---
phase: 01-foundation-and-engine-contract
plan: 02
subsystem: api
tags: [typescript, game-engine, snusking, types, interfaces]

# Dependency graph
requires:
  - phase: 01-foundation-and-engine-contract
    provides: "GameEngine interface in registry.ts; existing shared/src/types.ts with GameType"

provides:
  - "TurnBasedGameEngine interface extending GameEngine with projectState and getCurrentPhase"
  - "TurnPhase union type: draw | planning | reveal | resolve | ended"
  - "SnuskingCardDefinition, SnuskingCardInstance interfaces"
  - "SnuskingTradeOffer interface with stable offerId/cardInstanceId identity"
  - "SnuskingPlayerState (full hand), SnuskingOpponentState (handCount only)"
  - "SnuskingProjectedState — per-player safe view for socket emission"
  - "SnuskingMasterState — server-only truth (never emitted)"
  - "SnuskingAction discriminated union (spend/pass/trade-offer/trade-accept/trade-decline)"
  - "GameEndReason type (score_threshold | slut_snus)"
  - "GameType extended with 'snusking'"

affects:
  - 01-03 (deck/shuffle implementation imports SnuskingCardInstance)
  - 01-04 (rules implementation imports SnuskingMasterState, GameEndReason)
  - 01-05 (engine implementation implements TurnBasedGameEngine, imports all Snusking types)
  - 01-06 (GameType registration uses extended GameType)
  - 01-07 (client types use SnuskingProjectedState, SnuskingAction)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TurnBasedGameEngine extends GameEngine — additive interface extension, real-time engines unaffected"
    - "SnuskingProjectedState vs SnuskingMasterState — per-player projection pattern, master state never emitted"
    - "SnuskingOpponentState uses handCount (not hand) — privacy-preserving opponent view"
    - "Discriminated union for SnuskingAction — type-safe action dispatch at Zod boundary"
    - "Stable instanceId on cards — survives shuffles and reordering"

key-files:
  created:
    - server/src/__type_tests__/registry.type-test.ts
    - shared/src/__type_tests__/snusking.type-test.ts
  modified:
    - server/src/games/registry.ts
    - shared/src/types.ts

key-decisions:
  - "TurnPhase defined in registry.ts (not shared) — server-internal FSM concept, not emitted as-is"
  - "SnuskingPlayerState.hand vs SnuskingOpponentState.handCount — enforces projection boundary at the type level"
  - "SnuskingTradeOffer uses offerId (UUID) and cardInstanceId (UUID) — not array positions — survives ordering changes"
  - "GameType extended with 'snusking' in shared/src/types.ts — DB schema uses plain String so no migration needed"

patterns-established:
  - "Type-level tests in __type_tests__/ directories — compile-time regression prevention for interface contracts"
  - "Master state vs projected state split — SnuskingMasterState is truth, SnuskingProjectedState is the safe view per player"

requirements-completed:
  - REQ-NFR-04
  - REQ-NFR-05

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 1 Plan 2: Snusking Type Contracts Summary

**TurnBasedGameEngine interface and all Snusking types (state, cards, players, actions) defined — stable contracts for Plans 03-07 to build against without modification.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T19:30:58Z
- **Completed:** 2026-03-12T19:35:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `TurnBasedGameEngine` extends `GameEngine` with `projectState(playerId)` and `getCurrentPhase()` — SnuskingEngine's implementation target
- `TurnPhase` union exported from registry.ts — the Snusking FSM phase set used by all subsequent plans
- All Snusking-specific types added to shared/src/types.ts: card catalog, card instances, player/opponent projected views, master state, action union, trade offers, win conditions
- Compile-time type-test files added to both workspaces for regression prevention

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TurnBasedGameEngine interface to registry.ts** - `aa5a7ae` (feat)
2. **Task 2: Add Snusking types to shared/src/types.ts** - `3f4e94b` (feat)

_Note: TDD RED/GREEN cycle verified for both tasks via tsc --noEmit_

## Files Created/Modified
- `server/src/games/registry.ts` - Added TurnPhase type and TurnBasedGameEngine interface after existing GameEngine; existing interface and gameRegistry unchanged
- `server/src/__type_tests__/registry.type-test.ts` - Compile-time type test verifying TurnBasedGameEngine shape and TurnPhase values
- `shared/src/types.ts` - Extended GameType with 'snusking'; added full Snusking type section (CardDefinition, CardInstance, TradeOffer, PlayerState, OpponentState, ProjectedState, MasterState, Action union, GameEndReason)
- `shared/src/__type_tests__/snusking.type-test.ts` - Compile-time type test for all Snusking type shapes

## Decisions Made
- `TurnPhase` lives in `registry.ts` (server-only) rather than `shared/src/types.ts` — it's an internal FSM concept. The phase value IS emitted in `SnuskingProjectedState.phase` as a literal union (not the type reference), so shared packages don't need the `TurnPhase` name.
- `SnuskingPlayerState.hand` vs `SnuskingOpponentState.handCount` — privacy boundary enforced at the TypeScript type level, not just runtime logic.
- Card identity uses stable UUIDs (`instanceId`, `offerId`) rather than array positions — required for correct resolve phase matching after concurrent modifications.

## Deviations from Plan

None — plan executed exactly as written. The shared/src/types.ts was found to be partially pre-modified in the working tree (with mostly correct types); verified full conformance with plan spec before committing. No shape corrections were needed.

## Issues Encountered
- Pre-existing TypeScript errors in `server/src/routes/friends.ts`, `leaderboard.ts`, `rooms.ts`, and `socket/index.ts` appeared in compilation output — these are pre-existing, unrelated to this plan, and were left untouched per deviation scope boundary rule.
- Pre-existing RED-phase test files for Plans 03-05 (`deck.test.ts`, `engine.test.ts`, `rules.test.ts`) are present in the snusking directory and cause compilation errors for their missing implementation modules — expected and correct (those modules are Plans 03-05's job).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Plans 03-07 can now import from `server/src/games/registry.ts` and `shared/src/types.ts` without modification
- `TurnBasedGameEngine` is the implementation target for Plan 05 (SnuskingEngine class)
- `SnuskingProjectedState` is the shape for per-player state emission (socket handler in Plan 06)
- `SnuskingAction` discriminated union is ready for Zod schema generation in Plan 05

---
*Phase: 01-foundation-and-engine-contract*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: server/src/games/registry.ts
- FOUND: shared/src/types.ts
- FOUND: server/src/__type_tests__/registry.type-test.ts
- FOUND: shared/src/__type_tests__/snusking.type-test.ts
- FOUND: .planning/phases/01-foundation-and-engine-contract/01-02-SUMMARY.md
- FOUND commit: aa5a7ae (Task 1)
- FOUND commit: 3f4e94b (Task 2)
