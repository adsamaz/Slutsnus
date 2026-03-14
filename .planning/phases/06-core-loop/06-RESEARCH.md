# Phase 6: Core Loop - Research

**Researched:** 2026-03-15
**Domain:** Real-time arcade game — server physics engine, Canvas 2D client, Socket.IO state sync
**Confidence:** HIGH

## Summary

Phase 6 transforms the stub `SenusCatcherEngine` into a full physics engine running at 20 Hz on the server, and replaces the placeholder `SenusCatcherGame` component with a 60fps Canvas 2D client. The architecture is fully established: server ticks at 50ms via `setInterval`, client renders at 60fps via `requestAnimationFrame` and interpolates between server snapshots, bar position is client-authoritative (render immediately, emit throttled), and collision is server-authoritative (server resolves all catches from the bar X fraction the client sends).

The leaderboard write, session persistence, and game-end broadcast are **already implemented** in `room.ts` `onUpdate` — the engine only needs to emit a state object with `status: 'ended'` and a `results` array matching the `GameResult` shape from shared types. No new socket infrastructure is required.

The client's `GameContainer.tsx` currently types game state as `createSignal<SnuskingProjectedState | null>` — this must be widened to `unknown` (or a union) before the Snus Catcher canvas component can receive properly-typed state. Both players see each other's score and lives, but do not share a playfield, so state can be broadcast room-wide (no per-player `{ forUserId }` wrapping needed — both players receive identical top-level state, with their own perspective determined by their `userId`).

**Primary recommendation:** Build the engine FSM first (states: `waiting` → `playing` → `ended`), define all shared types for `SenusCatcherState` before writing a single line of canvas code, then implement the canvas client against the finalized state shape — exactly the same discipline that made Snusking Phase 1-3 successful.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-02 | Each player controls a bar via mouse on their own browser screen | Client-authoritative bar: render at cursor X immediately; emit `snus-catcher:bar-move` with normalized X fraction throttled to 30ms; server uses last-known X for collision |
| GAME-03 | Fresh snus pouches fall from the top of the screen continuously | Server spawns `FreshPouch` objects each tick at random X with constant downward velocity; state broadcast includes all active objects |
| GAME-04 | Spent (nasty) snus pouches fall from the top and must be avoided | Same spawn system as GAME-03 but object type `SpentPouch`; different color/sprite on canvas |
| GAME-05 | Catching a fresh pouch increments the player's score | Server collision check: if bar X overlaps pouch X within bar width, remove pouch and increment `score` in player state |
| GAME-06 | Touching a spent pouch costs the player one life | Same collision, but decrements `lives`; if `lives` reaches 0 triggers GAME-08/09 |
| GAME-07 | Player starts with 3 lives | `lives: 3` in `SenusCatcherPlayerState` initialized in `engine.init()` |
| GAME-08 | Player who loses all 3 lives first loses the match | Win condition checked each tick: `if (player.lives <= 0)` emit ended state |
| GAME-09 | Game ends and winner is declared when one player reaches 0 lives | Engine emits `{ status: 'ended', results: GameResult[] }` — room.ts `onUpdate` already handles leaderboard write and `game:end` broadcast |
| PLAT-02 | Game state syncs between both players via Socket.IO in real time | Room-broadcast via `io.to(roomCode).emit('game:state', ...)` on every tick — already implemented in room.ts fallback branch |
| PLAT-03 | Game result (winner/loser) is written to the leaderboard on game end | Already implemented in room.ts `onUpdate`: `prisma.leaderboardEntry.create(...)` when `status === 'ended' && results` |
| PLAT-04 | Player can return to lobby after the game ends | Client EndScreen component with `window.location.href = '/'` (same pattern as Snusking EndScreen) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.3 (workspace root) | Type contracts for engine state and client props | All workspaces already use it |
| Vitest | ^4.1.0 (server) | Unit tests for engine physics, spawn, collision, win condition | Already configured with `@slutsnus/shared` alias |
| Canvas 2D API | Browser built-in | 60fps rendering of falling objects and bar | Locked decision — no DOM layout at 60fps for 10-30 objects |
| SolidJS `createStore` | ^1.9.3 (solid-js/store) | Game state on client — prevents full re-render on every 20Hz tick | Locked decision: `createStore` not `createSignal` |
| SolidJS `requestAnimationFrame` | Browser built-in via `onCleanup(cancelAnimationFrame)` | 60fps render loop | Locked decision — cleanup from day one |
| Socket.IO | ^4.8.1 | Already installed; `game:action` carries bar position to server | Established pattern in GameContainer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `setInterval` (Node built-in) | N/A | 20Hz server physics tick | Already running from Phase 5; Phase 6 fills in the tick body |
| `@slutsnus/shared` workspace | N/A | `SenusCatcherState`, `SenusCatcherPlayerState`, `GameResult` | All consumers import from here; type-safe across server and client |
| Zod | ^4.3.6 (server) | Validate `snus-catcher:bar-move` action payload | Already installed; pattern from Snusking action validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D (CanvasRenderingContext2D) | WebGL / PixiJS | Canvas 2D is sufficient for 2D sprites/rectangles at 60fps; WebGL adds bundle complexity for no benefit at this object count |
| `createStore` for game state | `createSignal` | `createSignal` with a top-level game state object re-renders the entire canvas component on every 20Hz tick; `createStore` enables fine-grained updates |
| Room-broadcast state | Per-player `{ forUserId }` wrapper | Both players see identical object positions; only score/lives differ per player — the state object includes both players' score/lives, so no per-player projection is needed |
| `window.mousemove` + emit | Pointer Events API | `mousemove` is the established DOM pattern; Pointer Events adds pressure/tilt which is irrelevant |

**Installation:** No new packages required for Phase 6.

## Architecture Patterns

### Recommended Project Structure
```
server/src/games/snus-catcher/
├── engine.ts          # SenusCatcherEngine — physics FSM (REPLACE Phase 5 stub)
├── engine.test.ts     # Unit tests — physics, spawn, collision, win (EXTEND Phase 5 tests)
└── physics.ts         # Pure physics helpers — spawn, collision rect, move tick

client/src/games/snus-catcher/
├── index.tsx          # SenusCatcherGame root — store, rAF loop, canvas, event wiring (REPLACE)
├── render.ts          # Canvas draw functions — drawBar, drawPouch, drawHUD (pure functions)
└── snus-catcher.css   # Game-specific styles — canvas wrapper, HUD overlay

shared/src/
└── types.ts           # SenusCatcherState, SenusCatcherPlayerState, SenusCatcherObject (ADD)
```

### Pattern 1: Engine FSM — waiting → playing → ended
**What:** The engine holds an internal `status` field. `init()` sets `status = 'playing'` and starts spawning. When `lives <= 0` for any player, status becomes `'ended'` and results are emitted.
**When to use:** Every tick calls `tick()` which (a) moves objects, (b) spawns new objects probabilistically, (c) checks collisions against last-known bar positions, (d) checks win condition.

```typescript
// server/src/games/snus-catcher/engine.ts
private tick(): void {
    this.tickCount++;
    this.moveObjects();
    this.spawnObjects();
    this.checkCollisions();
    const winner = this.checkWinCondition();
    if (winner) {
        this.status = 'ended';
        clearInterval(this.tickInterval);
        this.tickInterval = undefined;
        this.onStateUpdate(this.buildEndedState(winner));
        return;
    }
    this.onStateUpdate(this.buildState());
}
```

### Pattern 2: Server-Authoritative Collision via Bar Fraction
**What:** Client sends only the normalized X fraction (0.0–1.0) of the cursor position. Server maps this to actual canvas-width units and performs collision against object bounding boxes.
**Why:** Server owns the canonical positions of all falling objects. Client-side collision would allow cheating and cause desyncs.

```typescript
// Action shape — emitted from client via socket.emit('game:action', ...)
// type: 'snus-catcher:bar-move', payload: { xFraction: number }
handleEvent(playerId: string, action: GameAction): void {
    if (action.type === 'snus-catcher:bar-move') {
        const payload = action.payload as { xFraction: number };
        const player = this.players.get(playerId);
        if (player) {
            player.barXFraction = Math.max(0, Math.min(1, payload.xFraction));
        }
    }
}
```

### Pattern 3: Client-Authoritative Bar Rendering
**What:** Client renders bar at the exact cursor X position immediately, without waiting for the next server tick.
**Why:** 50ms server tick means the bar would visually lag if we waited for server echo. The bar is purely cosmetic on the client — the server uses its own last-known fraction for authoritative collision.

```typescript
// In index.tsx — mousemove handler
const canvas = canvasRef;
let lastEmit = 0;
const onMouseMove = (e: MouseEvent) => {
    barX = e.clientX - canvas.getBoundingClientRect().left; // immediate local render
    const now = Date.now();
    if (now - lastEmit >= 30) { // 30ms throttle per STATE.md
        lastEmit = now;
        props.onAction({ type: 'snus-catcher:bar-move', payload: { xFraction: barX / canvas.width } });
    }
};
```

### Pattern 4: 60fps rAF Loop with Cleanup
**What:** `requestAnimationFrame` loop started in `onMount`, cancelled in `onCleanup`. Server state is stored in a `createStore`; the rAF loop reads the store and draws to the canvas on every frame.
**Why:** Without `onCleanup(cancelAnimationFrame)`, navigating away and back causes loops to accumulate. This is the top-listed critical pitfall.

```typescript
// In SenusCatcherGame (index.tsx)
import { createStore } from 'solid-js/store';
import { onMount, onCleanup } from 'solid-js';

const [gameState, setGameState] = createStore<SenusCatcherState | null>(null);
let rafId: number;

onMount(() => {
    const loop = () => {
        drawFrame(ctx, gameState, localBarX);
        rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
});

onCleanup(() => cancelAnimationFrame(rafId));
```

### Pattern 5: Socket State Listener Wiring
**What:** `game:state` events update the store; `game:end` events are already handled by `room.ts` and the client `GameContainer` must propagate them.
**When:** The `SenusCatcherGame` component receives `onAction` prop (same pattern as `SnuskingGame`). It registers `socket.on('game:state', ...)` and updates the store.

**Key observation from GameContainer inspection:** Currently `GameContainer.tsx` does NOT pass `state` or `onAction` to `SenusCatcherGame` — it only passes `roomCode`. Phase 6 must update `GameContainer` to:
1. Widen `gameState` signal type from `SnuskingProjectedState | null` to `unknown`
2. Pass `state` and `onAction` to `SenusCatcherGame`

### Pattern 6: Shared State Type Definition
**What:** Define `SenusCatcherState` and supporting types in `shared/src/types.ts` before implementing the engine or canvas. Both the server (engine) and client (canvas renderer) import from the same source.

```typescript
// shared/src/types.ts — ADD these types

export interface SenusCatcherObject {
    id: string;
    type: 'fresh' | 'spent';
    x: number;      // 0.0–1.0 fraction of canvas width
    y: number;      // 0.0–1.0 fraction of canvas height
}

export interface SenusCatcherPlayerState {
    userId: string;
    username: string;
    score: number;
    lives: number;              // 3 → 0
    barXFraction: number;       // 0.0–1.0 — last-known server position (for opponent's bar display)
}

export interface SenusCatcherState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: SenusCatcherPlayerState[];   // always 2 entries for 1v1
    objects: SenusCatcherObject[];        // falling items both players see (same playfield layout, but collision is per-player)
    results?: GameResult[];               // only present when status === 'ended'
}
```

**Design note:** Independent playfields (locked in STATE.md) means each player catches/misses independently — the *same* objects fall in the same positions, but collision is resolved per-player. The `objects` array is shared in the broadcast; the server maintains per-player `barXFraction` and resolves catches independently for each player.

### Anti-Patterns to Avoid
- **Using `createSignal` for game state:** A single top-level signal causes the entire canvas component to re-render on every 20Hz state update. Use `createStore` and update individual fields.
- **Rendering at cursor position with server echo wait:** Causes 50ms visual lag on bar movement. Render bar at cursor immediately; only the collision is server-authoritative.
- **Missing `onCleanup(cancelAnimationFrame)`:** rAF loops accumulate on component remount. This is the most common source of frame rate doubling and memory leaks in SolidJS canvas games.
- **Performing collision on the client:** Client collision would diverge from server truth and enable cheating. Server is the only source of truth for score and lives.
- **Emitting bar position on every mousemove:** At 144Hz monitors this fires ~7ms apart. Must throttle to minimum 30ms intervals per locked decision.
- **Hardcoding canvas dimensions:** Use `canvas.width` and `canvas.height` dynamically; store object positions as fractions (0.0–1.0) in the shared state to avoid needing to sync canvas dimensions between server and client.
- **Typing `SenusCatcherState` as `unknown` in the canvas component:** The canvas component should import and use the concrete `SenusCatcherState` type from shared. `unknown` is only appropriate at the `GameContainer` signal boundary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leaderboard write on game end | Custom Prisma calls in engine | Engine emits `{ status: 'ended', results: GameResult[] }`; room.ts already calls `prisma.leaderboardEntry.create()` | The full persistence logic (session update, per-player upsert, leaderboard entry) is already in room.ts `onUpdate` — verified from source |
| Game-end broadcast | Custom `game:end` emit | Same: room.ts `onUpdate` already calls `io.to(roomCode).emit('game:end', { results })` when status is ended | Verified in room.ts lines 157-181 |
| Socket room management | Tracking connected sockets manually | `io.to(roomCode).emit(...)` — room.ts broadcast path handles all room members | Phase 5 confirmed: `else` branch in `onUpdate` broadcasts to room |
| Action validation | Manually checking action payload types | Zod schema — same pattern as Snusking action validation | Already installed; prevents malformed `xFraction` crashing the engine |
| Player-to-socket routing | New Map | `onlineUsers` map from `socket/index.ts` | Per-player emit for future per-player state if needed |

**Key insight:** `room.ts` is a complete game lifecycle manager. The engine only needs to call `this.onStateUpdate(state)` with the right shape; all socket emission, persistence, and cleanup is handled for free.

## Common Pitfalls

### Pitfall 1: rAF Loop Accumulation on Component Remount
**What goes wrong:** Player navigates away mid-game (e.g., accidental back button) and returns. SolidJS mounts the component again, starting a second rAF loop. Both loops run, producing doubled frame rate initially, then diverging as they accumulate.
**Why it happens:** `requestAnimationFrame` does not self-cancel. The loop reference must be explicitly stored and cancelled.
**How to avoid:** Always assign `rafId = requestAnimationFrame(loop)` and `onCleanup(() => cancelAnimationFrame(rafId))` as the very first thing in component setup — before any other logic.
**Warning signs:** Frame rate climbs above 60fps on return to game; console shows duplicate draw calls.

### Pitfall 2: `createSignal` Instead of `createStore` for Game State
**What goes wrong:** Every 20Hz server tick updates the signal, which triggers SolidJS to re-run the entire component function — including re-registering socket listeners, re-starting rAF loops, and re-executing all `createEffect` calls.
**Why it happens:** `createSignal` equality check is reference equality on objects. A new state object (from JSON.parse of Socket.IO payload) is never equal to the previous.
**How to avoid:** Use `createStore` from `solid-js/store`. Update individual nested fields with `setGameState('players', 0, 'score', newScore)` rather than replacing the whole object.
**Warning signs:** Socket listener count grows over time; memory usage climbs; DevTools shows repeated component initialization.

### Pitfall 3: Bar Position Visual Lag
**What goes wrong:** Client only renders bar at `gameState.players[selfIndex].barXFraction` — the server's last-known position. At 20Hz, this produces 50ms lag between cursor movement and bar visual update, making the game feel broken.
**Why it happens:** Confusing server truth (for collision) with client rendering truth (for UX).
**How to avoid:** Maintain a separate local `let barX: number` variable in the canvas component that is updated directly from `mousemove` events and used for rendering. The store's `barXFraction` is still used for rendering the *opponent's* bar position.
**Warning signs:** Bar visibly snaps 50ms after cursor movement.

### Pitfall 4: GameContainer Signal Type Narrowing
**What goes wrong:** `GameContainer.tsx` declares `createSignal<SnuskingProjectedState | null>`. When state from a Snus Catcher game arrives, it is cast to `SnuskingProjectedState` — accessing `.self.hand` on a `SenusCatcherState` object causes runtime errors.
**Why it happens:** The signal type was scoped to Snusking before Snus Catcher existed.
**How to avoid:** Widen to `createSignal<unknown>(null)`. The `SenusCatcherGame` component receives `state` as `unknown` at the boundary and casts to `SenusCatcherState` internally after a type guard.
**Warning signs:** TypeScript errors in `GameContainer.tsx` when adding state prop to `SenusCatcherGame`; or silent runtime crash accessing Snusking-specific fields on Snus Catcher state.

### Pitfall 5: Object Positions in Pixel Space Instead of Fractions
**What goes wrong:** Server stores `x` and `y` as pixel values (e.g., `x: 340`). Client canvas has a different pixel width than whatever the server assumed. Objects appear shifted left or right depending on the player's screen resolution.
**Why it happens:** Server has no knowledge of client canvas size.
**How to avoid:** All positions in shared state must be normalized fractions (0.0–1.0). Client multiplies by `canvas.width` / `canvas.height` on render. Server multiplies by a fixed logical canvas size for physics calculations (e.g., `LOGICAL_WIDTH = 800`).
**Warning signs:** Objects appear at different horizontal positions on different screen sizes; collision works but objects appear offset on client.

### Pitfall 6: Game End Not Triggering Because onUpdate Shape Is Wrong
**What goes wrong:** Engine emits `{ status: 'ended', results: [...] }` but room.ts never persists or broadcasts `game:end` because the shape check fails.
**Why it happens:** room.ts `onUpdate` checks `raw.status === 'ended' && raw.results` on the object that arrives. If the engine wraps state in `{ forUserId, state }`, room.ts reads `s.state` for the inner object. If it uses broadcast (no `forUserId`), room.ts reads the top-level state. These two paths use different variables (`raw`).
**How to avoid:** Snus Catcher should use the room-broadcast path (no `forUserId` wrapper). Verify the broadcast path correctly extracts `raw = state as { status?: string; results?: GameResult[] }` — confirmed in room.ts line 154: `(state as { status?: string; results?: GameResult[] })` when `!s.forUserId`.
**Warning signs:** Game appears to end on client (lives reach 0) but leaderboard is not updated; `game:end` socket event never fires.

### Pitfall 7: Mouse Events Outside Canvas Bounds
**What goes wrong:** Player moves cursor to the edge of or outside the canvas element. `e.clientX - canvas.getBoundingClientRect().left` becomes negative or exceeds `canvas.width`.
**Why it happens:** `mousemove` fires even when cursor leaves the element if the button is held, and `mouseout` doesn't fire reliably during fast movement.
**How to avoid:** Clamp `barX` to `[0, canvas.width]` on the client, and clamp `xFraction` to `[0.0, 1.0]` on the server. Double-clamping prevents any edge case.

## Code Examples

### SenusCatcherState — shared type addition
```typescript
// shared/src/types.ts — append after existing types

export interface SenusCatcherObject {
    id: string;
    type: 'fresh' | 'spent';
    x: number;   // 0.0–1.0 fraction of logical width
    y: number;   // 0.0–1.0 fraction of logical height
}

export interface SenusCatcherPlayerState {
    userId: string;
    username: string;
    score: number;
    lives: number;
    barXFraction: number;
}

export interface SenusCatcherState {
    status: 'playing' | 'ended';
    tickCount: number;
    players: SenusCatcherPlayerState[];
    objects: SenusCatcherObject[];
    results?: GameResult[];
}

export type SenusCatcherAction =
    | { type: 'snus-catcher:bar-move'; payload: { xFraction: number } };
```

### Engine tick body (skeleton)
```typescript
// server/src/games/snus-catcher/engine.ts
private tick(): void {
    this.tickCount++;
    // 1. Move all objects downward
    for (const obj of this.objects) {
        obj.y += FALL_SPEED_PER_TICK; // fraction per tick
    }
    // 2. Remove objects that fell off screen
    this.objects = this.objects.filter(obj => obj.y < 1.1);
    // 3. Spawn new objects probabilistically
    if (Math.random() < SPAWN_CHANCE_PER_TICK) {
        this.objects.push(this.spawnObject());
    }
    // 4. Check collisions for each player
    for (const player of this.playerStates.values()) {
        this.resolveCollisions(player);
    }
    // 5. Win condition
    const loser = [...this.playerStates.values()].find(p => p.lives <= 0);
    if (loser) {
        this.end(loser);
        return;
    }
    // 6. Broadcast state
    this.onStateUpdate(this.buildState());
}
```

### Client rAF loop (skeleton)
```typescript
// client/src/games/snus-catcher/index.tsx
import { createStore } from 'solid-js/store';
import { onMount, onCleanup } from 'solid-js';
import type { SenusCatcherState } from '@slutsnus/shared';

export function SenusCatcherGame(props: { roomCode: string; onAction: (a: unknown) => void }) {
    let canvasRef!: HTMLCanvasElement;
    let rafId: number;
    let localBarX = 0;
    let lastEmit = 0;

    const [state, setState] = createStore<{ data: SenusCatcherState | null }>({ data: null });

    const socket = useSocket();
    socket.on('game:state', ({ state: s }) => setState('data', s as SenusCatcherState));
    onCleanup(() => socket.off('game:state'));

    onMount(() => {
        const ctx = canvasRef.getContext('2d')!;

        const loop = () => {
            if (state.data) drawFrame(ctx, canvasRef, state.data, localBarX);
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        const onMove = (e: MouseEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            localBarX = Math.max(0, Math.min(canvasRef.width, e.clientX - rect.left));
            const now = Date.now();
            if (now - lastEmit >= 30) {
                lastEmit = now;
                props.onAction({ type: 'snus-catcher:bar-move', payload: { xFraction: localBarX / canvasRef.width } });
            }
        };
        canvasRef.addEventListener('mousemove', onMove);
        onCleanup(() => {
            canvasRef.removeEventListener('mousemove', onMove);
            cancelAnimationFrame(rafId);
        });
    });

    return <canvas ref={canvasRef} width={800} height={600} />;
}
```

### GameContainer widening (required change)
```typescript
// GameContainer.tsx — change line 16
// FROM:
const [gameState, setGameState] = createSignal<SnuskingProjectedState | null>(null);
// TO:
const [gameState, setGameState] = createSignal<unknown>(null);

// And update the SenusCatcherGame Show block to pass state and onAction:
<Show when={gameType() === 'snus-catcher' ? gameState() : null}>
    {(s) => (
        <SenusCatcherGame
            state={s() as SenusCatcherState}
            roomCode={props.roomCode}
            onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
        />
    )}
</Show>
```

### Game end — what the engine must emit
```typescript
// engine.ts — buildEndedState()
private buildEndedState(loser: SenusCatcherPlayerState): SenusCatcherState {
    const players = [...this.playerStates.values()];
    const winner = players.find(p => p.userId !== loser.userId)!;
    const results: GameResult[] = [
        { userId: winner.userId, username: winner.username, score: winner.score, rank: 1 },
        { userId: loser.userId,  username: loser.username,  score: loser.score,  rank: 2 },
    ];
    return {
        status: 'ended',
        tickCount: this.tickCount,
        players: players.map(p => ({ ...p })),
        objects: [],
        results,
    };
}
// room.ts onUpdate already handles: game:end broadcast, leaderboard write, session persistence
```

### Physics constants (implement as named constants)
```typescript
// server/src/games/snus-catcher/engine.ts
const TICK_MS = 50;                    // 20Hz — locked
const LOGICAL_WIDTH = 800;             // logical units for collision math
const LOGICAL_HEIGHT = 600;
const FALL_SPEED_PER_TICK = 0.008;    // fraction of height per tick — tune via playtesting
const SPAWN_CHANCE_PER_TICK = 0.15;   // probability of new object per tick — tune
const SPENT_POUCH_FRACTION = 0.3;     // 30% of spawned objects are spent — tune
const BAR_WIDTH_FRACTION = 0.15;      // bar width as fraction of logical width — tune
const COLLISION_Y_THRESHOLD = 0.88;   // objects at or below this Y are "catchable"
const INITIAL_LIVES = 3;              // locked per GAME-07
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 5 stub: tick emits `{ tickCount, status: 'playing' }` | Phase 6 engine: tick emits full `SenusCatcherState` with objects, players, scores, lives | Phase 6 | Client can render actual game; existing room.ts `onUpdate` picks up `status: 'ended'` automatically |
| Phase 5 client: placeholder div "Snus Catcher — laddas..." | Phase 6 client: Canvas 2D at 60fps with rAF loop | Phase 6 | Full playable UI |
| `createSignal<SnuskingProjectedState | null>` in GameContainer | `createSignal<unknown>(null)` | Phase 6 | Unblocks Snus Catcher from receiving state; does not break Snusking (it still casts internally) |

**No deprecated patterns** — all changes are additive except the GameContainer signal type widening.

## Open Questions

1. **Independent playfields — do objects share the same positions?**
   - What we know: STATE.md locked "independent playfields — each player has their own falling objects"
   - Implication: The `objects` array in the broadcast state is the *same* for both players. Each player's bar collision is resolved independently server-side. Both players can "catch" the same object without conflict because they are in independent lanes. The server tracks per-player catches by resolving collision against each player's `barXFraction` separately.
   - Recommendation: One `objects` array in shared state. Server resolves catches per-player and removes the object from the shared array once *all* players have passed it (fallen off bottom), not when one player catches it. Actually simpler: each player has their own independent object list server-side (completely separate spawns). This is the true "independent playfields" model.
   - **Decision needed at plan time:** Shared object positions (same X/Y falls for both players, catches resolved independently) OR truly separate object lists per player (different X positions, different objects). The former is simpler to implement and sync. Recommendation: separate per-player object lists stored server-side; client only receives their own objects in the state (or receives both, each under `players[i].objects`). This aligns with the arcade model where each player has their own lane.

2. **Bar width on opponent HUD**
   - What we know: Both players see each other's score and lives (ROADMAP success criteria 5). Whether they also see each other's bar position is unspecified.
   - Recommendation: Show opponent's bar position using `barXFraction` from the state — adds minimal complexity and increases "racing game" feeling.

3. **Canvas resize / responsive layout**
   - What we know: Canvas dimensions are fixed at declaration time. On different screen sizes, the canvas will be letterboxed or stretched.
   - Recommendation: Use CSS `width: 100%; height: 100%` with `object-fit: contain` styling on the canvas element, and fix canvas logical dimensions at 800×600 in the component. Do not resize the canvas on window resize — that would require re-running the rAF loop setup.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (server workspace) |
| Config file | `server/vitest.config.ts` |
| Quick run command | `npm run test --workspace=server` |
| Full suite command | `npm run test --workspace=server` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAME-02 | `handleEvent('snus-catcher:bar-move')` updates player barXFraction | unit | `npm run test --workspace=server` | ✅ (engine.test.ts exists — add tests) |
| GAME-03 | Tick spawns FreshPouch objects over time | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| GAME-04 | Tick spawns SpentPouch objects over time | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| GAME-05 | Catching fresh pouch increments score | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| GAME-06 | Touching spent pouch decrements lives | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| GAME-07 | Player starts with 3 lives | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| GAME-08 | Player losing all lives triggers game end | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| GAME-09 | Game end emits `{ status: 'ended', results: GameResult[] }` | unit | `npm run test --workspace=server` | ✅ (extend engine.test.ts) |
| PLAT-02 | State broadcast on every tick | unit (existing) | `npm run test --workspace=server` | ✅ (Phase 5 test covers tick emission) |
| PLAT-03 | Leaderboard write on game end | smoke (manual) | Manual: play game to end, check leaderboard page | N/A — room.ts already handles this; tested via human verification |
| PLAT-04 | Return to lobby button works | smoke (manual) | Manual: click button after game ends, verify lobby appears | N/A — UI flow |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=server`
- **Per wave merge:** `npm run test --workspace=server` + `npx tsc --noEmit` (all three workspaces)
- **Phase gate:** All tests green + clean tsc + human playthrough before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Extend `server/src/games/snus-catcher/engine.test.ts` — add RED stubs for physics, collision, spawn, win condition before implementing engine body (covers GAME-02 through GAME-09)
- [ ] `shared/src/types.ts` — add `SenusCatcherState`, `SenusCatcherPlayerState`, `SenusCatcherObject`, `SenusCatcherAction` types (no test needed; checked by tsc)
- [ ] `client/src/games/snus-catcher/render.ts` — canvas draw functions (no automated tests; verified by visual inspection during human playthrough)

*(No new test files needed — engine.test.ts already exists from Phase 5; extend it in Wave 0.)*

## Sources

### Primary (HIGH confidence)
- Direct source inspection of `server/src/games/snus-catcher/engine.ts` — stub engine Phase 5 delivered; Phase 6 replaces tick body
- Direct source inspection of `server/src/socket/room.ts` — leaderboard write, game:end broadcast, onUpdate broadcast path confirmed lines 136-183
- Direct source inspection of `server/src/games/registry.ts` — `GameEngine` interface: `init`, `handleEvent`, `getState`, `destroy`
- Direct source inspection of `shared/src/types.ts` — `GameResult` shape, `GameAction` shape, `ClientToServerEvents` / `ServerToClientEvents`
- Direct source inspection of `client/src/games/GameContainer.tsx` — `createSignal<SnuskingProjectedState | null>` type narrowing issue; `Show` block for snus-catcher passes no state/onAction
- Direct source inspection of `client/src/stores/room.tsx` — `createStore` pattern for reactive state
- Direct source inspection of `client/src/games/snusking/index.tsx` — rAF-free Snusking (uses `createEffect` + `setInterval` for timer); Snus Catcher needs `requestAnimationFrame` instead
- Direct source inspection of `client/package.json` — `solid-js ^1.9.3`, no canvas library dependency (Canvas 2D is browser built-in)
- Direct source inspection of `server/package.json` — Zod `^4.3.6` available for action validation
- Direct source inspection of `server/prisma/schema.prisma` — `LeaderboardEntry`, `GameSession`, `GameSessionPlayer` models confirm persistence layer already exists

### Secondary (MEDIUM confidence)
- STATE.md locked decisions: client-authoritative bar, 30ms throttle, `createStore` not `createSignal`, 20Hz server tick, server-authoritative collision, canvas rendering, independent playfields, 3 lives
- ROADMAP.md Phase 6 success criteria: defines observable truths for human verification

### Tertiary (LOW confidence)
- Physics constants (`FALL_SPEED_PER_TICK`, `SPAWN_CHANCE_PER_TICK`, `BAR_WIDTH_FRACTION`) are LOW confidence starting points — implement as named constants, tune from playtesting per STATE.md decision

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns verified in existing source
- Architecture: HIGH — all integration points verified from direct source inspection (room.ts onUpdate, GameContainer Show routing, socket event shapes)
- Physics constants: LOW — starting values only; marked as tunable constants per STATE.md
- Pitfalls: HIGH — most pitfalls derived from direct code inspection (GameContainer signal type, room.ts onUpdate broadcast path shape)

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable codebase — no external dependency changes expected)
