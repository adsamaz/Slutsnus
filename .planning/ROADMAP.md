# Roadmap

**Project:** Snusking
**Version:** 1.0 — Card Game Engine
**Updated:** 2026-03-13

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

**Plans:** 4/7 plans executed

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

**Plans:** 4/5 plans executed

Plans:
- [x] 02-01-PLAN.md — Type contracts: extend shared types with strength/flavor/event/sabotage flags/new actions
- [x] 02-02-PLAN.md — Wave 0 RED stubs: combo multiplier and sabotage state transition test stubs
- [x] 02-03-PLAN.md — Card catalog + event pool: 12 cards with strength/flavor, SNUSKING_EVENTS, buildDeck stamp
- [x] 02-04-PLAN.md — Scoring + beer rules: scoreCards with event multipliers and beer combo; rules.test.ts green
- [ ] 02-05-PLAN.md — Engine mechanics: beer accounting, event rotation, sabotage delivery, immunity, deceptive trade

---

## Phase 3 — Client UI and Reveal Experience

**Goal:** Complete Solid.js card game UI built against the finalized state shape.

**Delivers:**
- `Board` component — overall game layout with event flash/banner and deck info
- `Hand` component — Play/Sabotage/Trade tabs with beer combo button, trade modal, skip/blur debuffs
- `OpponentStatus` component — face-down cards with commit status and beer count per opponent
- `RevealOverlay` component — simultaneous card-flip reveal animation (CSS 3D flip)
- `PlayerHUD` component — score HUD, beer mug icons, circular timer ring, debuff banners
- Event card display — full-screen flash at draw phase → persistent top banner
- Game end screen with final scores (Swedish copy, winner highlight)
- Lobby redesign with Swedish labels and snusking theme
- Phase-conditional rendering via Solid.js `<Switch>/<Match>` (no canvas, no RAF loop)

**Addresses pitfalls:** Event card reveal timing (shown at turn start, never mid-turn)

**Research flag:** Standard Solid.js patterns — no phase research needed

**Plans:** 5 plans

Plans:
- [x] 03-01-PLAN.md — SnuskingCard component + snusking.css (card visuals, all game CSS, keyframes)
- [ ] 03-02-PLAN.md — Hand.tsx rewrite: Play/Sabotage/Trade tabs, trade modal, debuff state
- [ ] 03-03-PLAN.md — PlayerHUD (beer mugs, timer ring, debuff banners) + OpponentStatus (face-down cards, commit dot, beer)
- [x] 03-04-PLAN.md — RevealOverlay + Board + index.tsx wiring (event flash timer, ToastContainer, all component props)
- [x] 03-05-PLAN.md — EndScreen polish (Swedish copy, winner highlight) + Lobby redesign (Swedish labels, snusking theme)

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

---

---

# Milestone v2.0 — Snus Catcher

**Version:** 2.0 — Snus Catcher Arcade Game
**Added:** 2026-03-14

## Phases

- [x] **Phase 5: Foundation** - Register Snus Catcher game type and wire lobby entry point (completed 2026-03-14)
- [ ] **Phase 6: Core Loop** - Full playable 1v1 arcade game with server tick engine and canvas client
- [ ] **Phase 7: Powerups** - All 4 powerup types implemented, tunable, and balanced

## Phase Details

### Phase 5: Foundation
**Goal**: Snus Catcher is registered as a selectable game type and a player can enter a Snus Catcher room from the lobby, receiving server ticks
**Depends on**: Phase 4 (existing platform must compile cleanly)
**Requirements**: GAME-01, PLAT-01
**Pitfall**: GameType must propagate atomically — `shared/src/types.ts`, `server/src/games/registry.ts`, `client/src/games/GameContainer.tsx`, and the Lobby UI must all be updated in a single commit or TypeScript errors cascade silently
**Success Criteria** (what must be TRUE):
  1. Lobby displays "Snus Catcher" as a selectable game option alongside Snusking
  2. Player can create a Snus Catcher room from the lobby and a second player can join it
  3. TypeScript compiles clean across shared, server, and client after the GameType addition
  4. The server emits game ticks to both sockets once a Snus Catcher room starts
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — SenusCatcherEngine stub + unit tests + atomic GameType propagation (all 4 files) + client placeholder
- [ ] 05-02-PLAN.md — Human verification: lobby UI, room create/join flow, server tick confirmation

### Phase 6: Core Loop
**Goal**: Two players can play a complete, scorable 1v1 Snus Catcher match — from lobby entry through win/loss — with server-authoritative physics and a 60fps canvas client
**Depends on**: Phase 5
**Requirements**: GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, PLAT-02, PLAT-03, PLAT-04
**Pitfall (bar input)**: Client bar must be client-authoritative — render at cursor position immediately, never wait for server echo. Bar position emits throttled to 30ms intervals
**Pitfall (rAF)**: rAF loop must have `onCleanup(cancelAnimationFrame)` from day one — missing cleanup causes loops to accumulate on component remount
**Pitfall (state signal)**: Use `createStore` not `createSignal` for 20Hz game state — a single top-level signal re-renders the entire canvas component on every tick
**Success Criteria** (what must be TRUE):
  1. Fresh snus pouches fall from the top of each player's screen continuously; catching one increments the score visible on the HUD
  2. Spent snus pouches fall and touching one costs a life; the lives indicator decrements and shows 3 → 2 → 1 → 0
  3. When one player loses their third life, the game ends and both screens show a winner/loser result
  4. The match result (winner and score) is written to the leaderboard and both players can return to the lobby
  5. Both players see each other's score and lives in real time throughout the match
  6. The canvas renders at 60fps smoothly without stutter between 20Hz server ticks
**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — Wave 0: Snus Catcher shared types + RED test stubs (GAME-02..09)
- [ ] 06-02-PLAN.md — Physics engine: physics.ts helpers + full SenusCatcherEngine FSM, all stubs GREEN
- [ ] 06-03-PLAN.md — Client contracts: GameContainer widening + render.ts draw functions + snus-catcher.css
- [ ] 06-04-PLAN.md — Canvas client: SenusCatcherGame component (rAF loop, createStore, bar input, end screen)
- [ ] 06-05-PLAN.md — Human verification: full 1v1 playthrough, leaderboard write, return to lobby

### Phase 7: Powerups
**Goal**: All 4 powerup types fall as catchable items and activate correctly, with tunable balance constants
**Depends on**: Phase 6
**Requirements**: PWR-01, PWR-02, PWR-03, PWR-04, PWR-05
**Pitfall (balance)**: Powerup effect durations, spawn rates, and width modifiers are LOW confidence starting points — implement as named constants (e.g. `NARROW_CURSE_DURATION_TICKS`), not hardcoded literals, so they can be adjusted without touching logic
**Pitfall (timing)**: Powerup expiry must use `expiresAtTick: number`, not wall-clock time — wall-clock drift between clients causes timer displays to diverge
**Success Criteria** (what must be TRUE):
  1. Powerup items fall from the top of the screen like regular items and catching one activates its effect immediately
  2. Catching Snus Rain causes a burst of additional fresh pouches to appear in the catcher's lane
  3. Catching Narrow Curse shrinks the opponent's bar for a visible duration shown on the opponent's HUD
  4. Catching Shield absorbs the next spent snus hit without costing a life; the shield indicator disappears after absorbing
  5. Catching Score Multiplier causes the next 5 pouches caught to count double, with a visible multiplier indicator
**Plans**: TBD

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Foundation | 2/2 | Complete   | 2026-03-14 |
| 6. Core Loop | 0/5 | Not started | - |
| 7. Powerups | 0/? | Not started | - |

## v2.0 Requirement Coverage

| Requirement | Phase |
|-------------|-------|
| GAME-01 | Phase 5 |
| PLAT-01 | Phase 5 |
| GAME-02 | Phase 6 |
| GAME-03 | Phase 6 |
| GAME-04 | Phase 6 |
| GAME-05 | Phase 6 |
| GAME-06 | Phase 6 |
| GAME-07 | Phase 6 |
| GAME-08 | Phase 6 |
| GAME-09 | Phase 6 |
| PLAT-02 | Phase 6 |
| PLAT-03 | Phase 6 |
| PLAT-04 | Phase 6 |
| PWR-01 | Phase 7 |
| PWR-02 | Phase 7 |
| PWR-03 | Phase 7 |
| PWR-04 | Phase 7 |
| PWR-05 | Phase 7 |

**Coverage: 18/18 v2.0 requirements mapped**
