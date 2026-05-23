# Apartment Building Facade

## Goal
Add a visible 2-story apartment building at (-8.5, -3.5) so the player can find and enter Sparky's apartment. Ground floor = reception, second floor = Sparky's flat.

## Location
- **Building center**: (-8.5, -3.5) — directly above the existing door hitbox
- **Footprint**: 5 wide x 4 deep (halfWidth 2.5, halfHeight 2.0)
- **South edge**: y = -5.5 (front wall, door at center)
- **West/East**: x = [-11, -6]
- **Door hitbox** (already exists): circle at (-8.5, -5.5), radius 1.3

The existing tree at (-8, -6) stays — no collision, just visual.

## Changes

### 1. New function in `src/components/game/scene.ts`
`createApartmentBuilding(x, y)` returning a `THREE.Group`:

**Materials**:
- Walls: warm beige textured toon (`#e8dcc8`, tile_23)
- Trim/door frame: dark wood (`#6b4a3d`)
- Roof: dark brown (`#4a3728`)
- Glass: `MeshBasicMaterial` blue-tinted, transparent 0.3 opacity
- Warm glow: `MeshBasicMaterial` yellow-tinted, transparent 0.2 opacity
- Door: dark (`#0f172a`)

**Structure** (z-up building, ground at z=0.1):
- Foundation: 5.4 x 4.4 x 0.1 slab, gray
- Ground floor back wall: 5 x 0.08 x 1.0 at y=-2
- Ground floor side walls: 0.08 x 4 x 1.0 at x=±2.5
- Ground floor front wall: two segments with door cutout (doorW=0.8), each segment has glass window (warm glow) + frame
- **Reception counter**: 0.6 x 1.2 x 0.5 wood desk behind the glass, at (-0.8, -0.5, 0.5)
- **Reception chair**: cylinder seat (0.1 radius, 0.04 tall) + backrest at (0.6, -0.5, 0.4)
- **Floor lamp**: thin pole + glowing sphere at (-0.8, 0.8, 0.6), pale yellow glow
- Door: 0.8 x 0.08 x 0.9, dark, centered at (0, 2, 0.55)
- Door frame: slightly larger, trim material
- Door step: 1.2 x 0.3 x 0.06, gray
- Floor divider: 5 x 4 x 0.04 at z=1.1 (between stories)
- Second floor back wall: same as ground floor, at z=1.6
- Second floor side walls: same
- Second floor front wall: solid 5 x 0.08 x 1.0 at z=1.6
- Second floor windows: 3 evenly spaced (0.6 wide x 0.5 tall), each with glass pane + warm glow + frame (4-sided trim)
- Awning: 1.4 x 0.06 x 0.12, red/white striped, above door at z=0.98 (just below floor divider)
- Sign: canvas 400x100, "SPARKY'S APT" in amber on dark bg, 1.2 x 0.06, above awning at z=1.06
- Roof: 5.6 x 4.4 x 0.12 slab + 5.7 x 4.5 x 0.04 trim

### 2. Add building to scene in `GameMap.tsx`
After line 954 (where bazaar shops are added to outdoorGroup):
```
const apartment = createApartmentBuilding(-8.5, -3.5);
outdoorGroup.add(apartment);
```

### 3. Add building obstacle in `GameMap.tsx`
In the `obstacleHitboxes` array around line 1593:
```
{ shape: 'box', center: new THREE.Vector2(-8.5, -3.5), halfWidth: 2.5, halfHeight: 2.0 },
```

### 4. Import in `GameMap.tsx`
Add `createApartmentBuilding` to the import from `@/components/game/scene`.

## Door entry flow (unchanged, just confirming)
1. Player walks south-to-north at x≈-8.5
2. At y≈-6.8, enters the door hitbox (radius 1.3 from -5.5)
3. `atApartmentDoor` triggers → teleport to interior at APARTMENT_SPAWN (2.5, -0.5)
4. Building obstacle at y≥-5.5 prevents walking through walls from the sides

## Files changed
- `src/components/game/scene.ts` — new `createApartmentBuilding` function
- `src/components/GameMap.tsx` — add building to outdoorGroup, add obstacle, add import
