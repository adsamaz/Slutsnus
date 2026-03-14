---
phase: 06-core-loop
plan: "01"
subsystem: testing
tags: [typescript, vitest, tdd, types, shared]

# Dependency graph
requires:
  - phase: 05-snus-catcher-foundation
    provides: SenusCatcherEngine stub, GameType union, snus-catcher registry entry
provides:
  - SenusCatcherObject, SenusCatcherPlayerState, SenusCatcherState, SenusCatcherAction in shared/src/types.ts
  - 22 RED-state it.todo() stubs in engine.test.ts grouped by GAME-02 through GAME-09
affects:
  - 06-core-loop (Wave 1 plans implement against these types and stubs)
  - client/src/games/snus-catcher (will import SenusCatcherState)
  - server/src/games/snus-catcher/engine.ts (will import SenusCatcherState)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Snus Catcher types appended to shared/src/types.ts (no separate file) — matches Snusking convention"
    - "it.todo() stubs grouped by requirement ID in separate describe blocks"
    - "objects per-player under SenusCatcherPlayerState (independent playfields model)"

key-files:
  created: []
  modified:
    - shared/src/types.ts
    - server/src/games/snus-catcher/engine.test.ts

key-decisions:
  - "SenusCatcherObject.type uses 'fresh'/'spent' string union (not boolean) — explicit discriminant for collision logic"
  - "objects array lives on SenusCatcherPlayerState (per-player) not SenusCatcherState (shared) — independent playfields model"
  - "barXFraction is last-known server position (float 0.0-1.0); client renders at cursor immediately without waiting for echo"
  - "SenusCatcherAction uses payload wrapper for bar-move xFraction — consistent with GameAction interface pattern"

patterns-established:
  - "Wave 0 TDD: types + RED stubs before any implementation — Wave 1 plans fill in GREEN implementations"
  - "Requirement ID in describe block name (GAME-07, GAME-02, etc.) traces tests directly to requirements doc"

requirements-completed: [GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09]

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 6 Plan 01: Snus Catcher — Type Contracts and RED Test Stubs

**SenusCatcherState/PlayerState/Object/Action types added to shared types, plus 22 it.todo() RED stubs for all physics requirements (GAME-02 through GAME-09)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T23:20:25Z
- **Completed:** 2026-03-14T23:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added 4 Snus Catcher types to shared/src/types.ts: SenusCatcherObject, SenusCatcherPlayerState, SenusCatcherState, SenusCatcherAction
- Extended engine.test.ts with 22 it.todo() stubs grouped into 6 describe blocks (one per requirement group)
- All 50 existing server tests remain GREEN; 22 new stubs appear as todo (pending)

## Task Commits

1. **Task 1: Add Snus Catcher shared types** - `9293722` (feat)
2. **Task 2: Add RED-state it.todo() stubs** - `884d556` (test)

## Files Created/Modified

- `shared/src/types.ts` — Appended SenusCatcherObject, SenusCatcherPlayerState, SenusCatcherState, SenusCatcherAction after existing SnuskingAction
- `server/src/games/snus-catcher/engine.test.ts` — Extended with 6 describe blocks and 22 it.todo() stubs (GAME-07, GAME-02, GAME-03+04, GAME-03 movement, GAME-05+06, GAME-08+09)

## Decisions Made

- objects array placed on SenusCatcherPlayerState (not top-level SenusCatcherState) — implements the independent playfields model from RESEARCH.md; each player has their own falling items with independent X positions
- SenusCatcherAction uses `{ type: '...'; payload: { xFraction: number } }` wrapper — consistent with existing GameAction interface pattern used at the Socket.IO boundary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Server tsconfig type-check (`npx tsc --noEmit -p server/tsconfig.json`) reports pre-existing errors (rootDir config, friends/leaderboard routes, registry type tests) — confirmed pre-existing by git stash verification, unrelated to this plan's changes. Shared workspace compiles clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Type contracts fully defined — Wave 1 plans (06-02 through 06-05) can import SenusCatcherState from @slutsnus/shared
- 22 RED stubs document exact expected behaviors; Wave 1 executor knows what each test must prove
- No blockers

---
*Phase: 06-core-loop*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: shared/src/types.ts
- FOUND: server/src/games/snus-catcher/engine.test.ts
- FOUND: .planning/phases/06-core-loop/06-01-SUMMARY.md
- FOUND commit: 9293722 (feat: shared types)
- FOUND commit: 884d556 (test: RED stubs)
