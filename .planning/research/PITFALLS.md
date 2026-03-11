# Domain Pitfalls

**Domain:** Turn-based simultaneous-reveal multiplayer card game
**Project:** Snusking — card game engine replacing snus-rpg on an existing platform
**Researched:** 2026-03-11
**Confidence:** HIGH (grounded in direct codebase analysis + established multiplayer game design patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken fairness guarantees, or irrecoverable game state corruption.

---

### Pitfall 1: Simultaneous Reveal Without Commit-Then-Reveal Protocol

**What goes wrong:** The game requires all players to choose actions simultaneously then reveal them. If the server processes actions as they arrive (first-come-first-served), a fast player's action can be visible to or influence a slow player before that slow player submits. This breaks the fairness guarantee entirely — the whole point of simultaneous reveal is that no player sees others' choices before committing.

The existing `game:action` handler in `server/src/socket/game.ts` calls `engine.handleEvent()` immediately on receipt with no buffering, no waiting for all players, and no reveal phase. This pattern is correct for the real-time snus-rpg but is architecturally wrong for simultaneous reveal.

**Why it happens:** Developers carry over the immediate-action pattern from real-time games. The Socket.IO event fires, the handler runs, done. It feels correct because it works — just unfairly.

**Consequences:** A player on a low-latency connection submits first and their sabotage resolves before their target has a chance to submit a defensive move. Players with better connections win structurally. The game cannot be trusted as a skill contest.

**Prevention:**
- Implement a two-phase turn cycle in the new engine: **collect phase** (buffer all player actions) then **resolve phase** (apply all buffered actions simultaneously).
- The engine must track which players have submitted for the current turn. Only when `submittedCount === activePlayers.length` does the resolve phase execute.
- The `handleEvent()` contract in the `GameEngine` interface needs to accommodate this: an action submission should return "pending" state (action locked in, waiting for others), and the engine triggers resolution internally.
- Never emit `game:state` with resolve results until all players have submitted.

**Detection (warning signs):**
- Engine calls `onStateUpdate` inside `handleEvent` for a submit-type action.
- State changes are visible to clients before all players have submitted that turn.
- The engine has no concept of "turn phase" or "players who have submitted this turn."

**Phase:** Core game engine foundation (Phase 1 of the new engine).

---

### Pitfall 2: Leaking Opponent Hand State to All Clients

**What goes wrong:** The server emits the full game state to all players in the room via `io.to(roomCode).emit('game:state', { state })`. In the existing snus-rpg this is fine — players see each other on the map, inventory is partially visible by design. In the card game, each player has a private hand of cards. If the server broadcasts a single state object containing all players' hands, any client can inspect the WebSocket frame and see opponents' cards.

This is not a paranoid concern — browser DevTools Network tab shows all WebSocket frames in plaintext. In a sabotage-heavy game, knowing an opponent's hand before choosing your action is game-breaking.

**Why it happens:** The `onStateUpdate` callback in `room.ts` line 118 does `io.to(roomCode).emit('game:state', { state })` — one broadcast, one object, all players. This was fine for a game with no hidden information. It is catastrophically wrong for hidden hands.

**Consequences:** Any technically-minded player can cheat trivially. The deception layer of the sabotage mechanic (giving opponents fake card names) is completely undermined if opponents can read the real card in the state.

**Prevention:**
- The new engine must emit **per-player state projections** rather than a single shared state. For each player in the room, compute a view that includes: their own full hand, other players' public-only information (score, card count, held beer, active effects).
- Change the emit pattern from `io.to(roomCode).emit(...)` to `io.to(playerSocketId).emit(...)` for each player.
- The `GameEngine` interface needs a `getStateForPlayer(playerId: string)` method, not just `getState()`.
- The `TradeOffer` structure already hides `realBrandId` behind `displayedName` — this pattern must be preserved and extended.

**Detection (warning signs):**
- A single call to `onStateUpdate` broadcasts to the entire room.
- `getState()` returns a monolithic object with all player hands.
- No per-player filtering logic exists in the engine or socket layer.

**Phase:** Core game engine foundation (Phase 1). Cannot be retrofitted cleanly after the UI is built around a shared state model.

---

### Pitfall 3: Game State Desync on Disconnect and Reconnect

**What goes wrong:** The existing known bug documented in `CONCERNS.md` states: "New players joining room midgame see empty/outdated game state — engine doesn't store state snapshots." For a turn-based card game, this is worse than for a real-time game. In real-time, a reconnecting player misses a few ticks and catches up. In turn-based, if a player disconnects mid-turn, the collect phase stalls forever waiting for their submission — the game deadlocks.

**Why it happens:** The current architecture has no reconnect state snapshot. The `activeGames` map holds the engine, but there is no mechanism to (1) emit current state to a newly reconnected socket, or (2) handle a disconnected player's pending turn submission.

**Consequences:**
- Player disconnects during collect phase → game stalls, other players cannot proceed.
- Player reconnects → sees blank state, doesn't know what phase the game is in or what cards they hold.
- If the game auto-advances past a disconnected player's turn, they rejoin mid-game with no context.

**Prevention:**
- The engine must have a **disconnect policy** for the collect phase: after a configurable timeout (e.g. 30 seconds), auto-submit a null/pass action for a disconnected player so the game can resolve.
- Track socket-to-userId mapping carefully. When a socket reconnects with the same JWT, detect it as a rejoin (not a new player) and immediately emit that player's current state view.
- Fix the existing snapshot gap: on `room:join` or socket reconnect while `activeGames.has(roomCode)`, emit the player's projected state from `engine.getStateForPlayer(userId)`.
- Add a `playerStatus` field per player: `'connected' | 'disconnected' | 'submitted'` so other players can see who is causing a delay.

**Detection (warning signs):**
- `room:join` handler does not check `activeGames` for an in-progress game.
- Engine collect phase has no timeout or absent-player handling.
- No socket-level reconnect detection (distinguishing new connection vs. rejoin).

**Phase:** Core engine (Phase 1) for the policy; reconnect UX (Phase 2) for the client feedback.

---

### Pitfall 4: Sabotage Mechanic Enabling Runaway Kingmaker Scenarios

**What goes wrong:** The sabotage mechanic (give opponents spent/worthless snus, or strong snus with negative side effects) can trivially be used to target the second-place player by the leader, or to coordinate attacks on the leader. In 3-4 player games this creates kingmaker dynamics: one player decides who wins not by playing well but by whom they choose to harm. This degrades the experience, especially if the losing player is always the sabotage target with no recourse.

**Why it happens:** Sabotage mechanics without counterplay feel oppressive. The current design has no stated protection against repeat targeting, no limit on how many sabotages can be directed at one player per turn, and no recourse card.

**Consequences:** Players feel helpless when targeted, particularly in the end-game where sabotage can flip the result. A player who was winning loses due to coordinated targeting — this feels unfair even if it was technically legal play. Players quit early.

**Prevention:**
- Each player should be able to receive at most **one sabotage per turn** (resolve them all simultaneously, but if multiple sabotages target the same player only the strongest or first-to-resolve applies).
- Include at least one card type that provides **sabotage immunity** for a turn (a "Snus Shield" equivalent — perhaps a pouch holder card).
- The beer mechanic can function as a partial defense: holding beer should give a resistance bonus to negative snus effects.
- Design the event/situation system so that the active event provides context-specific protection (e.g., "Fishing Trip" event reduces the effectiveness of sabotage cards against the player who triggered it).
- Playtest specifically: give all players only sabotage cards for 5 turns and verify the game doesn't devolve into mutual destruction.

**Detection (warning signs):**
- No per-turn sabotage limit per target player.
- No card or mechanic in FEATURES that provides immunity or resistance to sabotage.
- Sabotage resolves before the target has any chance to react (only possible if simultaneous reveal is broken — see Pitfall 1).

**Phase:** Card design and balance (Phase 2). Add immunity mechanics before first playtest.

---

### Pitfall 5: Replacing the Engine Without Isolating the Registry Boundary

**What goes wrong:** The new Snusking engine must replace `snus-rpg` entirely. The registry pattern (`server/src/games/registry.ts`) and the `GameEngine` interface are the intended isolation boundary. However, the existing interface is:

```typescript
interface GameEngine {
    init(roomId, players, onStateUpdate): void
    handleEvent(playerId, action): void
    getState(): unknown
    destroy(): void
}
```

This interface was designed for the real-time tick-loop model. Turn-based simultaneous reveal requires fundamentally different lifecycle semantics: phases, buffered submissions, per-player state views. If the team extends `handleEvent` piecemeal to accommodate turn phases (e.g., adding a `type: 'submit_turn'` action with side effects that block other actions), the game logic leaks into the generic socket layer.

**Why it happens:** The registry interface looks reusable, so developers try to stretch it rather than evolving the contract. The `GameAction` type (`{ type: string; payload?: unknown }`) encourages cramming turn-phase logic into action dispatch.

**Consequences:** The `game.ts` socket handler and `room.ts` `onUpdate` callback accumulate game-specific logic. The engine is not truly encapsulated. If a second game type is ever added, the socket layer breaks because it has hidden assumptions about the turn-based engine's state shape.

**Prevention:**
- Define a `TurnBasedGameEngine` interface that extends `GameEngine` with turn-aware methods: `submitAction(playerId, action)`, `getStateForPlayer(playerId)`, `getCurrentPhase()`.
- The socket handler should be game-type-aware enough to call the right interface methods — or the engine should fully handle phase transitions internally without requiring the socket layer to know about them.
- The `onStateUpdate` callback signature must support per-player emission: `onStateUpdate(perPlayerStates: Map<string, unknown>)` so the socket layer can route correctly.
- Do not start client UI work until the engine interface contract is finalized. Changing the state shape after the client renderer is built costs significant rework.

**Detection (warning signs):**
- `game.ts` handler contains `if/else` branching on action type beyond simple routing.
- `onStateUpdate` in `room.ts` interprets state fields to make routing decisions (already visible: it checks `s.status === 'ended'`).
- `getState()` returns `unknown` and callers cast it repeatedly.

**Phase:** Foundation — define the interface before writing any engine code (Phase 1, first task).

---

## Moderate Pitfalls

Mistakes that cause rework, balance problems, or poor player experience but are recoverable.

---

### Pitfall 6: Card Value Balance Ignoring Combo Multipliers

**What goes wrong:** The existing `brands.ts` assigns flat point values to snus cards (e.g. General = 20, Siberia -80 = 65). The new game adds event cards that boost contextual cards (Fishsnus is stronger on Fishing Trip), and beer as a combo resource. If base card values are balanced against each other in isolation, the combo system will create outlier strategies that are strictly dominant (always take Fishsnus, trigger Fishing Trip, hold beer — win every time).

**Why it happens:** Designers balance individual cards early, then add combo systems late. The two are not re-balanced together.

**Consequences:** The metagame collapses to one dominant strategy. Players who discover it always win; players who don't are confused why their reasonable play loses. Rebalancing after launch feels unfair to early learners.

**Prevention:**
- Do not assign final card values until the full combo matrix is mapped: for each card, list every event that boosts it and the effective value including the boost.
- Use a spreadsheet or design doc that shows the **maximum possible value** of each card across all combinations, not just its base value.
- The highest-value card in any single combo should not exceed 2.5x the base value of the best non-combo card. This prevents a single strategy from being overwhelmingly dominant.
- Design events to boost diverse card types, not to create a single "obvious" combo.

**Detection (warning signs):**
- Card values exist in code before the event/situation system is designed.
- No design document maps combo multipliers.
- Playtest feedback: "I just always do X and win."

**Phase:** Card and event design (Phase 2). Must be complete before Phase 3 playtesting.

---

### Pitfall 7: Turn Timer Miscalibration Killing the Social Dynamic

**What goes wrong:** Simultaneous-reveal works because all players think at the same time. If the turn timer is too short, players feel rushed and cannot enjoy the strategic layer. If it is too long, players who decide quickly sit idle. If there is no timer, a single indecisive player holds 3 others hostage indefinitely.

**Why it happens:** Timer values are often set arbitrarily in early development and never revisited. The timer that works in solo testing (0 network latency, developer knows the rules) is not the timer that works with real players over the network who are still learning.

**Consequences:** Short timer: casual players feel excluded, the game becomes a speed contest. Long timer: experienced players are bored and frustrated. No timer: one player ruins the session for everyone.

**Prevention:**
- Start with a 45-second turn timer for the collect phase. This is long enough for a new player to read their hand and think, short enough to maintain pace.
- Show a countdown to all players with clear indication of who has and has not submitted (without revealing what they submitted).
- Allow early resolution: if all players submit before the timer expires, resolve immediately.
- The auto-submit for disconnected players (Pitfall 3) should kick in at the timer expiry, not before.
- Make the timer value a configurable engine parameter (not hardcoded) so it can be adjusted without a deploy.

**Detection (warning signs):**
- Timer value is hardcoded in the engine with no configuration parameter.
- No UI indication of who has submitted vs. who is still deciding.
- Turn timer is the same value regardless of game phase (early turns when players are learning vs. late turns when experienced players decide quickly).

**Phase:** Core engine (Phase 1) for the configurable parameter; UI feedback (Phase 2) for the submission status display.

---

### Pitfall 8: Beer Resource Creates Dominant Hold-Forever Strategy

**What goes wrong:** Beer is described as a "separate holdable resource that combines with snus cards for bonus effects." If the bonus is always better than spending beer, the optimal play is always to hold beer as long as possible for maximum combo value. If there is no cost or risk to holding beer, players never spend it on sub-optimal turns, creating a degenerate "hoard everything until you have the perfect combo" strategy that is both dominant and anti-social (no interaction with other players).

**Why it happens:** Resources that are strictly better when held tend to be hoarded. Without a holding cost (opportunity cost, risk, decay), rational players hoard them.

**Consequences:** Players never drink the beer, the resource feel mechanical and pointless, or alternatively one player hoards beer for 10 turns then wins in a single blowout turn. Neither is fun.

**Prevention:**
- Beer should have a **holding limit** (e.g. maximum 2 beers held at once) so players cannot hoard indefinitely.
- Sabotage should be able to target beer (e.g. a "spilled beer" card removes one beer from the target) — this creates risk in holding and makes the decision meaningful.
- Alternatively, beer provides a diminishing-returns bonus (first beer = +30%, second beer = +20% on top) so the value of each additional held beer decreases.
- Make the beer bonus event-conditional: beer only gives its bonus when the active event is a social event (Party, Midsommar) — not a passive always-on multiplier.

**Detection (warning signs):**
- No holding limit on beer in the design spec.
- Playtesting shows players consistently hold beer until the last 2 turns.
- No mechanism to lose or be deprived of held beer.

**Phase:** Card and event design (Phase 2). Identify during balance review.

---

### Pitfall 9: Engine Replacement Breaks Existing Room/Lobby Flow

**What goes wrong:** The new Snusking engine must register as a new game type (e.g. `'snusking'`) in `gameRegistry`. The existing `GameType` union in `shared/src/types.ts` is `type GameType = 'snus-rpg'`. The `RoomInfo.gameType`, the `LeaderboardEntry.gameType`, and the database `room.gameType` column all use this literal type. Adding a new game type requires coordinated changes across: shared types, database schema (possibly a migration), the registry, the client router, and the game selection UI.

If the team adds the engine without updating all these coordination points, game sessions will be created with an unrecognized `gameType`, silently failing (the registry already returns undefined for unknown types and emits a `room:error`, but that error is swallowed by the catch block in `room.ts` line 153).

**Why it happens:** Type changes in a monorepo feel local but have wide blast radius. The shared package is compiled separately; a type mismatch may not surface until runtime.

**Consequences:** Creating a Snusking room results in a silent `room:error`. Players cannot start a game. The error is invisible because the catch in `room.ts` swallows it. This will be diagnosed as a backend bug rather than a type registration issue.

**Prevention:**
- Make `GameType` an enum or an extensible string union, not a hardcoded literal.
- Add the new game type to the registry, shared types, and database in a single coordinated commit.
- Add input validation that explicitly checks `gameType` against the registry before persisting (the `CONCERNS.md` already flags this gap for `gameType` validation).
- The `room:start` handler already checks `if (!gameRegistry[room.gameType])` — ensure this emits a visible error, not a swallowed one.

**Detection (warning signs):**
- `GameType` is `'snus-rpg'` literal in `shared/src/types.ts` and nowhere else is tracked.
- No migration prepared for the new game type string in the database.
- The client game selection page still only shows snus-rpg.

**Phase:** Platform integration (Phase 1, during engine registration). Do this on day one of the new engine work.

---

## Minor Pitfalls

Mistakes that cause minor friction, polish debt, or localized bugs.

---

### Pitfall 10: Event Card Draw Timing Creates Perceived Unfairness

**What goes wrong:** Event cards (Sauna night, Fishing trip, Party) are drawn each round and boost certain card types. If the event is revealed **before** players choose their turn actions, smart players always play the contextually boosted card. This is correct and intended — but if the event draw is not clearly visible to all players simultaneously, some players will miss it and feel cheated when their card underperforms.

**Prevention:** Reveal the event card at the start of each turn as a prominent animation before the collect phase opens. Never draw a new event mid-turn.

**Phase:** UI and turn flow (Phase 2).

---

### Pitfall 11: Inventory Index Instability During Trade

**What goes wrong:** The existing trade system uses `inventoryIndex` to identify a card in the offerer's hand. When the trade offer is created, the index is stored. If between offer creation and acceptance the offerer plays another card (shifting indices) or receives a card (via another trade), the index may point to the wrong card.

The new turn-based model mitigates this because actions resolve simultaneously (the offerer cannot play a card in the same turn they offered a trade). However, if trades can span multiple turns (an offer from turn N is still pending in turn N+1), the problem returns.

**Prevention:** Store the card's unique identifier (`cardId`) in the trade offer rather than its inventory position. The existing `TradeOffer` already uses `realBrandId` — extend this pattern to the new engine and never use positional indices for deferred operations.

**Phase:** Engine trade implementation (Phase 2).

---

### Pitfall 12: Leaderboard Score Semantics Change

**What goes wrong:** The existing `LeaderboardEntry` stores a raw `score` integer per session. The snus-rpg score represents items collected. The Snusking score represents empire points accumulated. If both game types share the same leaderboard without a `gameType` filter, scores are not comparable — a 65-point snus-rpg game and a 65-point Snusking game mean entirely different things.

**Prevention:** The `leaderboard.ts` route already scopes by `gameType` on the leaderboard table. Ensure the new engine uses a different `gameType` string so historical snus-rpg entries are not mixed with Snusking entries. Add a `gameType` label to the leaderboard UI.

**Phase:** Platform integration (Phase 1, before first game session is persisted).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Engine interface definition | Stretching the real-time `GameEngine` interface to fit turn-based semantics (Pitfall 5) | Define `TurnBasedGameEngine` extending `GameEngine` before writing any implementation code |
| Simultaneous action collect | Processing actions on receipt instead of buffering for all players (Pitfall 1) | Engine must gate resolution on all-players-submitted condition |
| State broadcast | Broadcasting full game state including opponent hands to all clients (Pitfall 2) | Per-player state projection from day one; no shared `getState()` return value |
| Disconnect handling | Game deadlocks when a player disconnects during collect phase (Pitfall 3) | Implement auto-pass after turn timer expiry; handle rejoin snapshot |
| GameType registration | New game type not propagated across types, DB schema, and registry (Pitfall 9) | Coordinated single commit across shared/server/client |
| Card balance | Flat card values assigned before combo matrix is mapped (Pitfall 6) | Build combo multiplier spreadsheet before coding card definitions |
| Beer resource design | Hold-forever dominance with no holding cost or risk (Pitfall 8) | Add holding limit and sabotage-beer interaction in design before implementation |
| Turn timer | Hardcoded timer that doesn't account for network latency or player experience level (Pitfall 7) | Configurable parameter from the start; start at 45 seconds |
| Sabotage balance | Kingmaker targeting with no counterplay (Pitfall 4) | One-sabotage-per-target-per-turn limit; at least one immunity card type |
| Trade system | Inventory index instability for multi-turn pending trades (Pitfall 11) | Use card ID not index; extend existing `realBrandId` pattern |
| Leaderboard | Mixed snus-rpg and Snusking scores on shared leaderboard (Pitfall 12) | Confirm `gameType` scoping before first game session is persisted |
| Event card reveal | Event drawn or changed mid-turn creating perceived unfairness (Pitfall 10) | Reveal event at turn start, before collect phase opens |

---

## Sources

**Confidence levels:**

- Pitfalls 1, 2, 3, 5, 9, 11, 12: HIGH — Derived directly from codebase analysis of `server/src/socket/game.ts`, `room.ts`, `registry.ts`, `engine.ts`, and `shared/src/types.ts`. The code patterns cited are real and observable.
- Pitfalls 4, 6, 7, 8, 10: MEDIUM — Derived from established multiplayer card game design patterns and game balance theory. Cannot be verified against official documentation sources (no web access in this session), but these are well-understood domain patterns in card game design literature (Dominion, Race for the Galaxy, Hanabi post-mortems).

*Analysis performed from direct codebase reads, no external sources consulted in this session.*
