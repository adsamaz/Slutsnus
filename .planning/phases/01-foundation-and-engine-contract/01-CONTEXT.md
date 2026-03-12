# Phase 1: Foundation and Engine Contract - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Working game engine with simultaneous reveal, per-player state projection, turn timer with auto-pass, reconnect handling, and win detection. Playable end-to-end with real snus brand cards but no combo/event/beer mechanics. Those belong to Phase 2.

snus-rpg engine fully removed. Basic trade (offer/accept, no deception) is in scope for Phase 1.

</domain>

<decisions>
## Implementation Decisions

### Turn Timer
- Fixed 45-second timer every turn — no variation based on game state
- Timer is visible to all players as a countdown (not hidden server-side)
- Round advances immediately when all players submit — no waiting for the clock
- When timer expires: auto-pass for any player who hasn't submitted (no card played, no points gained)

### Game End
- Two win conditions:
  1. **Score threshold:** First player(s) to reach 200 empire points — game ends at end of the current round (all submitted actions resolve first)
  2. **Slut snus:** Deck runs out — game ends, highest score wins
- If multiple players hit 200 in the same round: highest score wins (encourages going big, not just reaching threshold)
- "Slut Snus" gets a special end screen before results — thematic and memorable
- Normal score threshold win uses the standard results screen

### Disconnects
- No special grace period — disconnected player's turn is governed by the normal 45-second timer; if they don't reconnect and submit in time, they auto-pass
- Players can rejoin a game in progress at any point and receive a state snapshot
- Game continues regardless of player count — even with 1 player online (others auto-pass each turn)
- Session preserved for ~5 minutes if all players disconnect simultaneously, then cleanup
- Disconnected players appear on the end screen with their final score; leaderboard records their result

### Starter Card Set
- Real snus brand names (General, Siberia, Ettan, Göteborgs Rapé minimum) — not placeholders
- Simple empire point values per card, no combo/event/contextual effects (those are Phase 2)
- 5-card hand limit — players hold cards between turns
- Draw mechanic: Claude's discretion on draw count per turn (likely 1–2 per turn into the 5-card hand)
- Deck is finite and shared; spent cards go to a visible discard pile and reshuffle into a new deck when exhausted (before the "slut snus" condition triggers — slut snus = deck exhausted with no cards to reshuffle, or a defined minimum threshold)

### Player Actions (Phase 1)
- Spend one or multiple cards from hand in a single turn — empire points gained are the sum of all spent card values
- Pass (play nothing)
- Basic trade: offer a card to another player, they accept or decline — no deceptive display names yet (that's Phase 2)
- No player-to-player targeting or sabotage in Phase 1
- Resolution order irrelevant in Phase 1 — spending adds to your own score only, no conflicts

### Spending Mechanic
- Spent cards are discarded and removed from hand; player gains their combined empire point value
- Deck count is publicly visible to all players
- Reshuffle triggers when draw pile empties during a draw phase
- Slut snus (game-ending deck exhaustion): define threshold during implementation (e.g., deck cannot be reshuffled because discard is also empty, or a minimum card count is reached)

### Lobby / Room Changes
- Show player count display in lobby (2–4 slots, how many filled)
- No host-configurable player count — first 4 who join play; host starts when ready
- Game type label updated from 'snus-rpg' to 'Snusking'
- Full lobby redesign deferred to Phase 3

### Leaderboard
- Write both: final empire point score AND win/loss record per player per game session
- Disconnected players still get their score recorded

### Claude's Discretion
- Exact cards-per-turn draw count (likely 1–2; balance during Phase 4)
- Slut snus exhaustion threshold definition
- Reshuffle animation or notification (if any)
- Internal `onStateUpdate` approach for per-player projection (invoke once per player with playerId tag)
- `TurnBasedGameEngine` interface extension design

</decisions>

<specifics>
## Specific Ideas

- "Slut snus" — the Swedish phrase for "no more snus" — is the thematic name and special screen for deck exhaustion. Lean into this.
- Basic trade in Phase 1 (offer/accept without deception) sets up the infrastructure Phase 2 will extend with fake display names.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/games/registry.ts` — GameEngine interface + registry; new SnuskingEngine plugs in here
- `server/src/socket/game.ts` — action routing to engines; reused as-is
- `server/src/socket/room.ts` — needs one change: per-socket state emission instead of `io.to(roomCode).emit`
- `server/src/games/snus-rpg/brands.ts` — snus brand definitions (nicotine, taste, value); adapt as card catalog seed
- `client/src/games/GameContainer.tsx` — existing game wrapper; new Snusking client plugs in here

### Established Patterns
- TypeScript strict mode + Prettier (2-space, single quotes, trailing commas)
- camelCase functions, PascalCase types/interfaces, UPPER_SNAKE_CASE constants
- `@slutsnus/shared` package for cross-boundary types — all new Snusking types go here first
- Socket.IO event pattern: `socket.on('game:action', handler)` in game.ts

### Integration Points
- `shared/src/types.ts` — add `'snusking'` to GameType union; must be coordinated with DB enum and registry in one commit
- `server/src/socket/room.ts` — per-player state routing: emit to individual socketIds via `onlineUsers` map instead of room broadcast
- Client router — add `/games/snusking` route pointing to new Snusking components

</code_context>

<deferred>
## Deferred Ideas

- Deceptive trading (displayed name ≠ real card) — Phase 2
- Sabotage / spent snus cards / high-nicotine negative-effect cards — Phase 2
- Contextual snus cards and event system — Phase 2
- Full lobby redesign — Phase 3
- Player-triggered situations (spend to activate a context) — v2 backlog
- Spectator mode — v2 backlog
- In-game chat — v2 backlog

</deferred>

---

*Phase: 01-foundation-and-engine-contract*
*Context gathered: 2026-03-12*
