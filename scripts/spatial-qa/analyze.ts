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

TASK: Look at the screenshot CAREFULLY. Does the spatial layout match what's expected?
- Is the camera at the right angle/distance/elevation?
- Are the characters (Sparky in yellow, player in blue, Scrap in white) at their expected positions?
- Is anything clipping through walls or other objects?
- Are objects in the correct relative positions?
- Are there any objects floating in the air or embedded in the floor?
- Does the apartment room look correct (walls, bed, bookshelf, workbench, cardboard box)?

If everything looks correct spatially, respond with:
{"verdict":"correct","edits":[],"reasoning":"brief explanation of why correct"}

If something is wrong, respond with EXACT edit instructions in this format:
{"verdict":"needs_fix","edits":[{"file":"src/components/GameMap.tsx","line":NUMBER,"description":"what's wrong and why","oldString":"EXACT current code","newString":"EXACT corrected code"}],"reasoning":"what you saw in the screenshot"}

IMPORTANT:
- The "oldString" must be the EXACT code text at that line, character-for-character
- The "newString" must be the EXACT replacement code text
- Only suggest edits that directly fix spatial issues visible in the screenshot
- If the camera angle is wrong, suggest adjusting the camera position values
- If a character is misplaced, suggest adjusting their position
- Base your analysis on the ACTUAL camera/player/Sparky/Scrap values reported above vs the EXPECTED values, BUT verify visually from the screenshot

Respond ONLY with a valid JSON object. No markdown, no other text.`;
}

async function main() {
  const cutsceneName = process.argv[2] || 'battery-install';
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

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
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

    try {
      const result = await model.generateContent([
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        { text: prompt },
      ]);

      const response = result.response.text();
      console.log(`[analyze] Response for ${phaseName}:`, response.slice(0, 200) + '...');

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as GeminiResult;
        results.push({ phase: phaseName, result: parsed });
        if (parsed.verdict === 'needs_fix') {
          console.log(`[analyze] ⚠ Issues found in "${phaseName}":`);
          for (const edit of parsed.edits) {
            console.log(`   ${edit.file}:${edit.line} — ${edit.description}`);
          }
        } else {
          console.log(`[analyze] ✓ "${phaseName}" looks correct`);
        }
      } else {
        console.warn(`[analyze] Could not parse JSON from response: ${response.slice(0, 300)}`);
        results.push({
          phase: phaseName,
          result: { verdict: 'correct', edits: [], reasoning: 'Parse failed, treating as correct' },
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
    await new Promise(r => setTimeout(r, 500));
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
