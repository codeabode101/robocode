import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { GEMINI_API_KEY, OUTPUT_DIR } from './config';

interface QaPhase {
  name: string;
  frame: number;
  timer: number;
  camera: { x: number; y: number; z: number };
  player: { x: number; y: number };
  sparky?: { x: number; y: number; z: number };
  scrap?: { x: number; y: number; z: number };
}

interface CaptureFrame {
  phaseIndex: number;
  phaseName: string;
  screenshotPath: string;
  metadata: QaPhase;
}

interface GroundTruth {
  cutscene: string;
  room: string;
  roomBounds: { xMin: number; xMax: number; yMin: number; yMax: number };
  coordinateSystem: string;
  phases: Record<string, {
    description: string;
    expected: Record<string, unknown>;
    code: {
      file: string;
      cameraLine: number;
      cameraSnippet: string;
    };
  }>;
}

interface GeminiEdit {
  file: string;
  line: number;
  description: string;
  oldString: string;
  newString: string;
}

interface GeminiResult {
  verdict: 'correct' | 'needs_fix';
  edits: GeminiEdit[];
  reasoning: string;
}

async function imageToBase64(filePath: string): Promise<string> {
  const data = fs.readFileSync(filePath);
  return data.toString('base64');
}

function buildPrompt(phaseName: string, groundTruth: GroundTruth, captured: QaPhase): string {
  const phaseData = groundTruth.phases[phaseName];
  if (!phaseData) throw new Error(`No ground truth for phase: ${phaseName}`);

  return `You are analyzing a screenshot from a 3D game cutscene for spatial correctness.

COORDINATE SYSTEM: Z points UP (vertical). XY plane is the ground. The camera is a perspective camera looking down at about 65° FOV. This is a toon-shaded 3D scene with vibrant colors.

CUTSCENE: ${groundTruth.cutscene}
ROOM: ${groundTruth.room} (bounds x: ${groundTruth.roomBounds.xMin}..${groundTruth.roomBounds.xMax}, y: ${groundTruth.roomBounds.yMin}..${groundTruth.roomBounds.yMax})

PHASE: ${phaseName}
DESCRIPTION: ${phaseData.description}

ACTUAL STATE (from game engine):
- Camera: (${captured.camera.x.toFixed(3)}, ${captured.camera.y.toFixed(3)}, ${captured.camera.z.toFixed(3)})
- Player: (${captured.player.x.toFixed(3)}, ${captured.player.y.toFixed(3)})
- Sparky: ${captured.sparky ? `(${captured.sparky.x.toFixed(3)}, ${captured.sparky.y.toFixed(3)}, ${captured.sparky.z.toFixed(3)})` : 'N/A'}
- Scrap: ${captured.scrap ? `(${captured.scrap.x.toFixed(3)}, ${captured.scrap.y.toFixed(3)}, ${captured.scrap.z.toFixed(3)})` : 'N/A'}

EXPECTED STATE (from design):
${JSON.stringify(phaseData.expected, null, 2)}

RELEVANT CODE (${phaseData.code.file}:${phaseData.code.cameraLine}):
\`\`\`
${phaseData.code.cameraSnippet}
\`\`\`

TASK: Critically evaluate the spatial polish and composition quality:
- Camera position/angle — is the framing good? Does it clip through the floor (camera Z < 0)?
- Sparky (yellow) or player (blue) at wrong locations or facing wrong direction
- Scrap wrong shape/position (should be cylinder normally, torus during open-chest/place-battery/chest-glow)
- Objects clipping through walls, floor, or each other
- Floating objects or objects embedded in the floor
- Camera movement — is the lerp noticeable? Does the camera ever reach the target?
- Lighting/shading issues — are characters properly lit?
- Battery prop visibility during place-battery phase — can you see the battery entering Scrap's chest?
- Sparky's walk direction in sparky-walk phase — is Sparky walking toward Scrap or away?
- Overall composition — does the shot look well-framed for a cutscene?

Respond ONLY with a JSON object (no markdown, no other text). Two allowed formats:

CORRECT: {"v":"ok"}

BUG: {"v":"bug","edits":[{"file":"src/components/GameMap.tsx","line":NUM,"desc":"brief description of spatial bug","old":"EXACT code string to replace","new":"EXACT replacement code string"}]}`;
}

async function main() {
  const cutsceneName = process.argv[2] || 'battery-install';
  const modelName = (process.argv[3] || 'gemini-2.5-flash-lite').replace('--model=', '');
  const outDir = path.join(OUTPUT_DIR, cutsceneName);
  const framesDir = path.join(outDir, 'frames');

  // Load captured metadata
  const metadataPath = path.join(outDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`No metadata found at ${metadataPath}. Run capture.ts first.`);
  }
  const metadata: { cutscene: string; frames: CaptureFrame[]; } = JSON.parse(
    fs.readFileSync(metadataPath, 'utf-8')
  );

  // Load ground truth
  const groundTruthPath = path.resolve(__dirname, 'prompts', `${cutsceneName}.json`);
  if (!fs.existsSync(groundTruthPath)) {
    throw new Error(`No ground truth at ${groundTruthPath}`);
  }
  const groundTruth: GroundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  console.log(`[analyze] Analyzing ${metadata.frames.length} frames for "${cutsceneName}"`);
  console.log(`[analyze] Using Gemini 1.5 Flash`);

  console.log(`[analyze] Using model: ${modelName}`);
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });

  const results: Array<{ phase: string; result: GeminiResult }> = [];

  for (const frame of metadata.frames) {
    const phaseName = frame.phaseName;
    const screenshotPath = path.join(framesDir, frame.screenshotPath);

    if (!fs.existsSync(screenshotPath)) {
      console.warn(`[analyze] Screenshot not found: ${screenshotPath}, skipping`);
      continue;
    }

    const prompt = buildPrompt(phaseName, groundTruth, frame.metadata);
    const imageBase64 = await imageToBase64(screenshotPath);

    console.log(`[analyze] Sending phase "${phaseName}" to Gemini...`);

    async function sendWithRetry(retries = 20) {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          return await model.generateContent([
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
            { text: prompt },
          ]);
        } catch (err: any) {
          // Extract retry delay from error details if available
          let wait = Math.pow(2, attempt) * 5000;
          if (err?.status === 429) {
            const details = err.errorDetails || [];
            for (const d of details) {
              if (d.retryDelay) {
                const seconds = parseFloat(d.retryDelay.replace('s', ''));
                if (!isNaN(seconds)) wait = Math.ceil(seconds * 1000) + 1000;
              }
            }
            if (attempt < retries - 1) {
              console.log(`[analyze] Rate limited, waiting ${Math.round(wait/1000)}s...`);
              await new Promise(r => setTimeout(r, wait));
              continue;
            }
          }
          if (err?.status === 503 && attempt < retries - 1) {
            const wait503 = 3000 + Math.random() * 4000;
            console.log(`[analyze] Model busy (503), retry ${attempt+1}/${retries-1}, waiting ${Math.round(wait503/1000)}s...`);
            await new Promise(r => setTimeout(r, wait503));
            continue;
          }
          throw err;
        }
      }
      throw new Error('All retries exhausted');
    }

    try {
      const result = await sendWithRetry(3);

      const response = result.response.text();
      console.log(`[analyze] Response for ${phaseName}:`, response.slice(0, 400) + '...');

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as any;
        const edits: GeminiEdit[] = parsed.v === 'bug' ? (parsed.edits || []).map((e: any) => ({
          file: e.file || 'src/components/GameMap.tsx',
          line: e.line || 0,
          description: e.desc || e.description || '',
          oldString: e.old || e.oldString || '',
          newString: e.new || e.newString || '',
        })) : [];
        const result: GeminiResult = { verdict: parsed.v === 'bug' ? 'needs_fix' : 'correct', edits, reasoning: '' };
        results.push({ phase: phaseName, result });
        if (result.verdict === 'needs_fix') {
          console.log(`[analyze] ⚠ "${phaseName}" has issues:`);
          for (const edit of result.edits) {
            console.log(`   ${edit.file}:${edit.line} — ${edit.description}`);
            if (edit.oldString) console.log(`      OLD: ${edit.oldString.slice(0, 80)}`);
            if (edit.newString) console.log(`      NEW: ${edit.newString.slice(0, 80)}`);
          }
        } else {
          console.log(`[analyze] ✓ "${phaseName}" looks correct`);
        }
      } else {
        console.warn(`[analyze] Could not parse JSON from response: ${response.slice(0, 300)}`);
        results.push({
          phase: phaseName,
          result: { verdict: 'correct', edits: [], reasoning: 'Parse failed' },
        });
      }
    } catch (err) {
      console.error(`[analyze] Error analyzing "${phaseName}":`, err);
      results.push({
        phase: phaseName,
        result: { verdict: 'correct', edits: [], reasoning: `Error: ${err}` },
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 12000));
  }

  // Save analysis results
  const analysisPath = path.join(outDir, 'gemini-analysis.json');
  const analysisOutput = {
    cutscene: cutsceneName,
    analyzedAt: new Date().toISOString(),
    totalFrames: results.length,
    issuesFound: results.filter(r => r.result.verdict === 'needs_fix').length,
    results,
  };
  fs.writeFileSync(analysisPath, JSON.stringify(analysisOutput, null, 2));
  console.log(`[analyze] Analysis saved to ${analysisPath}`);

  // Summary
  const issues = results.filter(r => r.result.verdict === 'needs_fix');
  const totalEdits = issues.reduce((sum, r) => sum + r.result.edits.length, 0);
  console.log(`\n[analyze] === SUMMARY ===`);
  console.log(`[analyze] Frames analyzed: ${results.length}`);
  console.log(`[analyze] Phases with issues: ${issues.length}`);
  console.log(`[analyze] Total edits suggested: ${totalEdits}`);

  if (totalEdits > 0) {
    console.log(`\n[analyze] Suggested edits:`);
    for (const issue of issues) {
      for (const edit of issue.result.edits) {
        console.log(`  ${edit.file}:${edit.line}`);
        console.log(`    → ${edit.description}`);
        console.log(`    OLD: ${edit.oldString}`);
        console.log(`    NEW: ${edit.newString}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('[analyze] Fatal error:', err);
  process.exit(1);
});
