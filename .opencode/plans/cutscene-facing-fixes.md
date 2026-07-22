# Apartment Cutscene Fix Plan

## Changes to `src/components/GameMap.tsx`

### Fix 1: lift-carry facing snap (line 4562)
**Change**: `aptSparkyFacingRef.current = 0;` → `aptSparkyFacingRef.current = Math.PI;`
Sparky faces north (toward where Scrap was) instead of snapping 180° to south.

### Fix 2: link-computer rotation endAngle (line 4690)
**Change**: `const endAngle = Math.PI;` → `const endAngle = 0;`
Sparky rotates 90° clockwise (east→south) matching Z-up, instead of 270° CCW (east→north).

### Fix 3: walk-north facing (line 4732-4733)
**Change**:
```ts
aptSparkyFacingRef.current = Math.PI;  // line 4732
// and
new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)  // line 4733
```
→
```ts
aptSparkyFacingRef.current = 0;  // face south
// and
new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0)
```

### Fix 4: tack1-facing lerp target (line 4741)
**Change**: `(Math.PI - ...)` → `(0 - ...)`

### Fix 5: tack2-facing lerp target (line 4786)
**Change**: `(Math.PI - ...)` → `(0 - ...)`

### Fix 6: laptop detach quaternion (add after line 4719)
**Add**: `computerRef.current.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);`
This mirrors Z-up's `setFromAxisAngle(Z, PI)` — rotates laptop 180° around Y so screen faces correct direction.

### Fix 7: tack2 position (line 4791)
**Change**: `tackFxRef.current.position.set(-2.6, 0.36, -1.2);`
→ `tackFxRef.current.position.set(-2.6, 0.36, -0.976);`
Moves sparkle from scrap center (game-y=1.2) to scrap port (game-y=0.976).

### Fix 8: wire scrapPos (lines 4850, 4863)
**Change both occurrences**:
```ts
const scrapPos = new THREE.Vector3(-2.6, 0.24, -1.2);
```
→
```ts
const scrapPos = new THREE.Vector3(-2.6, 0.36, -0.976);
```

## How to Apply

Each fix above should be applied via the `edit` tool to `src/components/GameMap.tsx`. After all changes:
```bash
git add -A && git commit -m "Fix apartment cutscene Y-up conversion bugs in link-computer phase

- lift-carry facing: 0 → PI (north, toward box)
- link-computer rotation: endAngle PI → 0 (south)
- walk-north, tack1, tack2: facing targets PI → 0 (south)
- Add missing laptop detach quaternion setFromAxisAngle(Y, PI)
- tack2 position: scrap center → scrap port (-0.976 z)
- wire scrapPos: scrap center → scrap port
"
git push -u origin battery-only-flow
./scripts/deploy.sh
```
