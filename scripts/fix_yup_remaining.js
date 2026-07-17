#!/usr/bin/env node
/**
 * Fix remaining Y-up issues in GameMap.tsx that the original migration missed:
 * 
 * 1. PlaneGeometry/ShapeGeometry/CircleGeometry that are horizontal in Z-up (XY plane)
 *    need rotation.x = -PI/2 in Y-up to lie flat on the XZ ground plane.
 * 
 * 2. Camera orbit system uses py (now height in Y-up) instead of pz (north).
 * 
 * 3. Cutscene scratchVec3 positions still use (east, north, height) instead of 
 *    (east, height, -north).
 * 
 * 4. Debug display shows Y (height) instead of Z (north-south).
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '../src/components/GameMap.tsx');
let code = fs.readFileSync(FILE, 'utf8');
let changes = 0;

function replace(label, oldStr, newStr) {
  if (!code.includes(oldStr)) {
    console.warn(`WARN [${label}]: pattern not found`);
    return;
  }
  code = code.replace(oldStr, newStr);
  changes++;
  console.log(`OK  [${label}]`);
}

// =============================================================================
// 1. GROUND PLANE ROTATIONS — Add rotation.x = -Math.PI/2 for flat geometry
// =============================================================================

// Water plane
replace('water-rotation',
  `    water.position.y = 0.02;
    water.receiveShadow = true;
    outdoorGroup.add(water);`,
  `    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.02;
    water.receiveShadow = true;
    outdoorGroup.add(water);`
);

// Deep floor plane
replace('deepFloor-rotation',
  `    deepFloor.position.y = -5;
    outdoorGroup.add(deepFloor);`,
  `    deepFloor.rotation.x = -Math.PI / 2;
    deepFloor.position.y = -5;
    outdoorGroup.add(deepFloor);`
);

// City ground (island ShapeGeometry)
replace('cityGround-rotation',
  `    cityGround.position.y = 0.10;
    cityGround.receiveShadow = true;
    outdoorGroup.add(cityGround);`,
  `    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.y = 0.10;
    cityGround.receiveShadow = true;
    outdoorGroup.add(cityGround);`
);

// Sun disc — should be horizontal disc facing up (like in Z-up)
replace('sun-rotation',
  `    sun.position.set(8.5, 5.2, -6.8);
    outdoorGroup.add(sun);`,
  `    sun.rotation.x = -Math.PI / 2;
    sun.position.set(8.5, 5.2, -6.8);
    outdoorGroup.add(sun);`
);

// Road dashes — add rotation to each dash mesh
replace('dash-rotation',
  `        d.position.set(horiz ? x - len / 2 + i * step + dashLen / 2 : x, 0.17, -horiz ? y : y - len / 2 + i * step + dashLen / 2);
        outdoorGroup.add(d);`,
  `        d.rotation.x = -Math.PI / 2;
        d.position.set(horiz ? x - len / 2 + i * step + dashLen / 2 : x, 0.17, -(horiz ? y : y - len / 2 + i * step + dashLen / 2));
        outdoorGroup.add(d);`
);

// Lake circles — add rotation
replace('lake-rotation',
  `    lake.position.set(lx, 0.15, -ly); outdoorGroup.add(lake);`,
  `    lake.rotation.x = -Math.PI / 2;
    lake.position.set(lx, 0.15, -ly); outdoorGroup.add(lake);`
);
replace('lakeDeep-rotation',
  `    lakeDeep.position.set(lx, 0.14, -ly); outdoorGroup.add(lakeDeep);`,
  `    lakeDeep.rotation.x = -Math.PI / 2;
    lakeDeep.position.set(lx, 0.14, -ly); outdoorGroup.add(lakeDeep);`
);
replace('lakeShine-rotation',
  `    lakeShine.position.set(lx + 0.4, 0.16, -ly - 0.4); outdoorGroup.add(lakeShine);`,
  `    lakeShine.rotation.x = -Math.PI / 2;
    lakeShine.position.set(lx + 0.4, 0.16, -ly - 0.4); outdoorGroup.add(lakeShine);`
);

// Pool circle
replace('pool-rotation',
  `      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), poolMat);`,
  `      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), poolMat);
      pool.rotation.x = -Math.PI / 2;`
);

// =============================================================================
// 2. CAMERA ORBIT SYSTEM — Fix to use XZ plane for horizontal orbit
// =============================================================================

// Add pz variable and fix the camera orbit formula
replace('camera-orbit-vars',
  `        const px = localPositionRef.current.x;
        const py = localPositionRef.current.y;
        const sinYaw = Math.sin(camYaw), cosYaw = Math.cos(camYaw);
        const sinPitch = Math.sin(camPitch), cosPitch = Math.cos(camPitch);`,
  `        const px = localPositionRef.current.x;
        const pz = localPositionRef.current.z; // -north in Y-up
        const sinYaw = Math.sin(camYaw), cosYaw = Math.cos(camYaw);
        const sinPitch = Math.sin(camPitch), cosPitch = Math.cos(camPitch);`
);

// Fix computeCameraZoom call — pass horizontal coords (px, pz) not (px, height)
replace('camera-zoom-call',
  `        const zoom = computeCameraZoom(
          px, py,
          inside, room,
          buildingFootprints as BuildingFootprint[],
        );`,
  `        const zoom = computeCameraZoom(
          px, pz,
          inside, room,
          buildingFootprints as BuildingFootprint[],
        );`
);

// Fix camera target position — orbit in XZ plane, height on Y
replace('camera-target-pos',
  `        cameraTargetPosRef.current.set(
          px - sinYaw * cosPitch * cd,
          py - cosYaw * cosPitch * cd,
          Math.max(0.05, camY)
        );
        cameraLookTargetRef.current.set(
          px,
          py,
          inside ? 0.5 : 0.6
        );`,
  `        cameraTargetPosRef.current.set(
          px - sinYaw * cosPitch * cd,
          Math.max(0.05, camY),
          pz + cosYaw * cosPitch * cd
        );
        cameraLookTargetRef.current.set(
          px,
          inside ? 0.5 : 0.6,
          pz
        );`
);

// Fix building footprint clamping — camera.position.y is height, use z for horizontal
replace('camera-clamp-inside',
  `          camera.position.x = Math.max(-lim, Math.min(lim, camera.position.x));
          camera.position.y = Math.max(-lim, Math.min(lim, camera.position.y));`,
  `          camera.position.x = Math.max(-lim, Math.min(lim, camera.position.x));
          camera.position.z = Math.max(-lim, Math.min(lim, camera.position.z));`
);

// Fix external building footprint clamping
replace('camera-clamp-external',
  `          const cx = camera.position.x, cy = camera.position.y;
          const MARGIN = 0.15;
          for (const fp of buildingFootprints) {
            const playerInside = px >= fp.x1 && px <= fp.x2 && py >= fp.y1 && py <= fp.y2;
            if (playerInside) continue; // player is inside this building — room clamping handles camera
            if (cx >= fp.x1 && cx <= fp.x2 && cy >= fp.y1 && cy <= fp.y2) {
              const dl = cx - fp.x1, dr = fp.x2 - cx;
              const db = cy - fp.y1, dt = fp.y2 - cy;
              const minD = Math.min(dl, dr, db, dt);
              if (minD === dl) camera.position.x = fp.x1 - MARGIN;
              else if (minD === dr) camera.position.x = fp.x2 + MARGIN;
              else if (minD === db) camera.position.y = fp.y1 - MARGIN;
              else camera.position.y = fp.y2 + MARGIN;
            }
          }`,
  `          const cx = camera.position.x, cz = camera.position.z;
          const MARGIN = 0.15;
          for (const fp of buildingFootprints) {
            // fp uses north-positive coords; convert player's z (-north) to north for comparison
            const playerNorth = -pz;
            const playerInside = px >= fp.x1 && px <= fp.x2 && playerNorth >= fp.y1 && playerNorth <= fp.y2;
            if (playerInside) continue;
            // Convert camera z to north for comparison
            const camNorth = -cz;
            if (cx >= fp.x1 && cx <= fp.x2 && camNorth >= fp.y1 && camNorth <= fp.y2) {
              const dl = cx - fp.x1, dr = fp.x2 - cx;
              const db = camNorth - fp.y1, dt = fp.y2 - camNorth;
              const minD = Math.min(dl, dr, db, dt);
              if (minD === dl) camera.position.x = fp.x1 - MARGIN;
              else if (minD === dr) camera.position.x = fp.x2 + MARGIN;
              else if (minD === db) camera.position.z = -(fp.y1 - MARGIN);
              else camera.position.z = -(fp.y2 + MARGIN);
            }
          }`
);

// =============================================================================
// 3. DEBUG DISPLAY — Show z instead of y
// =============================================================================

replace('debug-state',
  `  const [debugDisplay, setDebugDisplay] = useState({ fps: '0', x: '0.00', y: '0.00' });`,
  `  const [debugDisplay, setDebugDisplay] = useState({ fps: '0', x: '0.00', z: '0.00' });`
);

replace('debug-update',
  `setDebugDisplay({ fps: String(fpsRef.current), x: localPositionRef.current.x.toFixed(2), y: localPositionRef.current.y.toFixed(2) });`,
  `setDebugDisplay({ fps: String(fpsRef.current), x: localPositionRef.current.x.toFixed(2), z: localPositionRef.current.z.toFixed(2) });`
);

replace('debug-render',
  `          <div>X: {debugDisplay.x}</div>
          <div>Y: {debugDisplay.y}</div>`,
  `          <div>X: {debugDisplay.x}</div>
          <div>Z: {debugDisplay.z}</div>`
);

// =============================================================================
// 4. CUTSCENE CAMERAS — Convert scratchVec3 positions from (east,north,height) 
//    to (east,height,-north)
//
//    Pattern: scratchVec3.current.set(x, y, z) where x=east, y=north, z=height
//    Should be: scratchVec3.current.set(x, z, -y)  i.e. (east, height, -north)
//
//    Similarly for camera.lookAt(x, y, z) where x=east, y=north, z=height
//    Should be: camera.lookAt(x, -y, z) ... wait no.
//    lookAt in Y-up: (east, height, -north) = (x, z, -y) from original
// =============================================================================

// Helper to convert (east, north, height) → (east, height, -north)
// For set(): set(x, north, height) → set(x, height, -north) = set(x, z, -y) 
// For lookAt(): lookAt(x, north, height) → lookAt(x, height, -north) = lookAt(x, z, -y)

// --- REPAIR CUTSCENE ---
replace('repair-cam-1',
  `            scratchVec3.current.set(2.9, 2.2, 1.0);
            camera.position.lerp(scratchVec3.current, 0.06);
            camera.lookAt(2.9, 0.3, -3.05);`,
  `            scratchVec3.current.set(2.9, 1.0, -2.2);
            camera.position.lerp(scratchVec3.current, 0.06);
            camera.lookAt(2.9, 0.3, 3.05);`
);

// --- REGISTER CUTSCENE ---
// place-robot
replace('register-place-robot-cam',
  `            if (registerCutscenePhaseRef.current === 'place-robot') {
              scratchVec3.current.set(2.0, 0.8, 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, -3.0);`,
  `            if (registerCutscenePhaseRef.current === 'place-robot') {
              scratchVec3.current.set(2.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, 3.0);`
);

// player-to-robot — uses localPositionRef which is already in Y-up, but the
// expressions `localPositionRef.current.y - 1.5` etc. treat y as north.
// In Y-up, localPositionRef.current.z is -north, so for the camera we need:
// set(px, height, -(north - 1.5)) = set(px, height, -north + 1.5) = set(px, height, pz + 1.5)
replace('register-player-to-robot-cam',
  `            } else if (registerCutscenePhaseRef.current === 'player-to-robot') {
              scratchVec3.current.set(localPositionRef.current.x, localPositionRef.current.y - 1.5, 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y + 0.8);`,
  `            } else if (registerCutscenePhaseRef.current === 'player-to-robot') {
              scratchVec3.current.set(localPositionRef.current.x, 1.5, localPositionRef.current.z + 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(localPositionRef.current.x, 0.3, localPositionRef.current.z - 0.8);`
);

// player-to-laptop
replace('register-player-to-laptop-cam',
  `            } else if (registerCutscenePhaseRef.current === 'player-to-laptop') {
              scratchVec3.current.set(0.5, 2.2, 2.0);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, -2.7);`,
  `            } else if (registerCutscenePhaseRef.current === 'player-to-laptop') {
              scratchVec3.current.set(0.5, 2.0, -2.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, 2.7);`
);

// connect-wire / register-dlg
replace('register-connect-wire-cam',
  `            } else if (registerCutscenePhaseRef.current === 'connect-wire' || registerCutscenePhaseRef.current === 'register-dlg') {
              scratchVec3.current.set(0.5, 2.2, 2.0);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, -2.7);`,
  `            } else if (registerCutscenePhaseRef.current === 'connect-wire' || registerCutscenePhaseRef.current === 'register-dlg') {
              scratchVec3.current.set(0.5, 2.0, -2.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(2.0, 0.3, 2.7);`
);

// laptop-ui / done — getWorldPosition gives Y-up coords, then set camera
replace('register-laptop-ui-cam',
  `            } else if (registerCutscenePhaseRef.current === 'laptop-ui' || registerCutscenePhaseRef.current === 'done') {
              const regComp = workshopRegisterComputerRef.current;
              if (regComp) {
                const lid = regComp.children[2] as THREE.Group;
                const display = lid.children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.z, -scratchVec3.current.y - 0.18);
                camera.lookAt(scratchVec3.current);
              }`,
  `            } else if (registerCutscenePhaseRef.current === 'laptop-ui' || registerCutscenePhaseRef.current === 'done') {
              const regComp = workshopRegisterComputerRef.current;
              if (regComp) {
                const lid = regComp.children[2] as THREE.Group;
                const display = lid.children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                // In Y-up, getWorldPosition gives (east, height, -north).
                // Camera above and behind: height+0.18, z offset
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.18, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }`
);

// default register
replace('register-default-cam',
  `            } else {
              scratchVec3.current.set(1.5, 2.5, 1.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(1.8, 0.4, -3.0);
            }`,
  `            } else {
              scratchVec3.current.set(1.5, 1.2, -2.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(1.8, 0.4, 3.0);
            }`
);

// --- BATTERY INSTALL CUTSCENE ---
// approach / hand-off
replace('battery-approach-cam',
  `            if (ibPhase === 'approach' || ibPhase === 'hand-off') {
              scratchVec3.current.set(localPositionRef.current.x, localPositionRef.current.y - 1.0, 2.0);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y + 1.5);`,
  `            if (ibPhase === 'approach' || ibPhase === 'hand-off') {
              scratchVec3.current.set(localPositionRef.current.x, 2.0, localPositionRef.current.z + 1.0);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(localPositionRef.current.x, 0.3, localPositionRef.current.z - 1.5);`
);

// sparky-walk
replace('battery-sparky-walk-cam',
  `            } else if (ibPhase === 'sparky-walk') {
              scratchVec3.current.set(-2.6, -0.2, 1.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.3, -0.6);`,
  `            } else if (ibPhase === 'sparky-walk') {
              scratchVec3.current.set(-2.6, 1.8, 0.2);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.3, 0.6);`
);

// battery default (chest-glow, etc.)
replace('battery-default-cam',
  `            } else {
              scratchVec3.current.set(-3.5, 0.7, 1.8);
              camera.position.lerp(scratchVec3.current, 0.08);
              camera.lookAt(-2.6, 0.3, -0.7);
            }`,
  `            } else {
              scratchVec3.current.set(-3.5, 1.8, -0.7);
              camera.position.lerp(scratchVec3.current, 0.08);
              camera.lookAt(-2.6, 0.3, 0.7);
            }`
);

// --- INTRO CUTSCENE ---
// fetch-laptop
replace('intro-fetch-laptop-cam',
  `            if (phase === 'fetch-laptop') {
              camera.position.set(-3.0, 1.5, -2.5);
              camera.lookAt(-3.0, 0.3, -1.15);`,
  `            if (phase === 'fetch-laptop') {
              camera.position.set(-3.0, 1.5, 2.5);
              camera.lookAt(-3.0, 0.3, 1.15);`
);

// link-computer / electrocute
replace('intro-electrocute-cam',
  `            } else if (phase === 'link-computer' || phase === 'electrocute') {
              scratchVec3.current.set(-3.0, 2.5, 1.5);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(-3.0, 0.3, -1.15);`,
  `            } else if (phase === 'link-computer' || phase === 'electrocute') {
              scratchVec3.current.set(-3.0, 1.5, -2.5);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(-3.0, 0.3, 1.15);`
);

// walk-to-laptop
replace('intro-walk-to-laptop-cam',
  `            } else if (phase === 'walk-to-laptop') {
              scratchVec3.current.set(localPositionRef.current.x, localPositionRef.current.y + 1.3, 2.0);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y - 0.8);`,
  `            } else if (phase === 'walk-to-laptop') {
              scratchVec3.current.set(localPositionRef.current.x, 2.0, localPositionRef.current.z - 1.3);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(localPositionRef.current.x, 0.3, localPositionRef.current.z + 0.8);`
);

// string-tutorial
replace('intro-string-tutorial-cam',
  `            } else if (phase === 'string-tutorial') {
              scratchVec3.current.set(-3.4, 1.6, 1.8);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(-3.4, 0.3, -0.5);`,
  `            } else if (phase === 'string-tutorial') {
              scratchVec3.current.set(-3.4, 1.8, -1.6);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(-3.4, 0.3, 0.5);`
);

// laptop-ui (intro)
replace('intro-laptop-ui-cam',
  `            } else if (phase === 'laptop-ui') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.z, -scratchVec3.current.y - 0.35);
                camera.lookAt(scratchVec3.current);
              }`,
  `            } else if (phase === 'laptop-ui') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }`
);

// antenna-glow (first half — t < 2.0)
replace('intro-antenna-glow-early',
  `            } else if (phase === 'antenna-glow') {
              const t = aptCutsceneTimerRef.current;
              if (t < 2.0) {
                scratchVec3.current.set(-3.0, 0.8, 1.5);
                camera.position.lerp(scratchVec3.current, 0.06);
                camera.lookAt(-2.6, 0.34, -1.2);`,
  `            } else if (phase === 'antenna-glow') {
              const t = aptCutsceneTimerRef.current;
              if (t < 2.0) {
                scratchVec3.current.set(-3.0, 1.5, -0.8);
                camera.position.lerp(scratchVec3.current, 0.06);
                camera.lookAt(-2.6, 0.34, 1.2);`
);

// antenna-glow (second half — t >= 2.0, uses display world position)
replace('intro-antenna-glow-late',
  `                if (computerRef.current) {
                  const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                  display.getWorldPosition(scratchVec3.current);
                  scratchVec3b.current.set(scratchVec3.current.x, scratchVec3.current.y - 0.35, scratchVec3.current.z);
                  camera.position.lerp(scratchVec3b.current, 0.04);
                  camera.lookAt(scratchVec3.current);
                }`,
  `                if (computerRef.current) {
                  const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                  display.getWorldPosition(scratchVec3.current);
                  scratchVec3b.current.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                  camera.position.lerp(scratchVec3b.current, 0.04);
                  camera.lookAt(scratchVec3.current);
                }`
);

// date-coding
replace('intro-date-coding-cam',
  `            } else if (phase === 'date-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.z, -scratchVec3.current.y - 0.35);
                camera.lookAt(scratchVec3.current);
              }`,
  `            } else if (phase === 'date-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }`
);

// reboot
replace('intro-reboot-cam',
  `            } else if (phase === 'reboot') {
              scratchVec3.current.set(-3.0, 0.8, 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, -1.2);`,
  `            } else if (phase === 'reboot') {
              scratchVec3.current.set(-3.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, 1.2);`
);

// version-coding
replace('intro-version-coding-cam',
  `            } else if (phase === 'version-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.z, -scratchVec3.current.y - 0.35);
                camera.lookAt(scratchVec3.current);
              }`,
  `            } else if (phase === 'version-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }`
);

// pre-boot
replace('intro-pre-boot-cam',
  `            } else if (phase === 'pre-boot') {
              scratchVec3.current.set(-3.0, 0.8, 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, -1.2);`,
  `            } else if (phase === 'pre-boot') {
              scratchVec3.current.set(-3.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, 1.2);`
);

// boot-coding
replace('intro-boot-coding-cam',
  `            } else if (phase === 'boot-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.z, -scratchVec3.current.y - 0.35);
                camera.lookAt(scratchVec3.current);
              }`,
  `            } else if (phase === 'boot-coding') {
              if (computerRef.current) {
                const display = (computerRef.current.children[2] as THREE.Group).children[1] as THREE.Mesh;
                display.getWorldPosition(scratchVec3.current);
                camera.position.set(scratchVec3.current.x, scratchVec3.current.y + 0.35, scratchVec3.current.z + 0.5);
                camera.lookAt(scratchVec3.current);
              }`
);

// boot
replace('intro-boot-cam',
  `            } else if (phase === 'boot') {
              scratchVec3.current.set(-3.0, 0.8, 1.5);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, -1.2);`,
  `            } else if (phase === 'boot') {
              scratchVec3.current.set(-3.0, 1.5, -0.8);
              camera.position.lerp(scratchVec3.current, 0.06);
              camera.lookAt(-2.6, 0.34, 1.2);`
);

// default intro (sp = sparky position)
replace('intro-default-cam',
  `            } else {
              scratchVec3.current.set(-2.7, 3.0, 2.2);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(sp.x, 0.3, -sp.y);
            }`,
  `            } else {
              scratchVec3.current.set(-2.7, 2.2, -3.0);
              camera.position.lerp(scratchVec3.current, 0.04);
              camera.lookAt(sp.x, 0.3, sp.z);
            }`
);

// --- RAFIQ WALK CUTSCENE ---
replace('rafiq-walk-cam',
  `          if (rafiqWalkPhaseRef.current === 'walking') {
            // Player walks upward (+Y). Camera behind (lower Y), looks ahead toward Rafiq.
            scratchVec3.current.set(localPositionRef.current.x, localPositionRef.current.y - 1.5, 1.8);
            camera.position.lerp(scratchVec3.current, 0.04);
            camera.lookAt(localPositionRef.current.x, 0.3, -localPositionRef.current.y + 0.5);`,
  `          if (rafiqWalkPhaseRef.current === 'walking') {
            // Player walks forward (+Z). Camera behind (lower Z), looks ahead toward Rafiq.
            scratchVec3.current.set(localPositionRef.current.x, 1.8, localPositionRef.current.z - 1.5);
            camera.position.lerp(scratchVec3.current, 0.04);
            camera.lookAt(localPositionRef.current.x, 0.3, localPositionRef.current.z + 0.5);`
);

replace('rafiq-centered-cam',
  `          } else {
            // Centered two-shot: characters centered on screen
            const midX = (localPositionRef.current.x + ROOM_OWNER_POS.x) / 2;
            const midY = (localPositionRef.current.y + ROOM_OWNER_POS.y) / 2;
            scratchVec3.current.set(midX, midY + 0.8, 1.6);
            camera.position.lerp(scratchVec3.current, 0.04);
            camera.lookAt(midX, 0.3, -midY);
          }`,
  `          } else {
            // Centered two-shot: characters centered on screen
            const midX = (localPositionRef.current.x + ROOM_OWNER_POS.x) / 2;
            const midZ = (localPositionRef.current.z + ROOM_OWNER_POS.z) / 2;
            scratchVec3.current.set(midX, 1.6, midZ + 0.8);
            camera.position.lerp(scratchVec3.current, 0.04);
            camera.lookAt(midX, 0.3, midZ);
          }`
);

// =============================================================================
// Write the result
// =============================================================================
fs.writeFileSync(FILE, code, 'utf8');
console.log(`\nDone! Applied ${changes} changes to ${path.basename(FILE)}.`);
