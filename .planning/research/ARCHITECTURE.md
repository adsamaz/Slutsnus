# Architecture Patterns: Snus Catcher Arcade Game

**Domain:** Real-time arcade game (falling objects, mouse-controlled bar, collision) integrated into an existing turn-based multiplayer platform
**Researched:** 2026-03-14
**Confidence:** HIGH (based on direct codebase analysis of the existing engine contract, socket layer, and client patterns)

---

## Context

This is a subsequent-milestone research document. The platform already exists and runs a working turn-based card game (Snusking). The task is adding a second game — Snus Catcher — a real-time arcade game where snus pouches fall from the top of the screen and each player controls a horizontal bar via mouse to catch them. The game is 1v1: each player plays on their own independent screen. Powerups (Snus Rain, Narrow Curse, Shield, Score Multiplier) can target the opponent.

The critical integration question is: **how does a real-time arcade game with a continuous tick loop fit the existing `GameEngine` interface designed for turn-based action dispatch?**

The answer: it fits cleanly. The `GameEngine` interface is generic enough to support both paradigms. The existing turn-based `SnuskingEngine` uses `handleEvent` for discrete player actions. The new `SenusCatcherEngine` uses `handleEvent` for the same purpose (bar movement updates), while adding its own server-side `setInterval` tick loop — the same pattern used by the now-removed `snus-rpg` engine. No interface changes are required.

---

## Existing Integration Points

### What Already Exists (Unchanged)

| Component | File | Role for Snus Catcher |
|-----------|------|----------------------|
| `GameEngine` interface | `server/src/games/registry.ts` | `SenusCatcherEngine` implements this; no changes needed |
| `gameRegistry` map | `server/src/games/registry.ts` | Add `'snus-catcher': SenusCatcherEngine` (one-line change) |
| `activeGames` map | `server/src/socket/index.ts` | Holds the engine instance; no changes needed |
| `game:action` handler | `server/src/socket/game.ts` | Routes bar-move actions to `engine.handleEvent`; no changes needed |
| `onStateUpdate` callback wiring | `server/src/socket/room.ts` | Already supports `{ forUserId, state }` per-player routing (added for Snusking); reuse as-is |
| `game:state` reception | `client/src/games/GameContainer.tsx` | Add `'snus-catcher'` branch alongside `'snusking'`; minor change |
| Room lifecycle (join, ready, start) | `server/src/socket/room.ts` | Fully reused; no changes needed |
| Lobby, auth, leaderboard, friends | All client pages and server routes | Fully reused; no changes needed |
| `GameType` union | `shared/src/types.ts` | Add `'snus-catcher'` to the type (one addition) |
| `ServerToClientEvents['game:state']` | `shared/src/types.ts` | Already typed as `{ state: unknown }`; no changes needed |

### What Must Be Modified

| Component | File | Change Required |
|-----------|------|-----------------|
| `gameRegistry` | `server/src/games/registry.ts` | Add `'snus-catcher': SenusCatcherEngine` |
| `GameType` union | `shared/src/types.ts` | Add `'snus-catcher'` literal |
| `GameContainer.tsx` | `client/src/games/GameContainer.tsx` | Add `snus-catcher` game type branch |

### What Is New

| Component | Location | Notes |
|-----------|----------|-------|
| `SenusCatcherEngine` | `server/src/games/snus-catcher/engine.ts` | Core arcade engine, tick loop, collision, powerup scheduling |
| Snus Catcher shared types | `shared/src/types.ts` (new section) | `SenusCatcherState`, `FallingObject`, `PowerupType`, action types |
| `SenusCatcherGame` root component | `client/src/games/snus-catcher/index.tsx` | Top-level client component wired into `GameContainer` |
| `ArcadeCanvas.tsx` | `client/src/games/snus-catcher/ArcadeCanvas.tsx` | Canvas renderer for falling objects and bar |
| `PowerupHUD.tsx` | `client/src/games/snus-catcher/PowerupHUD.tsx` | Active powerup timers, lives remaining, score |
| `OpponentStrip.tsx` | `client/src/games/snus-catcher/OpponentStrip.tsx` | Minimal opponent score + active-curse indicator |
| `EndScreen.tsx` | `client/src/games/snus-catcher/EndScreen.tsx` | Can adapt the Snusking EndScreen pattern |
| `snus-catcher.css` | `client/src/games/snus-catcher/snus-catcher.css` | Game-specific styles |

---

## Recommended Architecture

### High-Level Component Map

```
shared/src/types.ts
  └── SenusCatcherState          (server master + projected, never mixes both)
  └── SenusCatcherFallingObject  (id, x, y, type, active)
  └── SenusCatcherPlayerState    (barX, score, lives, activeEffects)
  └── SenusCatcherProjectedState (own player full, opponent score/effects only)
  └── SenusCatcherAction         (type: 'sc:bar-move' | 'sc:powerup-activate')

server/src/games/snus-catcher/
  engine.ts                      (SenusCatcherEngine implements GameEngine)
  physics.ts                     (pure: spawnObject, advanceObjects, checkCollisions)
  powerups.ts                    (pure: applyPowerup, powerup definitions)

server/src/games/registry.ts     (add 'snus-catcher': SenusCatcherEngine — one line)

client/src/games/snus-catcher/
  index.tsx                      (SenusCatcherGame: root, handles mouse events, emits actions)
  ArcadeCanvas.tsx               (canvas renderer: falling objects, bar, visual effects)
  PowerupHUD.tsx                 (lives, score, active powerup timers)
  OpponentStrip.tsx              (opponent score and incoming-curse warning)
  EndScreen.tsx                  (win/loss, results, adapts existing EndScreen pattern)
  snus-catcher.css

client/src/games/GameContainer.tsx  (add 'snus-catcher' branch — minor change)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `SenusCatcherEngine` | Authoritative game loop, falling object positions, collision detection, powerup scheduling, life tracking | `onStateUpdate` callback only |
| `physics.ts` | Pure functions: spawn objects, advance Y positions per tick, detect bar collision | Called by `SenusCatcherEngine` only |
| `powerups.ts` | Powerup definitions, effect application, duration tracking | Called by `SenusCatcherEngine` only |
| `SenusCatcherGame` (index.tsx) | Orchestrates client UI, captures mouse position, emits `sc:bar-move` actions at throttled rate | Socket store, child components |
| `ArcadeCanvas.tsx` | Renders falling objects and bar on a 2D canvas using `requestAnimationFrame` | Receives `SenusCatcherProjectedState` as props |
| `PowerupHUD.tsx` | Shows lives, score, active powerup timers as DOM overlay on canvas | Receives projected state as props |
| `OpponentStrip.tsx` | Shows opponent score and any incoming curse indicator | Receives projected opponent state as props |

---

## Server-Side Authority Boundary

### What the Server Controls

Everything that affects game outcome is server-authoritative:

- **Falling object positions** — the server computes Y positions on every tick; the client never invents object coordinates
- **Collision detection** — the server checks whether a falling object's Y has crossed the bar's Y at the bar's X position; the client result is purely visual
- **Powerup spawning** — the server decides when powerups appear and which type; clients display what the server emits
- **Life deductions** — when an object reaches the bottom without being caught, the server deducts a life; the client shows the result
- **Game end** — the server detects 0 lives and emits the final `status: 'ended'` state

### What the Client Controls

- **Bar X position input** — the client emits `sc:bar-move` with the mouse X fraction (0.0–1.0 relative to game area width); the server stores and uses this on the next tick for collision checks
- **Visual interpolation** — the client can smoothly animate the bar between server-confirmed positions for feel; the server state is always authoritative for collision

### The Accepted Lag Model

At 60fps client rendering and ~20 tick/sec server simulation, there is inherent visual lag between "I moved the bar" and "the server confirmed the catch." This is acceptable for this genre. The bar position sent to the server should be the raw mouse position at emit time — no client-side prediction needed at this scale.

The server tick rate should be 30–60ms (17–33 ticks/sec). This is fast enough that missed catches due to network lag are rare at normal latency. A tick rate below 30ms adds server load without meaningful accuracy improvement.

---

## Server-Side Game Loop

### Engine Lifecycle

```
engine.init(roomId, players, onStateUpdate)
  → build initial master state (objects=[], bar positions centered, lives=3, score=0)
  → start setInterval(tick, TICK_MS)

engine.handleEvent(playerId, action)
  → action.type === 'sc:bar-move': update masterState.players[playerId].barX
  → action.type === 'sc:powerup-activate': apply powerup effect if eligible

tick()
  → advance all falling object Y positions by speed (accounts for active SpeedCurse effects)
  → check collisions for each player: object Y >= bar Y AND |object X - bar X| <= barHalfWidth
  → caught objects: add score (modified by active ScoreMultiplier), remove object
  → missed objects: deduct 1 life, remove object
  → apply active Narrow Curse: reduce barHalfWidth for target player
  → apply active Shield: block one life deduction
  → spawn new objects at random X at top of screen on schedule
  → schedule powerup spawns at intervals
  → check win/end condition (any player lives === 0)
  → call onStateUpdate per-player (projected state only)

engine.destroy()
  → clearInterval on tick loop
```

### State Projection

The master state contains both players' full state. Per-player projection strips the opponent's bar position (no strategic value to see it), but exposes the opponent's score and active powerup effects (relevant for opponent awareness).

```
MasterState {
  players: {
    [playerId]: { barX, score, lives, activeEffects[] }
  }
  objects: FallingObject[]    // shared — same objects, both players see them
  tick: number
  status: 'playing' | 'ended'
  results?: GameResult[]
}

ProjectedState (per player) {
  self: { barX, score, lives, activeEffects[] }
  opponent: { score, lives, activeEffects[] }  // barX omitted — not needed, not strategic
  objects: FallingObject[]    // same array — objects are on a shared logical field
  tick: number
  status: 'playing' | 'ended'
  results?: GameResult[]
}
```

Each player sees the same falling objects. This is correct — the game field is shared visually; each player simply has their own bar and interacts with objects independently.

---

## Client Architecture

### Canvas vs DOM

Falling objects and the bar are rendered on a 2D canvas using `requestAnimationFrame`. This is the correct choice here — unlike card games (where DOM is better), arcade games with many moving objects per frame benefit from canvas:

- No per-object DOM reconciliation overhead at 60fps
- Direct pixel control for smooth movement
- Easy to handle object spawning/despawning without diffing
- Solid.js reactivity is still used for HUD overlay (lives, score, powerup timers) — DOM elements laid over the canvas

The client renders the last-received server state. Between server ticks, the client linearly interpolates object Y positions based on the known tick rate and object speed — this produces smooth visuals without waiting for the next server tick.

### Client-Side Interpolation Pattern

```typescript
// In ArcadeCanvas.tsx
createEffect(() => {
  const state = props.state;
  const tickMs = TICK_MS; // match server constant, exposed in shared types
  let lastTickTime = performance.now();

  const render = (now: number) => {
    const elapsed = now - lastTickTime;
    const interpolationFactor = Math.min(elapsed / tickMs, 1.0);

    // Draw objects at interpolated Y
    for (const obj of state.objects) {
      const interpolatedY = obj.y + obj.speed * interpolationFactor;
      drawObject(ctx, obj, interpolatedY);
    }

    drawBar(ctx, state.self.barX, state.self.activeEffects);
    rafId = requestAnimationFrame(render);
  };

  // Reset interpolation anchor on new server state
  lastTickTime = performance.now();
  rafId = requestAnimationFrame(render);

  onCleanup(() => cancelAnimationFrame(rafId));
});
```

When a new `game:state` event arrives, `lastTickTime` resets to `now` and objects snap to server-confirmed positions, preventing drift.

### Mouse Input Throttling

Emitting a `sc:bar-move` action on every `mousemove` event would produce 200–400 emissions/sec. This saturates the socket and the server action queue. Throttle to 30–50ms:

```typescript
// In SenusCatcherGame (index.tsx)
let lastEmit = 0;
const handleMouseMove = (e: MouseEvent) => {
  const now = performance.now();
  if (now - lastEmit < 30) return;
  lastEmit = now;
  const rect = canvasRef.getBoundingClientRect();
  const fraction = (e.clientX - rect.left) / rect.width;
  props.onAction({ type: 'sc:bar-move', x: Math.max(0, Math.min(1, fraction)) });
};
```

Server uses the most recently received `barX` when collision-checking on each tick. Intermediate positions are not needed.

---

## Powerup Architecture

### Powerup Types

| Powerup | Effect | Scope | Duration |
|---------|--------|-------|----------|
| Snus Rain | Extra objects spawn for 5s | Self (benefit) | 5 ticks × TICK_MS |
| Narrow Curse | Opponent bar width reduced 50% for 8s | Opponent (debuff) | 8 ticks × TICK_MS |
| Shield | Next missed object does not cost a life | Self (defensive) | Until consumed |
| Score Multiplier | Caught objects worth 2× for 6s | Self (benefit) | 6 ticks × TICK_MS |

### Powerup Sync

Powerups are server-spawned as special `FallingObject` entries with `type: 'powerup'` and a `powerupKind` field. When a player catches a powerup object, the server applies the effect immediately and emits the updated state.

Powerup effects that target the opponent (`Narrow Curse`) are applied to the opponent's `activeEffects` array in the master state and included in the opponent's projected state for that player's UI. The affected player sees their own `activeEffects` and can show a "Cursed!" indicator.

There is no client-side powerup activation — the server authorizes all powerup application via collision detection. This prevents clients from claiming powerups they did not actually catch.

---

## Data Flow

### Bar Movement (high frequency)

```
Client mouse move → throttled emit 'game:action' { type: 'sc:bar-move', x: 0.63 }
  → server socket/game.ts routes to engine.handleEvent(userId, action)
    → engine.masterState.players[userId].barX = 0.63
    (no state emission on handleEvent — bar position used next tick)
```

### Game Tick (server-driven)

```
Server setInterval fires (every ~33ms)
  → physics.ts advances object Y positions
  → physics.ts checks collisions against each player's barX
  → catches: score++, object removed
  → misses: lives--, object removed
  → powerup effects applied/decremented
  → new objects spawned per schedule
  → win check: any player.lives === 0
  → onStateUpdate({ forUserId: playerAId, state: projectedStateA })
  → onStateUpdate({ forUserId: playerBId, state: projectedStateB })
    → room.ts routes each to target player's socket(s)
      → socket.emit('game:state', { state: projected })
```

### Client State Reception

```
socket on 'game:state' → setGameState(state as SenusCatcherProjectedState)
  → SenusCatcherGame passes state as props to ArcadeCanvas + PowerupHUD + OpponentStrip
  → ArcadeCanvas: lastTickTime reset, next RAF frame renders from new baseline
  → PowerupHUD: reactive DOM update (lives, score, timers)
  → OpponentStrip: opponent score, curse indicator
```

---

## GameContainer Integration

The existing `GameContainer.tsx` hardcodes `SnuskingProjectedState` as the type for `gameState`. This must be generalized to support Snus Catcher without breaking the existing Snusking path.

### Required Change to GameContainer

```typescript
// Before (Snusking-only):
const [gameState, setGameState] = createSignal<SnuskingProjectedState | null>(null);

// After (multi-game):
const [gameState, setGameState] = createSignal<unknown>(null);

// Add Snus Catcher branch alongside the existing Snusking branch:
<Show when={gameType() === 'snus-catcher' ? gameState() : null}>
  {(state) => (
    <SenusCatcherGame
      state={state() as SenusCatcherProjectedState}
      roomCode={props.roomCode}
      onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
    />
  )}
</Show>
```

The `unknown` type for `gameState` is safe — the type cast happens at the game-specific component boundary where the correct type is known from the `gameType()` check.

---

## New vs Modified Summary

### New Files

```
server/src/games/snus-catcher/engine.ts      — SenusCatcherEngine (tick loop, collision, lives)
server/src/games/snus-catcher/physics.ts     — pure functions: spawn, advance, collide
server/src/games/snus-catcher/powerups.ts    — powerup definitions, effect application

client/src/games/snus-catcher/index.tsx      — SenusCatcherGame root component
client/src/games/snus-catcher/ArcadeCanvas.tsx — canvas renderer + RAF loop
client/src/games/snus-catcher/PowerupHUD.tsx — DOM overlay: lives, score, timers
client/src/games/snus-catcher/OpponentStrip.tsx — opponent score + curse indicator
client/src/games/snus-catcher/EndScreen.tsx  — end screen (adapt Snusking pattern)
client/src/games/snus-catcher/snus-catcher.css
```

### Modified Files

```
shared/src/types.ts                          — add GameType 'snus-catcher', add SenusCatcher* types
server/src/games/registry.ts                 — add 'snus-catcher': SenusCatcherEngine
client/src/games/GameContainer.tsx           — generalize gameState type, add snus-catcher branch
```

### Untouched Files

```
server/src/socket/game.ts                    — no changes: routes any game:action to engine
server/src/socket/room.ts                    — no changes: forUserId routing already in place
server/src/socket/index.ts                   — no changes
server/src/socket/friends.ts                 — no changes
server/src/routes/*                          — no changes
client/src/stores/*                          — no changes
client/src/pages/* (except possibly Lobby)  — Lobby needs snus-catcher as a selectable game type
client/src/games/snusking/*                  — untouched
```

**Note on Lobby:** The Lobby page currently shows game type. If game type selection exists in the UI, `'snus-catcher'` must be added as an option. If the game type is set at room creation via the API, the REST route handling room creation may also need to accept the new type. Confirm this is handled alongside the `GameType` registration change.

---

## Suggested Build Order

Dependencies flow from types down to UI. Each layer is independently testable.

### Layer 1 — Shared Types (no deps)

Add `'snus-catcher'` to `GameType` union. Define `SenusCatcherMasterState`, `SenusCatcherProjectedState`, `SenusCatcherPlayerState`, `FallingObject`, `PowerupType`, `SenusCatcherActiveEffect`, and `SenusCatcherAction` discriminated union in `shared/src/types.ts`. Export `TICK_MS` as a constant (or include in a shared config) so client and server use the same value for interpolation.

**Why first:** All other layers import from here. Types define the seam.

### Layer 2 — Physics and Powerup Pure Functions

Implement `physics.ts` (spawnObject, advanceObjects, checkCollisions) and `powerups.ts` (powerup definitions, applyPowerup, tickEffects) as pure functions that take state and return new state. No I/O, no side effects.

**Why second:** These are independently unit-testable. The engine depends on them; the client does not.

### Layer 3 — Server Engine

Implement `SenusCatcherEngine` in `engine.ts`. Owns the `setInterval` tick loop, calls into `physics.ts` and `powerups.ts`, manages master state, projects per-player state, calls `onStateUpdate`. Implement `handleEvent` for `sc:bar-move` and `sc:powerup-activate`.

**Why third:** Requires types (Layer 1) and physics/powerups (Layer 2).

### Layer 4 — Registry and Type Registration

Add `'snus-catcher': SenusCatcherEngine` to `gameRegistry`. Confirm `GameType` is already updated (Layer 1). Update Lobby UI / room creation to accept the new game type if applicable.

**Why fourth:** Engine must exist before it can be registered.

### Layer 5 — Canvas Renderer and HUD

Build `ArcadeCanvas.tsx` with RAF loop and client-side interpolation. Build `PowerupHUD.tsx` and `OpponentStrip.tsx` as DOM overlays. These receive `SenusCatcherProjectedState` as props and have no side effects beyond rendering.

**Why fifth:** Requires finalized types (Layer 1). Does not require the server engine to be running — can develop against a mock state signal.

### Layer 6 — Root Game Component and Mouse Input

Build `SenusCatcherGame` (index.tsx) that captures mouse events, throttles and emits `sc:bar-move` actions, and wires the child components. Wire into `GameContainer.tsx`.

**Why sixth:** Requires canvas/HUD components (Layer 5) and the action shape (Layer 1).

### Layer 7 — Integration and End-to-End Testing

Connect two browser tabs to the same room, confirm tick loop runs, collision is detected server-side, powerup effects propagate to opponent, game ends on 0 lives. Build `EndScreen.tsx`, wire to leaderboard persistence.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Collision Detection

**What:** Having the client detect its own catches and report them to the server
**Why bad:** Any client can fake catches. Score becomes exploitable. More importantly, two clients may report different collision results for the same game state due to timing.
**Instead:** Server computes collisions on every tick using the bar position last reported by the client. The client's catch visuals are cosmetic — the server result is authoritative.

### Anti-Pattern 2: Emitting State on Every Bar Move

**What:** Calling `onStateUpdate` inside `handleEvent` when a `sc:bar-move` action is received
**Why bad:** Bar moves arrive 30–50 times/sec. Broadcasting state to all clients on each move floods the socket and creates unnecessary rendering load. The bar position is only meaningful in the context of collision detection, which happens on the tick.
**Instead:** Store `barX` on `handleEvent`, read it on tick. Emit state only from the tick callback.

### Anti-Pattern 3: Using a Turn-Based Interface Extension for Arcade Logic

**What:** Implementing `TurnBasedGameEngine` (the Snusking-specific extension) for the arcade engine
**Why bad:** The arcade game has no turns, no phases, no planning windows. The `TurnBasedGameEngine` extension (`projectState`, `getCurrentPhase`) is Snusking-specific and does not model arcade state. Mixing them pollutes the interface.
**Instead:** Implement only the base `GameEngine` interface. The arcade engine is the same contract as the now-removed `snus-rpg` engine: `init`, `handleEvent`, `getState`, `destroy`. State projection is handled the same way as for Snusking — call `onStateUpdate` per player with per-player data — but this does not require the `TurnBasedGameEngine` interface.

### Anti-Pattern 4: Unbounded Object Count

**What:** Spawning objects at a rate faster than they can be caught or missed, or never clearing missed objects
**Why bad:** Object array grows unboundedly, making each tick's collision check O(n) with a growing n. At high tick rates this adds meaningful CPU overhead.
**Instead:** Objects are removed from the array the tick they are caught or missed. Spawn rate is bounded (e.g., max N objects on screen at any time). Powerup Snus Rain increases spawn rate temporarily but the cap prevents unbounded growth.

### Anti-Pattern 5: Blocking Game Type Registration

**What:** Adding `'snus-catcher'` to `gameRegistry` without updating `shared/src/types.ts` `GameType`, the DB enum, and room creation validation simultaneously
**Why bad:** The `room:start` handler in `room.ts` checks `gameRegistry[room.gameType]`. If `GameType` does not include the new value, TypeScript will flag it at compile time. If the DB enum does not include it, Prisma will reject room creation. All four touch points must be updated in one coordinated change.
**Instead:** Update `GameType`, registry, DB migration (if DB enum-constrained), and any room creation validation in the same commit. See existing `CONCERNS.md` for this pattern.

---

## Scalability Considerations

This is a 1v1 game. The primary concern is server-side tick loop overhead at concurrent game scale.

| Concern | For 1v1 (this game) | Notes |
|---------|---------------------|-------|
| Tick loop CPU | One `setInterval` per active game, ~30ms interval | 100 concurrent games = 3,333 ticks/sec total. Trivial for Node.js at this object count. |
| State emission volume | ~30 emissions/sec × 2 players = 60 socket messages/sec per game | Low. Well within Socket.IO defaults. |
| Object array size | Bounded by design (max N objects on screen) | Recommend cap of 20–30 simultaneous objects. |
| Bar move action rate | Throttled client-side to 30–50ms | Max 33 actions/sec per player; 66/sec per game. Handled synchronously in `handleEvent` without state emission. |
| Memory per game | ~1KB (2 players, ~20 objects, tick counter) | Negligible. |

---

## Sources

- Direct analysis of `server/src/games/registry.ts` — `GameEngine` interface contract (HIGH confidence)
- Direct analysis of `server/src/games/snusking/engine.ts` — existing engine pattern, per-player onStateUpdate, setImmediate for turn advance (HIGH confidence)
- Direct analysis of `server/src/socket/room.ts` — `forUserId` per-player state routing already implemented (HIGH confidence)
- Direct analysis of `server/src/socket/game.ts` — `game:action` routing; requires no changes (HIGH confidence)
- Direct analysis of `client/src/games/GameContainer.tsx` — `game:state` reception, gameType branching pattern (HIGH confidence)
- Direct analysis of `client/src/games/snusking/index.tsx` — RAF-based animation patterns already used in the codebase (HIGH confidence)
- Direct analysis of `shared/src/types.ts` — `GameType` union, `ServerToClientEvents`, `ClientToServerEvents` (HIGH confidence)
- Canvas rendering + client interpolation pattern for arcade games — standard technique, verified against existing codebase patterns (MEDIUM confidence — training data, no external source checked)
