# Removed & Archived Features

This document tracks features that were removed from the game to focus the scope.

## Removed in Audit (Jun 2026)

| Feature | Lines Removed | Reason |
|---------|--------------|--------|
| **`sparkyInstall*` refs** (4 refs + 82 lines animation) | ~100 | Dead code — sensor/voice/nav part install refs were never assigned. The part-install cutscene (walk-to-bench → weld → attach-part → walk-back → done) was unreachable. The battery install system replaced this entirely. |
| **`intro-done` quest stage** | ~10 | Orphan stage — never set by any code path. Removed from `SparkyQuestStage` type, `getMissionText`, `showSparkyPrompt`, and money progress bar. |
| **Animation loop emergency scrap activation** | ~15 | Redundant — scrap follower was being activated in 4 places (dialog handler, quest-stage effect, scene creation, animation loop). Centralized to single `activateScrapFollower()` function. |
| **Debug globals** (`__scrapLogged`, `__scrapFollowerX/Y`) | ~5 | Removed console noise. `__scrapFollowerX/Y` kept as single-line ref for Playwright test compatibility. |

## Removed in Port Settlement Build (Jul 2026)

### Top-Right UI Buttons
- **Guilds ⚔️** — social guild system was functional (list, create, join) but had no gameplay integration. Removed to keep UI minimal.
- **Friends 👥** — friend requests/search were functional but unused in gameplay. Removed.
- **Profile 👤** — profile modal showed stats but no gameplay impact. Removed.
- **Settings ⚙️** — **KEPT**. Debug mode, teleport, logout, reset remain useful.
- `ModalShell.tsx` — removed entirely (all four modal components removed).

### Transporter Store
- **3D building** at (-18.75, -12) — fully modeled structure with walls, roof, sign, interior props (bicycle, car mechanic).
- **Mechanic NPC** — vendor character at back of store.
- **Interaction hitbox** — 3.0 radius circle that showed "Transporter" prompt on Space.
- **Purchase modal** — displayed Bicycle ($100) and Car ($1,000) with "Coming soon!" on click. Neither was functional.
- **Obstacle hitboxes** in `buildObstacles()` — south, north, and west wall collisions.

### Arena
- **3D building** at (18.75, -12) — 3-story purple/red/blue tower with ARENA sign and glowing door.
- **Arena room group** — interior 12x12 floor with grid overlay, walls, center light.
- **Door hitbox** — circle at (18.75, -10.25) radius 0.5.
- **Room transition** — entering/exiting arena via door + Space key.
- **PvP multiplayer system**:
  - `leaveArenaRoom()` — reset state, POST leave, WebSocket leave
  - `challengePlayer()` — POST challenge, WebSocket notify
  - `acceptChallenge()` / `declineChallenge()` — response flow
  - `submitArenaCode()` — code submission + winner detection
- **WebSocket events**: `arena-join`, `arena-leave`, `arena-challenge`, `arena-accept`, `arena-decline`
- **Arena overlay UI** (`ArenaOverlay.tsx`) — player list, challenge buttons, code editor, output
- **API routes**: `/api/arena` (join/leave/challenge/accept/decline/list), `/api/arena/submit` (code submission)
- **State**: `inArenaRoom`, `arenaPlayers`, `arenaChallenge`, `arenaCode`, `arenaOutput`, `arenaBattleActive` — all removed.

The arena was fully implemented but removed to focus the scope on single-player world-building. It can be restored from git history if needed later.

## Added: Port Settlement & Ruined City (Jul 2026)

The world was redesigned from a bare grid layout into a post-apocalyptic coastal settlement with proper road flow and atmosphere.

### West — Port & Beach
- **Sand patch** over the former transporter grass block (x=-18.75, y=-12)
- **Canal** — narrow water channel running west to simulate a working harbor
- **Wooden wharf/dock** — two-tier dock with posts, railings, and boardwalk
- **Fishing boat** — small hull with mast and sail, tied to the main dock
- **Cargo crates** — stacked near dock entrance (3 stack, 3 more near secondary dock)
- **Barrel** — near crates
- **A-frame crane** — angled legs, cross beam, hoist for loading cargo
- **Port lanterns** — 4 light poles with glowing spheres along the dock
- **Cobblestone path** — connects port to the main road

### Center — Cobblestone Road
- Road color changed from cold `0x5a6a7a` to warm cobblestone `0x6b635e`
- **Existing road grid** kept intact — connects port → workshop (door -6,-10.3) → bazaar → apartment → parts shop → barrier

### East — Tree/Ruin Barrier
At x≈11, y≈-9 — blocks passage eastward:
- **3 fallen tree trunks** — laid at different angles
- **6 overgrown bushes** — dark green spheres of varying sizes
- **Crumbled stone wall** — 3 tilted box segments with rubble at base
- **DANGER sign** — red sign on post with "DANGER — RECLAIMED ZONE" text
- **Hitbox wall** — 4 box hitboxes blocking player movement through the barrier

### Further East — Ruined City Skyline
At x=14 to 24, visible beyond the barrier:
- **4 ruined skyscrapers**: tallest (16,-10, 2.0u), medium (18,-12, 1.7u), short-wide (20,-9, 1.2u), slender tilted (22,-11, 2.2u)
- **Broken tops** — tilted pieces, spikes, scorch marks on all buildings
- **Vines/overgrowth** — dark green strips covering building sides
- **Window patterns** — dark vertical stripes on medium building
- **Foreground debris** — 6 partial wall segments in front of skyscrapers
- **Haze layer** — semi-transparent dark blue plane for atmospheric depth
- **Dead trees** — bare branch structures near the ruins

### Forest Perimeter
- **Pine forest** — at north edge (y=9) and south edge (y=-23), spaced every 4 units
- **Dead trees** — near ruins east side, branch structures
- **Scattered pines** — between barrier and ruins, and on west side near port

### Atmosphere
- **Fog** — `THREE.Fog(0x3a5a7a, 22, 50)` added to scene
- **Water** — darker `0x2a4a6a` (was `0x4a7a9a`)
- **Ambient light** — warmer `0xffcc88` (was `0xffeedd`), intensity 0.7 (was 0.6)
- **Scene background** — `0x3a5a7a` (was `0x4a7a9a`)

| Feature | Status | Notes |
|---------|--------|-------|
| **Auto-rickshaws** | Never implemented | `createAutoRickshaw` exported from `city.ts` but never called |
| **Park benches** | Never implemented | Empty position array in city building code |
| **Trash cans** | Never implemented | Empty position array |
| **Unit 3/4 quests** | Placeholder | Sparky says "coming soon" |
| **`createBigPetShop`** | Defined unused | In `scene.ts` but never called |
