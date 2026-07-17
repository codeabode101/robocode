#!/usr/bin/env node
/**
 * Phase 2: Swap 2nd↔3rd args in position.set(), BoxGeometry(), Vector3(), lookAt()
 * 
 * Rule: In Z-up, call(x, y, z) has z=height. In Y-up, height is the 2nd arg: call(x, z, y).
 * So we swap args[1] and args[2] in all 3-arg calls.
 * 
 * Exceptions:
 * - Vector3(0, 0, 1) → Vector3(0, 1, 0) (up vector / rotation axis)
 * - Vector3(0, 1, 0) → leave as-is (already Y-up)
 * - Camera position/lookAt already fixed manually — but script will re-swap, so we re-fix after
 */

const fs = require('fs');
const path = require('path');

function extractArgs(content, startIdx) {
  // startIdx points to the opening '('
  let depth = 0;
  let i = startIdx;
  const args = [];
  let current = '';
  let argStart = startIdx + 1;
  
  for (i = startIdx + 1; i < content.length; i++) {
    const ch = content[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) {
        // End of call
        if (current.trim()) args.push(current.trim());
        return { args, endIdx: i };
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  return { args, endIdx: i };
}

function swapArgs23(content, pattern, file) {
  let changes = 0;
  let searchStart = 0;
  
  while (true) {
    const idx = content.indexOf(pattern, searchStart);
    if (idx === -1) break;
    
    const parenIdx = content.indexOf('(', idx + pattern.length);
    if (parenIdx === -1) { searchStart = idx + 1; continue; }
    
    const { args, endIdx } = extractArgs(content, parenIdx);
    
    if (args.length === 3) {
      // Check if already swapped (our manual camera fixes)
      // We'll just swap everything — camera will be re-fixed
      
      const oldCall = content.slice(idx, endIdx + 1);
      const newArgs = [args[0], args[2], args[1]];
      const newCall = pattern + '(' + newArgs.join(', ') + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++;
      searchStart = idx + newCall.length;
    } else {
      searchStart = parenIdx + 1;
    }
  }
  
  return { content, changes };
}

function swapVector3Args(content, file) {
  let changes = 0;
  let searchStart = 0;
  
  while (true) {
    const pattern = 'new THREE.Vector3(';
    const idx = content.indexOf(pattern, searchStart);
    if (idx === -1) break;
    
    const parenIdx = idx + pattern.length - 1;
    const { args, endIdx } = extractArgs(content, parenIdx);
    
    if (args.length === 3) {
      const a0 = args[0].trim();
      const a1 = args[1].trim();
      const a2 = args[2].trim();
      
      // Special cases: rotation axes and up vectors
      if (a0 === '0' && a1 === '0' && a2 === '1') {
        // (0, 0, 1) → (0, 1, 0) — rotation axis for yaw
        const oldCall = content.slice(idx, endIdx + 1);
        const newCall = 'new THREE.Vector3(0, 1, 0)';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        changes++;
        searchStart = idx + newCall.length;
        continue;
      }
      if (a0 === '0' && a1 === '1' && a2 === '0') {
        // Already (0, 1, 0) — skip
        searchStart = endIdx + 1;
        continue;
      }
      
      // Regular position: swap args 1 and 2
      const oldCall = content.slice(idx, endIdx + 1);
      const newArgs = [args[0], args[2], args[1]];
      const newCall = 'new THREE.Vector3(' + newArgs.join(', ') + ')';
      content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
      changes++;
      searchStart = idx + newCall.length;
    } else {
      searchStart = endIdx + 1;
    }
  }
  
  return { content, changes };
}

// Process files
const files = [
  'src/components/GameMap.tsx',
  'src/components/game/scene.ts',
  'src/components/game/helpers.ts',
];

let totalChanges = 0;

for (const relPath of files) {
  const filePath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let fileChanges = 0;
  
  // 1. position.set(x, y, z) → position.set(x, z, y)
  // Skip camera.position.set — already fixed manually
  const posPatterns = [
    '.position.set(',
  ];
  
  for (const pat of posPatterns) {
    let searchStart = 0;
    while (true) {
      const idx = content.indexOf(pat, searchStart);
      if (idx === -1) break;
      
      // Skip camera.position.set
      const prefix = content.slice(Math.max(0, idx - 20), idx);
      if (prefix.includes('camera.position.set')) {
        searchStart = idx + pat.length;
        continue;
      }
      
      const parenIdx = idx + pat.length - 1;
      const { args, endIdx } = extractArgs(content, parenIdx);
      
      if (args.length === 3) {
        const oldCall = content.slice(idx, endIdx + 1);
        const newArgs = [args[0], args[2], args[1]];
        const newCall = pat + newArgs.join(', ') + ')';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        fileChanges++;
        searchStart = idx + newCall.length;
      } else {
        searchStart = endIdx + 1;
      }
    }
  }
  
  // 2. BoxGeometry(w, d, h) → BoxGeometry(w, h, d)
  {
    const result = swapArgs23(content, 'new THREE.BoxGeometry(', relPath);
    content = result.content;
    fileChanges += result.changes;
  }
  
  // 3. new THREE.Vector3(x, y, z) → swap + handle up vectors
  {
    const result = swapVector3Args(content, relPath);
    content = result.content;
    fileChanges += result.changes;
  }
  
  // 4. lookAt(x, y, z) → lookAt(x, z, y) — skip camera.lookAt(vector)
  {
    let searchStart = 0;
    while (true) {
      const idx = content.indexOf('.lookAt(', searchStart);
      if (idx === -1) break;
      
      const parenIdx = idx + '.lookAt('.length - 1;
      const { args, endIdx } = extractArgs(content, parenIdx);
      
      // Skip lookAt(vector) — single arg
      if (args.length === 3) {
        const oldCall = content.slice(idx, endIdx + 1);
        const newArgs = [args[0], args[2], args[1]];
        const newCall = '.lookAt(' + newArgs.join(', ') + ')';
        content = content.slice(0, idx) + newCall + content.slice(endIdx + 1);
        fileChanges++;
        searchStart = idx + newCall.length;
      } else {
        searchStart = endIdx + 1;
      }
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`${relPath}: ${fileChanges} changes`);
    totalChanges += fileChanges;
  } else {
    console.log(`${relPath}: no changes`);
  }
}

console.log(`\nTotal: ${totalChanges} changes`);
