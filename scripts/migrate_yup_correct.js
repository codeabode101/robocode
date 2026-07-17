#!/usr/bin/env node
/**
 * CORRECT Z-Up → Y-Up Migration
 * Mapping: (x, y, z) → (x, z, -y)
 * Y (north/south in Z-up) becomes -Y... no wait:
 * Old Y (north/south) → New Z
 * Old Z (height) → New Y
 * But Z-up is right-handed, Y-up is right-handed, so we need to negate one axis.
 * 
 * Z-up: X right, Y forward (north), Z up  (right-handed)
 * Y-up: X right, Y up, Z backward (south)  (right-handed)
 * 
 * So: old(x, y, z) → new(x, z, -y)
 * Because old Y=north maps to new Z=-north (south is +Z in Y-up... wait)
 * 
 * Actually in Three.js Y-up right-handed: X right, Y up, Z toward camera
 * For top-down: Z toward camera = south (if looking north)
 * So +Z = south, -Z = north
 * Old Y = north (positive), so new Z = -old_Y (negate to get south=negative Z → wait)
 * 
 * Let me just think about concrete positions:
 * Player at (0, -7) in game = 7 units south. Old 3D: (0, -7, 0.24)
 * In Y-up: (0, 0.24, 7) where Z=7 means... 
 * Camera behind player (south of player): old (0, -10.5, 2.2)
 * In Y-up: (0, 2.2, ?) — camera needs to be south of player
 * If player is at game_y=-7, camera is at game_y=-10.5 (more south)
 * In Y-up Z: we want camera Z > player Z if +Z = south
 * So old_y=-10.5 → new_z=10.5, old_y=-7 → new_z=7
 * That means new_z = -old_y ✓
 * 
 * CONFIRMED: new(x, y, z) = old(x, old_z, -old_y)
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
    }
    else if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  return { args, endIdx: args.length ? startIdx : -1 };
}

function negateArg(arg) {
  arg = arg.trim();
  if (arg === '0') return '0';
  if (arg.startsWith('-')) return arg.slice(1);
  return '-' + arg;
}

// For position.set(x, y, z) → position.set(x, z, -y): swap args[1] and args[2], negate the new args[2] (which was old args[1])
function swapAndNegateY(content, searchPattern) {
  let changes = 0, searchStart = 0;
  while (true) {
    const idx = content.indexOf(searchPattern, searchStart);
    if (idx === -1) break;
    const parenIdx = idx + searchPattern.length - 1;
    const { args, endIdx } = extractArgs(content, parenIdx);
    if (args.length === 3 && endIdx > parenIdx) {
      const newCall = searchPattern + args[0] + ', ' + args[2] + ', ' + negateArg(args[1]) + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++;
      searchStart = idx + newCall.length;
    } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
  }
  return { content, changes };
}

// For BoxGeometry(w, d, h) → BoxGeometry(w, h, d): just swap args[1] and args[2], NO negate (dimensions)
function swapArgsOnly(content, searchPattern) {
  let changes = 0, searchStart = 0;
  while (true) {
    const idx = content.indexOf(searchPattern, searchStart);
    if (idx === -1) break;
    const parenIdx = idx + searchPattern.length - 1;
    const { args, endIdx } = extractArgs(content, parenIdx);
    if (args.length === 3 && endIdx > parenIdx) {
      const newCall = searchPattern + args[0] + ', ' + args[2] + ', ' + args[1] + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++;
      searchStart = idx + newCall.length;
    } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
  }
  return { content, changes };
}

// For Vector3(x, y, z) → Vector3(x, z, -y), but (0,0,1)→(0,1,0) and (0,1,0)→skip
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
      // Up vector / rotation axis: (0,0,1) → (0,1,0)
      if (a0 === '0' && a1 === '0' && a2 === '1') {
        const newCall = 'new THREE.Vector3(0, 1, 0)';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        changes++; searchStart = idx + newCall.length; continue;
      }
      // Already (0,1,0) — skip
      if (a0 === '0' && a1 === '1' && a2 === '0') { searchStart = endIdx + 1; continue; }
      // Regular position: swap + negate
      const newCall = 'new THREE.Vector3(' + a0 + ', ' + a2 + ', ' + negateArg(a1) + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++; searchStart = idx + newCall.length;
    } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
  }
  return { content, changes };
}

const files = [
  'src/components/GameMap.tsx',
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
  { const re = /camera\.up\.set\(0,\s*0,\s*1\)/g; const m = content.match(re); if (m) { content = content.replace(re, 'camera.up.set(0, 1, 0)'); fc += m.length; } }
  { const re = /(\w+(?:\.\w+)*)\.position\.z\s*=/g; let m; const reps = [];
    while ((m = re.exec(content)) !== null) { reps.push({ s: m.index, e: m.index + m[0].length, r: m[0].replace('.position.z', '.position.y') }); }
    for (const r of reps.reverse()) { content = content.slice(0, r.s) + r.r + content.slice(r.e); } fc += reps.length; }
  { const re = /(\w+(?:\.\w+)*)\.rotation\.z\s*=/g; let m; const reps = [];
    while ((m = re.exec(content)) !== null) {
      const ls = content.lastIndexOf('\n', m.index); const line = content.slice(ls, m.index);
      if (line.includes('//') || line.includes('*')) continue;
      reps.push({ s: m.index, e: m.index + m[0].length, r: m[0].replace('.rotation.z', '.rotation.y') });
    }
    for (const r of reps.reverse()) { content = content.slice(0, r.s) + r.r + content.slice(r.e); } fc += reps.length; }
  { const re = /(\w+(?:\.\w+)*)\.rotation\.set\((?:Math\.PI|PI)\s*\/\s*2,\s*0,\s*0\)/g; const m = content.match(re); if (m) { content = content.replace(re, '$1.rotation.set(0, 0, 0)'); fc += m.length; } }
  { const re = /(\w+(?:\.\w+)*)\.rotation\.x\s*=\s*(?:Math\.PI|PI)\s*\/\s*2(?!\s*[,)])/g; let m; const reps = [];
    while ((m = re.exec(content)) !== null) {
      const ls = content.lastIndexOf('\n', m.index); const line = content.slice(ls, m.index);
      if (line.includes('//') || line.includes('*')) continue;
      reps.push({ s: m.index, e: m.index + m[0].length, r: m[0].replace(/(?:Math\.PI|PI)\s*\/\s*2/, '0') });
    }
    for (const r of reps.reverse()) { content = content.slice(0, r.s) + r.r + content.slice(r.e); } fc += reps.length; }
  { const m1 = content.match(/\bbaseZ\b/g); if (m1) { content = content.replace(/\bbaseZ\b/g, 'baseY'); fc += m1.length; } }
  { const m1 = content.match(/\bcamZ\b/g); if (m1) { content = content.replace(/\bcamZ\b/g, 'camY'); fc += m1.length; } }

  // === PHASE 2: Swap+negate 2nd↔3rd args ===

  // position.set(x, y, z) → position.set(x, z, -y)
  { const r = swapAndNegateY(content, '.position.set('); content = r.content; fc += r.changes; }

  // BoxGeometry(w, d, h) → BoxGeometry(w, h, d) — NO negate for dimensions
  { const r = swapArgsOnly(content, 'new THREE.BoxGeometry('); content = r.content; fc += r.changes; }

  // Vector3(x, y, z) → Vector3(x, z, -y) + up vector handling
  { const r = swapVector3(content); content = r.content; fc += r.changes; }

  // .lookAt(x, y, z) → .lookAt(x, z, -y) — skip single-arg lookAt(vector)
  { let searchStart = 0;
    while (true) {
      const idx = content.indexOf('.lookAt(', searchStart);
      if (idx === -1) break;
      const parenIdx = idx + '.lookAt('.length - 1;
      const { args, endIdx } = extractArgs(content, parenIdx);
      if (args.length === 3 && endIdx > parenIdx) {
        const newCall = '.lookAt(' + args[0] + ', ' + args[2] + ', ' + negateArg(args[1]) + ')';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        fc++; searchStart = idx + newCall.length;
      } else { searchStart = endIdx > 0 ? endIdx + 1 : parenIdx + 1; }
    }
  }

  if (fc > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`${relPath}: ${fc} changes`);
    totalChanges += fc;
  } else { console.log(`${relPath}: no changes`); }
}
console.log(`\nTotal: ${totalChanges}`);
