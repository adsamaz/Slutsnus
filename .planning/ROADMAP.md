# Roadmap

**Project:** Snusking
**Version:** 1.0 — Card Game Engine
**Updated:** 2026-03-12

---

## Phase 1 — Foundation and Engine Contract

**Goal:** A working game engine that correctly implements simultaneous reveal, per-player state projection, turn timer with auto-pass, and reconnect handling. The game must be playable end-to-end with minimal cards.

**Delivers:**
- `TurnBasedGameEngine` interface extension defined before any implementation code
- `SnuskingEngine` class implementing simultaneous-reveal FSM (Draw → Planning → Reveal → Resolve)
- Per-player state projection (`projectState(playerId)`) — server never broadcasts unified hand state
- Turn timer (45–60 seconds) with auto-pass for AFK/disconnected players
- Reconnect support: state snapshot resent to rejoining player
- Win condition detection (empire score threshold) and game end trigger
- Leaderboard score write on game end
- `GameType` registration propagated across shared types, DB enum, registry, and client routing in one commit
- `snus-rpg` engine fully removed

**Addresses pitfalls:** Greedy action processing, room-broadcast hand leak, disconnect deadlock, interface contract mismatch, GameType registration gap

**Research flag:** Standard patterns — no phase research needed

**Plans:** 7 plans

Plans:
- [ ] 01-01-PLAN.md — Test infrastructure: Vitest install, config, RED-state stubs for deck/rules/engine
- [ ] 01-02-PLAN.md — Type contracts: TurnBasedGameEngine interface, all Snusking shared types
- [ ] 01-03-PLAN.md — Card catalog, Fisher-Yates deck builder, pure rules functions
- [ ] 01-04-PLAN.md — SnuskingEngine FSM: simultaneous reveal, timer, per-player projection
- [ ] 01-05-PLAN.md — Platform wiring: GameType registration, room.ts per-socket routing, reconnect
- [ ] 01-06-PLAN.md — Client skeleton: Solid.js components (Board, Hand, OpponentStatus, PlayerHUD, EndScreen)
- [ ] 01-07-PLAN.md — Cleanup: snus-rpg removal, lobby labels, player count, smoke test checkpoint

---

## Phase 2 — Card Design, Balance, and Game Economy

**Goal:** A complete, balanced card catalog and game economy. Design-first: the full combo matrix must be mapped before any values are coded.

**Delivers:**
- Balance document: full combo matrix (card × event × beer) with max-possible-value scenarios
- 8–12 snus brand cards with base values and contextual bonuses (Fishsnus, Bastusnus, General, Siberia, Göteborgs Rapé, Ettan, and others)
- Event card pool: Sauna Night, Fishing Trip, Party (minimum 3 event types)
- Beer resource: holding limit (max 2–3), combo interactions, and sabotage-beer interaction rules
- Sabotage mechanic: spent snus cards, high-nicotine cards with negative effects, one-per-target-per-turn limit
- Sabotage immunity card (at least one type)
- Deceptive trading: displayed name vs real card identity in trade offers
- Turn timer starting value (45 seconds) and score threshold (200) documented as tuneable parameters

**Addresses pitfalls:** Sabotage kingmaking, combo multiplier imbalance, turn timer miscalibration, beer hoarding, trade index instability

**Research flag:** Design validation phase — create balance spreadsheet before coding any values

---

## Phase 3 — Client UI and Reveal Experience

**Goal:** Complete Solid.js card game UI built against the finalized state shape.

**Delivers:**
- `Board` component — overall game layout
- `Hand` component — player's own cards with select → lock-in action confirmation UX
- `OpponentHand` component — face-down cards with commit status indicator
- `RevealOverlay` component — simultaneous card-flip reveal animation (CSS)
- `PlayerStatus` component — score HUD, beer count, turn phase indicator
- Event card display — revealed prominently at turn start, before planning phase opens
- Game end screen with final scores
- Phase-conditional rendering via Solid.js `<Switch>/<Match>` (no canvas, no RAF loop)

**Addresses pitfalls:** Event card reveal timing (shown at turn start, never mid-turn)

**Research flag:** Standard Solid.js patterns — no phase research needed

---

## Phase 4 — Integration, Playtesting, and Balance Iteration

**Goal:** A playtested, balanced game with validated edge-case handling.

**Delivers:**
- Multi-socket end-to-end tests covering: disconnect during planning, simultaneous sabotage targeting the same player, reconnect mid-round, turn timer expiry auto-pass
- Human playtesting sessions (2–4 players) to validate balance numbers
- Revised card values, score threshold, and timer duration based on playtesting
- Confirmed smooth reconnect UX
- All deferred balance concerns from Phase 2 resolved

**Research flag:** No technical research needed — requires human playtesting

---

## Phase Order Rationale

1. Interface contract and engine come first — changing the state shape after the client is built causes a full client rewrite
2. Balance design before card implementation — the documented failure mode is assigning values before the combo matrix exists
3. Client last — components receive typed state as props; build against the final shape
4. Playtesting last — balance validation requires a complete game loop; incomplete games produce misleading feedback
