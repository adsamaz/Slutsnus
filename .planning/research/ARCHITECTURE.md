# Architecture Patterns

**Domain:** Turn-based multiplayer card game engine
**Researched:** 2026-03-11
**Confidence:** HIGH (based on direct codebase analysis + established patterns)

---

## Context

This is a subsequent-milestone research document. The platform already exists and works. The task is
adding a new game engine (`snusking`) to replace `snus-rpg`. The constraint is hard: the new engine
**must** implement `GameEngine` from `server/src/games/registry.ts`:

```typescript
interface GameEngine {
    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void;
    handleEvent(playerId: string, action: GameAction): void;
    getState(): unknown;
    destroy(): void;
}
```

Everything below is designed to fit cleanly inside this interface.

---

## Recommended Architecture

### High-Level Component Map

```
shared/src/types.ts              <-- SnuskingState, SnuskingCard, SnuskingPlayer, SnuskingAction types
                                        (NEW section, parallel to existing SnusRpg* types)

server/src/games/snusking/       <-- New engine package
  engine.ts                      <-- SnuskingEngine implements GameEngine
  deck.ts                        <-- Card definitions, deck builder, shuffle
  rules.ts                       <-- Turn resolution, combo evaluation, win condition
  events.ts                      <-- Round event cards and situational matching logic

server/src/games/registry.ts     <-- Add 'snusking': SnuskingEngine  (one-line change)

client/src/games/snusking/       <-- New renderer package
  index.tsx                      <-- Root component, wired into GameContainer
  Board.tsx                      <-- Table layout: round event, discard pile, player zones
  Hand.tsx                       <-- Current player's cards (interactive)
  OpponentHand.tsx               <-- Other players' card backs during planning phase
  PlayerStatus.tsx               <-- Empire score, beer count, active effects per player
  RevealOverlay.tsx              <-- Simultaneous reveal animation when all actions committed
  EndScreen.tsx                  <-- Reuse/adapt existing pattern

client/src/games/GameContainer.tsx  <-- Add 'snusking' branch  (minor change)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `SnuskingEngine` | Authoritative game state, turn phase FSM, action buffering, reveal resolution | `onStateUpdate` callback only |
| `deck.ts` | Card catalog, deck construction, shuffle | `SnuskingEngine` (no external deps) |
| `rules.ts` | Turn resolution logic, combo scoring, event matching, win check | `SnuskingEngine` (pure functions) |
| `events.ts` | Round event card pool, situational modifiers | `rules.ts`, `SnuskingEngine` |
| `shared/types.ts` (Snusking section) | All cross-boundary type contracts | Server engine + client renderer |
| `GameContainer.tsx` | Routes `game:state` events to the correct game renderer | `SnuskingGame` component |
| `SnuskingGame` (`index.tsx`) | Orchestrates client-side UI, emits `game:action` events | Socket store, child components |
| `Board.tsx` | Renders the shared table (event card, discard zone) | Receives state as props |
| `Hand.tsx` | Renders local player's hand, handles card selection | Emits actions via callback |
| `RevealOverlay.tsx` | Shows all players' chosen cards simultaneously on reveal | Driven by phase transition in state |
| `PlayerStatus.tsx` | Scores, beer, effects per seat | Derived from state props |

---

## Turn Phase State Machine (Server-Authoritative)

The central architectural insight: the engine is a finite state machine with four phases per round.
This replaces the real-time tick loop of `snus-rpg` entirely.

```
          ┌──────────────────────────────────────────────────────┐
          │                     ROUND LOOP                       │
          │                                                      │
          │  DRAW ──► PLANNING ──► REVEAL ──► RESOLVE ──► DRAW  │
          │                                          │           │
          │                                     (win check)      │
          └──────────────────────────────────────────────────────┘
```

### Phase Definitions

| Phase | Duration | What Happens |
|-------|----------|--------------|
| `draw` | Instant (server-triggered) | Each player draws to hand limit; round event card is drawn |
| `planning` | Until all players commit OR timeout | Each player picks a card to play; choice stored privately |
| `reveal` | Brief broadcast pause | All committed cards sent to all clients simultaneously |
| `resolve` | Instant (server-triggered) | Cards scored, beer/sabotage/combos applied, empire points awarded |

### Why This Model

The simultaneous-reveal requirement means the server cannot process actions greedily as they arrive
(unlike `snus-rpg` which calls `handleEvent` immediately on each action). Instead, the engine must:

1. **Buffer** each player's chosen action during `planning`
2. **Gate reveal** until every seated player has committed (or timeout fires)
3. **Resolve** all committed actions atomically before emitting a new state snapshot

This is a standard "commit-then-reveal" pattern used in card games (Dominion, Exploding Kittens, etc.).
The server is the only party that ever knows the full committed-but-unrevealed state.

---

## Server-Side State Structure

### SnuskingState (canonical shape in shared/types.ts)

```typescript
type TurnPhase = 'draw' | 'planning' | 'reveal' | 'resolve';

interface SnuskingState {
    phase: TurnPhase;
    round: number;
    currentEvent: SnuskingEventCard | null;
    players: Record<string, SnuskingPlayer>;
    discardPile: SnuskingCard[];
    status: 'playing' | 'ended';
    results?: GameResult[];
}

interface SnuskingPlayer {
    userId: string;
    username: string;
    empireScore: number;
    beer: number;
    hand: SnuskingCard[];        // Full hand sent ONLY to the owning player (see below)
    hasCommitted: boolean;       // True once player has submitted action this planning phase
    lastPlayedCard: SnuskingCard | null;  // Populated only after reveal phase
    activeEffects: SnuskingEffect[];
}
```

### Critical: Per-Player State Projection

This is the most important architectural decision. The engine holds a **master state** containing
all players' hands. But `onStateUpdate` must emit **different projections** per player — a player
must see their own hand but only card-back counts for opponents.

**Implementation approach:** `onStateUpdate` is called once per player with a projected state, NOT
once globally.

In `server/src/socket/room.ts`, the existing pattern emits the same state to the whole room:

```typescript
io.to(roomCode).emit('game:state', { state });
```

This is fine for `snus-rpg` (shared visible map). For `snusking`, the engine's `onStateUpdate`
callback must receive a `roomCode` reference so it can emit per-socket. There are two implementation
options:

**Option A — Engine holds io reference (breaks the interface contract):** Do not use this.

**Option B — onStateUpdate returns a Map of projections (extends the interface implicitly):**
The engine calls `onStateUpdate` once per player with per-player data. The callback in `room.ts`
routes each projection to the correct socket. The `onStateUpdate` signature stays `(state: unknown)
=> void` but the engine invokes it once per player, each time with `{ forUserId, state: projection }`.
The room handler checks for `forUserId` and emits to the right socket.

This is the recommended approach. It requires a small change to the `room:start` handler in
`room.ts`, but the `GameEngine` interface stays the same — only the callback implementation changes.

### What Each Player Receives

| Field | Own Player | Other Players |
|-------|------------|---------------|
| `hand` | Full card array | Empty array (or omitted) |
| `hasCommitted` | True/false | True/false (safe to share — they can't deduce card from this) |
| `lastPlayedCard` | Full card (after reveal) | Full card (after reveal) — this is public |
| `empireScore` | Score | Score (always public) |
| `beer` | Count | Count (always public) |

### Engine Internal State vs Emitted State

The engine holds two representations:

```
engine.masterState         — full truth, never sent to clients
engine.projectState(id)    — derived per-player view, safe to emit
```

`getState()` (used for debug/admin) may return `masterState`. All socket emissions use `projectState`.

---

## Data Flow

### Planning Phase (action submission)

```
Client (Player A)
  Hand.tsx clicks card
    → sock.emit('game:action', { roomCode, action: { type: 'commit', payload: { cardId } } })

Server (socket/game.ts)
  game:action handler
    → engine.handleEvent(userId, action)
      → engine validates card is in player's hand
      → engine stores choice in masterState.pendingActions[userId] (private, not emitted)
      → engine marks player.hasCommitted = true
      → engine calls onStateUpdate per player (hand hidden, hasCommitted flags updated)
        → io.to(socketId).emit('game:state', { state: playerProjection })

Client receives update:
  GameContainer.tsx setGameState(state)
    → SnuskingGame re-renders
      → OpponentHand shows committed indicator (e.g. card face-down glow)
      → Hand.tsx disables card selection (player already committed)
```

### Reveal Phase (all players committed or timeout)

```
Server (SnuskingEngine)
  All players committed (or timeout fires)
    → engine transitions phase to 'reveal'
    → engine populates player.lastPlayedCard from pendingActions for ALL players
    → engine calls onStateUpdate per player (all lastPlayedCards now visible)
      → io.to(socketId).emit('game:state', { state: playerProjection })

Client receives update (phase === 'reveal'):
  RevealOverlay.tsx animates all cards flipping face-up simultaneously
  (Brief timer — 1500ms — then client sends no action; server auto-advances)

Server (SnuskingEngine)
  After reveal pause (setInterval or resolve triggered immediately after emit)
    → engine transitions to 'resolve'
    → rules.ts scores all committed cards
    → empire points awarded, beer updated, effects applied, sabotage resolved
    → pendingActions cleared
    → engine transitions to 'draw' (or 'ended' if win condition met)
    → engine calls onStateUpdate per player
```

### Win Condition Check

```
Server (rules.ts, called from engine after resolve)
  Any player.empireScore >= WIN_THRESHOLD?
    → engine.state.status = 'ended'
    → engine.state.results = sorted GameResult[]
    → onStateUpdate emits final state
    → room.ts handler detects status === 'ended', emits game:end, persists to DB
    → engine.destroy() called
```

---

## Client Rendering in Solid.js

### State-Driven, Not Loop-Driven

The existing `snus-rpg` client uses a `requestAnimationFrame` loop pulling state from a canvas
renderer. This is appropriate for real-time spatial rendering. For a card game UI, it is wrong.

Solid.js reactive primitives are the correct model for card game rendering:

- `createSignal<SnuskingState | null>` in `GameContainer` (already exists as `gameState`)
- Pass signal value as props to `SnuskingGame` (already the pattern)
- Child components derive their display from props reactively — no RAF loop needed
- `createMemo` for expensive derivations (e.g., "which cards in my hand are boosted by current event")

```typescript
// In SnuskingGame (index.tsx)
const boostedCards = createMemo(() => {
    const event = props.state.currentEvent;
    const hand = props.state.players[myId()]?.hand ?? [];
    return hand.filter(card => card.situation === event?.situation);
});
```

### Phase-Conditional Rendering

Use Solid.js `<Switch>/<Match>` to render phase-appropriate UI:

```typescript
<Switch>
    <Match when={props.state.phase === 'planning'}>
        <Hand cards={myHand()} onCommit={handleCommit} disabled={hasCommitted()} />
    </Match>
    <Match when={props.state.phase === 'reveal'}>
        <RevealOverlay players={props.state.players} />
    </Match>
    <Match when={props.state.phase === 'resolve'}>
        <ResolveAnimation results={lastRoundResults()} />
    </Match>
</Switch>
```

### No Canvas Required

The existing renderer (`renderer.ts`) uses a 2D canvas for map rendering. Cards are better rendered
as DOM elements — they support CSS transitions, hover states, and accessibility. The canvas approach
should not be carried over to `snusking`.

Each card is a component. CSS classes handle face-up/face-down state and boost highlights. This is
significantly simpler to build and maintain than a canvas card renderer.

### Trade/Sabotage Interaction

Trade offers (player-to-player card exchanges) and sabotage (giving opponents worthless/negative
cards) follow the same `game:action` pattern already established. The server resolves them in the
`resolve` phase, not the `planning` phase. Players submit trade offers during `planning` alongside
their main action — the server buffers both and processes together at resolve time.

---

## Suggested Build Order

Dependencies flow strictly from bottom to top. Each layer can be built and tested independently.

### Layer 1 — Shared Types (no deps)
Define `SnuskingState`, `SnuskingCard`, `SnuskingPlayer`, `SnuskingEffect`, `SnuskingEventCard`,
and associated action payload types in `shared/src/types.ts`. Also extend `GameType` to include
`'snusking'`.

**Why first:** Every subsequent layer imports from here. Getting types right early prevents churn.

### Layer 2 — Card Catalog and Deck (`deck.ts`, `events.ts`)
Define all snus card definitions and the event card pool. Pure data — no socket, no state machine.

**Why second:** `rules.ts` and `engine.ts` both depend on card definitions. Adapt existing
`brands.ts` for card data, extending with `situation`, `effect`, and `sabotage` fields.

### Layer 3 — Rules Engine (`rules.ts`)
Pure functions: `scoreCards(players, event, actions)`, `applyEffects(state, scoringResult)`,
`checkWin(state)`. No I/O, no state mutation — takes state and returns new state.

**Why third:** Pure functions are independently testable before the engine wires them together.

### Layer 4 — Game Engine (`engine.ts`)
Implements `GameEngine` interface. Owns the turn phase FSM, action buffering, timeout management,
and per-player state projection. Calls into `rules.ts` for all scoring logic.

**Why fourth:** Requires types (Layer 1), deck (Layer 2), and rules (Layer 3) to be complete.

### Layer 5 — Registry Wiring (one-line change to `registry.ts`)
Add `'snusking': SnuskingEngine`. Extend `GameType` union. Update `GameContainer.tsx` switch.

**Why fifth:** Engine must exist before it can be registered.

### Layer 6 — Client Components (board, hand, reveal)
Build `Board.tsx`, `Hand.tsx`, `OpponentHand.tsx`, `RevealOverlay.tsx`, `PlayerStatus.tsx`.
Each component receives typed state as props and has no side effects beyond emitting actions.

**Why sixth:** Client rendering is the UI layer — all logic lives in the server engine. Client
components should be built against the finalized types from Layer 1.

### Layer 7 — Integration and Polish
Wire `SnuskingGame` into `GameContainer`, test end-to-end with multiple sockets, add CSS transitions
for reveal and resolve phases, implement trade/sabotage UI modals.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Emitting Full Master State to All Players
**What:** Calling `io.to(roomCode).emit('game:state', { state: masterState })` — same as snus-rpg
**Why bad:** Exposes every player's hand to all connected sockets. Any client can read opponent cards
from the socket payload, even if the UI hides them.
**Instead:** Emit per-socket projections with opponents' hands stripped.

### Anti-Pattern 2: Processing Commits Greedily
**What:** Scoring a player's card the moment `handleEvent` is called during planning phase
**Why bad:** Players who act last see an unfair disadvantage (they can time their submit to react
after server state changes if greedy processing leaks information).
**Instead:** Buffer all commits in `pendingActions`, resolve atomically only when all players
have committed.

### Anti-Pattern 3: Tick Loop for Turn-Based Logic
**What:** Using `setInterval` at 100ms to drive card game state (inherited pattern from snus-rpg)
**Why bad:** Card game phases are event-driven (all players submitted, reveal complete) not time-
driven. A tick loop adds unnecessary complexity and CPU load.
**Instead:** Use promise/callback chains triggered by player commit completion and phase transitions.
A single timeout (planning phase deadline) is appropriate; general tick loop is not.

### Anti-Pattern 4: Canvas Rendering for Card UI
**What:** Drawing cards on a 2D canvas with a `requestAnimationFrame` loop
**Why bad:** Canvas loses all browser accessibility features, requires manual hit-testing for card
clicks, and makes CSS animations much harder.
**Instead:** DOM components per card with CSS classes for state. Solid.js reactive rendering handles
updates efficiently without a manual animation loop.

### Anti-Pattern 5: Client-Side Reveal Timing
**What:** Client waits a fixed delay after seeing all `hasCommitted: true` then renders reveal
**Why bad:** Network latency means different clients render the reveal at different times. Animation
feels desynchronized.
**Instead:** Server controls phase transitions. When the server emits `phase: 'reveal'`, all
clients render the reveal simultaneously from that single state update.

---

## Scalability Considerations

This is a 2–4 player per-room game. Scalability concerns are room-level, not global.

| Concern | For 2–4 players per room | Notes |
|---------|-------------------------|-------|
| State size | Very small (~5KB per room) | Card hands + scores fit easily in memory |
| Socket messages per round | ~10–20 per round (4 commits + 2 phase broadcasts per player) | Trivial load |
| Per-player projection overhead | O(players) per phase transition | Negligible at 4 players |
| Planning timeout | 30–60 second deadline per planning phase | One `setTimeout` per active game |
| Concurrent games | Limited only by Node.js memory; each engine is a small object | Fine at reasonable scale |

No architectural changes are needed for the game's scale. The existing `activeGames` Map pattern
scales adequately for this use case.

---

## Sources

- Direct analysis of `server/src/games/registry.ts` — `GameEngine` interface (HIGH confidence)
- Direct analysis of `server/src/games/snus-rpg/engine.ts` — existing engine pattern (HIGH confidence)
- Direct analysis of `server/src/socket/room.ts` — `onStateUpdate` callback wiring (HIGH confidence)
- Direct analysis of `client/src/games/GameContainer.tsx` — `game:state` reception pattern (HIGH confidence)
- Direct analysis of `client/src/games/snus-rpg/index.tsx` — existing renderer approach (HIGH confidence)
- Direct analysis of `shared/src/types.ts` — type contract baseline (HIGH confidence)
- Established commit-then-reveal pattern from multiplayer card games (Dominion, Hanabi, etc.) — MEDIUM confidence (training data, not verified against external source)
