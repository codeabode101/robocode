<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Robocode Architecture

## Stack
- **Framework**: Next.js 16.2.4 (Turbopack)
- **3D Rendering**: Three.js (r184), orthographic camera, toon-shaded
- **Database**: Drizzle ORM + postgres.js (CockroachDB via DATABASE_URL)
- **Auth**: WorkOS + jose (JWT in httpOnly cookies)
- **Multiplayer**: Apinator (WebSocket receive + HTTP POST send via `@apinator/server` SDK for reliable event triggering; client events not relayed by Apinator server, so server-side trigger via `/api/multiplayer`)
- **Deploy**: Cloudflare Workers (via @opennextjs/cloudflare) and/or Vercel

## Directory Structure

```
src/
  components/
    GameMap.tsx          # Main game component (reduced, ~500 lines)
    game/
      types.ts           # All shared types, constants, enums
      helpers.ts         # Pure utility functions (materials, sprites, visuals, collision)
      city.ts            # City layout (roads, buildings, plaza, shops, auto-rickshaws)
  app/
    game/page.tsx        # Game page (auth wrapper, renders GameMap)
    api/                 # All API routes (profile, auth, arena, etc.)
  hooks/
    useMultiplayer.ts    # WebSocket receive + HTTP POST send via `/api/multiplayer`
  db/
    index.ts             # Drizzle ORM setup
    schema.ts            # Database schema
```

## GameMap Component Architecture

GameMap.tsx is a single React client component with:

### State (React useState, triggers re-renders)
- Tutorial state, money, workshop/arena UI, quest progress

### Refs (useRef, no re-render)
- Three.js scene objects (groups, meshes, cameras)
- Player position, collision hitboxes, customer NPCs
- Input state (keyboard), animation loop handle
- Auto-rickshaw and cloud animation data

### Effects (useEffect)
1. **Scene setup** — Creates Three.js renderer, camera, lights, builds city, NPCs, rooms
2. **Tutorial & quest sync** — Mirrors state to refs for animation loop access
3. **Multiplayer** — Join/leave events, remote avatar management
4. **Arena** — Battle challenge/accept/decline flow

### Animation Loop
Runs at ~60fps via requestAnimationFrame:
1. Read keyboard input → compute movement → collision check → update position
2. NPC AI (Sparky path-walking, workshop customer movement)
3. Animate remote avatars (lerp toward target positions)
4. Animate environment (clouds drift, auto-rickshaws patrol, lights flicker)
5. Camera follow (lerp toward player, room zoom transitions)
6. Render scene

## Key Modules

### types.ts
All TypeScript interfaces (RobotVisual, CustomerNpc, Hitbox, etc.) and game constants (ISLAND_RADIUS, MOVE_SPEED, NPC positions). Import these when adding new game objects.

### helpers.ts
Pure functions with no React dependencies:
- `createToonMaterial` / `createTexturedToonMaterial` — MeshToonMaterial with gradient map
- `createLabelSprite` / `createNameSprite` — Canvas-based text sprites
- `createRobotVisual` / `createHumanVisual` / `createPlayerSprite` — 3D character builders
- `animateRobotVisual` — Per-frame animation (walk bob, pupil tracking)
- `collidesWithAny` / `isInsideHitbox` — Collision detection
- `disposeObject` — Cleanup Three.js geometry/materials

### city.ts
Procedural city generation:
- `buildCity(outdoorGroup)` — All roads, buildings, plaza, shops, trees, props
- `buildObstacles()` — Returns Hitbox[] for collision
- `createBigPetShop` / `createBazaarShop` — Building blueprints
- `createAutoRickshaw` — 3-wheeler vehicle visible on roads

## Three.js CanvasTexture notes
- `CanvasTexture.flipY` defaults to `true` — Three.js auto-flips vertically (canvas Y-down → WebGL Y-up).
- If text on a BoxGeometry face appears upside-down, set `st.flipY = false`.
- If text appears mirrored (backwards), the face normal is reversed — use `scale.x = -1` on the mesh to mirror the texture horizontally.
- For a BoxGeometry sign on a building facade: use `MeshBasicMaterial({ map: st })` with `st.flipY = false`. If the text reads backwards, the mesh is on the wrong side of the face or the face normal points inward.
Orthographic camera (top-down, z-up), viewHeight=26 units, ACESFilmic tone mapping, PCFSoft shadows, Fog at 38-58 units for depth. No post-processing (EffectComposer) — would need to import from `three/examples/jsm/postprocessing/`.

## Deployment
- **Cloudflare Workers** (NOT Pages): `./scripts/deploy.sh` (reads `NEXT_PUBLIC_APINATOR_APP_KEY` from `.dev.vars` automatically)
- **Config**: `wrangler.jsonc` MUST exist — it's the Worker entry point. Do NOT delete it.
- **Vercel**: `vercel` (standard Next.js deployment)
- Build output: `.open-next/` (Cloudflare) or `.next/` (Vercel)
- Secrets: `npx wrangler secret put <NAME>` for `.dev.vars` entries on Cloudflare
- **IMPORTANT**: Do NOT hardcode `NEXT_PUBLIC_APINATOR_APP_KEY` in build commands. Always use `./scripts/deploy.sh` or export it from `.dev.vars`.
- **Cloudflare secrets**: After first deploy, set these with `npx wrangler secret put <NAME>` for each entry in `.dev.vars`:
  - `WORKOS_API_KEY` — JWT signing key for auth
  - `DATABASE_URL` — CockroachDB connection string (postgres://...)
  - `NEXT_PUBLIC_APINATOR_APP_KEY` — WebSocket pub/sub app key
  - `APINATOR_SECRET` — HMAC secret for channel auth & server SDK
  - `APINATOR_APP_ID` — App UUID for `@apinator/server` REST API
  (`.dev.vars` is only for local dev; secrets are NOT auto-deployed with the worker.)

## ⚠️ DATABASE SAFETY RULES — READ BEFORE RUNNING ANY MIGRATION

### NEVER run destructive operations against production.
The file `src/db/migrate.ts` is DESIGNED to be safe — it uses
`CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`
only. It will NEVER drop or overwrite data.

### If you need to add a column:
1. Add it to `src/db/schema.ts`
2. Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `src/db/migrate.ts`
3. Run: `npx tsx src/db/migrate.ts`

### If you need to drop or alter a table destructively:
**THIS IS EXTREMELY DANGEROUS. DO NOT DO IT WITHOUT EXPLICIT USER APPROVAL.**
1. Create a SEPARATE script (e.g., `src/db/migrate_dangerous.ts`)
2. Require `CONFIRM_DESTRUCTIVE=yes` env var at the top:
   ```ts
   if (process.env.CONFIRM_DESTRUCTIVE !== 'yes') {
     console.error('Set CONFIRM_DESTRUCTIVE=yes to confirm you want to destroy data.');
     process.exit(1);
   }
   ```
3. Never run this against production unless the user explicitly asks you to.

If you, an AI agent, are about to run any database operation, STOP and think:
- Am I about to drop tables? → DO NOT. Use ALTER TABLE instead.
- Am I about to run a migration? → Check that it uses CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS.
- Could this delete user data? → If yes, DON'T DO IT. Ask the user first.
