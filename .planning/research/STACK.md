# Technology Stack — Snus Catcher Arcade Game

**Project:** Snus Catcher (1v1 real-time arcade game on the Snusking platform)
**Researched:** 2026-03-14
**Scope:** Additive capabilities on top of the validated platform (TypeScript + Express + Socket.IO 4.8.1 + Solid.js 1.9.3 + Vite 6.1.0 + Prisma 5.22.0). No stack changes allowed.

---

## Context and Constraints

The platform runs Socket.IO 4.8.1, Solid.js 1.9.3, TypeScript 5.7.3, Vite 6.1.0. The constraint is absolute: no stack changes. The existing `GameEngine` interface (`registry.ts`) is the integration seam — a new `SnusCatcherEngine` will implement it and register under `'snus-catcher'` in `gameRegistry`.

The existing turn-based card game (Snusking) already demonstrates the full integration path:
- `game:action` socket event → `engine.handleEvent(playerId, action)`
- Engine calls `onStateUpdate({ forUserId, state })` → `game:state` emitted per player
- `GameContainer.tsx` receives `game:state`, routes to the correct game component by `gameType`

Snus Catcher must follow this same contract. What changes is the nature of the game loop: instead of event-driven turn resolution, the arcade game requires a continuous server-side tick loop broadcasting position data to both players at ~20 Hz.

**Zero new npm packages are required.** All techniques below use platform capabilities that already exist or are built into the browser/Node.js.

---

## Recommended Stack

### Game Loop: Server-Side Tick Engine (Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `setInterval` at 50 ms | Node.js built-in | Server-authoritative game tick | 20 ticks/second is adequate for a falling-object arcade game where objects move predictably along straight paths. `setInterval` is the correct tool — it is available in Node.js without any dependencies, and 20 Hz tick rate produces ~40 bytes/tick/player which is trivial for Socket.IO. Do NOT use `requestAnimationFrame` on the server — rAF is a browser API and does not exist in Node.js. |
| `requestAnimationFrame` (browser) | Browser built-in | Client render loop | The client game component uses rAF to drive its own render cycle. Solid.js signals update the reactive canvas/DOM state on each rAF frame by reading the latest server-provided state snapshot. This separates rendering rate (60 fps client) from network rate (20 Hz server tick). |
| Client-side interpolation | — | Smooth motion between server ticks | At 20 Hz, objects jump in 50 ms steps at 60 fps rendering. Linear interpolation between the last-received server position and the predicted next position (based on known velocity) makes motion smooth without changing server tick rate. Requires storing `prevState` and `currentState` and interpolating by `(Date.now() - lastTickTime) / TICK_MS`. |

**Confidence: HIGH** — Derived from well-established patterns for browser arcade games over WebSockets, confirmed against the existing Socket.IO and Node.js architecture in this codebase.

**Why 20 Hz and not 60 Hz:** Socket.IO (TCP/HTTP) has higher per-message overhead than raw UDP. At 60 Hz for 2 players, the server emits 120 events/second; at 20 Hz it emits 40. For a 1v1 game with simple straight-line falling physics, 20 Hz server ticks + client interpolation is visually indistinguishable from 60 Hz server ticks and dramatically reduces server load and network jitter.

---

### Rendering: Canvas (Not DOM) for the Game Viewport

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `<canvas>` element, 2D context | Browser built-in | Game viewport rendering | Falling objects + collision highlights + powerup effects are all positional/animated at high frequency. DOM element positions driven by reactive signals cause layout recalculations on every rAF frame for every object. Canvas draw calls avoid layout thrashing entirely. At 60 fps with 10–30 falling objects, canvas is the correct choice. |
| Solid.js `onMount` + `ref` | 1.9.3 (existing) | Canvas setup | Solid.js `ref` binds the canvas element. `onMount` initializes the 2D context and starts the rAF loop. `onCleanup` cancels the rAF handle and clears the interval. No library needed — this is idiomatic Solid.js for imperative DOM work. |
| Canvas 2D API (`CanvasRenderingContext2D`) | Browser built-in | Drawing objects | `fillRect`, `drawImage`, `arc`, `fillText` are sufficient for this game. No WebGL, no Pixi.js, no Phaser. The game is 2D and visually simple (snus cans falling, a horizontal bar). The 2D context API is available everywhere with zero dependencies. |

**Confidence: HIGH** — Canvas vs DOM for arcade games is a well-understood tradeoff. The existing Solid.js codebase already uses the Web Animations API (not canvas) for card fly animations, confirming the team is comfortable with imperative DOM/browser APIs. Canvas is additive and isolated to the game component.

**Why NOT DOM elements for falling objects:** The existing Snusking card game uses CSS transitions and DOM elements because cards are layout objects. Falling arcade objects are not — they have floating-point x/y coordinates that change 60 times per second. Updating CSS `top`/`left` or `transform` via Solid.js signals on 20 objects at 60 Hz triggers style recalculations that will degrade performance on mid-range devices. Canvas sidesteps this entirely.

**Why NOT Pixi.js / Phaser:** Pixi.js is ~800 KB (gzipped ~270 KB). Phaser is ~1 MB. For a simple 2D falling-objects game, the 2D Canvas API provides everything needed. Adding a game framework would introduce a rendering paradigm (scene graph, ticker, assets loader) that conflicts with the existing Solid.js component model and Socket.IO state flow.

---

### Mouse Tracking: Native `mousemove` Event (Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `canvas.addEventListener('mousemove', ...)` | Browser built-in | Bar position tracking | Reading `event.offsetX` from a `mousemove` listener on the canvas element gives the cursor's x position relative to the canvas in one line. No library needed. Throttle to once per tick (50 ms) before emitting to server to avoid flooding the socket. |
| Pointer events (`pointerdown`, `pointermove`) | Browser built-in | Touch + mouse unification | Using `pointermove` instead of `mousemove` handles both mouse and touch input with the same event handler. Drop-in replacement. Recommended over `mousemove` for broader device support. |
| Client-side throttle (manual `Date.now()` check) | — | Prevent socket flooding | Before emitting a `game:action` with the new bar x-position, check `Date.now() - lastEmitTime >= 50`. If true, emit and update `lastEmitTime`. This 4-line throttle prevents emitting more than 20 mouse events/second to the server. Do NOT use lodash `throttle` — it is 70 KB for 4 lines of code. |

**Confidence: HIGH** — Native browser events with manual throttling is the established pattern for this use case. The existing codebase uses zero utility libraries for DOM events (confirmed by reading `index.tsx` and `Hand.tsx`).

---

### Collision Detection: AABB on Server (Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Axis-Aligned Bounding Box (AABB) | — | Bar catches falling snus can | AABB collision: `barX <= canX + canWidth && barX + barWidth >= canX && barY <= canY + canHeight && barY + barHeight >= canY`. This is 4 comparisons. No library needed. All falling objects in this game are rectangles moving along the Y axis — the simplest possible collision case. |
| Server-side collision authority | — | Cheat prevention | The server tick loop runs collision detection every 50 ms against the last-reported bar position per player. The result (`caught: true`, score delta) is authoritative. The client may run speculative collision locally for visual feedback only — the server score is canonical. |
| Client-side speculative collision | — | Zero-latency visual feedback | The client can locally mark a can as "caught" when the bar overlaps it (same AABB logic) and show a visual effect immediately, before the server confirmation arrives. If the server disagrees (due to latency mismatch), the server state corrects it on the next tick. Acceptable for an arcade game where visual polish matters more than perfect accuracy. |

**Confidence: HIGH** — AABB is the textbook approach for axis-aligned rectangles. No library is justified for 4 comparison expressions.

---

### Server-Authoritative vs Client-Authoritative: Hybrid

The Snus Catcher game is **server-authoritative for score and game state**, **client-authoritative for rendering position**.

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Falling object positions | Server | Generated and updated server-side each tick. Clients receive positions in `game:state`. |
| Bar position | Client-reported, server-validated | Client sends bar x-position via `game:action`. Server stores last known position per player and uses it in collision checks. Server clamps to `[0, canvasWidth - barWidth]`. |
| Score | Server | Collision detection is server-side. Score mutations happen in the engine. Clients never self-report score changes. |
| Visual rendering | Client | Client renders at 60 fps using latest server state + interpolation. All rendering decisions are client-side. |
| Powerup effects | Server | Server decides when powerups spawn, which player collects them, and what effect activates. Client shows the effect reactively. |

**Why not fully client-authoritative:** In a 1v1 competitive arcade game, client-authoritative scoring is trivially cheatable. A client could report "I caught everything" without the server verifying. For this platform (which has a leaderboard and friends), server authority on score is non-negotiable.

**Why not fully server-authoritative (including bar):** Making the server drive bar position from client mouse events requires the client to emit mouse position, server to include it in `game:state`, and the client to render the bar based on the server echo — adding 1 round-trip latency (~50–150 ms on LAN, more on internet) to every mouse movement. This produces visible lag on the most player-controlled element. The correct pattern is: client renders the bar at the locally-reported position, server uses the last-received position for collision — the bar position is eventually consistent, not immediately consistent.

**Confidence: HIGH** — This hybrid pattern is the established standard for browser arcade games with server-side scoring. Seen in: virtually all browser-based arcade multiplayer games that care about anti-cheat.

---

### Socket.IO Event Pattern for Arcade State Sync

**Tick broadcast (server → clients):**

```
game:state  (emitted per-player, ~20 Hz)
  payload: {
    state: {
      phase: 'playing' | 'ended',
      tick: number,             // monotonic, for interpolation
      objects: FallingObject[], // x, y, id, type, caught
      myScore: number,
      opponentScore: number,
      myLives: number,
      opponentLives: number,
      activePowerup: Powerup | null,
      timeRemaining: number,    // seconds
    }
  }
```

**Bar position (client → server):**

```
game:action  (throttled to 20 Hz client-side)
  payload: { type: 'snuscatcher:move-bar', x: number }
```

**Why reuse `game:action` for bar position:** The existing socket routing already dispatches `game:action` to `engine.handleEvent(playerId, action)`. Bar position is just another action — the engine stores it as `players[playerId].barX`. No new socket event needed, no changes to routing code.

**Why NOT a dedicated `game:input` event:** The only benefit of a separate event would be bypassing engine validation, which is a security regression. Keeping bar movement as a `game:action` means it goes through the same Zod validation path as all other actions, and the engine has full control over clamping and validation.

**Tick event batching:** If network conditions cause multiple ticks to queue up on the client, the client should only apply the latest received state and discard stale ones. The `tick` counter in the state payload enables this: `if (incoming.tick <= lastAppliedTick) return`.

**Confidence: HIGH** — Derived directly from reading the existing `game.ts` socket handler and understanding the `game:action` → `engine.handleEvent` → `onStateUpdate` → `game:state` flow.

---

### rAF Game Loop in Solid.js: Pattern

The client game component structure for Snus Catcher:

```typescript
// In Snus Catcher Solid.js component:
import { onMount, onCleanup } from 'solid-js';

let rafHandle: number;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// Latest server state, updated by Socket.IO listener (outside rAF)
let latestState: SnusCatcherState | null = null;
let lastTickTime = 0;
let prevState: SnusCatcherState | null = null;

onMount(() => {
  ctx = canvas.getContext('2d')!;

  // Socket listener updates state reference (not a Solid signal — no reactive overhead)
  socket.on('game:state', ({ state }) => {
    prevState = latestState;
    latestState = state as SnusCatcherState;
    lastTickTime = Date.now();
  });

  function frame() {
    rafHandle = requestAnimationFrame(frame);
    if (!latestState) return;
    const alpha = Math.min(1, (Date.now() - lastTickTime) / TICK_MS);
    drawFrame(ctx, prevState, latestState, alpha);
  }
  rafHandle = requestAnimationFrame(frame);
});

onCleanup(() => {
  cancelAnimationFrame(rafHandle);
  socket.off('game:state', ...);
});
```

**Key design decisions in this pattern:**

1. **Server state is a plain mutable variable, not a Solid signal.** The rAF loop reads it directly. Putting 20 Hz socket updates into a Solid signal would cause 20 reactive recalculations per second in the component tree — unnecessary, since the canvas draw call replaces the entire frame anyway.

2. **Solid signals are used for UI overlay elements only** (score, lives, timer, powerup indicator). These update at human-readable rates (score changes on catch, timer ticks at 1 Hz). Using `createSignal` for these is correct and idiomatic.

3. **`onCleanup` cancels both rAF and socket listener.** The existing `index.tsx` already demonstrates this pattern with `socket.on` / `onCleanup(() => socket.off(...))`.

4. **Canvas size matches CSS size to avoid DPI blur.** `canvas.width = canvas.offsetWidth * devicePixelRatio` on mount, with `ctx.scale(devicePixelRatio, devicePixelRatio)`.

**Confidence: HIGH** — Pattern derived from reading the existing Solid.js component architecture, the Web Animations API usage in `index.tsx`, and established rAF patterns. The "plain variable for render-loop state, signal for UI overlay" split is a well-known Solid.js performance pattern.

---

### Server Engine Structure for Arcade Game

The arcade engine differs structurally from the turn-based engine but implements the same `GameEngine` interface:

| Concern | Approach |
|---------|----------|
| Tick loop | `setInterval(tick, 50)` started in `init()`, cleared in `destroy()` |
| Object spawning | Deterministic spawn schedule or random with `Math.random()` seeded per game ID (fairness for 1v1) |
| Per-player state | Each player has separate falling objects? No — same objects, different bar positions and separate scores |
| State emission | `onStateUpdate({ forUserId: player1Id, state: projectFor(player1Id) })` then same for player 2, each tick |
| `handleEvent` | Stores bar position: `this.barX[playerId] = clamp(action.x, 0, CANVAS_W - BAR_W)` |
| Game end | Timer reaches 0 or one player loses all lives — engine calls `destroy()` and emits final state |

The `onStateUpdate` callback already accepts `{ forUserId, state }` objects (established by the Snusking engine). No changes to `room.ts` or socket infrastructure needed.

**Confidence: HIGH** — Derived directly from reading the existing `SnuskingEngine` and how `emitPerPlayer()` works.

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Rendering | Canvas 2D API | Pixi.js v8 | Pixi.js is ~270 KB gzipped. For 10–30 falling rectangles at 60 fps, the 2D Canvas API is entirely sufficient. Pixi.js introduces a scene graph, ticker, loader, and renderer abstraction that adds complexity without benefit at this scale. |
| Rendering | Canvas 2D API | DOM elements + CSS transforms | DOM layout recalculation at 60 fps for 20+ moving elements causes style recalculation jitter on mid-range hardware. Canvas draw calls are O(n) with no layout step. |
| Rendering | Canvas 2D API | WebGL (`<canvas>` + WebGL context) | WebGL is correct for particle systems with 10,000+ objects. For a game with 30 objects, WebGL adds significant boilerplate (shaders, buffers, attribute locations) with no perceptible benefit. |
| Game framework | Zero-dependency custom | Phaser 3 | Phaser 3 is ~1 MB. It requires ownership of the game loop, asset loader, and scene management — all of which conflict with Solid.js component lifecycle and Socket.IO state flow. Would require ejecting from the existing GameContainer architecture. |
| Collision | AABB (manual) | Matter.js / Planck.js | Physics engines add 100–300 KB and general-purpose constraint solving. Snus Catcher has objects moving only along the Y axis hitting a horizontal bar — literally the simplest collision scenario. A physics engine is a 200 KB solution to a 4-line problem. |
| Mouse throttle | Manual `Date.now()` check | lodash `throttle` | Lodash is 70 KB for a 4-line throttle. The existing codebase uses zero utility libraries — confirmed by reading all existing game files. Consistent with the project's lean dependency philosophy. |
| Server tick | `setInterval` | `requestAnimationFrame` on server | `requestAnimationFrame` does not exist in Node.js. It is a browser API. Some game frameworks polyfill it on Node.js but this adds a dependency and pretends Node.js is a browser. `setInterval` is the correct and direct approach. |
| Bar sync | `game:action` (reuse existing) | New `game:input` socket event | A new event type requires changes to `game.ts` routing and potentially new typed socket events in `shared/src/types.ts`. Reusing `game:action` is zero-impact on infrastructure. |
| Interpolation | Manual lerp in rAF loop | A tween library (GSAP, etc.) | GSAP is 50 KB. Lerping `prev + (curr - prev) * alpha` is 3 lines of arithmetic. No library justified. |

---

## Installation

```bash
# No new packages required.
# All capabilities used are:
#   - Browser built-ins (canvas 2D, requestAnimationFrame, pointermove)
#   - Node.js built-ins (setInterval, Math.random)
#   - Existing Socket.IO 4.8.1 (already installed)
#   - Existing Solid.js 1.9.3 (already installed)
```

---

## Platform Integration Points

**`shared/src/types.ts`:**
- Add `'snus-catcher'` to the `GameType` union
- Add `SnusCatcherAction` discriminated union: `{ type: 'snuscatcher:move-bar'; x: number }`
- Add `SnusCatcherState` interface for projected state shape
- Add `FallingObject` interface: `{ id: string; x: number; y: number; type: string; caught: boolean }`

**`server/src/games/registry.ts`:**
- Add `'snus-catcher': SnusCatcherEngine` to `gameRegistry`
- Import from new `./snus-catcher/engine.ts`

**`client/src/games/GameContainer.tsx`:**
- Add `'snus-catcher'` case alongside existing `'snusking'` case
- Import and render `SnusCatcherGame` component

**`client/src/games/snus-catcher/index.tsx`:**
- New component: canvas-based game viewport + reactive overlays for score/lives/timer
- Follows the `{ state, roomCode, onAction }` props contract established by `SnuskingGame`

No changes to `server/src/socket/game.ts`, `server/src/socket/room.ts`, or any auth/lobby code.

---

## Sources and Confidence

All findings are derived from direct codebase reading (HIGH confidence) and well-established browser game development patterns. External search tools were unavailable this session.

| Area | Confidence | Basis |
|------|------------|-------|
| GameEngine interface integration | HIGH | Direct read: `registry.ts`, `engine.ts`, `game.ts` |
| Socket.IO event pattern reuse | HIGH | Direct read: `game.ts`, `index.ts`, `GameContainer.tsx` |
| Canvas over DOM for arcade objects | HIGH | Established rendering tradeoff; DOM layout cost at 60 fps is well-documented |
| rAF loop + plain variable pattern in Solid.js | HIGH | Direct read: Solid.js `onMount`/`onCleanup` pattern in `index.tsx`; rAF standard |
| 20 Hz server tick via `setInterval` | HIGH | Node.js built-in; 20 Hz is standard for browser arcade games over TCP |
| AABB collision (manual 4-line) | HIGH | Mathematically correct for axis-aligned rectangles; no library needed |
| Hybrid authority model (server score, client bar) | HIGH | Standard anti-cheat pattern for competitive browser games |
| Manual throttle over lodash | HIGH | Direct read confirms zero utility library usage in existing game code |
| No Pixi.js / Phaser | HIGH | Object count and visual complexity do not justify game framework overhead |
| Client interpolation between ticks | MEDIUM | Standard pattern; exact implementation details (lerp vs ease) depend on feel testing |

---

*Stack research: 2026-03-14*
