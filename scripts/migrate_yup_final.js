#!/usr/bin/env node
/**
 * Combined Z-Up → Y-Up Migration Script (Fixed)
 * Phase 1: rotation.z→y, rotation.x=PI/2→0, baseZ→baseY, camera.up
 * Phase 2: Swap 2nd↔3rd args in position.set, BoxGeometry, Vector3, lookAt
 */

const fs = require('fs');
const path = require('path');

function extractArgs(content, startIdx) {
  let depth = 0;
  let args = [];
  let current = '';
  for (let i = startIdx + 1; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; current += ch; }
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) { if (current.trim()) args.push(current.trim()); return { args, endIdx: i }; }
      depth--; current += ch;
    } else if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  return { args, endIdx: args.length ? startIdx : -1 };
}

function swapArgsInCall(content, searchPattern) {
  let changes = 0, searchStart = 0;
  while (true) {
    const idx = content.indexOf(searchPattern, searchStart);
    if (idx === -1) break;
    // The opening '(' is the last char of the searchPattern
    const parenIdx = idx + searchPattern.length - 1;
    const { args, endIdx } = extractArgs(content, parenIdx);
    if (args.length === 3 && endIdx > parenIdx) {
      const oldCall = content.slice(idx, endIdx + 1);
      const newCall = searchPattern + args[0] + ', ' + args[2] + ', ' + args[1] + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++;
      searchStart = idx + newCall.length;
    } else {
      searchStart = parenIdx + 1;
    }
  }
  return { content, changes };
}

function swapVector3(content) {
  let changes = 0, searchStart = 0;
  const pat = 'new THREE.Vector3(';
  while (true) {
    const idx = content.indexOf(pat, searchStart);
    if (idx === -1) break;
    const parenIdx = idx + pat.length - 1;
    const { args, endIdx } = extractArgs(content, parenIdx);
    if (args.length === 3 && endIdx > parenIdx) {
      const [a0, a1, a2] = args.map(a => a.trim());
      if (a0 === '0' && a1 === '0' && a2 === '1') {
        const newCall = 'new THREE.Vector3(0, 1, 0)';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        changes++; searchStart = idx + newCall.length; continue;
      }
      if (a0 === '0' && a1 === '1' && a2 === '0') { searchStart = endIdx + 1; continue; }
      const newCall = 'new THREE.Vector3(' + a0 + ', ' + a2 + ', ' + a1 + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++; searchStart = idx + newCall.length;
    } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
  }
  return { content, changes };
}

const files = [
  'src/components/game/scene.ts',
  'src/components/game/helpers.ts',
];

let totalChanges = 0;

for (const relPath of files) {
  const filePath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) { console.log(`SKIP: ${relPath}`); continue; }

  let content = fs.readFileSync(filePath, 'utf-8');
  let fc = 0;

  // === PHASE 1: Simple text replacements ===
  // camera.up.set(0, 0, 1) → (0, 1, 0)
  { const re = /camera\.up\.set\(0,\s*0,\s*1\)/g; const m = content.match(re); if (m) { content = content.replace(re, 'camera.up.set(0, 1, 0)'); fc += m.length; } }

  // position.z = val → position.y = val
  { const re = /(\w+(?:\.\w+)*)\.position\.z\s*=/g; let m; const reps = [];
    while ((m = re.exec(content)) !== null) { reps.push({ s: m.index, e: m.index + m[0].length, r: m[0].replace('.position.z', '.position.y') }); }
    for (const r of reps.reverse()) { content = content.slice(0, r.s) + r.r + content.slice(r.e); } fc += reps.length; }

  // rotation.z = val → rotation.y = val (yaw)
  { const re = /(\w+(?:\.\w+)*)\.rotation\.z\s*=/g; let m; const reps = [];
    while ((m = re.exec(content)) !== null) {
      const ls = content.lastIndexOf('\n', m.index);
      const line = content.slice(ls, m.index);
      if (line.includes('//') || line.includes('*')) continue;
      reps.push({ s: m.index, e: m.index + m[0].length, r: m[0].replace('.rotation.z', '.rotation.y') });
    }
    for (const r of reps.reverse()) { content = content.slice(0, r.s) + r.r + content.slice(r.e); } fc += reps.length; }

  // rotation.set(PI/2, 0, 0) → rotation.set(0, 0, 0)
  { const re = /(\w+(?:\.\w+)*)\.rotation\.set\((?:Math\.PI|PI)\s*\/\s*2,\s*0,\s*0\)/g; const m = content.match(re); if (m) { content = content.replace(re, '$1.rotation.set(0, 0, 0)'); fc += m.length; } }

  // rotation.x = PI/2 (standalone) → rotation.x = 0
  { const re = /(\w+(?:\.\w+)*)\.rotation\.x\s*=\s*(?:Math\.PI|PI)\s*\/\s*2(?!\s*[,)])/g; let m; const reps = [];
    while ((m = re.exec(content)) !== null) {
      const ls = content.lastIndexOf('\n', m.index);
      const line = content.slice(ls, m.index);
      if (line.includes('//') || line.includes('*')) continue;
      reps.push({ s: m.index, e: m.index + m[0].length, r: m[0].replace(/(?:Math\.PI|PI)\s*\/\s*2/, '0') });
    }
    for (const r of reps.reverse()) { content = content.slice(0, r.s) + r.r + content.slice(r.e); } fc += reps.length; }

  // baseZ → baseY, camZ → camY
  { const m1 = content.match(/\bbaseZ\b/g); if (m1) { content = content.replace(/\bbaseZ\b/g, 'baseY'); fc += m1.length; } }
  { const m1 = content.match(/\bcamZ\b/g); if (m1) { content = content.replace(/\bcamZ\b/g, 'camY'); fc += m1.length; } }

  // === PHASE 2: Swap 2nd↔3rd args ===

  // position.set(x, y, z) → position.set(x, z, y)
  {
    let searchStart = 0;
    while (true) {
      const idx = content.indexOf('.position.set(', searchStart);
      if (idx === -1) break;
      const parenIdx = idx + '.position.set('.length - 1;
      const { args, endIdx } = extractArgs(content, parenIdx);
      if (args.length === 3 && endIdx > parenIdx) {
        const oldCall = content.slice(idx, endIdx + 1);
        const newCall = '.position.set(' + args[0] + ', ' + args[2] + ', ' + args[1] + ')';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        fc++; searchStart = idx + newCall.length;
      } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
    }
  }

  // BoxGeometry(w, d, h) → BoxGeometry(w, h, d)
  {
    const result = swapArgsInCall(content, 'new THREE.BoxGeometry(');
    content = result.content; fc += result.changes;
  }

  // new THREE.Vector3(x, y, z) → swap + handle up vectors
  {
    const result = swapVector3(content);
    content = result.content; fc += result.changes;
  }

  // .lookAt(x, y, z) → .lookAt(x, z, y) — skip single-arg lookAt(vector)
  {
    let searchStart = 0;
    while (true) {
      const idx = content.indexOf('.lookAt(', searchStart);
      if (idx === -1) break;
      const parenIdx = idx + '.lookAt('.length - 1;
      const { args, endIdx } = extractArgs(content, parenIdx);
      if (args.length === 3 && endIdx > parenIdx) {
        const oldCall = content.slice(idx, endIdx + 1);
        const newCall = '.lookAt(' + args[0] + ', ' + args[2] + ', ' + args[1] + ')';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        fc++; searchStart = idx + newCall.length;
      } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
    }
  }

  if (fc > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`${relPath}: ${fc} changes`);
    totalChanges += fc;
  } else {
    console.log(`${relPath}: no changes`);
  }
}
console.log(`\nTotal: ${totalChanges}`);
