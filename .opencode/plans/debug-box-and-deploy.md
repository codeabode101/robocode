# Debug Box Invisibility + Deploy All Fixes

## Step 1: Add console.log diagnostics

### Box creation (line ~3259)
```ts
console.log('📦 BOX CREATED at', boxResult.group.position.toArray().map(v=>v.toFixed(3)).join(', '), 'parent:', boxResult.group.parent?.constructor.name, 'visible:', boxResult.group.visible);
```

### Box visibility toggle (line ~3946)
```ts
console.log('📦 BOX VISIBLE = TRUE, parent:', cutsceneBoxRef.current?.parent?.constructor.name, 'parent.visible:', cutsceneBoxRef.current?.parent?.visible, 'apartmentRoomGroup.visible:', apartmentRoomGroup.visible);
```

### Apartment room group visibility (line ~6253)
```ts
console.log('🏠 APARTMENT GROUP visible:', inApartmentRoomRef.current, 'box parent chain:', cutsceneBoxRef.current?.parent?.constructor.name, '->', cutsceneBoxRef.current?.parent?.parent?.constructor.name);
```

### aptStage check (line ~3941)
```ts
console.log('🏠 APARTMENT ENTRY aptStage:', aptStage, 'cutsceneDone:', cutsceneDoneRef.current, 'box exists:', !!cutsceneBoxRef.current);
```

## Step 2: Build + Deploy
```bash
./scripts/deploy.sh
```

## Step 3: User checks browser console for the logs

## Step 4: Based on logs, fix root cause of box invisibility

Likely suspects (ordered by probability):
1. **Box z-fighting with floor** — floor top is at Y=0.24 (BoxGeometry 8×0.24×8 at Y=0.12). Box group at Y=0.24, so bottom edges coincide. Add `renderOrder` or `polygonOffset` on box material.
2. **Box walls face inward** — if `side: THREE.FrontSide` (default) and camera is looking from outside, the back faces won't render. Need to check camera orientation vs box faces.
3. **Box scale is zero** — unlikely since `createCardboardBox` uses default scale.
4. **Box not parented to apartmentRoomGroup** — verify `boxResult.group.parent === apartmentRoomGroup`.
5. **aptStage check fails** — `sparkyQuestStageRef.current !== 'intro'`.

## Step 5: Iterate until box is visible, then deploy again
