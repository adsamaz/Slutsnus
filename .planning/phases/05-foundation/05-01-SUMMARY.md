---
phase: 05-foundation
plan: 01
subsystem: game-registration
tags: [snus-catcher, engine, game-type, registry, typescript, tdd]
dependency_graph:
  requires: []
  provides: [SenusCatcherEngine, snus-catcher-game-type, snus-catcher-client-placeholder]
  affects: [shared/types, server/registry, client/GameContainer, client/Home, client/Lobby]
tech_stack:
  added: []
  patterns: [20Hz-setInterval-tick, double-init-guard, atomic-GameType-propagation]
key_files:
  created:
    - server/src/games/snus-catcher/engine.ts
    - server/src/games/snus-catcher/engine.test.ts
    - client/src/games/snus-catcher/index.tsx
  modified:
    - shared/src/types.ts
    - server/src/games/registry.ts
    - client/src/games/GameContainer.tsx
    - client/src/pages/Home.tsx
    - client/src/pages/Lobby.tsx
decisions:
  - SenusCatcherEngine uses 50ms setInterval (20 Hz) — matches STATE.md decision
  - Double-init guard clears previous interval before setting new one
  - Placeholder client component requires no state prop — Show block uses plain boolean condition
  - Pre-existing server tsc errors (rootDir, routes) are out of scope — not caused by this plan
metrics:
  duration: ~20 minutes
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_created: 3
  files_modified: 6
  tests_added: 4
  tests_total_after: 50
---

# Phase 5 Plan 01: Snus Catcher Foundation Summary

SenusCatcherEngine stub with 20 Hz tick, 4 GREEN lifecycle tests, and atomic registration across all four TypeScript propagation points (shared types, server registry, client GameContainer, Home/Lobby pages).

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | SenusCatcherEngine stub + 4 lifecycle tests (TDD RED→GREEN) | 1e3cecc | Complete |
| 2 | Atomic GameType propagation — 6 files updated together | 72aae5d | Complete |

## What Was Built

### Task 1: SenusCatcherEngine (TDD)

`server/src/games/snus-catcher/engine.ts` implements `GameEngine`:
- `init()`: clears any existing interval (double-init guard), sets `onStateUpdate`, starts 50ms setInterval tick
- `tick()`: increments `tickCount`, calls `onStateUpdate({ tickCount, status: 'playing' })`
- `handleEvent()`: no-op stub (Phase 6 adds bar movement and collision)
- `getState()`: returns `{ tickCount, status: 'playing' }`
- `destroy()`: clears interval, sets `tickInterval = undefined`

`server/src/games/snus-catcher/engine.test.ts` — 4 tests using `vi.useFakeTimers()`:
1. init() starts emitting state at ~20 Hz (advance 100ms, expect called)
2. destroy() clears interval (no ticks after destroy)
3. Double-init does not accumulate two intervals (exactly 1 tick per 50ms)
4. getState() returns object with tickCount property

### Task 2: Atomic GameType Propagation

All six propagation points updated in a single commit:
- `shared/src/types.ts`: `GameType = 'snusking' | 'snus-catcher'`
- `server/src/games/registry.ts`: `'snus-catcher': SenusCatcherEngine` added to `gameRegistry`
- `client/src/games/snus-catcher/index.tsx`: Placeholder component (`SenusCatcherGame`) renders "Snus Catcher — laddas..." centered div
- `client/src/games/GameContainer.tsx`: `<Show when={gameType() === 'snus-catcher'}>` block added after Snusking block
- `client/src/pages/Home.tsx`: Snus Catcher entry appended to GAMES array (id, name, tagline, description, badges)
- `client/src/pages/Lobby.tsx`: Badge label updated — `'snus-catcher'` resolves to `'Snus Catcher'`

## Verification Results

- Server tests: 50/50 passing (4 new SenusCatcherEngine tests GREEN)
- `shared/tsconfig.json` tsc --noEmit: CLEAN
- `client/tsconfig.json` tsc --noEmit: CLEAN
- `server/tsconfig.json` tsc --noEmit: Pre-existing errors in unrelated files (routes, socket, type-tests) — not caused by this plan

## Decisions Made

1. **20 Hz tick at 50ms** — locked decision from STATE.md, implemented as `const TICK_MS = 50`
2. **Double-init guard** — research pitfall addressed: clear existing interval before creating new one
3. **No state prop on placeholder** — `SenusCatcherGame` takes only `roomCode`; the GameContainer Show block uses a plain boolean condition (not gated on gameState()) per plan specification
4. **Atomic commit for Task 2** — all six files committed together to prevent cascading TypeScript errors

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing server tsc errors in `routes/friends.ts`, `routes/leaderboard.ts`, `routes/rooms.ts`, `socket/index.ts`, and `__type_tests__/registry.type-test.ts` were NOT caused by this plan's changes and are out of scope per deviation boundary rules.

## Self-Check: PASSED

All files verified:
- FOUND: server/src/games/snus-catcher/engine.ts
- FOUND: server/src/games/snus-catcher/engine.test.ts
- FOUND: client/src/games/snus-catcher/index.tsx
- FOUND: .planning/phases/05-foundation/05-01-SUMMARY.md
- FOUND: commit 1e3cecc (Task 1)
- FOUND: commit 72aae5d (Task 2)
