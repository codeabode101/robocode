---
name: robocode-dev
description: Use when working on the Robocode 3D game island project. Covers pair programming mode (interactive, asks questions, fast tests) and autonomous mode (continuous loop, never stops, writes state for compaction resume, builds spatial tests, MCP-driven exploration loop).
---

# Robocode Development Skill

## ⚠️ Z-UP COORDINATE SYSTEM — READ BEFORE ANY 3D WORK

This project uses **Z-up** (NOT Y-up like Three.js defaults, Unity, or most game engines). Every rotation, position, and camera calculation depends on this.

```
X = east/west
Y = north/south
Z = UP (vertical)
```

**Rotation rules:**
- `rotation.x` → rotates in **YZ plane** (north-south × up-down)
- `rotation.y` → rotates in **XZ plane** (east-west × up-down)
- `rotation.z` → rotates in **XY plane** (east-west × north-south) ← HORIZONTAL, NOT for face-mounted objects

**Window face rotations:**
| Face | Axis | Window spans | Correct rotation | WRONG rotation |
|------|------|-------------|-----------------|----------------|
| South/North | `'x'` | X (width) × Z (height) | `rotation.y` | `rotation.z` ← sticks out! |
| East/West | `'y'` | Y (width) × Z (height) | `rotation.x` | `rotation.z` ← sticks out! |

**Why this matters:** If you use `rotation.z` on a south-face plank, it rotates in the XY plane (horizontal) instead of the XZ plane (the window face). The plank will protrude from the building instead of lying flat across the window.

**Building z-positions:**
- Road mesh: z=0.14
- Grass blocks: z=0.17
- Buildings: z=0.25
- Player/NPCs: z=0.24

**Camera:** PerspectiveCamera(65), pitch starts at 0.8 rad (~46°). `movementX * 0.012` = yaw, `movementY * 0.005` = pitch. Top-down view, looking along -Z.

---

## Project Quick Reference

### Stack
Next.js 16 (Turbopack), Three.js r184, Drizzle ORM + CockroachDB, WorkOS auth, Apinator WebSocket multiplayer, Cloudflare Workers deploy.

### Directory Structure
```
src/
  components/
    GameMap.tsx          # Main game (~7400 lines)
    game/
      types.ts           # Shared types, constants, enums
      helpers.ts         # Pure utilities (materials, sprites, collision)
      city.ts            # City layout (roads, buildings, plaza, shops)
      scene.ts           # Building generator, window states, interiors
  app/
    game/page.tsx        # Game page (auth wrapper)
    api/                 # API routes
  hooks/
    useMultiplayer.ts    # WebSocket + HTTP multiplayer
  db/
    schema.ts            # Database schema
    index.ts             # Drizzle ORM setup
```

### Key Conventions

**Hitbox Rule**: Every visible 3D object MUST have a corresponding collision hitbox. Defined as `{ shape: 'box', center: { x, y }, halfWidth, halfHeight }` or `{ shape: 'circle', center: { x, y }, radius }`. Added to room obstacle arrays (`workshopObstaclesRef`, `shopObstaclesRef`, etc.).

**Z-Positions**:
- Road mesh: z=0.14
- Grass blocks: z=0.17
- Buildings: z=0.25
- Player/NPCs: z=0.24 (standing on ground)

**Road Grid**:
- Horizontal roads at y≈0, y≈-8.25, y≈8.5
- Vertical roads at x≈0, x≈12, x≈24
- xGaps: `[-10.4, -1.0], [1.0, 11.0], [13.0, 23], [25.0, 29]`
- yGaps: top `[1.0, 7.0]`, mid `[-7.0, -1.0]`, bottom `[-14, -9.5]`
- Road mesh: `BoxGeometry(46, 24, 0.04)` at `(9, -2, 0.14)`

**Camera**:
- PerspectiveCamera(65, aspect, 0.1, 100)
- Pitch starts at 0.8 rad (~46°)
- `movementX * 0.012` = yaw, `movementY * 0.005` = pitch
- ZOOMED: camDist=2.0, lookDist=2.1, height=1.7, fov=60
- ZOOM_RANGE=2.0

**Island**: Custom `THREE.ShapeGeometry`. Flat left edge at x=-10.4, flat bottom at y=-14. Arc uses `absarc(0,0,40,...)`.

**Building Positions**:
| Building | Position | Notes |
|----------|----------|-------|
| Concrete | (-5.7, 4) | w=8, d=4.5, h=3.5 |
| Brick | (6, 4) | w=8.5, d=4.5, h=2.5 |
| Slate top | (18.5, 4) | w=9, d=4.5, h=3.0 |
| Slate mid | (18.5, -4) | w=9, d=4.5, h=2.0 |
| Wood | (18.5, -11.75) | w=9, d=3.5, h=2.5 |
| Wall concrete | (28, 1) | d=8, h=7.5 |
| Wall brick | (28, -9.5) | d=9, h=6.5 |

**Deploy**: `./scripts/deploy.sh` (Cloudflare Workers). Reads `NEXT_PUBLIC_APINATOR_APP_KEY` from `.dev.vars`. After first deploy, set secrets with `npx wrangler secret put <NAME>`.

**Branch Safety**: Always work on a separate branch. Only merge to `main` after user confirms. `git checkout -b <feature-name>`.

**Database Safety**: NEVER run destructive migrations. Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` only.

### Test Commands
```bash
npm run build                          # Build (120s timeout)
./scripts/deploy.sh                    # Deploy to Cloudflare (120s timeout)
node screenshot_test.js                # 12-scene visual test (60s per scene)
node spatial_tests.js                  # Position/alignment/collision tests
```

---

## Pair Programming Mode

**Trigger**: "pair mode", "pair program", "let's work together", or when the user is actively chatting and giving directions.

### Rules
1. **Ask before acting.** Present 2-3 options when there's ambiguity. Never assume.
2. **Run `npm run build`** after each change (fast, local verification).
3. **Run `node screenshot_test.js`** only when visual verification is needed.
4. **Check in after each logical change** — don't move on until user confirms.
5. **Only change what was asked.** Be conservative. Don't refactor things the user didn't mention.
6. **Ask questions** if something seems off, if there are multiple approaches, or if the change might have side effects.

### Workflow
```
User asks → Clarify → Make change → Build → Show result → Ask "looks good?" → Next
```

---

## Autonomous Mode

**Trigger**: "autonomous", "go wild", "continuous mode", "run nonstop", "you decide", or any broad directive followed by "go" / "run with it" / "you decide" / "make it happen".

### Core Rules
- **NEVER stop. NEVER wait for user.** Keep going until physically stopped.
- **NEVER stop with remaining tasks.** If there are unfinished items in your todo list, you MUST complete ALL of them before stopping, committing, deploying, or asking the user anything. Do not mark items as "lower priority" or defer them. Every task the user asked for is equally important. If tasks remain, keep working — do not output a summary or ask "should I continue?".
- **Everything is in scope**: buildings, roads, windows, game logic, multiplayer, database, tests, visual fixes, bugs — anything.
- **After compaction**: read `.opencode/robocode-autonomous-state.md`, pick up exactly where you left off. Do NOT restart from scratch.
- **Make decisions independently.** Think what's best for the project. Use project conventions above.
- **Write state file after EVERY iteration** so compaction resume works.

### Autonomous Loop

```
1. READ STATE FILE
   → .opencode/robocode-autonomous-state.md
   → Know what's next, what's done, what's broken

2. MCP EXPLORE (optional, for discovery)
   → Open game via Playwright MCP
   → Walk player around, interact with NPCs
   → Trigger cutscenes, check collision
   → Take screenshots, read console errors
   → Discover new issues to fix

3. FIX / BUILD
   → Edit code (GameMap.tsx, scene.ts, city.ts, helpers.ts, etc.)
   → Follow project conventions

4. VERIFY (automated)
   → npm run build
   → ./scripts/deploy.sh
   → node screenshot_test.js
   → node spatial_tests.js
   → Review EVERY screenshot strictly

5. VERIFY (MCP play-through)
   → Walk to the changed area
   → Confirm visual fix
   → Confirm collision works
   → Confirm interaction works

6. COMMIT + LOG
   → git add -A && git commit -m "<description>"
   → Update state file

7. REPEAT from step 1
```

### Graceful Test Handling
- `screenshot_test.js`: 60s timeout per scene, max 2 retries, page crash → retry → skip after max retries
- `npm run build`: 120s timeout
- `deploy.sh`: 120s timeout
- `spatial_tests.js`: 60s timeout per test, graceful skip on crash
- **NEVER let a test failure stop the loop** — log it, note in state file, move to next task

### MCP-Driven Discovery
Use Playwright MCP to explore the game in real-time:
- Walk into every building → check interior rendering
- Talk to every NPC → verify dialog triggers
- Trigger every cutscene → watch full sequence
- Walk along every road → check alignment
- Stand at every building face → check windows, doors, boarding
- Try to walk through solid objects → find missing hitboxes
- Check console for errors/warnings

When you find an issue:
1. Note it in the state file
2. Fix it in code
3. Build + deploy + test
4. MCP play-through to verify the fix
5. Write a spatial test that catches it automatically
6. Commit

### Spatial Tests to Build (`spatial_tests.js`)
Each test loads the game, walks to a position, takes a screenshot, and verifies:

| Test | What it checks |
|------|---------------|
| Building positions | Each building's west/south face is at expected coordinates |
| Road alignment | Yellow dashed lines centered on roads, no offset |
| Sidewalk flush | Sidewalks sit at z=0.17, flush with road edges |
| No overlaps | Adjacent buildings don't clip into each other |
| Camera zoom | At ZOOMED level, buildings are visible in frame |
| Window states | Boarded windows show planks (not solid board), glass is dark/reflective |
| Green stripe | No green grass visible between building base and ground (z-ordering correct) |
| Collision | Player can't walk through buildings (hitbox blocks) |
| Door access | Doors are reachable, not blocked by geometry |
| Island edge | Flat left/bottom edges render correctly |

Test structure:
```javascript
const tests = [
  { name: 'concrete south face', walk: [...], rotate: [...], verify: (screenshot) => {...} },
  { name: 'road alignment', walk: [...], rotate: [...], verify: (screenshot) => {...} },
  // ...
];

// Each test: load game → dismiss modals → walk → rotate → screenshot → analyze → pass/fail
// Timeout 60s per test, max 2 retries, crash → skip
```

---

## State File Format

`.opencode/robocode-autonomous-state.md` — updated after EVERY autonomous iteration:

```markdown
# Robocode Autonomous State
Last updated: 2026-07-17T19:30:00Z
Iteration: 47
Mode: autonomous

## Current Task
Fix boarded windows on east wall buildings — planks not visible, solid board backing showing.

## Completed This Session
- Extended road grid to x=27 (commit abc123)
- Added wall buildings at x=28 (commit def456)
- Fixed green stripe z-ordering (commit ghi789)
- Created spatial_tests.js with 10 tests (commit jkl012)

## Next Up
- Fix boarded window rendering (in progress)
- Add dashed lines for vertical road at x=24
- Test all building interiors via MCP
- Verify collision hitboxes for east wall buildings

## Known Issues
- spatial_tests.js scene 4 sometimes times out (page crash)
- Wood building west face windows look too dark

## Test Results Last Run
- screenshot_test.js: 11/12 passed, 1 failed (scene 4 timeout)
- spatial_tests.js: 8/10 passed, 2 failed (building position check, window state check)
```

After compaction: read this file, see iteration 47 was mid-fix on boarded windows, continue from there. Do NOT restart from "what should I do?".
