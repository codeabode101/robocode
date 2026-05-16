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
- **Multiplayer**: Apinator (WebSocket pub/sub for real-time position sync & arena events)
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
    useMultiplayer.ts    # WebSocket multiplayer via Apinator
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

## Render Pipeline
Orthographic camera (top-down, z-up), viewHeight=26 units, ACESFilmic tone mapping, PCFSoft shadows, Fog at 38-58 units for depth. No post-processing (EffectComposer) — would need to import from `three/examples/jsm/postprocessing/`.

## Deployment
- **Cloudflare Workers**: `./scripts/deploy.sh` (reads NEXT_PUBLIC_APINATOR_APP_KEY from .dev.vars automatically)
- **Vercel**: `vercel` (standard Next.js deployment)
- Build output: `.open-next/` (Cloudflare) or `.next/` (Vercel)
- Secrets: `npx wrangler secret put <NAME>` for .dev.vars entries on Cloudflare
- **IMPORTANT**: Do NOT hardcode `NEXT_PUBLIC_APINATOR_APP_KEY` in build commands. Always use `./scripts/deploy.sh` or export it from `.dev.vars`.
