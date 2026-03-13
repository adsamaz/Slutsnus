---
phase: 02-card-design-balance-and-game-economy
plan: 04
subsystem: game-engine
tags: [scoring, event-multipliers, beer-bonus, vitest, tdd, typescript]

# Dependency graph
requires:
  - phase: 02-01
    provides: SnuskingEventCard type, SnuskingCardStrength, SnuskingCardFlavor in shared/src/types.ts
  - phase: 02-03
    provides: strength/flavor stamped on card instances via buildDeck()
  - phase: 01-03
    provides: scoreCards, spendCards, rules.ts baseline implementation
provides:
  - scoreCards(cards, activeEvent?, beerCardId?) with tiered event multipliers and beer bonus
  - spendCards(state, playerId, cardIds, activeEvent?, beerCardId?) threading params through
  - computeEventMultiplier() helper (both 2x, one 1.5x, neither 1.0x)
  - All 5 EVENT-SYS-3 scoreCards multiplier tests GREEN (11/11 total in rules.test.ts)
affects: [engine.ts startResolve call site, Phase 3 client scoring display, Phase 4 balance iteration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Beer bonus applied FIRST (Math.round(points * 1.5)) then event multiplier applied AFTER"
    - "Math.round() at each multiplication step to prevent fractional empire points"
    - "Optional params with ? — backwards-compatible function signature extension"
    - "Pure function scoring — no state mutation, all inputs explicit"

key-files:
  created: []
  modified:
    - server/src/games/snusking/rules.ts
    - server/src/games/snusking/rules.test.ts

key-decisions:
  - "Beer +50% applied FIRST before event multiplier — order locked per CONTEXT.md"
  - "Math.round() at each step (beer then event) — prevents accumulation of fractional points"
  - "computeEventMultiplier() is private (unexported) — only scoreCards needs it"
  - "isSpentSnus cards score 0 because empirePoints=0 in catalog — no special case needed"
  - "spendCards new params are optional — engine.ts call site compiles unchanged"

patterns-established:
  - "Event fixtures as module-level constants in test files (SAUNA_NIGHT, PARTY)"
  - "makeCardInstance opts pattern for optional strength/flavor/instanceId in tests"

requirements-completed: [CARD-SYS, EVENT-SYS, BEER-RES]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 02 Plan 04: Scoring Engine Update Summary

**Event multiplier scoring (2x/1.5x/1x) and beer +50% combo bonus wired into scoreCards() and spendCards() with Math.round() ordering; all 5 EVENT-SYS-3 test stubs converted to passing assertions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T15:34:17Z
- **Completed:** 2026-03-13T15:36:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended `scoreCards()` with optional `activeEvent` and `beerCardId` params — fully backwards-compatible with existing engine.ts call sites
- Implemented `computeEventMultiplier()`: both strength+flavor match → 2.0x, one match → 1.5x, neither → 1.0x
- Beer bonus (+50%) applied FIRST on `beerCardId` card (only for high/extreme strength), then event multiplier applied AFTER — Math.round() at each step
- Converted all 5 `it.todo` stubs in `rules.test.ts` to real assertions; all 11 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Update scoreCards() and spendCards() in rules.ts** - `801b860` (feat)
2. **Task 2: Convert rules.test.ts stubs to real assertions** - `35ea1c5` (test)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks — implementation committed first, tests converted to GREEN in Task 2_

## Files Created/Modified
- `server/src/games/snusking/rules.ts` - Extended scoreCards() and spendCards() with event/beer params; added computeEventMultiplier()
- `server/src/games/snusking/rules.test.ts` - Added event fixtures, updated makeCardInstance helper, converted 5 stubs to passing tests

## Decisions Made
- Beer bonus order: applied FIRST before event multiplier, as specified in CONTEXT.md locked decisions
- `computeEventMultiplier()` kept private (not exported) — only called from `scoreCards()`
- `isSpentSnus` cards naturally score 0 because their `empirePoints` is 0 in the catalog — no explicit special case required
- `spendCards()` new params made optional so `engine.ts` line 202 compiles unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - multiplier math verified against plan spec:
- extreme+tobacco vs Sauna Night: 30 × 2.0 = 60
- high+mint vs Sauna Night: Math.round(25 × 1.5) = 38 (strength matches, mint does not match tobacco/licorice)
- high+mint vs Party + beer: Math.round(25 × 1.5) = 38, then 38 × 2.0 = 76

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scoring engine complete with event multipliers and beer combo bonus
- `spendCards()` signature is backwards-compatible — engine.ts needs no changes for basic play
- engine.ts `startResolve()` can be updated in a future plan to pass `currentEvent` and `beerCardId` through to `spendCards()` when beer combo spend actions are fully wired
- rules.test.ts has zero todos remaining — all EVENT-SYS-3 scoring behaviours verified

## Self-Check: PASSED
- rules.ts: FOUND
- rules.test.ts: FOUND
- 02-04-SUMMARY.md: FOUND
- Commit 801b860 (Task 1): FOUND
- Commit 35ea1c5 (Task 2): FOUND

---
*Phase: 02-card-design-balance-and-game-economy*
*Completed: 2026-03-13*
