# Persistence Overhaul

## Root Cause
The `resetStages` list at `GameMap.tsx:555` included valid stage names (`unit2`, `unit3`, `unit4`, `unit2-done`, `unit3-done`, `unit4-done`, `all-done`). Every reload with progressed stages triggered `/api/profile/reset` and wiped back to `unit1-done`.

## Changes

### 1. Wrappers → optimistic only (no fetch)
`updateQuestStage`, `updateBackpack`, `updateMoney` now only set state + ref. Persistence is handled by a single mechanism below.

### 2. Persistence: retry-based save + beforeunload beacon
Replace all old debounced/effect-based persistence (`moneyTimerRef`, `backpackTimerRef`, `saveMoney`, `saveBackpack`, quest stage effect with `prevStageRef`) with:

- **`lastConfirmedQuestRef`**, **`lastConfirmedBackpackRef`**, **`lastConfirmedMoneyRef`** — track what the server has acknowledged
- **`saveToServer(url, body, retriesLeft, onSuccess)`** — shared retry function with 1s backoff, 3 retries, logs errors to console (no silent `.catch(() => {})`)
- Three effects (quest stage, backpack, money) — when state differs from `lastConfirmed*Ref`, call `saveToServer`
- **`beforeunload` handler** — compares refs vs lastConfirmed refs; if different, sends `sendBeacon` with a `Blob` (Content-Type: `application/json`)

### 3. Profile load marks initial state as confirmed
After reading from the server at lines 563-581, set:
```
lastConfirmedMoneyRef.current = data.currency ?? 0;
lastConfirmedQuestRef.current = mappedStage;
lastConfirmedBackpackRef.current = data.backpack;
```
so the persistence effects don't re-save what the server just told us. Migration case (line 583-586) intentionally does NOT set lastConfirmed — it needs to persist the upgrade.

### 4. Remove unused timers
Delete `moneyTimerRef`, `backpackTimerRef` declarations and their effects.

### Files changed
- `src/components/GameMap.tsx` — wrappers (lines 390-421), profile load (563-581), persistence block (605-647)
