---
phase: 02-card-design-balance-and-game-economy
verified: 2026-03-13T16:45:00Z
status: gaps_found
score: 9/11 must-haves verified
gaps:
  - truth: "balance document (combo matrix) exists as a standalone design artifact"
    status: failed
    reason: "ROADMAP.md phases goal is 'design-first: the full combo matrix must be mapped before any values are coded'. RESEARCH.md identifies BALANCE.md as the Wave 0 deliverable and lists it in the recommended project structure. The file does not exist at .planning/phases/02-card-design-balance-and-game-economy/BALANCE.md."
    artifacts:
      - path: ".planning/phases/02-card-design-balance-and-game-economy/BALANCE.md"
        issue: "File does not exist — the combo matrix was documented in RESEARCH.md but never produced as a standalone balance document"
    missing:
      - "Create BALANCE.md capturing the combo matrix table as a standalone reference (the math exists in RESEARCH.md lines 301-327; it needs to be extracted and formatted as a committed balance document)"
  - truth: "rules.test.ts makeState helper is type-correct against Phase 2 SnuskingPlayerState"
    status: failed
    reason: "server tsc reports TS2739 at rules.test.ts:119 — the makeState helper's player object literal is missing skipNextTurn, pendingDiscard, highNicEffect, and immunityActive which became required fields in Phase 2. The file uses 'as unknown as SnuskingMasterState' to bypass the return type check, but the inner player object literal is still type-checked and fails."
    artifacts:
      - path: "server/src/games/snusking/rules.test.ts"
        issue: "makeState() player literal at line 119 missing 4 required Phase 2 SnuskingPlayerState fields: skipNextTurn, pendingDiscard, highNicEffect, immunityActive"
    missing:
      - "Add skipNextTurn: false, pendingDiscard: false, highNicEffect: false, immunityActive: false to the player object literal in makeState() helper (lines 119-122)"
human_verification:
  - test: "Blurry/shaking screen effect fires exactly once per high-nic sabotage hit"
    expected: "Recipient sees the shaking effect for exactly one planning phase after receiving a high-nic sabotage — not persisting across subsequent turns"
    why_human: "highNicEffect is cleared server-side after one emitPerPlayer() cycle. The client rendering of this flag (Phase 3) cannot be verified by grep or test runner — requires UI inspection."
---

# Phase 2: Card Design, Balance, and Game Economy — Verification Report

**Phase Goal:** A complete, balanced card catalog and game economy. Design-first: the full combo matrix must be mapped before any values are coded.
**Verified:** 2026-03-13T16:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Balance document / combo matrix exists as a standalone design artifact | FAILED | BALANCE.md does not exist at the expected path; matrix is embedded in RESEARCH.md but not extracted as a committed deliverable |
| 2 | SnuskingCardStrength, SnuskingCardFlavor, SnuskingEventCard types exported from shared | VERIFIED | shared/src/types.ts lines 196-204: all three types present and exported |
| 3 | SnuskingPlayerState has skipNextTurn, pendingDiscard, highNicEffect, immunityActive flags | VERIFIED | shared/src/types.ts lines 244-247: all four boolean flags present as required fields |
| 4 | SnuskingAction union has 9 members including all 4 Phase 2 variants | VERIFIED | shared/src/types.ts lines 290-299: 9-member union confirmed |
| 5 | 12-card catalog with strength/flavor; Göteborgs Rapé has canProvideImmunity | VERIFIED | deck.ts lines 9-22: all 12 entries, each with strength+flavor; goteborg has canProvideImmunity: true |
| 6 | SNUSKING_EVENTS has 3 entries (Sauna Night, Fishing Trip, Party) with correct affinities | VERIFIED | deck.ts lines 28-47: 3 events with correct strength/flavor affinity arrays |
| 7 | scoreCards applies beer +50% before event multiplier; 2x/1.5x/1x tiers correct | VERIFIED | rules.ts lines 14-51: computeEventMultiplier() and scoreCards() implement correct order; 5 green tests confirm math |
| 8 | Engine wires beer increment (+1/turn, cap 3), sabotage delivery, immunity, event rotation | VERIFIED | engine.ts startDrawPhase() lines 193-219 and startResolve() lines 255-348: all mechanics present |
| 9 | projectState() includes currentEvent field | VERIFIED | engine.ts line 175: currentEvent: state.currentEvent in return object |
| 10 | All 46 server tests pass green with no todos remaining | VERIFIED | Test run confirmed: 3 files, 46 tests, 0 failures, 0 todos |
| 11 | rules.test.ts makeState helper is type-correct against Phase 2 SnuskingPlayerState | FAILED | server tsc TS2739 at rules.test.ts:119 — player literal missing 4 required Phase 2 flags |

**Score: 9/11 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/src/types.ts` | All Phase 2 type contracts | VERIFIED | SnuskingCardStrength, SnuskingCardFlavor, SnuskingEventCard, extended SnuskingCardDefinition, extended SnuskingPlayerState (4 flags), extended SnuskingAction (9 members), extended SnuskingProjectedState (currentEvent) |
| `server/src/games/snusking/deck.ts` | 12-card catalog, SNUSKING_EVENTS, buildDeck stamp | VERIFIED | 12 entries in SNUSKING_CARDS, 3 entries in SNUSKING_EVENTS, buildDeck() stamps strength+flavor |
| `server/src/games/snusking/deck.test.ts` | Catalog count and event pool tests | VERIFIED | 9 tests covering count, per-card strength/flavor, goteborg immunity, 36-instance deck, event pool |
| `server/src/games/snusking/rules.ts` | scoreCards() and spendCards() with event and beer params | VERIFIED | Both functions have optional activeEvent and beerCardId params; computeEventMultiplier() is private |
| `server/src/games/snusking/rules.test.ts` | Multiplier tests green; makeState type-correct | PARTIAL | 11 tests green; makeState helper has TS2739 error (4 missing player flags) |
| `server/src/games/snusking/engine.ts` | All Phase 2 mechanics wired | VERIFIED | Beer increment, event rotation, sabotage delivery (both types), immunity activation, one-per-target Set, deceptive trade displayName, updated projectState, updated createEmptyPlayer |
| `server/src/games/snusking/engine.test.ts` | All stubs converted to real assertions | VERIFIED | 10 stubs converted: 4 beer tests + 6 sabotage/immunity tests, all green |
| `.planning/phases/02-card-design-balance-and-game-economy/BALANCE.md` | Standalone combo matrix document | MISSING | Combo matrix math exists in RESEARCH.md lines 234-327 but was never extracted as a committed balance document |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| shared/src/types.ts | server/src/games/snusking/deck.ts | SnuskingCardDefinition requires strength/flavor | WIRED | deck.ts imports SnuskingCardDefinition, all 12 entries have strength+flavor |
| shared/src/types.ts | server/src/games/snusking/engine.ts | SnuskingAction union — Zod schema must match 9 variants | WIRED | engine.ts SnuskingActionSchema has 9 discriminatedUnion members including all 4 Phase 2 variants |
| server/src/games/snusking/deck.ts | server/src/games/snusking/engine.ts | SNUSKING_EVENTS imported for event rotation in startDrawPhase() | WIRED | engine.ts line 15: import { buildDeck, shuffle, SNUSKING_EVENTS } from './deck'; used at line 194 |
| server/src/games/snusking/deck.ts | server/src/games/snusking/rules.ts | SnuskingCardInstance.strength/flavor used in scoreCards | WIRED | rules.ts computeEventMultiplier() uses card.strength and card.flavor; instances carry these from buildDeck() |
| server/src/games/snusking/rules.ts | server/src/games/snusking/engine.ts | spendCards called with activeEvent + beerCardId from spend-with-beer action | WIRED | engine.ts startResolve() lines 303-323: spendCards called with this.masterState.currentEvent and action.beerCardId |
| server/src/games/snusking/engine.ts | shared/src/types.ts | New SnuskingAction variants handled in handleEvent(); Zod schemas added | WIRED | All 4 new action types validated by Zod schema; sabotage/immunity handled in startResolve() |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CARD-SYS | 02-01, 02-03 | 8-12 snus brand cards with strength/flavor; fake name via trade; spent snus exists | SATISFIED | 12 cards in SNUSKING_CARDS; canProvideImmunity on goteborg; isSpentSnus/isHighNic fields available on SnuskingCardDefinition |
| EVENT-SYS | 02-01, 02-03, 02-04 | 3 event types; revealed before planning; combo multiplier | SATISFIED | SNUSKING_EVENTS with 3 entries; currentEvent in ProjectedState; 2x/1.5x/1x scoreCards logic confirmed by tests |
| BEER-RES | 02-01, 02-04, 02-05 | Beer resource: +1/turn, cap 2-3, combo interactions, sabotage-beer interaction | SATISFIED | beer increments in startDrawPhase(); capped at 3; beer combo via spend-with-beer action; immunity costs 1 beer |
| TRADE-SAB | 02-01, 02-05 | Deceptive trading; spent snus sabotage; high-nic sabotage; one-per-target; immunity card | SATISFIED | displayName in trade offers with masking in resolveAcceptedTrades(); skipNextTurn and pendingDiscard/highNicEffect set in startResolve(); sabotagedThisTurn Set enforces one-per-target; immunityActive blocks all incoming sabotage |

**No orphaned requirements found** — all four requirement IDs declared across the plans are accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/src/games/snusking/rules.test.ts | 119 | Player object literal in makeState() missing required Phase 2 fields — TS2739 under full tsc | Warning | Test helper is structurally stale; Vitest runs pass because test framework does not invoke full tsc, but `npx tsc --project server/tsconfig.json --noEmit` reports the error. Does not affect test outcomes at runtime. |

**Non-Phase-2 tsc errors noted** (pre-existing, not introduced by Phase 2):
- `server/src/routes/friends.ts`, `leaderboard.ts`, `rooms.ts` — string | string[] type issues (pre-existing from Phase 1, outside Phase 2 scope)
- `server/src/socket/index.ts` — rootDir configuration issue (pre-existing)

---

### Human Verification Required

#### 1. High-nic sabotage blurry screen effect (single-fire)

**Test:** In a 2-player game, have player 1 send a sabotage-highnic action to player 2. Observe the client state player 2 receives in the next planning phase.
**Expected:** Player 2's projected state has `self.highNicEffect: true` for exactly one planning phase, then `false` for all subsequent turns.
**Why human:** `highNicEffect` is cleared server-side after `emitPerPlayer()` in `startPlanningPhase()`. The client rendering of this flag belongs to Phase 3. Cannot verify the UI effect or confirm the flag arrives and clears correctly without an active socket session.

---

### Gaps Summary

Two gaps block the phase goal from being fully achieved:

**Gap 1 — Balance document missing (Goal-level):** The phase ROADMAP goal explicitly states "design-first: the full combo matrix must be mapped before any values are coded." RESEARCH.md documents the combo matrix (lines 234-327) and identifies `BALANCE.md` as the Wave 0 deliverable. No standalone `BALANCE.md` was committed. The matrix math was embedded into the research document but the intent was a dedicated, committed balance artifact. This is a documentation gap — the combo math itself is correct (proven by passing tests) — but the explicit "design-first" contract in the phase goal requires the document to exist as a committed artifact.

**Gap 2 — makeState helper type staleness (Test hygiene):** Plan 02-01 made four boolean flags required on `SnuskingPlayerState`. The `makeState()` helper in `rules.test.ts` was written in Phase 1 and was not updated to include these fields. Under `npx tsc --project server/tsconfig.json --noEmit`, this produces TS2739. Vitest does not invoke full tsc (it uses esbuild transform), so all 46 tests pass. The gap is: the server workspace has a known compile error in a test file that Phase 2 introduced and Phase 2 plans did not fix.

---

*Verified: 2026-03-13T16:45:00Z*
*Verifier: Claude (gsd-verifier)*
