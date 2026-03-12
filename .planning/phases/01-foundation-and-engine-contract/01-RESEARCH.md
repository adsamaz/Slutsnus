# Phase 1: Foundation and Engine Contract - Research

**Researched:** 2026-03-12
**Domain:** Turn-based simultaneous-reveal card game engine on existing Socket.IO + TypeScript platform
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Turn Timer:**
- Fixed 45-second timer every turn — no variation based on game state
- Timer is visible to all players as a countdown (not hidden server-side)
- Round advances immediately when all players submit — no waiting for the clock
- When timer expires: auto-pass for any player who hasn't submitted (no card played, no points gained)

**Game End:**
- Two win conditions:
  1. Score threshold: First player(s) to reach 200 empire points — game ends at end of the current round (all submitted actions resolve first)
  2. Slut snus: Deck runs out — game ends, highest score wins
- If multiple players hit 200 in the same round: highest score wins
- "Slut Snus" gets a special end screen before results
- Normal score threshold win uses the standard results screen

**Disconnects:**
- No special grace period — disconnected player's turn is governed by the normal 45-second timer
- Players can rejoin a game in progress at any point and receive a state snapshot
- Game continues regardless of player count — even with 1 player online (others auto-pass each turn)
- Session preserved for ~5 minutes if all players disconnect simultaneously, then cleanup
- Disconnected players appear on the end screen with their final score; leaderboard records their result

**Starter Card Set:**
- Real snus brand names (General, Siberia, Ettan, Göteborgs Rapé minimum) — not placeholders
- Simple empire point values per card, no combo/event/contextual effects (Phase 2)
- 5-card hand limit
- Draw mechanic: Claude's discretion on draw count per turn (likely 1–2)
- Deck is finite and shared; spent cards go to visible discard pile and reshuffle when exhausted (before slut snus)

**Player Actions (Phase 1):**
- Spend one or multiple cards from hand — empire points gained = sum of spent card values
- Pass (play nothing)
- Basic trade: offer a card to another player, they accept or decline — no deceptive display names yet
- No player-to-player targeting or sabotage in Phase 1
- Resolution order irrelevant — spending adds to your own score only

**Spending Mechanic:**
- Spent cards are discarded and removed from hand; player gains combined empire point value
- Deck count is publicly visible to all players
- Reshuffle triggers when draw pile empties during a draw phase
- Slut snus threshold: defined during implementation

**Lobby / Room Changes:**
- Show player count display in lobby (2–4 slots, how many filled)
- No host-configurable player count — first 4 who join play; host starts when ready
- Game type label updated from 'snus-rpg' to 'Snusking'
- Full lobby redesign deferred to Phase 3

**Leaderboard:**
- Write both: final empire point score AND win/loss record per player per game session
- Disconnected players still get their score recorded

### Claude's Discretion
- Exact cards-per-turn draw count (likely 1–2; balance during Phase 4)
- Slut snus exhaustion threshold definition
- Reshuffle animation or notification (if any)
- Internal `onStateUpdate` approach for per-player projection (invoke once per player with playerId tag)
- `TurnBasedGameEngine` interface extension design

### Deferred Ideas (OUT OF SCOPE)
- Deceptive trading (displayed name ≠ real card) — Phase 2
- Sabotage / spent snus cards / high-nicotine negative-effect cards — Phase 2
- Contextual snus cards and event system — Phase 2
- Full lobby redesign — Phase 3
- Player-triggered situations (spend to activate a context) — v2 backlog
- Spectator mode — v2 backlog
- In-game chat — v2 backlog
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-CORE-01 | Turn-based card game engine replacing `snus-rpg` entirely | `SnuskingEngine` implements `GameEngine` via registry; snus-rpg files deleted |
| REQ-CORE-02 | Up to 4 players per game session (minimum 2) | Existing `PlayerInfo[]` passed to `engine.init()` supports this; no changes needed |
| REQ-CORE-03 | Simultaneous reveal: all players choose actions, then reveal together | `pendingActions: Map<string, StagedAction>` buffer; resolve only when all submitted or timer fires |
| REQ-CORE-04 | Turn phases: Draw → Planning → Reveal → Resolve | `GamePhase` type union driving FSM transitions inside `SnuskingEngine` |
| REQ-CORE-05 | Turn timer (45 seconds) with auto-pass for AFK/disconnected players | `setTimeout` with `TURN_TIMER_MS = 45_000` constant; fires `autoPass` for missing players |
| REQ-CORE-06 | Win condition: empire score threshold (200) triggers game end at round end | `checkWin()` called in `resolve` phase after scoring; stores results and transitions to `ended` |
| REQ-CORE-07 | Win condition: deck exhaustion ("slut snus") triggers game end | `checkSlutSnus()` in draw phase when deck + discard both empty (or below threshold) |
| REQ-MULTI-01 | Per-player state projection: each player only receives their own hand | `projectState(playerId)` strips other players' hands; `onStateUpdate` called once per player |
| REQ-MULTI-02 | Opponents' commit status visible (has submitted / pending) without revealing choice | `hasCommitted: boolean` in projected state; `pendingActions` never emitted |
| REQ-MULTI-03 | Reconnect support: rejoining player receives current state snapshot | `room:join` handler checks `activeGames` and emits `projectState(userId)` to rejoining socket |
| REQ-MULTI-04 | Game state persists through brief disconnects; auto-pass at timer expiry | Timer auto-pass logic; no special early timeout for disconnected players |
| REQ-NFR-01 | Server must never broadcast unified game state containing all players' hands | `onStateUpdate` pattern changed from room-broadcast to per-socket emission |
| REQ-NFR-02 | Action payloads validated at Socket.IO boundary (Zod, server-side only) | Zod schemas for `SnuskingAction` discriminated union; validated in `handleEvent` |
| REQ-NFR-03 | Deck shuffling must use unbiased algorithm (`crypto.randomInt` Fisher-Yates) | Inline Fisher-Yates in `deck.ts`; replaces `Math.random()` pattern from snus-rpg |
| REQ-NFR-04 | `TurnBasedGameEngine` interface extension defined before any implementation | First file created in Phase 1; extends `GameEngine` with turn-aware methods |
| REQ-NFR-05 | `GameType` registration propagated across shared types, DB enum, registry, and client routing in one commit | `shared/src/types.ts` + `registry.ts` + `GameContainer.tsx` + `room.ts` updated together |
</phase_requirements>

---

## Summary

Phase 1 builds the complete playable foundation for Snusking by replacing the `snus-rpg` engine with a new `SnuskingEngine` implementing a simultaneous-reveal finite state machine. The work is constrained by two hard architectural requirements that must be resolved before any other code is written: (1) `onStateUpdate` in `room.ts` currently broadcasts one state object to the whole room — this must become per-socket emission, and (2) the existing `GameEngine` interface was designed for real-time greedy processing — a `TurnBasedGameEngine` extension must be defined before writing the engine class.

The codebase is well-suited for this work. The `GameEngine` interface in `registry.ts` is the clean integration seam. The `onlineUsers` map in `socket/index.ts` already provides the userId-to-socketId lookup needed for per-player emission. The existing `brands.ts` file contains all snus brand definitions (12 brands including General, Siberia, Ettan, Göteborgs Rapé) that can be adapted into card catalog seeds. The Prisma schema uses plain `String` (not a typed enum) for `gameType` and `status` fields, meaning `'snusking'` can be added to the TypeScript union without a DB migration — only the TypeScript type and registry need updating.

The 7-layer build order is: shared types → card catalog + deck → rules engine (pure functions) → game engine FSM → registry + room.ts wiring → client skeleton → reconnect + lobby. Each layer is independently testable. The planner should structure tasks to match this dependency order exactly — starting with types, ending with client integration.

**Primary recommendation:** Define `TurnBasedGameEngine` and the full `SnuskingState` type contract in the first commit of Phase 1. Every subsequent task depends on these types being stable.

---

## Standard Stack

### Core (zero new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript plain class | 5.7.3 (existing) | `SnuskingEngine implements GameEngine` | Matches existing pattern; no framework adds overhead fighting the `handleEvent` + `onStateUpdate` contract |
| `GamePhase` type union | — | FSM phase enum: `'draw' \| 'planning' \| 'reveal' \| 'resolve' \| 'ended'` | Discriminated unions for exhaustive switch; zero runtime cost |
| `Map<string, StagedAction>` | — | Simultaneous action buffering | Idiomatic TypeScript; matches `handleEvent(playerId, action)` signature exactly |
| `setTimeout` | Node.js built-in | Turn timer (45 seconds); auto-pass on expiry | Single-process architecture; no Redis in stack |
| `crypto.randomInt` | Node.js built-in | Fisher-Yates deck shuffle | Unbiased; replaces flagged `Math.random()` shuffle in snus-rpg |
| Solid.js `createSignal` / `createStore` | 1.9.3 (existing) | Client game UI state | Already a project dependency; reactive primitives are correct for card game rendering |

### New Dependency
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^3.x (latest stable) | Server-side action payload validation at Socket.IO boundary | Directly addresses unsafe casts documented in CONCERNS.md; server-only install |

**Note on Zod version:** The research summary listed `^3.24.x` based on training data (August 2025 cutoff). Zod released v4 in 2025. Verify which major version is appropriate before installing: if Zod v4 is stable and has a compatible API, use it; otherwise use `^3.x`. Check `npmjs.com/package/zod` before running the install command.

### Alternatives Rejected
| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Plain TypeScript class | XState 5.x | XState actor/service model fights the existing `handleEvent` + `onStateUpdate` contract; adds indirection for a 5-phase FSM |
| Plain TypeScript class | boardgame.io | Requires its own server, transport, and client framework — cannot be embedded in existing Express + Socket.IO |
| `setTimeout` | Redis/BullMQ timer | Single-process; overkill; Redis not in stack |
| `crypto.randomInt` Fisher-Yates | `lodash.shuffle` | lodash uses `Math.random()` internally; 70KB for 5 lines; adds nothing |

**Installation:**
```bash
# Server workspace only
npm install zod --workspace=@slutsnus/server
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
shared/src/
└── types.ts                    # Add SnuskingState, SnuskingCard, SnuskingPlayer, SnuskingAction (new section)

server/src/games/
├── registry.ts                 # Replace 'snus-rpg' with 'snusking'; add TurnBasedGameEngine interface
└── snusking/
    ├── engine.ts               # SnuskingEngine — FSM, action buffering, timer, projection
    ├── deck.ts                 # Card definitions (adapted from brands.ts), deck builder, Fisher-Yates shuffle
    └── rules.ts                # Pure functions: scoreCards(), checkWin(), checkSlutSnus()

client/src/games/
└── snusking/
    ├── index.tsx               # SnuskingGame root component
    ├── Board.tsx               # Table layout: discard pile, deck count, player zones
    ├── Hand.tsx                # Current player's cards (interactive during planning phase)
    ├── OpponentStatus.tsx      # Other players' commit status (face-down indicator)
    ├── PlayerHUD.tsx           # Empire score per player (always public)
    └── EndScreen.tsx           # Win screen / Slut Snus screen

server/src/socket/
└── room.ts                     # MODIFIED: onUpdate callback → per-socket emission pattern
```

### Pattern 1: TurnBasedGameEngine Interface Extension

**What:** Define a `TurnBasedGameEngine` interface that extends `GameEngine` with turn-phase awareness before writing `SnuskingEngine`.

**When to use:** First file written in Phase 1. All subsequent engine code implements this contract.

**Why this approach:** The existing `GameEngine` interface (`init`, `handleEvent`, `getState`, `destroy`) was designed for real-time greedy processing. Adding turn phases through action type hacks leaks game logic into the socket layer. A named extension makes the contract explicit and prevents interface sprawl.

```typescript
// Source: registry.ts (existing) + new extension
// File: server/src/games/registry.ts

export interface GameEngine {
  init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void;
  handleEvent(playerId: string, action: GameAction): void;
  getState(): unknown;
  destroy(): void;
}

// New — defined before SnuskingEngine implementation
export interface TurnBasedGameEngine extends GameEngine {
  projectState(playerId: string): unknown;
  getCurrentPhase(): TurnPhase;
}
```

### Pattern 2: Per-Player State Emission (room.ts change)

**What:** Change the `onUpdate` callback from room-broadcast to per-socket emission. This is the only required modification to existing platform files.

**When to use:** Part of the coordinated `GameType` registration commit.

```typescript
// Source: direct read of server/src/socket/room.ts (line 117-118)
// BEFORE (current):
const onUpdate = async (state: unknown) => {
  io.to(roomCode).emit('game:state', { state });
  // ...
};

// AFTER (snusking requires per-player projection):
// Engine calls onUpdate once per player: onUpdate({ forUserId: id, state: projection })
const onUpdate = async (state: unknown) => {
  const s = state as { forUserId?: string; state: unknown; status?: string; results?: GameResult[] };

  if (s.forUserId) {
    // Per-player projection (Snusking pattern)
    const socketIds = onlineUsers.get(s.forUserId);
    if (socketIds) {
      for (const socketId of socketIds) {
        io.to(socketId).emit('game:state', { state: s.state });
      }
    }
  } else {
    // Room-broadcast (snus-rpg pattern — preserved for backward compat until removed)
    io.to(roomCode).emit('game:state', { state });
  }

  // Game end handling (unchanged)
  const raw = (s.forUserId ? s.state : s) as { status?: string; results?: GameResult[] };
  if (raw.status === 'ended' && raw.results) {
    // ... existing persist logic
  }
};
```

**Note on the `forUserId` approach:** This is the Option B pattern from ARCHITECTURE.md — engine calls `onStateUpdate` once per player, each time with `{ forUserId, state: projection }`. The `GameEngine` interface stays unchanged; only the callback implementation changes. This is the locked recommendation.

### Pattern 3: Simultaneous Reveal FSM

**What:** Engine buffers all player actions in `pendingActions` during `planning` phase. Resolution only fires when `pendingActions.size === activePlayers.size` OR the turn timer fires.

```typescript
// Source: architecture research (verified against existing handleEvent pattern in engine.ts)

type TurnPhase = 'draw' | 'planning' | 'reveal' | 'resolve';

class SnuskingEngine implements TurnBasedGameEngine {
  private masterState!: SnuskingMasterState;   // full truth, never emitted
  private pendingActions = new Map<string, StagedAction>();
  private turnTimer?: ReturnType<typeof setTimeout>;
  private onStateUpdate: (state: unknown) => void = () => {};

  handleEvent(playerId: string, action: GameAction): void {
    if (this.masterState.phase !== 'planning') return;
    if (this.pendingActions.has(playerId)) return; // already committed

    const validated = validateAction(action); // Zod parse
    if (!validated) return;

    this.pendingActions.set(playerId, validated);
    this.masterState.players[playerId].hasCommitted = true;
    this.emitPerPlayer(); // show updated commit status, NOT the action

    if (this.allPlayersActed()) {
      this.startReveal();
    }
  }

  private allPlayersActed(): boolean {
    const active = Object.keys(this.masterState.players).filter(
      id => this.masterState.players[id].isConnected || this.pendingActions.has(id)
    );
    return active.every(id => this.pendingActions.has(id));
  }
}
```

### Pattern 4: Card Catalog (adapted from brands.ts)

**What:** New `SnuskingCard` type and card catalog in `deck.ts`. Adapts existing `SnusBrand` data — same brand names, reframed as empire point values.

**Key insight:** The existing `brands.ts` has 12 brands (General, Siberia, Ettan, Göteborgs Rapé, Grov, Röda Lacket, Catch Licorice, Oden's Extreme, Thunder Extra Strong, Oden's Cold Dry, Knox Original, General White Portion). Phase 1 uses a subset of these with simple empire point values. Phase 2 adds the `situation` field for event combos.

```typescript
// Source: direct read of server/src/games/snus-rpg/brands.ts
// Phase 1 card shape (no situation/effect fields — those are Phase 2)

interface SnuskingCardDefinition {
  id: string;
  name: string;
  empirePoints: number;  // replaces 'value' from SnusBrand
}

// Starter set — real brand names, simple values
export const SNUSKING_CARDS: SnuskingCardDefinition[] = [
  { id: 'general',    name: 'General',           empirePoints: 20 },
  { id: 'siberia',    name: 'Siberia -80',        empirePoints: 30 },
  { id: 'ettan',      name: 'Ettan',              empirePoints: 15 },
  { id: 'goteborg',   name: 'Göteborgs Rapé',     empirePoints: 18 },
  { id: 'grov',       name: 'Grov',               empirePoints: 14 },
  { id: 'catchlicorice', name: 'Catch Licorice',  empirePoints: 22 },
  // Add more during Phase 4 balance tuning
];
```

### Pattern 5: Reconnect State Snapshot

**What:** On `room:join` socket event, if an active game exists for that room, emit the player's current projected state immediately.

**Where to add:** `room:join` handler in `room.ts`, after the existing room info broadcast.

```typescript
// Source: direct read of server/src/socket/room.ts (room:join handler at line 34)
// Add after existing room info emit:

socket.on('room:join', async ({ roomCode }) => {
  // ... existing room DB lookup and socket.join ...

  // Reconnect state snapshot for in-progress game
  const engine = activeGames.get(roomCode);
  if (engine) {
    const turnEngine = engine as TurnBasedGameEngine;
    const snapshot = turnEngine.projectState(userId);
    socket.emit('game:state', { state: snapshot });
  }
});
```

### Pattern 6: Fisher-Yates Deck Shuffle

**What:** Unbiased deck shuffle replacing the `Math.random()` sort pattern documented as biased in CONCERNS.md.

```typescript
// Source: standard Fisher-Yates algorithm (mathematical certainty)
// File: server/src/games/snusking/deck.ts

import { randomInt } from 'crypto';

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```

### Pattern 7: Slut Snus End Condition

**What:** Two distinct win conditions each triggering different end screens. Engine detects both in `resolve` phase (after scoring).

```typescript
// Source: CONTEXT.md decisions

type GameEndReason = 'score_threshold' | 'slut_snus';

function checkWinCondition(state: SnuskingMasterState): GameEndReason | null {
  // Score threshold: check after scoring completes
  const SCORE_THRESHOLD = 200;
  const winners = Object.values(state.players).filter(p => p.empireScore >= SCORE_THRESHOLD);
  if (winners.length > 0) return 'score_threshold';

  // Slut snus: deck is empty AND discard is empty (nothing to reshuffle)
  if (state.deck.length === 0 && state.discardPile.length === 0) return 'slut_snus';

  return null;
}
```

### Anti-Patterns to Avoid

- **Greedy action processing:** Never call `onStateUpdate` with revealed opponent actions inside `handleEvent` during planning phase. Buffer in `pendingActions`, emit only `hasCommitted` status until all players act.
- **Room-broadcast of master state:** Never call `io.to(roomCode).emit('game:state', { state: masterState })`. Always use per-socket emission with projected state.
- **Tick loop for turn-based logic:** Do not use `setInterval` to drive phase transitions (the snus-rpg pattern). Only use a single `setTimeout` for the planning phase deadline.
- **Canvas rendering for cards:** Do not extend `renderer.ts`. All Snusking UI is DOM-based Solid.js components.
- **Client-side reveal timing:** Do not have the client decide when to show revealed cards. Server controls phase transitions; client renders whatever `phase` it receives.
- **GameType registration in multiple commits:** Adding `'snusking'` to `shared/types.ts` without also updating `registry.ts`, `room.ts` (`onUpdate`), and `GameContainer.tsx` in the same commit causes silent `room:error` failures (the registry check at line 100 in `room.ts`).
- **Inventory index for trades:** Store `cardId` in trade offers, not array position. Position shifts when cards are played. The existing `TradeOffer.realBrandId` pattern is correct — extend it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Action payload validation | Manual `as { cardId: string }` casts | Zod `z.discriminatedUnion()` | The existing codebase already has unsafe casts documented in CONCERNS.md; Zod parses-and-throws at the boundary with proper error messages |
| Deck shuffling | `[...deck].sort(() => Math.random() - 0.5)` | `crypto.randomInt` Fisher-Yates | The biased sort shuffle is already documented as a problem in CONCERNS.md; Fisher-Yates is 5 lines |
| Per-player state routing | Custom state diffing or client-side filtering | `onlineUsers.get(userId)` per-socket emit | The `onlineUsers` map already tracks userId → Set\<socketId\>; iterate it |
| Turn timer | `setInterval` polling | Single `setTimeout` + clearTimeout | One timeout per planning phase is correct; a general tick loop is wrong for event-driven turn flow |
| Unique card IDs in hands | Sequential integer IDs | `uuid` (already a project dependency) | UUID is already installed (`uuid 11.0.3`); instance IDs must survive shuffles and hand reordering |

**Key insight:** The platform already has the plumbing. The `onlineUsers` map, `activeGames` map, `GameEngine` interface, `game:action` routing, and leaderboard persistence are all done. Phase 1 adds the game logic layer only.

---

## Common Pitfalls

### Pitfall 1: Starting snus-rpg removal before Snusking is wired up
**What goes wrong:** Deleting `snus-rpg` files before `'snusking'` is registered and tested leaves the platform with no working game type. The `gameRegistry` check in `room.ts` line 100 returns `undefined` and emits `room:error`.
**Why it happens:** It feels cleaner to delete the old code first.
**How to avoid:** Keep `snus-rpg` alive until `SnuskingEngine` passes end-to-end smoke test. Delete snus-rpg in the final task of the phase, after Snusking is verified.
**Warning signs:** `room:error: 'Unknown game type'` when trying to start a Snusking room.

### Pitfall 2: onStateUpdate called before pendingActions gate
**What goes wrong:** If `handleEvent` calls `onStateUpdate` immediately on receiving a `commit` action (the existing pattern from `snus-rpg` engine line 182), other players see state changes before submitting. Timing advantage = structural unfairness.
**Why it happens:** Copying the snus-rpg `handleEvent` pattern. It calls `this.onStateUpdate(this.getState())` at the end of every action.
**How to avoid:** During `planning` phase, `onStateUpdate` only emits `hasCommitted` status updates (who locked in), never the action content. Emit full reveal only when transitioning to `reveal` phase.
**Warning signs:** Engine calls `onStateUpdate` inside `handleEvent` for commit-type actions during planning phase.

### Pitfall 3: GameType registration spread across multiple commits
**What goes wrong:** Adding `'snusking'` to `registry.ts` without updating `shared/src/types.ts` (the `GameType` union), `room.ts` (the `onUpdate` callback), and `GameContainer.tsx` causes runtime failures.
**Why it happens:** Developers update the registry first to "test it works", planning to update types later.
**How to avoid:** One commit: `shared/src/types.ts` + `server/src/games/registry.ts` + `server/src/socket/room.ts` (onUpdate change) + `client/src/games/GameContainer.tsx`.
**Warning signs:** TypeScript errors on `RoomInfo.gameType`, `room.ts` line 100 check fails at runtime.

### Pitfall 4: Disconnect without auto-pass causes planning phase deadlock
**What goes wrong:** A player disconnects during `planning` phase. The `allPlayersActed()` gate never opens. Other 3 players are stuck waiting indefinitely.
**Why it happens:** The `allPlayersActed()` predicate counts all players, not only connected ones.
**How to avoid:** `allPlayersActed()` should only count players who have not disconnected. On timer expiry, auto-insert `{ type: 'pass' }` into `pendingActions` for any player who hasn't committed (connected or not).
**Warning signs:** Multiplayer test with 2 sockets: close one socket during planning phase and see if the round ever resolves.

### Pitfall 5: Reconnect emits master state instead of projected state
**What goes wrong:** Adding the reconnect snapshot by calling `engine.getState()` (which returns `masterState`) exposes all players' hands to the rejoining player.
**Why it happens:** `getState()` already exists on the interface; `projectState(userId)` requires the cast to `TurnBasedGameEngine`.
**How to avoid:** The reconnect snapshot MUST use `engine.projectState(userId)`. Cast to `TurnBasedGameEngine` in the `room:join` handler after checking `activeGames`.
**Warning signs:** Rejoining player can see other players' card counts / hands in their received state snapshot.

### Pitfall 6: Deck reshuffle timing during draw phase
**What goes wrong:** If the draw phase tries to deal cards and the draw pile is empty, a naive implementation throws or deals nothing. Reshuffle should happen automatically, but reshuffle into an empty discard pile should trigger slut snus — not a crash.
**Why it happens:** The draw logic checks `deck.length > 0` but doesn't handle the two-step: "can we reshuffle? if yes, reshuffle and continue; if no, trigger slut snus".
**How to avoid:** Draw phase logic: if deck empty and discard non-empty → reshuffle discard into deck → continue draw. If deck empty and discard empty → trigger slut snus end condition.
**Warning signs:** Error thrown when last card is drawn and a new round starts.

### Pitfall 7: Win condition checked before resolution completes
**What goes wrong:** If `checkWin()` runs before all `pendingActions` are scored in the same resolve phase, a player might reach 200 points from the current round's actions but the win isn't detected.
**Why it happens:** Checking win condition at start of resolve phase instead of end.
**How to avoid:** Run `scoreCards()` → update `empireScore` → THEN run `checkWin()` in sequence within the `resolve` phase. Win detection at the end of resolve, not before.
**Warning signs:** Player at 199 points plays a 5-point card, game continues instead of ending.

---

## Code Examples

Verified patterns from direct codebase reads:

### Current GameEngine interface (to extend, not replace)
```typescript
// Source: direct read of server/src/games/registry.ts
export interface GameEngine {
  init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void;
  handleEvent(playerId: string, action: GameAction): void;
  getState(): unknown;
  destroy(): void;
}

export const gameRegistry: Record<string, new () => GameEngine> = {
  'snus-rpg': SnusRpgEngine,
  // Add: 'snusking': SnuskingEngine
};
```

### onlineUsers map (existing — use for per-socket emission)
```typescript
// Source: direct read of server/src/socket/index.ts (lines 12-14)
// userId → Set<socketId>
export const onlineUsers = new Map<string, Set<string>>();
export const activeGames = new Map<string, GameEngine>();
```

### GameType union (current — needs 'snusking' added)
```typescript
// Source: direct read of shared/src/types.ts (line 30)
// BEFORE:
export type GameType = 'snus-rpg';
// AFTER (Phase 1):
export type GameType = 'snus-rpg' | 'snusking';
// Note: DB schema uses plain String for gameType (not a Prisma enum), so no migration needed.
```

### GameContainer pattern (existing — add snusking branch)
```typescript
// Source: direct read of client/src/games/GameContainer.tsx (lines 54-62)
// BEFORE:
<Show when={gameType() === 'snus-rpg'}>
  <SnusRpgGame ... />
</Show>

// AFTER:
<Show when={gameType() === 'snus-rpg'}>
  <SnusRpgGame ... />
</Show>
<Show when={gameType() === 'snusking'}>
  <SnuskingGame state={state() as SnuskingState} roomCode={props.roomCode} ended={ended()} ... />
</Show>
```

### Existing snus-rpg engine endGame pattern (adapt for Snusking)
```typescript
// Source: direct read of server/src/games/snus-rpg/engine.ts (lines 142-154)
private endGame(): void {
  const sorted = Object.values(this.state.players).sort((a, b) => b.score - a.score);
  const results: GameResult[] = sorted.map((p, i) => ({
    userId: p.userId,
    username: p.username,
    score: p.score,
    rank: i + 1,
  }));
  this.state.status = 'ended';
  this.state.results = results;
  this.onStateUpdate(this.getState());
  this.destroy();
}
// Snusking's endGame will follow same pattern — but call onUpdate once per player
// using projectState(userId), and include endReason: 'score_threshold' | 'slut_snus'
```

### Brands data available for adaptation (partial)
```typescript
// Source: direct read of server/src/games/snus-rpg/brands.ts (12 brands total)
// Available: general, general-white, goteborg, ettan, grov, roda-lacket,
//            catch-licorice, odens-extreme, thunder-strong, odens-cold-dry, siberia, knox
// Phase 1 uses these as SnuskingCardDefinition with empirePoints replacing value
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `io.to(roomCode).emit('game:state', { state })` | `io.to(socketId).emit('game:state', { state: projectState(userId) })` | Phase 1 (this phase) | Eliminates hand leak via DevTools; required for hidden-information game |
| `setInterval(tick, 100)` tick loop | `setTimeout` planning deadline only | Phase 1 (this phase) | Card game is event-driven, not time-driven; reduces CPU waste |
| `Math.random()` sort shuffle (biased) | `crypto.randomInt` Fisher-Yates | Phase 1 (this phase) | Eliminates statistical bias in deck deals |
| Unsafe `as { ... }` action casts | Zod discriminated union parse | Phase 1 (this phase) | Runtime validation; removes class of payload corruption bugs |
| Single `GameEngine` interface | `TurnBasedGameEngine extends GameEngine` | Phase 1 (this phase) | Clean separation of real-time vs turn-based engine contracts |

**Deprecated/outdated:**
- `snus-rpg` engine: Removed entirely in Phase 1 final task. Do not add new features to it.
- Room-broadcast pattern: Deprecated for games with hidden state. Preserved for backward compat only until snus-rpg is deleted.

---

## Open Questions

1. **onStateUpdate: `{ forUserId, state }` wrapper vs. Map\<string, unknown\>**
   - What we know: CONTEXT.md marks this as Claude's Discretion. ARCHITECTURE.md recommends Option B (invoke once per player with `forUserId` tag). The `forUserId` approach keeps `GameEngine.init()` signature unchanged.
   - What's unclear: Whether the wrapper object approach (`{ forUserId, state }`) is cleaner than changing `onStateUpdate` to accept `Map<string, unknown>`.
   - Recommendation: Use the `{ forUserId, state }` wrapper. It keeps the `GameEngine` interface unchanged, requires no breaking change to `registry.ts`, and lets snus-rpg continue broadcasting without modification. Resolve definitively in the first implementation task.

2. **Zod version: v3 or v4**
   - What we know: Training data (August 2025) shows `^3.24.x` as stable. Zod v4 was in active development.
   - What's unclear: Whether v4 is stable and production-ready as of 2026-03-12.
   - Recommendation: Check `npmjs.com/package/zod` for current stable version before installing. Use the latest stable v3 if v4 has breaking changes; use v4 if it's stable and the API is compatible.

3. **Draw count per turn (Claude's Discretion)**
   - What we know: CONTEXT.md says "likely 1–2 per turn into the 5-card hand". 5-card hand limit is locked.
   - What's unclear: Whether to draw to fill (deal until hand = 5) or draw a fixed number.
   - Recommendation: Draw to fill up to 5 cards per draw phase. Simpler logic, consistent hand size, easier to balance in Phase 4. The constant `MAX_HAND_SIZE = 5` is already locked.

4. **Slut snus threshold**
   - What we know: CONTEXT.md says define during implementation. Two options: (a) deck + discard both empty, (b) deck falls below minimum threshold (e.g., fewer cards than players × 1).
   - What's unclear: Which is more fun (guaranteed cards for final round vs. abrupt end).
   - Recommendation: Use option (a) — slut snus triggers when the draw pile is empty AND the discard pile is also empty (nothing to reshuffle). This gives the most natural game end and requires no tunable threshold constant.

5. **5-minute all-disconnected session preservation**
   - What we know: CONTEXT.md says "session preserved for ~5 minutes if all players disconnect simultaneously, then cleanup".
   - What's unclear: Whether this requires active tracking (a 5-minute `setTimeout` on all-disconnect) or is best-effort (relying on process memory).
   - Recommendation: Add a 5-minute `setTimeout` in the disconnect handler when `onlineUsers.get(userId)?.size === 0` and `activeGames.has(roomCode)`. Call `engine.destroy()` and `activeGames.delete(roomCode)` on expiry. Simple to implement; no Redis needed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework configured (see Wave 0) |
| Config file | none — Wave 0 task |
| Quick run command | `npm test --workspace=@slutsnus/server` (after Vitest installed) |
| Full suite command | `npm test --workspace=@slutsnus/server -- --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REQ-CORE-03 | All players commit → reveal fires; early commit waits | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-CORE-04 | Phase transitions: draw→planning→reveal→resolve→draw | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-CORE-05 | Timer expiry auto-passes uncommitted players | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-CORE-06 | Player at 200+ points after resolve triggers game end | unit | `vitest run server/src/games/snusking/rules.test.ts` | ❌ Wave 0 |
| REQ-CORE-07 | Deck + discard empty during draw → slut snus end | unit | `vitest run server/src/games/snusking/rules.test.ts` | ❌ Wave 0 |
| REQ-MULTI-01 | projectState strips opponent hand cards | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-MULTI-02 | hasCommitted visible; actual action NOT in projected state during planning | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-MULTI-03 | Reconnecting player receives current projected state | integration | manual (multi-socket) — manual-only in Phase 1 | ❌ manual |
| REQ-NFR-01 | No player's hand visible in opponent's projected state | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-NFR-02 | Invalid action payload rejected by Zod before engine processes it | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ Wave 0 |
| REQ-NFR-03 | Deck shuffle is unbiased (chi-square or distribution test) | unit | `vitest run server/src/games/snusking/deck.test.ts` | ❌ Wave 0 |
| REQ-NFR-04 | TurnBasedGameEngine interface exists and SnuskingEngine satisfies it | type-check | `tsc --noEmit` in server workspace | ❌ Wave 0 |
| REQ-NFR-05 | GameType includes 'snusking' in shared types | type-check | `tsc --noEmit` in shared workspace | ❌ Wave 0 |

**Manual-only justification (REQ-MULTI-03):** Reconnect testing requires two Socket.IO clients, one disconnect/reconnect cycle, and state snapshot comparison. This is an end-to-end scenario that requires running the full server stack. Mark as smoke-tested manually during Phase 4 integration, not automated in Phase 1.

### Sampling Rate
- **Per task commit:** `npm test --workspace=@slutsnus/server` (unit tests only)
- **Per wave merge:** `npm test --workspace=@slutsnus/server -- --coverage` + `tsc --noEmit` across all workspaces
- **Phase gate:** Full suite green + manual smoke test (2-socket game start → play 3 rounds → end screen) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/src/games/snusking/engine.test.ts` — covers REQ-CORE-03, REQ-CORE-04, REQ-CORE-05, REQ-MULTI-01, REQ-MULTI-02, REQ-NFR-01, REQ-NFR-02
- [ ] `server/src/games/snusking/rules.test.ts` — covers REQ-CORE-06, REQ-CORE-07
- [ ] `server/src/games/snusking/deck.test.ts` — covers REQ-NFR-03
- [ ] `server/vitest.config.ts` — Vitest configuration for server workspace
- [ ] Framework install: `npm install -D vitest --workspace=@slutsnus/server`

---

## Sources

### Primary (HIGH confidence)
- Direct read: `server/src/games/registry.ts` — `GameEngine` interface (4 lines), `gameRegistry` pattern
- Direct read: `server/src/socket/room.ts` — `onUpdate` callback (lines 117–147), `room:join` handler, room:start flow, leaderboard persistence
- Direct read: `server/src/socket/index.ts` — `onlineUsers` map (line 12), `activeGames` map (line 14), disconnect handler
- Direct read: `server/src/socket/game.ts` — `game:action` routing to `engine.handleEvent` (line 14)
- Direct read: `server/src/games/snus-rpg/engine.ts` — class structure, `handleEvent` pattern, `endGame` pattern (327 lines)
- Direct read: `server/src/games/snus-rpg/brands.ts` — 12 brand definitions available for adaptation
- Direct read: `shared/src/types.ts` — `GameType` union (line 30), `GameAction` interface, `GameResult`, `PlayerInfo`
- Direct read: `server/prisma/schema.prisma` — `gameType` field is plain `String` (no migration needed for 'snusking')
- Direct read: `client/src/games/GameContainer.tsx` — `game:state` reception pattern, `gameType()` switch
- Direct read: `.planning/phases/01-foundation-and-engine-contract/01-CONTEXT.md` — all locked decisions
- Direct read: `.planning/research/ARCHITECTURE.md` — 7-layer build order, per-player projection patterns
- Direct read: `.planning/research/STACK.md` — stack constraints, Zod recommendation, Fisher-Yates rationale
- Direct read: `.planning/research/PITFALLS.md` — 12 documented pitfalls with codebase-grounded evidence

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — cross-references and phase rationale (derived from primary sources)
- `.planning/research/FEATURES.md` — feature scope and "must have" / "should have" categorization
- Established commit-then-reveal pattern from multiplayer card games (Dominion, Hanabi) — simultaneous reveal architecture

### Tertiary (LOW confidence)
- Zod version `^3.24.x` — training data (August 2025 cutoff); verify current stable version at npmjs.com before install

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — derived entirely from direct codebase reads; no new libraries except Zod (version LOW)
- Architecture patterns: HIGH — all patterns verified against actual source files read in this session
- Pitfalls: HIGH (structural pitfalls 1–5) / MEDIUM (reshuffle timing, win condition ordering) — structural pitfalls derived from reading actual code; timing pitfalls from card game design knowledge
- Code examples: HIGH — all examples cite specific file + line numbers from direct reads

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable platform; no fast-moving dependencies)
