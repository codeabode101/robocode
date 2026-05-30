import type { Hitbox, CustomerRequest, Vec2, DataProcessingStep } from './types';
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
  return hitboxes.some(h => isInsideHitbox(point, h));
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
  const n = input.replace(/\s+/g, ' ').trim();
  if (!n) return { valid: false, error: 'Write some code first.' };
  if (!n.endsWith(';')) return { valid: false, error: 'Missing semicolon at the end (;).' };
  const lines = n.split(';').filter(l => l.trim()).map(l => l.trim() + ';');
  if (lines.length < request.required.length) return { valid: false, error: `You need ${request.required.length} statement${request.required.length > 1 ? 's' : ''}. Use separate lines or semicolons.` };
  if (lines.length > request.required.length) return { valid: false, error: `Too many statements. You only need ${request.required.length} line${request.required.length > 1 ? 's' : ''}.` };

  const reqToVal = (r: string) => r === 'name' ? request.petName : r === 'color' ? request.petColor : String(request.petSize);
  const reqToType = (r: string) => r === 'size' ? 'int' : 'String';

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
  const tapeMat = new THREE.MeshToonMaterial({ color: 0x92400e });

  // Base
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.35), boxMat);
  base.position.set(0, 0, 0.175);
  group.add(base);

  // Tape stripes
  for (let s = -1; s <= 1; s += 2) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.62, 0.36), tapeMat);
    tape.position.set(s * 0.28, 0, 0.175);
    group.add(tape);
  }

  // Flaps — lid is a single mesh representing the top flaps, pivoted at back edge
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.04), boxMat);
  lid.position.set(0, 0, 0.37);
  lid.userData.pivotX = 0;
  lid.userData.pivotY = -0.29;
  group.add(lid);

  // Lid tape
  const lidTape = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.05), tapeMat);
  lidTape.position.set(0, 0, 0.39);
  group.add(lidTape);

  return { group, lid };
}

export function openBoxLid(lid: THREE.Mesh, progress: number) {
  const pivotX = (lid.userData.pivotX as number) || 0;
  const pivotY = (lid.userData.pivotY as number) || 0;
  const angle = -progress * Math.PI / 2.2;
  // Translate to pivot, rotate, translate back
  lid.position.x = pivotX - pivotX * Math.cos(angle) + pivotY * Math.sin(angle);
  lid.position.y = pivotY - pivotX * Math.sin(angle) - pivotY * Math.cos(angle);
  lid.position.z = 0.37 + pivotX * Math.sin(angle);
  lid.rotation.z = angle;
}

export function createLaptop(): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshToonMaterial({ color: 0x1e293b });
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const emissiveMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 });

  // Base (keyboard area)
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.035), baseMat);
  base.position.set(0, 0, 0.017);
  group.add(base);

  // Screen — rotated back ~110deg from horizontal
  const screenGroup = new THREE.Group();
  screenGroup.position.set(0, 0, 0.017);
  screenGroup.rotation.x = 1.92; // ~110 degrees

  const screenBack = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.35, 0.025), baseMat);
  screenBack.position.set(0, 0, 0.26);
  screenGroup.add(screenBack);

  const screenFace = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.31, 0.01), emissiveMat);
  screenFace.position.set(0, 0, 0.273);
  screenGroup.add(screenFace);

  group.add(screenGroup);
  return group;
}

export function createWire(startPos: THREE.Vector3, endPos: THREE.Vector3): THREE.Mesh {
  const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(endPos, startPos);
  const len = dir.length();
  dir.normalize();

  const wireMat = new THREE.MeshToonMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.9,
    emissive: 0x3b82f6,
    emissiveIntensity: 0.5,
  });

  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, len, 6), wireMat);
  wire.position.copy(mid);

  // Orient cylinder along direction
  const up = new THREE.Vector3(0, 0, 1);
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
  wire.quaternion.copy(quat);

  return wire;
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

  if (partId === 'sensor') {
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.roundRect(8, 14, 48, 34, 4); ctx.fill();
    ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(24, 31, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(24, 30, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.roundRect(34, 24, 14, 12, 2); ctx.fill();
    ctx.strokeStyle = '#0d0d1a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 14); ctx.lineTo(40, 4); ctx.stroke();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(40, 3, 2.5, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(14 + i * 9, 47, 5, 4);
    }
  } else if (partId === 'voice') {
    ctx.fillStyle = '#2563eb';
    ctx.beginPath(); ctx.roundRect(12, 12, 40, 40, 8); ctx.fill();
    ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(32, 32, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(32, 32, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(32, 32, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath(); ctx.arc(32, 32, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.roundRect(26, 5, 12, 8, 3); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath(); ctx.roundRect(30, 3, 4, 3, 1); ctx.fill();
    ctx.fillStyle = '#22c55e'; ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 4;
    ctx.beginPath(); ctx.arc(46, 16, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(20 + i * 12, 50, 4, 4);
    }
  } else if (partId === 'navigation') {
    ctx.fillStyle = '#1b5e20';
    ctx.fillRect(6, 8, 52, 48);
    ctx.strokeStyle = '#0d3b0f'; ctx.lineWidth = 1; ctx.strokeRect(6, 8, 52, 48);
    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, 32); ctx.lineTo(22, 32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(42, 32); ctx.lineTo(54, 32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, 12); ctx.lineTo(32, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, 42); ctx.lineTo(32, 52); ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.roundRect(24, 24, 16, 16, 2); ctx.fill();
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.beginPath(); ctx.arc(28, 28, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.roundRect(42, 12, 8, 6, 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath(); ctx.arc(46, 15, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(12 + i * 11, 4, 4, 5);
      ctx.fillRect(12 + i * 11, 55, 4, 5);
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(3, 14 + i * 14, 4, 4);
      ctx.fillRect(57, 14 + i * 14, 4, 4);
    }
  }
  return c.toDataURL();
}

export interface BuildingFootprint {
  x1: number; y1: number; x2: number; y2: number;
}

const ROOM_HALF: Record<string, number> = {
  arena: 6.0, workshop: 5.3, apartment: 4.0, shop: 1.8,
};

export function computeCameraZoom(
  camX: number, camY: number,
  inside: boolean,
  room: string,
  buildingFootprints: BuildingFootprint[],
): { fov: number; camDist: number; lookDist: number; height: number } {
  const BASE = { fov: 65, camDist: 2.2, lookDist: 2.5, height: 1.8 };
  const ZOOMED = { fov: 50, camDist: 0.8, lookDist: 1.0, height: 1.2 };
  const ZOOM_RANGE = 3;

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
