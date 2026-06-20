# Copilot instructions for Robocode

## Commands

- `npm run dev` — start the local Next.js app.
- `npm run build` — production build.
- `npm run start` — run the built app.
- `npm run lint` — ESLint.
- `npm run build:cf` / `npm run preview:cf` / `npm run deploy:cf` — OpenNext Cloudflare build, preview, and deploy.
- `npx playwright test` — run the full Playwright suite in `tests/`.
- `npx playwright test tests/homepage.spec.ts` — run a single spec file.
- `npx playwright test tests/phase1.spec.ts -g "tutorial page validates Java code correctly"` — run one named test.
- `npx wrangler d1 execute robocode --file=migrations/001_init.sql` — apply a D1 migration file from `migrations/`.

## Architecture

- This is a Next.js 16 App Router app. `src/app/` contains pages and API routes; `src/components/` contains the game UI and scene code.
- `src/components/GameMap.tsx` is the core client component. It owns the Three.js scene, animation loop, quest/UI state, multiplayer wiring, and most gameplay behavior.
- `src/components/GameMapLoader.tsx` disables SSR for the game and wraps it in `GameErrorBoundary`.
- `src/components/game/scene.ts`, `helpers.ts`, `types.ts`, `city.ts`, and `tutorialData.ts` split reusable scene builders, math/utilities, shared types, map generation, and tutorial content out of `GameMap.tsx`.
- Auth is cookie-based JWT. Middleware protects every route except `/`, `/login`, `/signup`, and `/api`; auth routes live in `src/app/api/auth/*`.
- Database access goes through Drizzle with Cloudflare D1. Schema lives in `src/db/schema.ts`; migrations are SQL files under `migrations/`.
- Multiplayer uses Apinator. The client receives remote state through `channel.bind(...)` and sends updates with `apinator.trigger(...)`.
- `src/app/layout.tsx` loads the Puter.js script before interactive so the game can fall back to it for TTS.

## Conventions

- Keep `GameMap.tsx` edits surgical. It is large and tightly coupled through refs, effects, and animation-loop state.
- Reuse shared constants and types from `src/components/game/types.ts` instead of duplicating gameplay values.
- Prefer the pure helpers in `src/components/game/helpers.ts` for collision, text sprites, materials, and validation logic.
- Preserve the existing cutscene/UI gating pattern (`hideGameUiRef`, `startCinematicCutscene()`, `endCinematicCutscene()`) when adding cinematic flows.
- When changing the database shape, update `src/db/schema.ts` and add a matching SQL migration in `migrations/`; avoid destructive schema changes.
- Follow the repo's Next.js 16 guidance and check `node_modules/next/dist/docs/` before changing framework-specific behavior.
