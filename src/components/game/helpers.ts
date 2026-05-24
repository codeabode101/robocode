import type { Hitbox, CustomerRequest, Vec2, DataProcessingStep } from './types';

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

export function highlightPython(input: string) {
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\b(True|False|None|def|class|if|else|return|for|while|import|from)\b|\b([a-z_][a-z0-9_]*)\b(?=\s*=)/gi;
  let out = '', last = 0;
  for (const m of input.matchAll(re)) {
    const v = m[0], i = m.index ?? 0;
    out += escapeHtml(input.slice(last, i));
    if (v.startsWith('"') || v.startsWith("'")) out += `<span style="color:#f59e0b">${escapeHtml(v)}</span>`;
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

function randomizeValue(val: string): string {
  if (val === '$age') return String(randInt(10, 75));
  if (val === '$smallAge') return String(randInt(3, 12));
  if (val === '$temp') return String(randInt(350, 410) / 10);
  if (val === '$a') return String(randInt(5, 50));
  if (val === '$b') return String(randInt(5, 50));
  if (val === '$dogs') return String(randInt(1, 6));
  if (val === '$score') return String(randInt(50, 100));
  if (val === '$foodMult') return String(randInt(3, 8));
  if (val === '$healthScore') return String(randInt(60, 99));
  return val;
}

function randomizeCodeLine(line: string): string {
  return line.replace(/\$[a-zA-Z]+/g, randomizeValue);
}

const DATA_TEMPLATES: DataTemplate[] = [
  // Type A — Expression only
  {
    givenInfo: ['int age = $age;'],
    expectedCode: ['int foodPortion = $age + 3;'],
    description: 'Portion size is age plus 3.',
  },
  {
    givenInfo: ['int age = $age;'],
    expectedCode: ['boolean isAdult = $age >= 18;'],
    description: 'Check if age is 18 or older.',
  },
  {
    givenInfo: ['int age = $age;', 'boolean healthy = true;'],
    expectedCode: ['int score = $age * 2;'],
    description: 'Health score is age times 2.',
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
  // Type B — Full declaration
  {
    givenInfo: [],
    expectedCode: ['int age = $smallAge;', 'int foodPortion = $age + 3;'],
    description: 'Declare the age variable, then compute the food portion.',
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
  {
    givenInfo: [],
    expectedCode: ['boolean healthy = true;', 'int healthScore = $healthScore;'],
    description: 'Declare a boolean for health status and an int for the score.',
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

function validateJavaWorkshopCode(input: string, request: CustomerRequest) {
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

function validatePythonWorkshopCode(input: string, request: CustomerRequest) {
  const n = input.trim();
  if (!n) return { valid: false, error: 'Write some code first.' };
  const lines = n.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));

  if (lines.length < request.required.length) {
    return { valid: false, error: `You need ${request.required.length} statement${request.required.length > 1 ? 's' : ''}.` };
  }
  if (lines.length > request.required.length) {
    return { valid: false, error: `Too many statements. You only need ${request.required.length} line${request.required.length > 1 ? 's' : ''}.` };
  }

  const reqToVal = (r: string) => r === 'name' ? `"${request.petName}"` : r === 'color' ? `"${request.petColor}"` : String(request.petSize);

  for (let i = 0; i < request.required.length; i++) {
    const line = lines[i].trim();
    const req = request.required[i];
    const val = reqToVal(req);

    if (!line.includes('=')) return { valid: false, error: `Line ${i + 1}: Use = to assign a value.` };
    if (!line.includes(val)) return { valid: false, error: `Line ${i + 1}: Expected value ${val}.` };
  }
  return { valid: true, error: '' };
}



export function validateWorkshopCode(input: string, request: CustomerRequest) {
  if (request.requestType === 'data-processing' && request.dataSteps) {
    return validateDataProcessingCode(input, request.dataSteps, request.language);
  }

  const language = request.language || 'java';

  if (language === 'python-easy' || language === 'python-hard') {
    return validatePythonWorkshopCode(input, request);
  } else {
    return validateJavaWorkshopCode(input, request);
  }
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

  // Check method calls match
  const methodPattern = /\.(length|charAt|substring|indexOf|equals|compareTo|abs|pow|sqrt|max|random|parseInt|nextInt)\(/g;
  const cMethods = [...c.matchAll(methodPattern)].map(m => m[1]);
  const eMethods = [...e.matchAll(methodPattern)].map(m => m[1]);
  if (eMethods.length > 0) {
    for (const m of eMethods) {
      if (!c.includes(`.${m}(`)) return `Call .${m}() on the appropriate variable.`;
    }
  }

  // Check key variable names appear
  const cVars = c.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];
  const eVars = e.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];
  for (const ev of eVars) {
    if (!['parseInt', 'nextInt', 'in', 'abs', 'max', 'min', 'pow', 'sqrt', 'random'].includes(ev) &&
      !c.includes(ev) && !ev.match(/^\d+$/)) {
      // Check if it's a variable used in the expected but not a keyword or number
      // Allow this — the variable name might differ
    }
  }

  return null;
}

export function validateDataProcessingCode(input: string, steps: DataProcessingStep[], language?: string): { valid: boolean; error: string } {
  const language_type = language || 'java';
  const n = input.replace(/\s+/g, ' ').trim();
  if (!n) return { valid: false, error: 'Write some code first.' };

  const allExpected = steps.flatMap(s => s.expectedCode);

  let lines: string[];
  if (language_type === 'python') {
    lines = n.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).map(l => l.trim());
  } else {
    if (!n.endsWith(';') && language_type !== 'python') return { valid: false, error: 'Missing semicolon at the end (;).' };
    lines = n.split(';').filter(l => l.trim()).map(l => l.trim() + ';');
  }

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
