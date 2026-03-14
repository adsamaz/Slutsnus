---
phase: 06-core-loop
plan: "02"
subsystem: gaming
tags: [typescript, vitest, tdd, physics, game-engine, snus-catcher]

# Dependency graph
requires:
  - phase: 06-core-loop/06-01
    provides: SenusCatcherState/PlayerState/Object/Action types and 22 RED it.todo() stubs
  - phase: 05-snus-catcher-foundation
    provides: SenusCatcherEngine stub, GameType union, registry entry
provides:
  - physics.ts with pure helper functions: spawnObject, moveObjects, resolveCollisions, PHYSICS constants
  - Full SenusCatcherEngine FSM: init, handleEvent, getState, destroy, tick, end
  - All 22 RED it.todo() stubs turned GREEN (72 total server tests, 0 failures)
affects:
  - 06-core-loop (Wave 1 plans: physics engine now drives all server-authoritative game logic)
  - client/src/games/snus-catcher (will consume SenusCatcherState emitted from this engine)
  - server/src/socket/room.ts (already handles status='ended' + results — no changes needed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure physics module (physics.ts) with no side effects — all functions testable in isolation"
    - "Engine imports PHYSICS constants from physics.ts — no hardcoded magic numbers in engine.ts"
    - "vi.restoreAllMocks() in afterEach prevents Math.random spy leakage between test cases"
    - "Mock all Math.random calls with a single constant value (e.g. 0.05) to keep sequences predictable"

key-files:
  created:
    - server/src/games/snus-catcher/physics.ts
  modified:
    - server/src/games/snus-catcher/engine.ts
    - server/src/games/snus-catcher/engine.test.ts

key-decisions:
  - "Objects are spawned AFTER moveObjects in the tick body — newly spawned objects have y=0 on the same tick they appear, and are first moved on the next tick"
  - "end() emits players with objects:[] in the ended state — cleaner for client end-screen which has no use for in-flight objects"
  - "vi.restoreAllMocks() required in afterEach when using Math.random spy — Vitest does not auto-restore between tests in the same describe block"
  - "Collision tests use mockReturnValue(constant) not sequential mock — simpler and less fragile than cycling sequences"

patterns-established:
  - "Physics pure module: extract all physics math into a separate testable module with no imports from engine"
  - "TDD determinism via Math.random mock: use single constant value rather than cycling sequences for engine collision tests"

requirements-completed: [GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, PLAT-02, PLAT-03]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 6 Plan 02: Snus Catcher — Physics Engine and GREEN Tests

**Server-authoritative physics FSM with pure physics.ts helpers (spawnObject/moveObjects/resolveCollisions) and 22 previously-RED stubs now GREEN (72 total passing tests)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-14T23:24:02Z
- **Completed:** 2026-03-14T23:32:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created physics.ts with PHYSICS constants, spawnObject, moveObjects, resolveCollisions as pure functions (no side effects, no engine imports)
- Rewrote engine.ts: full FSM with tick body (moveObjects + probabilistic spawn + resolveCollisions + win detection), handleEvent bar clamping, end() emitting status='ended' with ranked results
- Replaced all 22 it.todo() stubs with real tests — 72 total server tests pass, 0 failures, 0 pending todos

## Task Commits

1. **Task 1: Create physics.ts with pure helper functions** - `4ef7f84` (feat)
2. **Task 2: Implement full physics FSM engine and turn all RED stubs GREEN** - `e8df417` (feat)

## Files Created/Modified

- `server/src/games/snus-catcher/physics.ts` — Pure physics module: PHYSICS constants, spawnObject, moveObjects, resolveCollisions
- `server/src/games/snus-catcher/engine.ts` — Full SenusCatcherEngine FSM replacing Phase 5 stub
- `server/src/games/snus-catcher/engine.test.ts` — 22 it.todo() stubs replaced with real implementations

## Decisions Made

- Objects are spawned AFTER moveObjects in the tick body. A newly spawned object has y=0 at the end of the tick it was created, and y=0.008 (FALL_SPEED_PER_TICK) at the end of the next tick. This was discovered during the "y=0 initially" test assertion design — the test had to be adjusted to assert `y >= 0` after 1 tick, not `y > 0`.
- `end()` clears player objects arrays in the ended state (`objects: []`). The end screen doesn't need in-flight objects and it simplifies the client.
- `vi.restoreAllMocks()` is required in `afterEach` for any describe block that uses `vi.spyOn(Math, 'random')`. Without it, the mock from test N bleeds into test N+1, causing intermittent spawn failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertions for object y-position after 1 tick**
- **Found during:** Task 2 (engine.test.ts implementation)
- **Issue:** Test "spawned objects have x in [0.0, 1.0] and y = 0.0 initially" asserted `obj.y > 0` after 1 tick. But objects spawned in a tick are added AFTER `moveObjects`, so y=0 at end of spawn tick (moved next tick). Assertion was incorrect.
- **Fix:** Changed assertion from `toBeGreaterThan(0)` to `toBeGreaterThanOrEqual(0)` with a comment explaining the spawn-then-move ordering.
- **Files modified:** server/src/games/snus-catcher/engine.test.ts
- **Committed in:** e8df417 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TypeScript errors in mock.calls callbacks**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** Destructuring `([s]: [SenusCatcherState])` in `.find()` callbacks failed TypeScript check — `mock.calls` type is `any[][]` and tuple destructure is not assignable.
- **Fix:** Changed all such callbacks to `(args: unknown[]) => (args[0] as SenusCatcherState).status === 'ended'` pattern.
- **Files modified:** server/src/games/snus-catcher/engine.test.ts
- **Committed in:** e8df417 (Task 2 commit)

**3. [Rule 1 - Bug] Added vi.restoreAllMocks() to afterEach in all inner describe blocks**
- **Found during:** Task 2 (test failures in "spawned objects have x in [0.0, 1.0]")
- **Issue:** Math.random spy from previous test (mockReturnValue 0.0) persisted into next test despite calling vi.spyOn again, causing 0 objects after 1 tick in the second test.
- **Fix:** Added `vi.restoreAllMocks()` to `afterEach` in all 4 inner describe blocks (GAME-03/04, GAME-03, GAME-05/06, GAME-08/09).
- **Files modified:** server/src/games/snus-catcher/engine.test.ts
- **Committed in:** e8df417 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All auto-fixes were test correctness issues, not scope creep. Engine implementation executed exactly as specified.

## Issues Encountered

- Server `npx tsc --noEmit` reports pre-existing errors in registry.type-test.ts, routes, and socket (confirmed pre-existing from 06-01-SUMMARY.md). No new TypeScript errors in physics.ts or engine.ts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Server engine fully functional and tested — all 22 GAME-02 through GAME-09 requirements verified GREEN
- engine.ts emits SenusCatcherState compatible with room.ts onUpdate broadcast (`status='ended'` + `results` array) — leaderboard write and game:end broadcast handled automatically
- physics.ts exports are ready for any additional unit tests if needed
- Wave 1 can proceed to client canvas implementation (06-03) and socket integration (06-04)

---
*Phase: 06-core-loop*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: server/src/games/snus-catcher/physics.ts
- FOUND: server/src/games/snus-catcher/engine.ts
- FOUND: server/src/games/snus-catcher/engine.test.ts
- FOUND: .planning/phases/06-core-loop/06-02-SUMMARY.md
- FOUND commit: 4ef7f84 (feat: physics.ts)
- FOUND commit: e8df417 (feat: engine FSM + GREEN tests)
