#!/usr/bin/env node
/**
 * Z-Up to Y-Up Migration Script for Robocode
 *
 * Handles systematic transformations:
 * 1. position.z = val → position.y = val
 * 2. rotation.z = val → rotation.y = val (yaw)
 * 3. rotation.set(PI/2, 0, 0) → rotation.set(0, 0, 0) (remove lay-flat)
 * 4. baseZ → baseY
 * 5. camera.up.set(0, 0, 1) → camera.up.set(0, 1, 0)
 *
 * Does NOT handle:
 * - position.set(x, y, z) three-arg calls (too ambiguous — manual review needed)
 * - BoxGeometry argument order (manual review needed)
 * - Complex nested expressions
 */

const fs = require('fs');
const path = require('path');

const files = [
  'src/components/GameMap.tsx',
  'src/components/game/scene.ts',
  'src/components/game/helpers.ts',
];

let totalChanges = 0;

for (const relPath of files) {
  const filePath = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${relPath} not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changes = 0;

  // 1. camera.up.set(0, 0, 1) → camera.up.set(0, 1, 0)
  {
    const re = /camera\.up\.set\(0,\s*0,\s*1\)/g;
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, 'camera.up.set(0, 1, 0)');
      changes += matches.length;
      console.log(`  ${relPath}: camera.up.set ${matches.length} occurrences`);
    }
  }

  // 2. position.z = val → position.y = val (simple assignment)
  {
    const re = /(\w+(?:\.\w+)*)\.position\.z\s*=/g;
    let match;
    const replacements = [];
    while ((match = re.exec(content)) !== null) {
      replacements.push({ start: match.index, end: match.index + match[0].length, original: match[0], replacement: match[0].replace('.position.z', '.position.y') });
    }
    for (const r of replacements.reverse()) {
      content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
    }
    changes += replacements.length;
    if (replacements.length > 0) console.log(`  ${relPath}: position.z → position.y ${replacements.length} occurrences`);
  }

  // 3. .rotation.z = val → .rotation.y = val (yaw rotation)
  // Be careful not to match .rotation.z in comments or strings
  {
    const re = /(\w+(?:\.\w+)*)\.rotation\.z\s*=/g;
    let match;
    const replacements = [];
    while ((match = re.exec(content)) !== null) {
      // Skip if it's inside a comment
      const lineStart = content.lastIndexOf('\n', match.index);
      const line = content.slice(lineStart, match.index);
      if (line.includes('//') || line.includes('*')) continue;
      replacements.push({ start: match.index, end: match.index + match[0].length, original: match[0], replacement: match[0].replace('.rotation.z', '.rotation.y') });
    }
    for (const r of replacements.reverse()) {
      content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
    }
    changes += replacements.length;
    if (replacements.length > 0) console.log(`  ${relPath}: rotation.z → rotation.y ${replacements.length} occurrences`);
  }

  // 4. rotation.set(Math.PI / 2, 0, 0) → rotation.set(0, 0, 0)
  {
    const re = /(\w+(?:\.\w+)*)\.rotation\.set\(Math\.PI\s*\/\s*2,\s*0,\s*0\)/g;
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, '$1.rotation.set(0, 0, 0)');
      changes += matches.length;
      console.log(`  ${relPath}: rotation.set(PI/2,0,0) → rotation.set(0,0,0) ${matches.length} occurrences`);
    }
  }

  // 5. rotation.set(PI/2, 0, 0) variant
  {
    const re = /(\w+(?:\.\w+)*)\.rotation\.set\(PI\s*\/\s*2,\s*0,\s*0\)/g;
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, '$1.rotation.set(0, 0, 0)');
      changes += matches.length;
      console.log(`  ${relPath}: rotation.set(PI/2,0,0) variant → rotation.set(0,0,0) ${matches.length} occurrences`);
    }
  }

  // 6. rotation.x = Math.PI / 2 → rotation.x = 0 (cylinder orient)
  // Only match standalone lines, not inside rotation.set()
  {
    const re = /(\w+(?:\.\w+)*)\.rotation\.x\s*=\s*Math\.PI\s*\/\s*2(?!\s*[,)])/g;
    let match;
    const replacements = [];
    while ((match = re.exec(content)) !== null) {
      const lineStart = content.lastIndexOf('\n', match.index);
      const line = content.slice(lineStart, match.index);
      if (line.includes('//') || line.includes('*')) continue;
      replacements.push({ start: match.index, end: match.index + match[0].length, original: match[0], replacement: match[0].replace(/Math\.PI\s*\/\s*2/, '0') });
    }
    for (const r of replacements.reverse()) {
      content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
    }
    changes += replacements.length;
    if (replacements.length > 0) console.log(`  ${relPath}: rotation.x = PI/2 → rotation.x = 0 ${replacements.length} occurrences`);
  }

  // 7. rotation.x = PI / 2 variant
  {
    const re = /(\w+(?:\.\w+)*)\.rotation\.x\s*=\s*PI\s*\/\s*2(?!\s*[,)])/g;
    let match;
    const replacements = [];
    while ((match = re.exec(content)) !== null) {
      const lineStart = content.lastIndexOf('\n', match.index);
      const line = content.slice(lineStart, match.index);
      if (line.includes('//') || line.includes('*')) continue;
      replacements.push({ start: match.index, end: match.index + match[0].length, original: match[0], replacement: match[0].replace(/PI\s*\/\s*2/, '0') });
    }
    for (const r of replacements.reverse()) {
      content = content.slice(0, r.start) + r.replacement + content.slice(r.end);
    }
    changes += replacements.length;
    if (replacements.length > 0) console.log(`  ${relPath}: rotation.x = PI/2 variant → rotation.x = 0 ${replacements.length} occurrences`);
  }

  // 8. baseZ → baseY (variable name)
  {
    const re = /\bbaseZ\b/g;
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, 'baseY');
      changes += matches.length;
      console.log(`  ${relPath}: baseZ → baseY ${matches.length} occurrences`);
    }
  }

  // 9. camZ → camY (variable name)
  {
    const re = /\bcamZ\b/g;
    const matches = content.match(re);
    if (matches) {
      content = content.replace(re, 'camY');
      changes += matches.length;
      console.log(`  ${relPath}: camZ → camY ${matches.length} occurrences`);
    }
  }

  // 10. Fog: scene.fog = new THREE.Fog(color, near, far) — swap Z/Y in camera-related fog
  // Fog is distance-based, no coordinate swap needed

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`${relPath}: ${changes} changes applied`);
    totalChanges += changes;
  } else {
    console.log(`${relPath}: no changes`);
  }
}

console.log(`\nTotal: ${totalChanges} changes`);
console.log('\nMANUAL REVIEW NEEDED:');
console.log('- position.set(x, y, z) three-arg calls — swap y↔z for height positions');
console.log('- BoxGeometry(w, d, h) — swap d/h argument order');
console.log('- Camera position.set and lookAt — swap y↔z');
console.log('- ScratchVec3 camera follow — swap y↔z');
console.log('- Fog near/far — no change needed (distance-based)');
