---
phase: 02-card-design-balance-and-game-economy
plan: "02"
subsystem: testing
tags: [vitest, tdd, red-state, snusking, event-multipliers, beer-resource, sabotage]

# Dependency graph
requires:
  - phase: 02-card-design-balance-and-game-economy
    plan: "01"
    provides: "Phase 2 type contracts — SnuskingPlayerState sabotage flags, SnuskingEventCard, extended SnuskingAction"
provides:
  - "RED-state it.todo stubs in rules.test.ts for event multiplier scoring (5 stubs, EVENT-SYS-3)"
  - "RED-state it.todo stubs in engine.test.ts for beer resource tracking (4 stubs, BEER-RES)"
  - "RED-state it.todo stubs in engine.test.ts for sabotage and immunity (6 stubs, TRADE-SAB)"
  - "Baseline scoreCards test replaced with real assertion (2 cards, no event, 35 points)"
  - "makeCardInstance test helper added to rules.test.ts"
affects:
  - "02-04 — scoreCards event multiplier implementation must turn these stubs green"
  - "02-05 — engine sabotage/beer implementation must turn these stubs green"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "it.todo() for type-safe RED stubs — avoids import/TypeScript errors when implementation types not yet final"
    - "Nyquist compliance pattern — write test stubs before implementation to define behavioral contracts"

key-files:
  created: []
  modified:
    - server/src/games/snusking/rules.test.ts
    - server/src/games/snusking/engine.test.ts

key-decisions:
  - "Use it.todo() instead of expect(true).toBe(false) — avoids TypeScript errors when referenced types may not exist yet"
  - "Separate describe blocks per requirement group (EVENT-SYS-3, BEER-RES, TRADE-SAB) — aligns stubs with requirement IDs"

patterns-established:
  - "Phase 2 RED stubs: all new behavioral tests use it.todo() form and are grouped by requirement ID"

requirements-completed:
  - EVENT-SYS
  - BEER-RES
  - TRADE-SAB

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 2 Plan 02: Phase 2 RED Test Stubs Summary

**15 it.todo RED-state stubs covering event multipliers (rules.test.ts) and beer/sabotage engine behaviors (engine.test.ts), with baseline scoreCards assertion replaced from placeholder to real 35-point check**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T15:34:02Z
- **Completed:** 2026-03-13T15:42:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced placeholder `scoreCards` test (`expect(true).toBe(true)`) with real baseline: two cards sum to 35 points
- Added 5 it.todo stubs in `scoreCards with event multipliers (EVENT-SYS-3)` describe block in rules.test.ts
- Added 4 it.todo stubs in `Beer resource (BEER-RES)` describe block in engine.test.ts
- Added 6 it.todo stubs in `Sabotage and immunity (TRADE-SAB)` describe block in engine.test.ts
- Added `makeCardInstance` test helper and `SnuskingCardInstance` import to rules.test.ts
- Full suite: 31 passing, 15 todo, 0 failures — zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend rules.test.ts with combo multiplier stubs** - `39ed8e2` (test)
2. **Task 2: Extend engine.test.ts with beer and sabotage stubs** - `35fbaf8` (test)

**Note:** Plan 02-01 types were also uncommitted and were committed atomically as prerequisite: `70d6073` (feat)

## Files Created/Modified

- `server/src/games/snusking/rules.test.ts` — replaced placeholder scoreCards test, added 5 event-multiplier stubs, added makeCardInstance helper, added SnuskingCardInstance import
- `server/src/games/snusking/engine.test.ts` — appended Beer resource (BEER-RES) and Sabotage and immunity (TRADE-SAB) describe blocks with 10 total it.todo stubs

## Decisions Made

- Used `it.todo('description')` for all new stubs rather than `expect(true).toBe(false)` — this avoids TypeScript/import errors if plan 02-01 types are not installed yet, and produces cleaner test output (todo state vs failure)
- Grouped stubs by requirement ID (EVENT-SYS-3, BEER-RES, TRADE-SAB) to maintain clear traceability from test to requirement

## Deviations from Plan

None — plan executed exactly as written. The rules.test.ts changes were already present from earlier session work; they were committed as part of this plan's execution.

## Issues Encountered

The rules.test.ts Task 1 content had been written in a prior session but never committed. The shared/src/types.ts changes from plan 02-01 were also uncommitted. Both were committed during this execution in the correct order (types first, then test stubs).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 15 RED-state stubs define the behavioral contracts for plans 02-04 and 02-05
- Plan 02-04 must implement event multiplier logic in `scoreCards()` to turn 5 rules.test.ts stubs green
- Plan 02-05 must implement beer resource and sabotage/immunity in the engine to turn 10 engine.test.ts stubs green
- No blockers — types are in place, stubs are committed, ready for implementation plans

---
*Phase: 02-card-design-balance-and-game-economy*
*Completed: 2026-03-13*
