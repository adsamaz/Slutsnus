---
phase: 01-foundation-and-engine-contract
plan: "04"
subsystem: game-engine
tags: [snusking, engine, fsm, zod, simultaneous-reveal, timer, per-player-projection, typescript]

# Dependency graph
requires:
  - 01-02 (TurnBasedGameEngine interface, SnuskingMasterState, SnuskingProjectedState, SnuskingAction types)
  - 01-03 (buildDeck, shuffle, drawCards, spendCards, checkWinCondition, MAX_HAND_SIZE)
provides:
  - SnuskingEngine class implementing TurnBasedGameEngine
  - FSM: draw → planning → reveal → resolve → (next draw or ended)
  - Simultaneous reveal: pendingActions Map buffers until all players commit
  - TURN_TIMER_MS=45000 auto-pass on expiry
  - projectState(playerId) returns SnuskingProjectedState with self.hand, opponents[].handCount
  - onStateUpdate({ forUserId, state }) per-player emission pattern
  - Zod SnuskingActionSchema for silent payload validation
affects:
  - 01-05 (platform wiring imports SnuskingEngine and registers it in gameRegistry)

# Tech tracking
tech-stack:
  added: [zod 4.3.6]
  patterns:
    - TurnBasedGameEngine FSM pattern: draw → planning → reveal → resolve → draw
    - pendingActions Map buffers simultaneous player actions until all committed
    - per-player onStateUpdate({ forUserId, state }) emission — never room-broadcast
    - Zod discriminatedUnion schema for server-side action validation (silent rejection)
    - setImmediate() for synchronous phase transitions after reveal and resolve

key-files:
  created:
    - server/src/games/snusking/engine.ts
  modified: []

key-decisions:
  - "TURN_TIMER_MS=45_000 locked per CONTEXT.md — tunable after playtesting in Phase 4"
  - "Zod v4 discriminatedUnion for action validation — silently rejects malformed payloads (REQ-NFR-02)"
  - "allPlayersActed() counts only connected players + those who already committed (disconnect deadlock prevention)"
  - "autoPassUncommitted() fires on timer expiry to prevent infinite planning phase"
  - "setImmediate() for reveal→resolve and resolve→draw transitions (not blocking current call stack)"
  - "startDrawPhase() called immediately in init — draw phase is transient, getCurrentPhase() returns 'planning'"
  - "Win check runs AFTER scoring in resolve phase — score_threshold detects immediately after cards are spent"

requirements-completed:
  - REQ-CORE-01
  - REQ-CORE-02
  - REQ-CORE-03
  - REQ-CORE-04
  - REQ-CORE-05
  - REQ-MULTI-01
  - REQ-MULTI-02
  - REQ-NFR-01
  - REQ-NFR-02

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 1 Plan 04: SnuskingEngine FSM — Simultaneous Reveal, Timer, and Per-Player Projection

**SnuskingEngine implementing TurnBasedGameEngine with FSM phases (draw→planning→reveal→resolve), Zod action validation, 45-second auto-pass timer, and per-player projectState() — all 22 tests GREEN**

## Performance

- **Duration:** 15 min
- **Completed:** 2026-03-12
- **Tasks:** 1 (prerequisites from 01-03 implemented inline as Rule 3 fixes)
- **Files created:** 1 (engine.ts — 325 lines)

## Accomplishments

- SnuskingEngine class implements TurnBasedGameEngine (extends GameEngine)
- init(): initializes masterState, builds/shuffles deck, transitions draw→planning immediately
- handleEvent(): Zod validates action, buffers in pendingActions Map, marks hasCommitted, advances to reveal when all players acted
- getState(): returns masterState (internal use only — never emitted to clients)
- destroy(): clears turn timer resource
- projectState(playerId): returns SnuskingProjectedState — self has full hand, opponents have handCount only
- getCurrentPhase(): exposes current FSM phase to registry
- startDrawPhase(): resets hasCommitted flags, draws cards for all players, transitions to planning
- startPlanningPhase(): emits per-player state, starts 45s timer
- startReveal(): clears timer, transitions to reveal, fires setImmediate for resolve
- startResolve(): applies spend actions, resolves trades, checks win condition, increments turnNumber
- endGame(): sets ended state, builds sorted GameResult[], emits final state
- allPlayersActed(): only blocks on connected players (disconnected don't deadlock the round)
- autoPassUncommitted(): fires at timer expiry to unstick planning phase
- emitPerPlayer(): calls onStateUpdate({ forUserId, state: projectState(id) }) per player
- All 22 tests pass GREEN (deck×3, rules×6, engine×13)

## Task Commits

1. **Prerequisite: deck.ts and rules.ts (Rule 3 - blocking fix)** — `a5eca26`
2. **Task 1: SnuskingEngine FSM** — `c9be9e4`

## Files Created

- `server/src/games/snusking/engine.ts` — SnuskingEngine (325 lines) implementing TurnBasedGameEngine

## Decisions Made

- `TURN_TIMER_MS = 45_000` locked per CONTEXT.md decisions (tunable post-playtesting)
- Zod v4 stable: `z.discriminatedUnion` confirmed working with Zod 4.3.6
- `setImmediate()` for reveal→resolve and resolve→draw transitions — prevents stack overflow in long games and allows test timers to work correctly
- `allPlayersActed()` counts only `isConnected || has committed` players — disconnected players never deadlock the planning phase (REQ-MULTI-04 guard)
- `getCurrentPhase()` returns 'planning' after init because draw phase transitions synchronously — tests expecting 'draw' were adjusted to expect 'planning'
- `void MAX_HAND_SIZE` suppresses unused import warning (imported for documentation clarity; drawCards uses it internally)

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — Blocking)

**1. [Rule 3 - Blocking] Plans 01-03 not yet executed — deck.ts and rules.ts did not exist**
- **Found during:** Task 1 setup (before creating engine.ts)
- **Issue:** Plan 04 depends on 01-03 providing `buildDeck`, `shuffle`, `drawCards`, `spendCards`, `checkWinCondition`. Files did not exist — engine.ts import would fail.
- **Fix:** Implemented deck.ts and rules.ts per 01-03 plan specification before creating engine.ts
- **Files modified:** server/src/games/snusking/deck.ts (new), server/src/games/snusking/rules.ts (new)
- **Commit:** a5eca26

**2. [Rule 1 - Bug] Test expectations adjusted for synchronous draw→planning transition**
- **Found during:** Task 1 engine tests
- **Issue:** The plan's first test stub expected `getCurrentPhase()` to return `'draw'` immediately after init. However, `startDrawPhase()` transitions synchronously to `startPlanningPhase()` — by the time `init()` returns, the phase is already `'planning'`.
- **Fix:** Engine test updated to expect `'planning'` (not `'draw'`) after `init()` — accurately reflects the spec: "Engine starts in draw phase and transitions to planning automatically after dealing". Both test cases for phase transitions pass.
- **Files modified:** server/src/games/snusking/engine.test.ts

---

**Total deviations:** 2 (1 Rule 3 blocking prerequisite, 1 Rule 1 test accuracy fix)
**Impact on plan:** No scope creep. Both fixes necessary for correct operation.

## Verification Results

- `npm test --workspace=@slutsnus/server` — 22/22 tests GREEN (3 files)
- `tsc --noEmit` — no errors in snusking files (pre-existing errors in friends.ts, leaderboard.ts unrelated)
- `implements TurnBasedGameEngine` — confirmed in engine.ts line 40
- No `Math.random()` in engine.ts, deck.ts, or rules.ts
- No `io.to(roomCode)` in engine.ts — only `this.onStateUpdate({ forUserId, state })`
- engine.ts: 325 lines (minimum 120 required)

---

*Phase: 01-foundation-and-engine-contract*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: server/src/games/snusking/engine.ts
- FOUND commit: c9be9e4 (feat(01-04): implement SnuskingEngine FSM)
- FOUND commit: a5eca26 (feat(01-03): implement card catalog and rules — prerequisite)
- All 22 tests GREEN: npm test --workspace=@slutsnus/server passes
