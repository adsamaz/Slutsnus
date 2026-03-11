# Project Research Summary

**Project:** Snusking card game engine
**Domain:** Turn-based simultaneous-reveal multiplayer card game
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Snusking is a turn-based multiplayer card game engine being added to an existing TypeScript + Express + Socket.IO + Solid.js + Prisma platform. The defining mechanic — simultaneous reveal — requires every player to secretly commit an action before any outcomes are shown. This commit-then-reveal pattern is well-established in card game design (Dominion, Hanabi) but conflicts directly with the existing real-time engine's greedy action-processing approach. The single most important architectural decision for the entire project is implementing per-player state projection from day one: the server must never broadcast a unified game state containing all players' hands, or any technically literate player can cheat via browser DevTools.

The recommended approach stays strictly within the existing technology stack — no new frameworks, no game server replacement. A custom `SnuskingEngine` class implements the existing `GameEngine` interface, extended with a `TurnBasedGameEngine` contract that adds turn-aware methods. The only new dependency is Zod (server-side only) for runtime validation of card game action payloads, replacing the unsafe casts flagged in CONCERNS.md. All card rendering moves from the canvas-based real-time renderer to declarative Solid.js DOM components — the correct genre choice for a card game. A 7-layer build order exists: shared types → card catalog → rules engine → game engine → registry wiring → client components → integration, each layer independently testable before the next begins.

The key risks are structural, not implementation. Two must be resolved before any other code is written: (1) the `onStateUpdate` callback in `room.ts` must be changed to support per-player state emission, and (2) the `GameEngine` interface must be extended or wrapped with turn-phase-aware methods before the engine implementation begins. If either is deferred, the client UI will be built against a state shape that cannot safely serve a hidden-information game and will require a full rewrite. Card balance risks (beer hoarding, sabotage kingmaking, combo dominance) are recoverable with playtesting — architectural risks are not.

---

## Key Findings

### Recommended Stack

The platform constraint is absolute: no stack changes. The new engine plugs into the existing `GameEngine` interface via the `gameRegistry`. The only package addition is Zod on the server for action validation. All other patterns use existing TypeScript class patterns, built-in `crypto.randomInt` for deck shuffling (replacing the biased `Math.random()` shuffle flagged in CONCERNS.md), and Solid.js `createStore` (already a dependency) for card game UI state.

The simultaneous-reveal mechanic requires one mandatory platform change: `room.ts` must change from `io.to(roomCode).emit('game:state', { state })` to per-socket emission, routing a different state projection to each player. This is the only required modification to existing files beyond the one-line registry change.

**Core technologies:**
- TypeScript plain class (`SnuskingEngine implements GameEngine`) — no framework overhead needed for a 5-phase game loop; XState and boardgame.io are incompatible with the existing integration contract
- Explicit `GamePhase` enum + `pendingActions: Map<string, StagedAction>` — idiomatic TypeScript simultaneous-reveal pattern; no state machine library needed
- Zod ^3.24.x (server only) — runtime validation of card game action payloads at the Socket.IO boundary; directly addresses the unsafe casts documented in CONCERNS.md
- `crypto.randomInt` Fisher-Yates shuffle — unbiased deck shuffle; the existing `Math.random()` shuffle is documented as biased in CONCERNS.md
- Solid.js `createStore` + CSS transitions — card game UI state and reveal animations; DOM rendering is correct for this genre, canvas is not

### Expected Features

The MVP is the smallest playable game demonstrating all three layers of the design: empire score race + contextual card combos + social deception via sabotage.

**Must have (table stakes):**
- Turn structure with simultaneous-reveal phases (Choose → Reveal → Resolve → Draw) — the game cannot exist without this
- Hand management with draw, hold, spend (empire points), and discard — visible hand is the core game loop
- Turn timer (45–60 seconds) with auto-pass for AFK/disconnected players — without this, one player blocks everyone indefinitely
- Per-player state visibility (own hand private, scores and commit status public) — critical for the hidden-information mechanic
- Reconnect / rejoin support with state snapshot resend — existing known gap, must be fixed
- Win condition (empire score threshold) with permanent HUD visibility
- Game end screen and leaderboard write

**Should have (differentiators):**
- Simultaneous-reveal with locked-in action commit UX — the core differentiator; eliminates turn-order advantage
- Contextual snus cards (Fishsnus, Bastusnus) with event-matching bonus — adds combo planning depth
- Event cards (Sauna Night / Fishing Trip / Party) revealing round context — shared public information layer that creates strategic reactions
- Beer as a holdable combo resource — the hold-or-spend decision creates meaningful per-turn choice; must have carry limit (max 2–3) to prevent hoarding
- Deceptive trading mechanic (displayed name vs. real card) — inherited from snus-rpg engine; creates social tension and memorable moments
- Sabotage via spent snus card transfer
- Snus brand identity from existing `brands.ts` (General, Siberia, Göteborgs Rapé, Ettan)

**Defer (v2+):**
- Player-triggered situations (spending resources to activate a context) — needs event system stable first
- Expanded card catalog beyond 8–12 initial brands
- High-nicotine negative-effect snus as sabotage vector — needs balance testing before shipping
- Spectator mode — significant implementation complexity, not needed for MVP
- In-game chat — creates harassment vectors in a deception game

### Architecture Approach

The architecture follows a strict 7-layer dependency chain from pure data structures up to integrated UI. The engine is a finite state machine with four turn phases (draw → planning → reveal → resolve) replacing the real-time tick loop entirely. The master state (containing all player hands and pending actions) is held privately in the engine and never emitted directly. Instead, `projectState(playerId)` produces a per-player view for emission. Rules logic is extracted into pure functions in `rules.ts` (independently testable). Client rendering is declarative Solid.js components driven by reactive state, not a canvas animation loop.

**Major components:**
1. `shared/src/types.ts` (Snusking section) — all cross-boundary type contracts; the foundation everything else depends on
2. `server/src/games/snusking/engine.ts` — `SnuskingEngine` implementing the extended `TurnBasedGameEngine` interface; owns FSM, action buffering, timeout, and state projection
3. `server/src/games/snusking/deck.ts` + `events.ts` — card catalog and event card pool; pure data with no external dependencies
4. `server/src/games/snusking/rules.ts` — pure scoring functions: `scoreCards()`, `applyEffects()`, `checkWin()`; independently unit-testable
5. `client/src/games/snusking/` — DOM-based card components (`Board`, `Hand`, `OpponentHand`, `RevealOverlay`, `PlayerStatus`); driven entirely by typed props, no side effects
6. `server/src/socket/room.ts` (modified) — per-socket state routing replacing the room-broadcast pattern

### Critical Pitfalls

1. **Simultaneous reveal without commit buffering** — if `handleEvent` processes and broadcasts results immediately on receipt (the existing pattern), players on faster connections gain a structural advantage. The engine must buffer all player actions in `pendingActions` and only resolve atomically when `submittedCount === activePlayers.length` or the turn timer expires.

2. **Leaking opponent hand state via room broadcast** — the existing `io.to(roomCode).emit('game:state', { state })` broadcasts one object to all players. In a card game with hidden hands, any player can read opponents' cards from browser DevTools. Per-socket projection must be implemented from day one — it cannot be retrofitted cleanly after the client is built.

3. **Game deadlock on player disconnect** — if a player disconnects during the planning phase with no auto-submit policy, the collect gate (`submittedCount === activePlayers.length`) never opens. The engine must auto-pass disconnected players at turn timer expiry and emit the rejoining player's current state projection on reconnect.

4. **Interface contract mismatch — stretching real-time `GameEngine` for turn-based semantics** — the existing `GameEngine` interface (`handleEvent`, `getState`, `destroy`) was designed for the real-time tick model. Adding turn-phase logic through action type hacks leaks game logic into the socket layer. Define a `TurnBasedGameEngine` interface extension before writing any implementation code.

5. **GameType registration not propagated across shared types, database, and registry** — adding `'snusking'` to the registry without updating `shared/src/types.ts`, the DB enum, and client routing causes silent `room:error` failures (the existing catch block in `room.ts` swallows these). All four touch points must be updated in a single coordinated commit.

---

## Implications for Roadmap

Based on combined research, the build order is driven by hard dependencies: types before implementations, server before client, interface contract before any engine code.

### Phase 1: Foundation and Engine Contract

**Rationale:** The two critical pitfalls (greedy action processing, room-broadcast of hidden state) must be addressed before any other code is written. The type contract and interface extension define the seam that all subsequent layers plug into. Changing these after Phase 2 starts causes cascading rewrites.

**Delivers:** A working `SnuskingEngine` that correctly implements simultaneous reveal, per-player state projection, turn timer with auto-pass, and reconnect state snapshot. The game is playable end-to-end with minimal cards and no balancing.

**Addresses:** Table stakes features — turn structure, turn timer, reconnect support, win condition detection, leaderboard write.

**Avoids:** Pitfall 1 (greedy processing), Pitfall 2 (room broadcast leak), Pitfall 3 (disconnect deadlock), Pitfall 5 (interface contract mismatch), Pitfall 9 (GameType registration gap), Pitfall 12 (leaderboard score semantics).

**Research flag:** Standard patterns — the 7-layer build order is well-defined. No phase research needed.

### Phase 2: Card Design, Balance, and Game Economy

**Rationale:** The rules engine and card catalog must be designed together with the full combo matrix mapped before any values are coded. Building card definitions before the event system is complete (the documented mistake in Pitfall 6) produces values that will need re-balancing. This phase should be design-first before implementation.

**Delivers:** Complete card catalog (8–12 snus brand cards), event card pool (3 event types), beer resource with holding limit and interaction rules, sabotage mechanic with per-target limit, and all combo multipliers mapped in a balance document before implementation.

**Addresses:** Differentiator features — contextual snus cards, event cards, beer combo resource, deceptive trading, sabotage.

**Avoids:** Pitfall 4 (sabotage kingmaking — add one-sabotage-per-target limit and immunity card), Pitfall 6 (combo multiplier imbalance — map full combo matrix first), Pitfall 7 (turn timer miscalibration — configurable parameter, start at 45 seconds), Pitfall 8 (beer hoarding — holding limit and sabotage-beer interaction), Pitfall 11 (trade index instability — use cardId not array index).

**Research flag:** Needs deeper design validation — balancing numbers (score threshold, card values, combo multipliers, timer duration) are MEDIUM confidence and require playtesting. No external research needed; this is internal design work.

### Phase 3: Client UI and Reveal Experience

**Rationale:** Client components are the final layer in the dependency chain. They receive typed state as props and emit actions via the already-wired Socket.IO pattern. Building the client last ensures the state shape is stable and the reveal animation (the most memorable moment in a simultaneous-reveal game) is built against the final projection format.

**Delivers:** Complete Solid.js card game UI — `Board`, `Hand`, `OpponentHand`, `RevealOverlay`, `PlayerStatus` components, CSS card-flip reveal animation, phase-conditional rendering via `<Switch>/<Match>`, action confirmation UX (select → lock in), and submission status display (who has committed without revealing what).

**Addresses:** Table stakes — legible card display, action confirmation UX, player identification, score HUD, game end screen.

**Avoids:** Pitfall 10 (event card reveal timing — event revealed prominently at turn start before planning phase opens, never mid-turn). Anti-patterns: no canvas rendering, no RAF loop, no client-side reveal timing.

**Research flag:** Standard patterns — Solid.js DOM component patterns are well-documented. CSS card flip is 15 lines. No phase research needed.

### Phase 4: Integration, Playtesting, and Balance Iteration

**Rationale:** Multi-socket end-to-end testing surfaces edge cases in disconnect handling, simultaneous action resolution, and turn timer behavior that unit tests cannot reproduce. Balance issues (dominant strategies, sabotage targeting, beer hoarding patterns) only emerge with real players making real decisions.

**Delivers:** A playtested, balanced game with validated turn timer, confirmed win threshold, and verified edge-case handling for disconnects, simultaneous sabotage, and multi-turn pending trades.

**Addresses:** All deferred balance concerns from Phase 2. Confirms reconnect UX is smooth.

**Research flag:** No technical research needed. Requires human playtesting with 2–4 players per session to validate balance numbers.

### Phase Ordering Rationale

- Phases 1 → 4 follow strict dependency order: types and contracts precede implementations, server logic precedes client rendering, single-player testable units precede multiplayer integration.
- The interface contract (Phase 1) must be final before client UI (Phase 3) begins; changing the state shape mid-client-build is the most expensive possible rework.
- Balance design (Phase 2) must precede implementation of card values; the documented Pitfall 6 pattern (assigning values before the combo matrix exists) is the most common card game design mistake.
- Playtesting (Phase 4) is last because balance validation requires a complete game loop; playtesting an incomplete game produces misleading feedback.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (balance):** Specific numeric values (score threshold, card base values, combo multipliers, beer bonus percentages) are MEDIUM confidence from genre conventions. These must be validated by playtesting, not research. Create a balance spreadsheet mapping max possible value per card across all combo scenarios before coding any values.

Phases with standard patterns (skip research-phase):
- **Phase 1 (foundation):** All patterns are derived from direct codebase reads. The 7-layer build order is well-defined and unambiguous.
- **Phase 3 (client UI):** Solid.js reactive component patterns are standard. CSS card flip is a known pattern. DOM-over-canvas for card games is a firm recommendation.
- **Phase 4 (integration):** Standard end-to-end testing with multiple browser tabs. No novel integration challenges.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Derived entirely from direct codebase reads. Constraints are hard (no stack changes). Zod version needs verification at npmjs.com but the choice is correct. |
| Features | MEDIUM | Core game design theory is HIGH confidence. Specific numbers (card count, score threshold, timer duration) are MEDIUM — genre conventions, not verified against this game's specific balance. |
| Architecture | HIGH | Based on direct analysis of the existing engine, socket, and type contract files. The 7-layer build order and per-player projection requirement are unambiguous from the code. |
| Pitfalls | HIGH (structural) / MEDIUM (balance) | Structural pitfalls (1, 2, 3, 5, 9, 11, 12) are HIGH — derived from observable code patterns. Balance pitfalls (4, 6, 7, 8, 10) are MEDIUM — derived from card game design literature, not empirical testing. |

**Overall confidence:** HIGH for architecture and implementation approach. MEDIUM for balance parameters.

### Gaps to Address

- **Card balance numbers:** Score threshold (suggested 200), turn timer (suggested 45s), card base values, and combo multipliers are starting points from genre conventions. These must be treated as initial guesses and revised after first playtests. Do not tune these during implementation — tune after playtesting.
- **`onStateUpdate` contract change:** Two options exist for per-player state routing (engine invokes callback once per player with `forUserId` tag, vs. callback signature changed to accept a Map). The specific approach must be agreed before Phase 1 implementation begins. The ARCHITECTURE.md recommends Option B (invoke once per player with player identifier).
- **Sabotage immunity card:** At least one card type providing sabotage immunity for a turn is required (Pitfall 4). The specific card is not yet named or costed. This is a Phase 2 design decision.
- **Zod version:** Listed as ^3.24.x based on training data. Verify current stable version at npmjs.com/package/zod before installing.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `server/src/games/registry.ts`, `server/src/games/snus-rpg/engine.ts`, `server/src/socket/room.ts`, `server/src/socket/game.ts`, `client/src/games/GameContainer.tsx`, `shared/src/types.ts`, `brands.ts` — all engine patterns, integration contracts, and type system findings
- `.planning/PROJECT.md` — feature requirements and scope constraints (simultaneous reveal, 2–4 players, no AI, no real-time)
- `CONCERNS.md` — documented platform issues that directly informed Zod adoption, Fisher-Yates shuffle, and per-player state requirement

### Secondary (MEDIUM confidence)
- Established multiplayer card game design patterns (commit-then-reveal from Dominion, Hanabi, Cosmic Encounter; balance theory from CCG post-mortems) — balance pitfalls and mechanic design recommendations
- Solid.js reactive rendering patterns — client architecture approach (DOM over canvas for card games)

### Tertiary (LOW confidence)
- Specific balance numbers (score threshold 200, turn timer 45s, card count 8–12, beer hold limit 2–3) — genre convention starting points; require playtesting to validate. Treat as hypotheses, not conclusions.

---

*Research completed: 2026-03-11*
*Ready for roadmap: yes*
