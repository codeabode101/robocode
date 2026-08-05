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
- **Multiplayer**: Apinator (`@apinator/client` WebSocket SDK) — bidirectional. Client sends position/events via `apinator.trigger()` directly through WebSocket. Receives remote players via `channel.bind()`. Players in different stages see each other on the same world map.
- **Deploy**: Cloudflare Workers (via @opennextjs/cloudflare) and/or Vercel

## Directory Structure

```
src/
  components/
    GameMap.tsx          # Main game component (~7400 lines)
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

## ⚠️ Hitbox Rule — Every visible object MUST have a hitbox
Every visible 3D object in a room (furniture, counter, machine) must have a corresponding collision hitbox in that room's obstacle array (`workshopObstaclesRef.current`, `shopObstaclesRef.current`, etc.). The hitbox should match the object's actual dimensions. Hitboxes are defined as `{ shape: 'box', center: { x, y }, halfWidth, halfHeight }` or `{ shape: 'circle', center: { x, y }, radius }`.

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

---

## Session History (Jun 2 2026)

### Goal
Convert all post-cutscene dialogs to typewriter style, add letter icon + 3D model, and build the full battery-as-purchasable-component feature with install flow.

### Constraints & Preferences
- All modals after cutscene (battery dialog, Rafiq letter, workshop intro, Rafiq no-letter) must use the bottom-bar typewriter pattern (30vh, speaker icon, blinking cursor, Enter button).
- Rafiq without the letter says "Who are you?" via typewriter dialog (pre-cutscene) or reopens workshop intro (post-cutscene).
- Battery is a separate purchasable component (NOT a repair stage part like sensor/voice/nav). Purchasable at `unit1-done` stage for ~$20.
- Letter must have a 2D icon (`createPartIcon`) and a 3D model (`createPartModel`) that appears in the player's hand when held.
- No rot180 in carry/orbit phases (confirmed correct by user); placement has rot180 (180° rotated when lowered).
- Door marker only shows after Sparky arrives home (`sparkyHomeArrivedRef.current` guard added to the `useEffect`).
- DO NOT change the intro cutscene or tutorial teaching of 4 variables. Battery install is purely cosmetic — Scrap powers up, Sparky says "go buy a sensor."

### Key Decisions
- Battery component: sold at Parts Shop (6.0, -12.0), costs $20, requires `unit1-done` stage.
- After buying battery → enter apartment → install-battery mini-cutscene (Sparky walks to Scrap, opens chest, places battery, chest glows).
- After install: battery removed from backpack, `batteryInstalledRef = true`, Sparky modal: "Think you need a sensor — go buy one at the Parts Shop near the lake."
- No quest stage change from battery install — sensor install still advances `unit1-done → unit2`.

### Quest Progression
```
intro → cutscene → Rafiq workshop → tutorial (Variables & Data Types) → unit1-done
  → { buy battery ($20) → install (cosmetic) } + { buy sensor ($5) → install → unit2 }
  → String Methods tutorial → unit2-done → { buy voice ($10) → install → unit3 }
  → ... → all-done
```

### Spatial Layout (Orthographic top-down, Y-up — Three.js default)
| Location | Position | Size/Notes |
|----------|----------|------------|
| Player spawn | (0, -7) | Outdoor world, ISLAND_RADIUS=40 |
| Parts Shop | (6.0, -12.0) | 8x4, door at (6.0, -10.2) |
| Rafiq's Shop (workshop) | walls (-6, -11.8) hw=3.70 hh=1.20 | door at (-6, -10.3) |
| Apartment building | (-6, -3.5) | 8x2.8, door at x=-3.6 |
| Apartment spawn | (0, -1.5) | Room interior |
| Sparky in apartment | (0.2, 2.2) | scale 0.7 |
| Scrap in apartment | (-2.6, 1.2, 0.24) | scale 0.65, after cutscene |
| Sparky outdoor | (-2.87, -6.1) | Repair kiosk |
| Rafiq in workshop | (2.35, 1.95) | ROOM_OWNER_POS |
| Workshop spawn | (0, -3.7) | Room interior |
| Parts shop spawn | (0, 1.2) | Room interior |
| Arena | (18.75, -12) | 7x3.5 |

### Interaction Distances
- Player collision radius: 0.48
- Move speed: 7.4
- Talk to Sparky: 1.7 (SPARKY_INTERACTION_DISTANCE)
- Talk to Rafiq (workshop): 1.8 (hardcoded)
- Talk to customers: 1.25
- Register zone: 2.1 radius

### Typewriter Dialog Pattern
Reference: Electrocute dialog at GameMap.tsx ~6087-6142.
State: `{ showXxxDlg: boolean, xxxStep: number, xxxText: string }`
Steps: `{ speaker: string, text: string }[]`
Effects: One for typewriter (35ms char interval), one for Enter key handler.
JSX: fixed/inset-0/flex-col/justify-end, 30vh bottom bar, gradient bg, speaker SVG, blinking ▌cursor, Enter button.

Full pattern reference:
```ts
// Typewriter effect
useEffect(() => {
  if (!showXxxDlg) return;
  setXxxText('');
  let i = 0;
  const interval = setInterval(() => { i++; setXxxText(step.text.slice(0, i)); if (i >= step.text.length) clearInterval(interval); }, 35);
  return () => clearInterval(interval);
}, [xxxStep, showXxxDlg, xxxDlgSteps]);

// Enter key handler
useEffect(() => {
  if (!showXxxDlg) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); if (nextStep < xxxDlgSteps.length) setXxxStep(nextStep); else { setShowXxxDlg(false); /* cleanup */ } } };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [showXxxDlg, xxxStep, xxxDlgSteps.length]);
```

### Battery Install Mini-Cutscene
Separate from `aptCutscenePhaseRef` — uses `installBatteryPhaseRef` with phases:
`'idle' | 'walk-to-scrap' | 'open-chest' | 'place-battery' | 'chest-glow' | 'done'`
Triggered in `runApartmentSparkyInteraction()` when battery in backpack, not yet installed.

---

## Cutscene UI System

### Architecture
GameMap.tsx controls UI visibility during cinematic cutscenes through a centralized ref + function system.

### Key Primitives (`GameMap.tsx`)
- **`hideGameUiRef`** (`useRef(false)`) — single source of truth for whether mission text, money animation, backpack, and mission modal should be hidden. Only `true` during **cinematic** cutscenes (intro, battery install). Never set during dialog-only interactions (Rafiq workshop conversation, Sparky outdoor dialog).
- **`startCinematicCutscene()`** — sets `cinemCamActiveRef.current = true` AND `hideGameUiRef.current = true`
- **`endCinematicCutscene()`** — sets both to `false`

### What gets hidden when `hideGameUiRef.current === true`
| UI Element | Line | Guard |
|------------|------|-------|
| Mission modal (NEW MISSION popup) | ~1088 | `!hideGameUiRef.current` added to trigger condition |
| Persistent mission box (bottom-left) | ~6810 | `!hideGameUiRef.current` added |
| Money bill animation (flying coins) | ~6832 | `!hideGameUiRef.current` added |
| Backpack (bottom-center) | ~7392 | `!hideGameUiRef.current` added |

### What does NOT get hidden
- **Money wallet** (bottom-right `$` display at ~6788) — intentional, always visible
- **Exclamation markers** (3D scene markers) — hidden via `syncMarkers` using `cinemCamActiveRef.current` directly (line ~6199)
- **Typewriter dialogs** (TFB component) — always shown, they ARE the cutscene
- **Workshop panel / shop UI** — room-specific, managed separately

### When `hideGameUiRef` is set
| Cutscene | Entry | Exit |
|----------|-------|------|
| Intro apartment cutscene (Sparky electrocute) | `startCinematicCutscene()` at ~3789, ~4016 | `endCinematicCutscene()` at ~5401 |
| Rafiq letter cutscene | (no `startCinematicCutscene` — camera stays normal; markers hidden via syncMarkers `rafiqWalkPhaseRef !== 'idle'`) |
| Battery install cutscene | `startCinematicCutscene()` at ~3795, ~4040, ~6463 | `endCinematicCutscene()` at ~5465, ~7128 |

### Important
- **Rafiq letter cutscene** (walk to Rafiq + hand letter) does NOT call `startCinematicCutscene()` — camera stays normal. However, `cinemCamActiveRef` is still checked: the workshop Space handler, Rafiq prompt display, and Rafiq interaction handler all guard against `cinemCamActiveRef.current === true` OR `rafiqWalkPhaseRef.current !== 'idle'` — preventing Space-triggered interactions during ANY cutscene.
- **Interaction blocking**: ALL Space key handlers must check `!cinemCamActiveRef.current` AND (where applicable) cutscene-specific phase refs (`rafiqWalkPhaseRef.current === 'idle'`). This is enforced in the workshop Space handler at ~3821, the Rafiq prompt at ~6361, and the Rafiq interaction at ~6372.
- **Rafiq / Sparky dialog-only interactions** never touch `hideGameUiRef`. All UI stays visible.
- **`syncMarkers()` is called via a `useEffect`** (deps: quest stage, room, backpack, etc.). `startCinematicCutscene()`/`endCinematicCutscene()` increment a `cutsceneTick` state, which is added to the effect's dependency array — so `syncMarkers()` fires automatically when a cutscene starts or ends. **No per-frame work in the animation loop.**
- **Customer NPC `!` markers** are guarded separately at ~5640 via `rafiqWalkPhaseRef.current === 'idle'` — they never show during any cutscene phase.
- To add a new cinematic cutscene: call `startCinematicCutscene()` at entry and `endCinematicCutscene()` at completion. Do NOT set `cinemCamActiveRef.current` directly.
- To add a new non-cinematic cutscene (camera stays normal): use a dedicated phase ref (e.g., `rafiqWalkPhaseRef`). Add `!cinemCamActiveRef.current && phaseRef.current === 'idle'` guards to the Space handler and interaction prompts.

### WorkshopPanel
The "Workshop guide" button was deleted (line ~98). Rafiq is the workshop guide — talk to him for guidance.

## TTS (Text-to-Speech) System

### Architecture
- **Native Web Speech API** (`window.speechSynthesis`) is tried first
- **Puter.js** (`puter.ai.txt2speech()`) is the fallback when `getVoices().length === 0`
- Puter.js script loaded via `<Script>` in `layout.tsx` from `https://js.puter.com/v2/`

### Flow (`speakStep` in `GameMap.tsx`)
1. Check `speechSynthesis.getVoices().length === 0` → use puter.js fallback
2. Otherwise → native `SpeechSynthesisUtterance` with `cancel()` + `setTimeout(speak, 10)`

### Word Underline (cross-browser)
- Both native and puter.js paths pre-compute word boundaries via `/\S+/g` regex
- **Timer-based fallback** (220ms interval): advances through `wordBounds[]`, works on Firefox/Linux where `onboundary` never fires
- `onboundary` handler overwrites timer position on browsers where it fires (more precise)
- First word highlighted immediately via `ttsCharIndexRef.current = wordBounds[0]?.start ?? null`

### State & Refs (`GameMap.tsx`)
- `ttsUtteranceRef` — the native `SpeechSynthesisUtterance` (or `{}` sentinel for puter)
- `ttsCharIndexRef` — current word start index for underline
- `puterTtsAudioRef` / `puterTtsTimerRef` — puter.js cleanup refs
- `ttsTick` (useState) — incremented to force re-render on word boundary

### TFB Component (`TypewriterFooter`)
Module-level React component outside `GameMap` (prevents remounting).
Props: `show`, `step`, `steps`, `text`, `icon`, `onEnter`, `ttsOn`, `ttsCharIdx`, `onTtsToggle`, `hideEnter`, `codeBlocks`.
Renders 30vh bottom bar with speaker icon, name, TTS play/stop button, typewriter text with word underline, and Enter button.

---

## ⚠️ BRANCH SAFETY — READ BEFORE EDITING GameMap.tsx

### ALWAYS work on a separate branch for risky edits.
The file `GameMap.tsx` is ~7300 lines with complex state/ref/effect interdependencies.
A bad edit can silently break the entire game. Protect `main` at all costs.

### Current branch: `battery-only-flow`
This branch strips out the tutorial system and old sensor/voice/nav progression.
After battery install cutscene → Scrap follower → free roam. No tutorial, no Sparky dialogs about sensors.

### Workflow:
1. `git checkout -b <feature-name>` — create branch from `main`
2. `git commit` after each logical change
3. `git push -u origin <branch>` — if you need to share/deploy from branch
4. Only merge to `main` after the user explicitly confirms and tests the branch

### If something goes wrong:
- `git checkout main` — return to known-good state
- `git branch -D <broken-branch>` — delete the bad branch
- `git checkout -b <new-feature>` — start fresh from main

## Deployment

### Manual deploy (Cloudflare Workers):
```bash
git add -A && git commit -m "<message>"
git push -u origin <branch>
./scripts/deploy.sh
```
This builds with `opennextjs-cloudflare` and deploys to `https://robocode.rahejaom.workers.dev`.

### Automatic deployment:
The deploy script reads `NEXT_PUBLIC_APINATOR_APP_KEY` from `.dev.vars` automatically. After first deploy, set secrets with:
```bash
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put NEXT_PUBLIC_APINATOR_APP_KEY
```
(Values from `.dev.vars` — these are NOT auto-deployed with the worker.)

### Vercel deployment (alternative):
```bash
vercel
```

### Auto-deploy workflow:
After completing ANY changes to `GameMap.tsx` or other game code:
1. `git add -A && git commit -m "<description of changes>"`
2. `git push -u origin <branch>`
3. `./scripts/deploy.sh`
This ensures the branch is always deployed and testable on `https://robocode.rahejaom.workers.dev`.
Do NOT merge to `main` before the user confirms the branch works in production.

---

## Session History (Jun 21 2026)

### Goal
Fix robot orientation in repair cutscene — robot was rotated wrong in the customer's arms.

### Changes Made

1. **Robot carry rotation fix** (`setCustomerRobotMode`, `'carry'`):
   - Rotation: `(0, 0, PI/2)` — 90° in XY plane so face normal stays +Z (upward), head on left, feet on right, thin profile from front
   - Position: `(0.105, 0.22, 0.11)` — X-offset centers body, Y-forward clears torso by ~0.6mm (negligible overlap), Z at hand level for support
   - Scale: `0.35` (unchanged)

2. **Robot place-robot phase fix** (repair cutscene completion):
   - Same transform applied: position `(0.105, 0.22, 0.11)`, rotation `(0, 0, PI/2)`, scale `0.35`

3. **Arm cradling pivot direction fix** (`GameMap.tsx ~6014-6015`):
   - Left arm `rotation.y`: `0.1` → `-0.1` (INWARD instead of outward — moves hand toward center)
   - Right arm `rotation.y`: `-0.1` → `0.1` (INWARD instead of outward — moves hand toward center)
   - Fix applies to all customers in `waiting` stage (cradling pose)

### Spatial Analysis (robot in customer's arms)
With rotation `(0,0,PI/2)` and position `(0.105,0.22,0.11)`, scale `0.35`:
- Face normal → +Z (upwards) ✓
- Body back at Y=0.116 is 0.6mm inside torso Y-edge 0.122 (negligible overlap, resolves with physics margin)
- Body front at Y=0.280, torso front at ~0.122 → robot extends forward of torso (visible, natural)
- Body bottom Z=0.206 within hand sphere (0.176-0.230) → hands support from below ✓
- Hand front-surface Y=0.104 < body back Y=0.116 → hands cup from behind ✓
- Inward arm pivots (now `-0.1`/`0.1`) bring hands 12mm closer to center → better front-cradle grip

### ⚠️ Y-up CORRECTION (Aug 5 2026) — values above were Z-up, WRONG in Y-up
The transforms above (`(0,0,PI/2)` / `(0.105,0.22,0.11)`) came from the Z-up
branch (customer yaw was `rotation.z`). After the Z-up→Y-up migration they are
invalid. Correct Y-up transforms in `setCustomerRobotMode`:
- **Carry** (`npc.visual.root` local frame, customer faces -Z at `rotation.y=0`):
  `position (0, 0.08, -0.15)`, `rotation (-Math.PI/2, 0, -Math.PI/2)`, `scale 0.35`
  → robot lies ACROSS chest (head east), face points UP (+Y, toward camera),
  in front of the customer (z<0). Verified: `R:(x,y,z)→(y,z,x)`.
- **Register** (`workshopRegisterDockRef` local frame, dock top at y≈0.205):
  `position (0.45, 0.058, 0.05)`, `rotation (-Math.PI/2, 0, Math.PI)`, `scale 0.35`
  → robot lies on dock (feet at y=0.205 rest on surface), face UP, head SOUTH
  (toward player). Verified: `R:(x,y,z)→(-x,z,y)`.
THREE Euler default order is `R = Rx*Ry*Rz` — use `rotation.set` values exactly
as above; naive axis-mapping from Z-up flips face direction (e.g. face west).

### Branch
Current branch: `customer-queue-system`. No new branch created — fixes applied directly.

---

## Session History (Jun 21 2026) — Part 2

### Goal
Fix three bugs in workshop repair flow: empty customer typewriter dialog, robot color not matching `petColor`, and green emissive glow overriding robot color.

### Changes Made

1. **Removed customer typewriter dialog from repair cutscene**:
   - Deleted `REPAIR_DLG_STEPS`, `showRepairDlg`, `repairStep`, `repairText` state
   - Glow phase now transitions directly to `'place-robot'` (skips `'dialog'` phase)
   - Removed `<TFB>` JSX block for repair dialog
   - Customer no longer says anything — cutscene is glow → place-robot → done

2. **Robot 3D color now matches `petColor`** (`createCustomerCargoRobot` at line 780):
   - Added `PET_COLOR_HEX` map: `{ red: 0xef4444, blue: 0x3b82f6, ... }`
   - Changed from `hashColor(\`robot-${customerName}\`)` to `PET_COLOR_HEX[petColor]`
   - Both spawn sites pass `request.petColor` as the second argument

3. **White glow instead of green** (`GameMap.tsx ~5708`):
   - Changed `mat.emissive.setHex(0x22c55e)` → `mat.emissive.setHex(0xffffff)`
   - Reduced intensity multiplier: `intensity` → `intensity * 0.6`

---

## Session History (Jun 21 2026) — Part 3

### Goal
Change robot from customer's arms to ground follower during workshop leaving phase.

### Changes Made

1. **Skip `blockCustomer` for leaving NPCs** (`GameMap.tsx` ~5973/5978/5982):
   - Added `npc.stage === 'leaving' ||` bypass to all three movement checks
   - Leaving customers can walk through northbound shifting customers freely
   - Other customers still can't walk through the leaving NPC (excluded from their blockCustomer check)

2. **Robot placed on ground in place-robot phase** (`GameMap.tsx` ~5717-5728):
   - Changed from `sn2.visual.root.attach(robotRoot)` → `workshopRoomGroupRef.current?.attach(robotRoot)`
   - Position: behind customer `(sn2.position.x, sn2.position.y - 0.5, 0.24)`
   - Rotation: `(PI/2, 0, 0)` (standing upright, same as register dock)
   - Scale: `0.18` (ground scale, same as register dock)

3. **Robot follower animation in leaving stage** (`GameMap.tsx` ~5996-6010):
   - First frame: detach from customer → attach to room group, init position
   - Each frame: lerp position toward point 0.5 units behind customer (`lerp factor 0.08`)
   - `rotation.z` matched to customer's facing direction
   - `animateRobotVisual` called with walk speed when moving

4. **Cargo robot disposal on exit** (`GameMap.tsx` ~5932-5933, 5952-5953):
   - Detach from parent + `disposeObject(npc.cargoRobot.root)` in both exit paths
   - Prevents ghost robot being left in the room

### Branch
`customer-queue-system` (committed + pushed + deployed)

---

## Session History (Jul 6 2026)

### Goal
Fix scrap follower closure bug, scrap body donut issue, add per-line TTS to laptop code prompts, and standardize cutscene interaction blocking.

### Changes Made

1. **Scrap follower not showing fix** (`GameMap.tsx` ~4875, ~5967):
   - `scrapVisible` React state was used in the animation loop closure (always `false`). Added `scrapVisibleRef` and used `scrapVisibleRef.current` in the animation loop instead.

2. **Scrap torus body only during battery install** (`GameMap.tsx` ~3314-3335, ~5845-5930):
   - Removed permanent body replacement at scene setup (cylinder → torus was done immediately, making Scrap a donut forever).
   - Body is now replaced with a torus + chest panel only when the battery install `'open-chest'` phase starts.
   - Body is restored to the original cylinder after `'done'` phase, preserving any glow children.
   - Added `scrapOrigBodyRef` to store the original mesh for restoration.

3. **Per-line TTS in laptop code prompts** (`GameMap.tsx` ~8488-8510):
   - Replaced prose instruction text with numbered code template lines + TTS play buttons, matching the customer spec sheet pattern.
   - Each mode shows its expected code lines: name (1 line), date (3 lines), version (2 lines), boot (1 line).
   - Uses `playLineTts` + `renderFormattedSpecLine` + `ttsActiveTextRef` per-line play/stop toggle.

4. **Cutscene interaction blocking** (`GameMap.tsx` ~3821, ~6361, ~6372):
   - Workshop Space handler now guards against `!cinemCamActiveRef.current && rafiqWalkPhaseRef.current === 'idle'`.
   - Rafiq prompt and interaction handler same guards.
   - Prevents Space-triggered interactions during ANY cutscene (cinematic or Rafiq walk).

5. **Deployment** (`scripts/deploy.sh`): Added `CLOUDFLARE_API_TOKEN` loading from `.dev.vars`. Stored token in `.dev.vars` + saved old token as comment. Added `account_id` to `wrangler.jsonc`. Set Cloudflare secrets (4 total). Migrations applied.

### Key Decisions
- All cutscene interaction guards consolidated to check `!cinemCamActiveRef.current` (for `startCinematicCutscene()`-managed) AND `rafiqWalkPhaseRef.current === 'idle'` (for Rafiq walk cutscene).
- Laptop code prompts use the same numbered-line TTS pattern as customer spec sheets for consistency.

### Branch
`main` (committed + pushed + deployed)

---

## Session History (Jul 22 2026)

### Goal
Fix the apartment intro cutscene — camera looking wrong direction, Sparky facing opposite direction, height/position bugs from incomplete Z-up→Y-up conversion.

### Changes Made

1. **Camera Z-sign fixes** (`GameMap.tsx` ~6328-6400):
   - All `camera.lookAt` Z values that were copied as +gameY (Z-up convention) were negated to −gameY (Y-up convention). 
   - Fixes: `1.15→-1.15`, `0.5→-0.5`, `1.2→-1.2`.
   - Camera was looking at wrong locations (north instead of south), so nothing was visible.

2. **Laptop-facing camera offset** (`GameMap.tsx` ~6346-6390):
   - `scratchVec3.current.z + 0.5` → `scratchVec3.current.z + 0.35` (Z-up depth offset was not negated for Y-up Z).

3. **Sparky height bug in fetch-laptop return walk** (`GameMap.tsx` ~4573):
   - `aptSparkyCS.root.position.y = WEST_TARGET.y` was setting the 3D Y (height) to 0.5 (a game-Y coordinate), making Sparky float at twice normal height.
   - Fixed to `aptSparkyCS.root.position.set(aptSparkyCS.root.position.x, 0.22, -WEST_TARGET.y)`.

4. **Base quaternion misalignment** (`GameMap.tsx`):
   - Outdoor Sparky faces **north** (created with `facing: 'north'`, rotated 180°). Apartment Sparky faces **south** (created with default `facing: 'south'`, no rotation). 
   - All cutscene code was using `sparkyBaseQuatRef.current` (outdoor north-facing quat) on the apartment Sparky, causing Sparky to face **opposite** to movement direction.
   - Added `aptBaseQuatRef` storing the apartment Sparky's own (identity) quaternion at creation time (line 3312). All cutscene and battery install code now uses `aptBaseQuatRef.current`.

5. **Coil position Z bug** (`GameMap.tsx` ~4773):
   - `-aptSparkyCS.root.position.y + coilOffset.y * 0.7` was using 3D height as depth coordinate.
   - Fixed to `aptSparkyCS.root.position.z + coilOffset.z * 0.7`.

6. **Scrap follower Y-up bug** (`GameMap.tsx` ~4356, 4366):
   - `scrapPosY` reads `root.position.y` (height) instead of `-root.position.z` (game-Y).
   - `root.position.y = cand.y` sets height to game-Y coordinate.
   - Fixed: reads `-root.position.z` for game-Y, writes `root.position.z = -cand.y`.

7. **Laptop 180° rotation flipped display away from player** (`GameMap.tsx` ~4649):
   - Laptop was rotated `Math.PI` around Y when placed on ground, putting the blue screen on the back of the lid (facing north, away from player).
   - Fixed: removed the 180° rotation line. Display now faces south toward the player during coding phases.

8. **Laptop lowering used Z-coordinate as height** (`GameMap.tsx` ~4650, 4759, 4762):
   - `worldPos.z` (depth = −gameY) was stored as `lowerStartZ`, then used as `position.y` (height).
   - Laptop started at Y≈−1.12 (underground) and rose to Y=0.24.
   - Fixed: stores `worldPos.y` as `lowerStartY`, reads `startY`, animates `position.y = startY + (endY−startY)*easedLower`.

9. **Scrap rotation.x stuck at π/2 during lift** (`GameMap.tsx` ~3208, 4461):
   - Scrap lies face-down in the box (`rotation.x = π/2`). When lifted (`lift-rise` phase), `rotation.x` was never reset to 0.
   - Scrap stayed tilted 90° through lift-carry and lift-lower, only snapping upright during antenna-glow shake.
   - Fixed: added `rotation.x = 0` at the start of `lift-rise`.
   - Also fixed axis mismatch: `rotation.z = 0.4` → `rotation.y = 0.4` at line 3208 (initial box rotation).

### Branch
`battery-only-flow` (not yet committed)

---

## Automated Screenshot Testing

### Script: `screenshot_test.js`

Playwright-based test that simulates a real player exploring the game world. Takes labeled screenshots at various positions and camera angles.

**Usage:**
```bash
node screenshot_test.js
```
Outputs `test_*.png` files to `/tmp/`.

### How it works

1. **Auth**: Reads `WORKOS_API_KEY` from `.dev.vars`, creates a JWT cookie
2. **Modal dismissal**: Clicks "Got it!" button via JS, presses Escape, closes X buttons
3. **Camera rotation**: Acquires pointer lock on the canvas, then dispatches `PointerEvent('pointermove')` with `movementX`/`movementY` — the game's camera handler processes these when `isLockedRef.current === true`
4. **Movement**: WASD keyboard events via Playwright
5. **Screenshots**: Labeled and saved to `/tmp/test_*.png`

### Key helpers in the script

| Helper | What it does |
|--------|-------------|
| `dismissModals()` | Clicks "Got it!", Escape, close X buttons |
| `acquirePointerLock()` | Calls `canvas.requestPointerLock()` via JS |
| `rotateCamera(movementX, movementY, steps)` | Dispatches `pointermove` events with `movementX`/`movementY` properties over N steps |
| `walk(keys, ms)` | Holds WASD keys for `ms` milliseconds |
| `screenshot(label)` | Saves labeled PNG to `/tmp/test_<label>.png` |

### Camera rotation note

The game uses `PointerEvent.movementX/movementY` for camera orbit when pointer lock is active. In headless Chromium, `requestPointerLock()` + dispatched events work — the game's `onPointerMove` handler processes them and updates `yawRef`/`cameraPitchRef`. Each `movementX` unit rotates ~0.012 rad, each `movementY` unit tilts ~0.005 rad.

### Building locations for testing

| Building | Position | Height |
|----------|----------|--------|
| Top-left (concrete) | (-5.7, 4) | 3.5 |
| Top-center (brick) | (6, 4) | 2.5 |
| Top-right (slate) | (18.5, 4) | 3.0 |
| Mid-right (slate) | (18.5, -4) | 2.0 |
| Bottom-right (wood) | (18.5, -11.75) | 2.5 |

To get a good building screenshot: walk the player within 3–5 units of a building, then `rotateCamera()` to face it from the side (negative movementX = look left, positive = look right, negative movementY = look up).

## ⚠️ PRE-DEPLOY RULES — STRICT ENFORCEMENT

### ALWAYS run tests before committing or deploying
1. Run `node screenshot_test.js` after ANY visual change to buildings, roads, or scene objects
2. Review EVERY screenshot before proceeding — do not skip or rush
3. Be **extremely strict** when reviewing: look for Z-fighting, missing geometry, floating objects, wrong positioning, clipping, inverted faces, color mismatches, any visual artifact
4. If even the slightest improvement can be made, make it — don't ship something you know is slightly off
5. Only after screenshots pass inspection: commit and deploy

### Review checklist for screenshots
- Windows/doors visible and flush with wall surface (not floating, not z-fighting)
- All 4 wall faces have windows
- Roads have centered yellow lines
- No missing walls or faces
- Buildings sit on grass, not floating
- No geometry overlaps or clipping
- Shadows look correct (not pitch black, not missing)
- Collapsed corners look natural, not like bugs
- Camera angles show buildings properly (not top-down blobs)