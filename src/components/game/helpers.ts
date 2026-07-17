import type { Hitbox, CustomerRequest, Vec2, DataProcessingStep, SparkyQuestStage, ScrapPartId, GameGoal, RoomType } from './types';
import type { RobotVisual } from './scene';
import { WALK_BOB_SPEED } from './scene';
import * as THREE from 'three';

export function isInsideHitbox(point: Vec2, hitbox: Hitbox) {
  if (hitbox.shape === 'circle') {
    const dx = point.x - hitbox.center.x;
    const dy = point.y - hitbox.center.y;
    return Math.hypot(dx, dy) <= hitbox.radius;
  }
  const dx = Math.abs(point.x - hitbox.center.x);
  const dy = Math.abs(point.y - hitbox.center.y);
  return dx <= hitbox.halfWidth && dy <= hitbox.halfHeight;
}

export function collidesWithAny(point: Vec2, hitboxes: Hitbox[]) {
  for (let i = 0; i < hitboxes.length; i++) {
    if (isInsideHitbox(point, hitboxes[i])) return true;
  }
  return false;
}

export function escapeHtml(input: string) {
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function highlightJava(input: string) {
  const re = /"(?:[^"\\\n]|\\.)*"|\b(String|int|double|boolean|char|float|long|short|byte)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b(?=\s*=)/g;
  let out = '', last = 0;
  for (const m of input.matchAll(re)) {
    const v = m[0], i = m.index ?? 0;
    out += escapeHtml(input.slice(last, i));
    if (v.startsWith('"')) out += `<span style="color:#f59e0b">${escapeHtml(v)}</span>`;
    else if (m[1]) out += `<span style="color:#60a5fa">${escapeHtml(v)}</span>`;
    else out += `<span style="color:#a78bfa">${escapeHtml(v)}</span>`;
    last = i + v.length;
  }
  return out + escapeHtml(input.slice(last));
}

export function pickRandom<T>(items: T[]) { return items[Math.floor(Math.random() * items.length)]; }

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getWorkshopRequestSignature(request: CustomerRequest) {
  if (request.requestType === 'data-processing' && request.dataSteps) {
    const sig = request.dataSteps.map(s => s.expectedCode.join('|')).join('||');
    return `dp:${sig}`;
  }
  return `${request.required.slice().sort().join('+')}|${request.petName}|${request.petColor}|${request.petSize}`;
}

// ── Data Processing Templates ──

interface DataTemplate {
  givenInfo: string[];
  expectedCode: string[];
  description: string;
}

// Type A: Expression only — variables are shown, player writes the computation
// Type B: Full declaration — player writes everything

const COLORS = ['Red', 'Blue', 'Green', 'Gold', 'Silver', 'Bronze', 'Crimson', 'Violet', 'Amber', 'Teal'];
const NAMES = ['Buddy', 'Max', 'Charlie', 'Rocky', 'Daisy', 'Luna', 'Cooper', 'Milo', 'Ollie', 'Zoe'];

function randomizeValue(val: string): string {
  if (val === '$age') return String(randInt(10, 75));
  if (val === '$smallAge') return String(randInt(3, 12));
  if (val === '$size') return String(randInt(1, 12));
  if (val === '$temp') return String(randInt(350, 410) / 10);
  if (val === '$a') return String(randInt(5, 50));
  if (val === '$b') return String(randInt(5, 50));
  if (val === '$dogs') return String(randInt(1, 6));
  if (val === '$score') return String(randInt(50, 100));
  if (val === '$foodMult') return String(randInt(3, 8));
  if (val === '$healthScore') return String(randInt(60, 99));
  if (val === '$color') return COLORS[randInt(0, COLORS.length - 1)];
  if (val === '$name') return NAMES[randInt(0, NAMES.length - 1)];
  return val;
}

function randomizeCodeLine(line: string): string {
  return line.replace(/\$[a-zA-Z]+/g, randomizeValue);
}

const DATA_TEMPLATES: DataTemplate[] = [
  // Type A — Expression only (variables given, player writes computation)
  {
    givenInfo: ['int size = $size;'],
    expectedCode: ['int doublePortion = $size * 2;'],
    description: 'Double the portion size.',
  },
  {
    givenInfo: ['String color = "$color";'],
    expectedCode: ['int colorLen = color.length();'],
    description: 'Find the length of the color name.',
  },
  {
    givenInfo: ['String name = "$name";'],
    expectedCode: ['String shout = name.toUpperCase();'],
    description: 'Convert the pet name to uppercase.',
  },
  {
    givenInfo: ['double temp = $temp;'],
    expectedCode: ['int rounded = (int) $temp;'],
    description: 'Round the temperature down.',
  },
  {
    givenInfo: ['int a = $a;', 'int b = $b;'],
    expectedCode: ['int bigger = Math.max($a, $b);'],
    description: 'Find the larger of the two values.',
  },
  {
    givenInfo: ['int dogs = $dogs;'],
    expectedCode: ['int totalFood = $dogs * $foodMult;'],
    description: 'Total food is dogs times portion multiplier.',
  },
  // Type B — Full declaration (player writes everything)
  {
    givenInfo: [],
    expectedCode: ['int size = $size;', 'int doublePortion = $size * 2;'],
    description: 'Declare the size variable, then double it.',
  },
  {
    givenInfo: [],
    expectedCode: ['String color = "$color";', 'int colorLen = color.length();'],
    description: 'Declare the color, then find its length.',
  },
  {
    givenInfo: [],
    expectedCode: ['double temp = $temp;', 'int rounded = (int) $temp;'],
    description: 'Declare the temperature, then cast it to an int.',
  },
  {
    givenInfo: [],
    expectedCode: ['int score = $score;', 'int bonus = (int) Math.sqrt($score);'],
    description: 'Declare the score, then compute its square root as int.',
  },
];

export function createDataRequest(customerName: string): { dataSteps: DataProcessingStep[] } {
  const template = pickRandom(DATA_TEMPLATES);
  const dataSteps: DataProcessingStep[] = [{
    givenInfo: template.givenInfo.map(randomizeCodeLine),
    expectedCode: template.expectedCode.map(randomizeCodeLine),
    description: template.description,
  }];
  return { dataSteps };
}

// ── Workshop Code Validation ──

function checkLine(n: string, req: string, expectedType: string, expectedValue: string) {
  if (!n.includes(';')) return 'Missing semicolon at the end (;).';
  const typeMatch = n.match(/^\s*(String|int|double|boolean|char)\b/);
  if (!typeMatch) return `Start with the correct type: use ${expectedType}.`;
  if (typeMatch[1] !== expectedType) return `Wrong type. Use ${expectedType} for this field, not ${typeMatch[1]}.`;
  const varNameMatch = n.match(/^\s*(?:String|int|double|boolean|char)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (varNameMatch) {
    const vn = varNameMatch[1];
    if (vn[0] !== vn[0].toLowerCase()) return `Java convention: variable names should start with a lowercase letter (camelCase). Use something like \`${vn[0].toLowerCase() + vn.slice(1)}\`.`;
  }
  const eqMatch = n.includes('=');
  if (!eqMatch) return 'Use = to assign a value.';
  if (expectedType === 'String') {
    const hasQuotes = /"[^"\n]*"/.test(n);
    if (!hasQuotes) return 'String values must be wrapped in double quotes: use " around the value.';
    const valMatch = n.match(/"([^"]*)"/);
    if (valMatch && valMatch[1] !== expectedValue) return `Wrong value. Expected "${expectedValue}", got "${valMatch[1]}".`;
    const correctAssign = new RegExp(`String\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*"${expectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*;`);
    if (!correctAssign.test(n)) return `Check the full shape: \`String name = "${expectedValue}";\``;
  } else if (expectedType === 'boolean') {
    const valMatch = n.match(/=\s*(\S+)\s*;/);
    if (valMatch && valMatch[1] !== 'true' && valMatch[1] !== 'false') return `Use \`true\` or \`false\` for boolean values, got "${valMatch[1]}".`;
    if (valMatch && valMatch[1] !== String(expectedValue)) return `Wrong value. Expected ${expectedValue}, got ${valMatch[1]}.`;
    const correctAssign = new RegExp(`boolean\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*${expectedValue}\\s*;`);
    if (!correctAssign.test(n)) return `Check the full shape: \`boolean name = ${expectedValue};\``;
  } else if (expectedType === 'double') {
    const valMatch = n.match(/=\s*(\S+)\s*;/);
    if (valMatch && !/^-?\d+(\.\d+)?$/.test(valMatch[1])) return `Use a number for double values, got "${valMatch[1]}".`;
    if (valMatch && parseFloat(valMatch[1]) !== parseFloat(String(expectedValue))) return `Wrong value. Expected ${expectedValue}, got ${valMatch[1]}.`;
    const correctAssign = new RegExp(`double\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*${parseFloat(String(expectedValue))}\\s*;`);
    if (!correctAssign.test(n)) return `Check the full shape: \`double name = ${expectedValue};\``;
  } else {
    const valMatch = n.match(/=\s*(\S+)\s*;/);
    if (valMatch && valMatch[1] !== String(expectedValue)) return `Wrong value. Expected ${expectedValue}, got ${valMatch[1]}.`;
    const correctAssign = new RegExp(`int\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=\\s*${expectedValue}\\s*;`);
    if (!correctAssign.test(n)) return `Check the full shape: \`int name = ${expectedValue};\``;
  }
  return null;
}

export function validateWorkshopCode(input: string, request: CustomerRequest) {
  if (request.requestType === 'data-processing' && request.dataSteps) {
    return validateDataProcessingCode(input, request.dataSteps);
  }
  // Spec-sheet validation: any-order matching
  if (request.isSpecSheet && request.specSheetPrompts?.length) {
    const n = input.replace(/\s+/g, ' ').trim();
    if (!n) return { valid: false, error: 'Write some code first.' };
    if (!n.endsWith(';')) return { valid: false, error: 'Missing semicolon at the end (;).' };
    const lines = n.split(';').filter(l => l.trim()).map(l => l.trim() + ';');
    const totalExpected = request.required.length + request.specSheetPrompts.length;
    if (lines.length < totalExpected) return { valid: false, error: `You need ${totalExpected} statements in any order.` };
    if (lines.length > totalExpected) return { valid: false, error: `Too many statements. You only need ${totalExpected}.` };

    const reqToValSpec = (r: string) => r === 'name' ? request.petName : r === 'color' ? request.petColor : r === 'size' ? String(request.petSize) : r === 'version' ? '1.0' : 'true';
    const reqToTypeSpec = (r: string) => r === 'size' ? 'int' : r === 'hasWireSurge' ? 'boolean' : r === 'version' ? 'double' : 'String';

    // Build all expected declarations
    type Expect = { name: string; type: string; value: string; label: string };
    const expects: Expect[] = [];
    for (const req of request.required) expects.push({ name: req, type: reqToTypeSpec(req), value: reqToValSpec(req), label: req });
    for (const p of request.specSheetPrompts) expects.push({ name: p.expectedName, type: p.expectedType, value: p.expectedValue, label: `${p.expectedType} ${p.expectedName}` });

    const used = new Array(expects.length).fill(false);
    for (const line of lines) {
      let matched = false;
      for (let i = 0; i < expects.length; i++) {
        if (used[i]) continue;
        if (checkLine(line, expects[i].name, expects[i].type, expects[i].value) === null) {
          used[i] = true; matched = true; break;
        }
      }
      if (!matched) {
        // Show best error from first unmatched expectation
        for (let i = 0; i < expects.length; i++) {
          if (used[i]) continue;
          const hint = checkLine(line, expects[i].name, expects[i].type, expects[i].value);
          if (hint) return { valid: false, error: `${hint} (looking for: ${expects[i].label})` };
        }
        return { valid: false, error: `Couldn't match this line to any expected declaration.` };
      }
    }
    const missing = expects.filter((_, i) => !used[i]);
    if (missing.length) return { valid: false, error: `Missing: ${missing.map(m => m.label).join(', ')}` };
    return { valid: true, error: '' };
  }
  const n = input.replace(/\s+/g, ' ').trim();
  if (!n) return { valid: false, error: 'Write some code first.' };
  if (!n.endsWith(';')) return { valid: false, error: 'Missing semicolon at the end (;).' };
  const lines = n.split(';').filter(l => l.trim()).map(l => l.trim() + ';');
  if (lines.length < request.required.length) return { valid: false, error: `You need ${request.required.length} statement${request.required.length > 1 ? 's' : ''}. Use separate lines or semicolons.` };
  if (lines.length > request.required.length) return { valid: false, error: `Too many statements. You only need ${request.required.length} line${request.required.length > 1 ? 's' : ''}.` };

  const reqToVal = (r: string) => r === 'name' ? request.petName : r === 'color' ? request.petColor : r === 'hasWireSurge' ? 'true' : r === 'version' ? '1.0' : String(request.petSize);
  const reqToType = (r: string) => r === 'size' ? 'int' : r === 'hasWireSurge' ? 'boolean' : r === 'version' ? 'double' : 'String';

  for (let i = 0; i < request.required.length; i++) {
    const req = request.required[i];
    const hint = checkLine(lines[i], req, reqToType(req), reqToVal(req));
    if (hint) return { valid: false, error: hint };
  }
  return { valid: true, error: '' };
}

// ── Data Processing Validation ──

/**
 * Normalize whitespace for comparison.
 */
function norm(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a code line matches an expected pattern, allowing numeric values to differ.
 * For lines with exact numbers (declarations), we check type + name + operator shape.
 * For boolean expressions, we check the operator shape.
 */
function lineMatches(codeLine: string, expectedLine: string): string | null {
  const c = norm(codeLine);
  const e = norm(expectedLine);
  if (!c.endsWith(';')) return 'Missing semicolon at the end (;).';

  // Parse both into tokens
  const cParts = c.replace(';', '').trim().split(/\s+/);
  const eParts = e.replace(';', '').trim().split(/\s+/);

  // Check declaration: type matches
  const typePattern = /^(String|int|double|boolean|char)\b/;
  const cType = c.match(typePattern)?.[1];
  const eType = e.match(typePattern)?.[1];
  if (cType && eType && cType !== eType) {
    return `Wrong type. Expected ${eType}, got ${cType}.`;
  }

  // For compound expressions (no type, like +=), check pattern
  if (!cType && !eType) {
    // Both are compound/expression lines — check operator presence
    if (e.includes('+=') && !c.includes('+=')) return 'Use the += operator.';
    if (e.includes('-=') && !c.includes('-=')) return 'Use the -= operator.';
    if (e.includes('>=') && !c.includes('>=')) return 'Use the >= operator.';
    if (e.includes('<=') && !c.includes('<=')) return 'Use the <= operator.';
    if (e.includes('>') && !c.includes('>')) return 'Use the > operator.';
    if (e.includes('<') && !c.includes('<')) return 'Use the < operator.';
  }

  // Check variable name case (camelCase)
  const varMatchC = c.match(/^\s*(?:String|int|double|boolean|char)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (varMatchC) {
    const vn = varMatchC[1];
    if (vn[0] !== vn[0].toLowerCase()) {
      return `Variable names should start with a lowercase letter (camelCase). Try \`${vn[0].toLowerCase() + vn.slice(1)}\`.`;
    }
  }

  // Check declared variable name matches expected
  const varMatchE = e.match(/^\s*(?:String|int|double|boolean|char)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (varMatchE) {
    const expectedVar = varMatchE[1];
    if (!varMatchC || varMatchC[1] !== expectedVar) {
      return `Variable name should be \`${expectedVar}\`, not \`${varMatchC ? varMatchC[1] : '(none found)'}\`.`;
    }
  }

  // Check method calls match
  const methodPattern = /\.(length|charAt|substring|indexOf|equals|compareTo|abs|pow|sqrt|max|random|parseInt|nextInt)\(/g;
  const cMethods = [...c.matchAll(methodPattern)].map(m => m[1]);
  const eMethods = [...e.matchAll(methodPattern)].map(m => m[1]);
  if (eMethods.length > 0) {
    for (const m of eMethods) {
      if (!c.includes(`.${m}(`)) return `Call .${m}() on the appropriate variable.`;
    }
  }

  return null;
}

export function validateDataProcessingCode(input: string, steps: DataProcessingStep[]): { valid: boolean; error: string } {
  const n = input.replace(/\s+/g, ' ').trim();
  if (!n) return { valid: false, error: 'Write some code first.' };
  if (!n.endsWith(';')) return { valid: false, error: 'Missing semicolon at the end (;).' };

  const allExpected = steps.flatMap(s => s.expectedCode);
  const lines = n.split(';').filter(l => l.trim()).map(l => l.trim() + ';');

  if (lines.length < allExpected.length) {
    return { valid: false, error: `You need ${allExpected.length} statement${allExpected.length > 1 ? 's' : ''}. You wrote ${lines.length}.` };
  }
  if (lines.length > allExpected.length) {
    return { valid: false, error: `Too many statements. You only need ${allExpected.length} line${allExpected.length > 1 ? 's' : ''}.` };
  }

  for (let i = 0; i < allExpected.length; i++) {
    const err = lineMatches(lines[i], allExpected[i]);
    if (err) return { valid: false, error: `Line ${i + 1}: ${err}` };
  }

  return { valid: true, error: '' };
}

// ── Cutscene 3D Helpers ──

export function createCardboardBox(): { group: THREE.Group; lid: THREE.Mesh } {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshToonMaterial({ color: 0xc8944a });
  const innerMat = new THREE.MeshToonMaterial({ color: 0x92400e });
  const tapeMat = new THREE.MeshToonMaterial({ color: 0x92400e });

  const t = 0.025;
  const h = 0.325;
  const w = 0.6;

  // Bottom panel
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, t, w), innerMat);
  bottom.position.set(0, t / 2, 0);
  group.add(bottom);

  // North wall
  const north = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), boxMat);
  north.position.set(0, t / 2 + h / 2, -w / 2 - t / 2);
  group.add(north);

  // South wall
  const south = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), boxMat);
  south.position.set(0, t / 2 + h / 2, (w / 2 - t / 2));
  group.add(south);

  // East wall
  const east = new THREE.Mesh(new THREE.BoxGeometry(t, h, w), boxMat);
  east.position.set(w / 2 - t / 2, t / 2 + h / 2, 0);
  group.add(east);

  // West wall
  const west = new THREE.Mesh(new THREE.BoxGeometry(t, h, w), boxMat);
  west.position.set(-(w / 2 - t / 2), t / 2 + h / 2, 0);
  group.add(west);

  // Tape stripes on side walls
  for (let s = -1; s <= 1; s += 2) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.04, t, 0.62), tapeMat);
    tape.position.set(s * 0.28, t + h, 0);
    group.add(tape);
  }

  // Lid — hinged at north edge (pivotY = 0.2875)
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.04, 0.58), boxMat);
  lid.position.set(0, t + h + 0.02, 0);
  lid.userData.pivotX = 0;
  lid.userData.pivotY = 0.2875;
  group.add(lid);

  // Lid tape — parent to lid so it rotates with it
  const lidTape = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.5), tapeMat);
  lidTape.position.set(0, t + h + 0.045, 0);
  lid.add(lidTape);

  return { group, lid };
}

export function openBoxLid(lid: THREE.Mesh, progress: number) {
  const pivotY = (lid.userData.pivotY as number) || 0;
  const lidZ = lid.position.z;
  const angle = -progress * Math.PI / 3;
  // Rotate around x-axis at the north edge (pivotY)
  // Lid tilts upward from its north hinge
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  lid.position.y = pivotY * (1 - cosA);
  lid.position.y = lidZ - pivotY * sinA;
  lid.rotation.x = angle;
  lid.rotation.y = 0;
}

export function createLaptop(): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshToonMaterial({ color: 0x334155 });
  const lidMat = new THREE.MeshToonMaterial({ color: 0x1e293b });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.8, depthWrite: false });
  const darkMat = new THREE.MeshToonMaterial({ color: 0x0f172a });

  const baseW = 0.6, baseD = 0.35, baseH = 0.025, lidH = baseD;

  const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseD), baseMat);
  base.position.set(0, baseH / 2, 0);
  group.add(base);

  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.004, 0.14), darkMat);
  kb.position.set(0, baseH + 0.002, 0.03);
  group.add(kb);

  const screenGroup = new THREE.Group();
  screenGroup.position.set(0, baseH, baseD / 2);
  screenGroup.rotation.x = 0;

  const lid = new THREE.Mesh(new THREE.BoxGeometry(baseW, 0.02, lidH), lidMat);
  lid.position.set(0, 0, -lidH / 2);
  lid.renderOrder = 0;
  screenGroup.add(lid);

  const display = new THREE.Mesh(new THREE.BoxGeometry(baseW - 0.04, 0.006, lidH - 0.04), screenMat);
  display.name = 'laptop-display';
  display.position.set(0, -0.030, -lidH / 2);
  display.renderOrder = 1;
  screenGroup.add(display);

  group.add(screenGroup);

  const usbPort = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.028), darkMat);
  usbPort.name = 'usb-port';
  usbPort.position.set(-baseW / 2, baseH / 2, baseD / 2 + 0.02);
  group.add(usbPort);
  return group;
}

export function createWire(length = 0.55): THREE.Mesh {
  const wireMat = new THREE.MeshToonMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 1,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.5,
  });

  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length, 6), wireMat);
  return wire;
}

export function createWireCoil(): THREE.Mesh {
  const mat = new THREE.MeshToonMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 1,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.5,
  });
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), mat);
  coil.position.y = 0.1;
  return coil;
}

export function animateWirePulse(wire: THREE.Mesh, time: number) {
  const intensity = 0.3 + 0.7 * Math.abs(Math.sin(time * 3));
  const mat = wire.material as THREE.MeshToonMaterial;
  if (mat.emissiveIntensity !== undefined) {
    mat.emissiveIntensity = intensity;
  }
}

export function hashColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360}, 72%, 58%)`;
}

export function createPartIcon(partId: string): string {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  if (partId === 'battery') {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath(); ctx.roundRect(14, 10, 36, 44, 6); ctx.fill();
    ctx.strokeStyle = '#166534'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.roundRect(24, 3, 16, 8, 3); ctx.fill();
    ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.roundRect(28, 1, 8, 3, 1); ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath(); ctx.roundRect(28, 52, 8, 6, 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const barY = 22 + i * 10;
      const brightness = i === 2 ? '#4ade80' : i === 1 ? '#86efac' : '#bbf7d0';
      ctx.fillStyle = brightness;
      if (i === 2) { ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 4; }
      ctx.beginPath(); ctx.roundRect(20, barY, 24, 6, 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', 32, 10);
    ctx.fillText('−', 32, 58);
  } else if (partId === 'letter') {
    ctx.fillStyle = '#f5e6c8';
    ctx.beginPath(); ctx.roundRect(8, 14, 48, 34, 3); ctx.fill();
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 14); ctx.lineTo(32, 32); ctx.lineTo(56, 14); ctx.stroke();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(32, 32, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(12, 40, 40, 2);
    ctx.fillRect(12, 44, 28, 2);
  }
  return c.toDataURL();
}

export interface BuildingFootprint {
  x1: number; y1: number; x2: number; y2: number;
}

const ROOM_HALF: Record<string, number> = {
  workshop: 5.3, apartment: 4.0, shop: 1.8,
};

export function computeCameraZoom(
  camX: number, camY: number,
  inside: boolean,
  room: string,
  buildingFootprints: BuildingFootprint[],
): { fov: number; camDist: number; lookDist: number; height: number } {
  const BASE = { fov: 65, camDist: 2.2, lookDist: 2.5, height: 1.8 };
  const ZOOMED = { fov: 60, camDist: 2.0, lookDist: 2.1, height: 1.7 };
  const ZOOM_RANGE = 2.0;

  let minDist = Infinity;

  if (inside) {
    const half = ROOM_HALF[room];
    if (half !== undefined) {
      const dx = half - Math.abs(camY);
      const dy = half - Math.abs(camX);
      minDist = Math.min(dx, dy);
      // Adjust base values for rooms
      BASE.camDist = 1.4;
      BASE.lookDist = 1.6;
      BASE.height = 1.2;
      ZOOMED.camDist = 0.6;
      ZOOMED.lookDist = 0.7;
      ZOOMED.height = 1.0;
    }
  } else {
    for (const fp of buildingFootprints) {
      const dx = camX < fp.x1 ? fp.x1 - camX : camX > fp.x2 ? camX - fp.x2 : 0;
      const dy = camY < fp.y1 ? fp.y1 - camY : camY > fp.y2 ? camY - fp.y2 : 0;
      const d = Math.hypot(dx, dy);
      if (d < minDist) minDist = d;
    }
  }

  if (!isFinite(minDist)) minDist = ZOOM_RANGE;

  const t = Math.max(0, Math.min(1, 1 - (minDist - 0.3) / (ZOOM_RANGE - 0.3)));

  return {
    fov: BASE.fov + (ZOOMED.fov - BASE.fov) * t * t,
    camDist: BASE.camDist + (ZOOMED.camDist - BASE.camDist) * t,
    lookDist: BASE.lookDist + (ZOOMED.lookDist - BASE.lookDist) * t,
    height: BASE.height + (ZOOMED.height - BASE.height) * t,
  };
}

export function computeGoal(
  stage: SparkyQuestStage,
  backpack: ScrapPartId[],
  money: number,
  cutsceneDone: boolean,
  workshopIntroSeen: boolean,
  batteryInstalled: boolean,
): GameGoal {
  if (batteryInstalled) return 'free-roam';
  if (!cutsceneDone) return 'watch-cutscene';
  if (backpack.includes('letter')) return 'show-letter-to-rafiq';
  if (backpack.includes('battery')) return 'install-battery';
  if (money < 10) {
    if (stage === 'intro' && !workshopIntroSeen) return 'talk-to-sparky';
    return 'earn-money';
  }
  return 'buy-battery';
}

export function getMissionText(goal: GameGoal, money: number, stage: SparkyQuestStage): string {
  switch (goal) {
    case 'watch-cutscene': return '';
    case 'talk-to-sparky': return 'Talk to Sparky.';
    case 'show-letter-to-rafiq': return 'Show Sparky\'s letter to Rafiq at his workshop.';
    case 'earn-money': {
      if (stage === 'intro' || stage === 'intro-done') {
        return `Earn $10 at the workshop ($${Math.min(money, 10)}/$10 earned)`;
      }
      return `Earn $10 at Rafiq's workshop ($${Math.min(money, 10)}/$10 earned)`;
    }
    case 'buy-battery': return 'Buy the Battery Pack at the Parts Shop ($10).';
    case 'install-battery': return stage === 'intro' ? 'Talk to Sparky.' : 'Bring the battery to Sparky in the apartment!';
    case 'free-roam': return 'Scrap is fully repaired!';
  }
}

export function walkPlayer(
  pos: { x: number; y: number },
  target: { x: number; y: number },
  speed: number,
  delta: number,
  worldTime: number,
  baseY: number,
  visual: RobotVisual | null,
  leftLegPivot: THREE.Object3D | null,
  rightLegPivot: THREE.Object3D | null,
  yawRef: { current: number } | null,
): boolean {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.01) {
    if (leftLegPivot) leftLegPivot.rotation.x = 0;
    if (rightLegPivot) rightLegPivot.rotation.x = 0;
    if (visual) {
      visual.leftArm.rotation.x = -Math.PI / 2;
      visual.rightArm.rotation.x = -Math.PI / 2;
    }
    if (visual) visual.root.position.set(pos.x, baseY, -pos.y);
    return true;
  }
  const dirX = dx / dist;
  const dirY = dy / dist;
  pos.x += dirX * speed * delta;
  pos.y += dirY * speed * delta;
  if (yawRef) yawRef.current = Math.atan2(dirX, dirY);
  if (visual) {
    visual.root.position.set(pos.x, baseY + Math.sin(worldTime * 10) * 0.02, -pos.y);
  }
  const walkSwing = Math.sin(worldTime * WALK_BOB_SPEED) * 0.3;
  if (leftLegPivot) leftLegPivot.rotation.x = walkSwing;
  if (rightLegPivot) rightLegPivot.rotation.x = -walkSwing;
  const armSwing = Math.sin(worldTime * WALK_BOB_SPEED + Math.PI) * 0.2;
  if (visual) {
    visual.leftArm.rotation.x = -Math.PI / 2 + armSwing;
    visual.rightArm.rotation.x = -Math.PI / 2 - armSwing;
  }
  return false;
}
