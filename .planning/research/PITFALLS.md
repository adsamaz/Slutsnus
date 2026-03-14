# Domain Pitfalls

**Domain:** Adding a real-time arcade game to a turn-based multiplayer platform
**Project:** Snus Catcher — arcade minigame integrated into the existing Snusking platform
**Researched:** 2026-03-14
**Confidence:** HIGH (grounded in direct codebase analysis of existing architecture)

---

## Context: Why This Is a Distinct Problem Space

The existing Snusking platform was designed around a pull-based, event-driven model: players submit discrete actions, the server resolves them, and pushes state snapshots. There is no game loop, no continuous timer, and no physics. Adding a real-time arcade game with a falling-objects loop is not merely "another game type" — it is an architectural category change that conflicts with several assumptions baked into the platform.

The key structural facts:

- `GameEngine` interface: `init / handleEvent / getState / destroy` — no `tick()`, no server-side loop
- `game:action` socket handler calls `engine.handleEvent()` then returns — no streaming, no rate limiting
- `onStateUpdate` callback emits state to clients — designed for discrete turn snapshots, not 60fps positions
- `GameContainer.tsx` receives `game:state` events and sets a Solid.js signal — fine for turns, problematic for streaming
- The `activeGames` map in `socket/index.ts` holds live engine instances — cleanup is only on `game:end` or 5-minute timeout

These facts make several pitfalls highly likely without deliberate prevention.

---

## Critical Pitfalls

Mistakes that cause rewrites, broken gameplay, or platform instability.

---

### Pitfall 1: Forcing Arcade Loop Into the handleEvent Pattern

**What goes wrong:** The existing `GameEngine` interface has `handleEvent(playerId, action)` as the only way to push input into the engine. For the turn-based game, this is perfect — each action is a meaningful game event. For an arcade game, the natural instinct is to call `handleEvent` with something like `{ type: 'arcade:move', x: 450 }` on every `mousemove`. This creates a tight coupling where the physics loop is driven by client-to-server events rather than a server-side timer. The result is that the game speed and physics fidelity become dependent on client event emission rate and network round-trip time — broken by design.

**Why it happens:** The registry pattern looks like a universal adapter. `handleEvent` is there, it takes an action, it seems extensible. Developers naturally reach for the existing hammer.

**Consequences:**
- Bar position is only as smooth as the client's event throttle and the socket latency allows
- On high-latency connections the bar lags behind the mouse by hundreds of milliseconds
- The physics tick count diverges between players because each client drives the server at a different rate
- Multiple simultaneous position updates from different players produce interleaved `handleEvent` calls with no ordering guarantee

**Prevention:**
- The arcade engine must own its own server-side `setInterval` tick loop started in `init()` and stopped in `destroy()`. The loop drives physics: advancing object positions, running collision detection, emitting state.
- `handleEvent` (or a new method, see Pitfall 2) is used only for discrete input events: `{ type: 'arcade:setBarX', x: number }` updates a mutable bar position variable that the loop reads on the next tick. The loop is not triggered by input.
- The bar position variable is the only shared mutable state driven by client input. Everything else (object positions, score, spawn timing) is driven by the server loop.

**Phase:** Engine architecture decision — must be settled before writing a single line of arcade engine code.

---

### Pitfall 2: Extending GameEngine Interface Instead of Defining a New One

**What goes wrong:** The existing `GameEngine` interface is already extended once with `TurnBasedGameEngine` (in `registry.ts`). The arcade engine may seem to fit the base interface if the game loop is hidden inside `init()`. But `getState()` returns `unknown` — for arcade, the callers (`room.ts` `onUpdate` and the client `GameContainer`) must know the state shape to route it. If the arcade engine uses the same `onStateUpdate` callback signature as the turn-based engine, the caller code in `room.ts` will attempt to check `s.forUserId` (the Snusking-specific projection pattern) on arcade state, causing silent routing failures.

The existing code in `room.ts` at the `onUpdate` closure (lines 136–183) already contains game-specific logic: it checks `s.forUserId` to decide per-player routing. Adding arcade state through this same path without explicitly handling the different shape will silently fall through to the room-broadcast fallback and emit everything to everyone.

**Why it happens:** The `GameEngine` interface satisfies TypeScript at compile time. The mismatch only surfaces at runtime when routing logic branches incorrectly on undefined fields.

**Consequences:**
- Arcade state (which contains positions of all falling objects) is broadcast to all players without filtering — fine for arcade, but the routing is accidental, not intentional
- If a second arcade feature needs per-player state, the untyped fallback masks the problem until it's deeply entrenched
- Adding another game type later requires understanding the hidden Snusking-specific logic in `room.ts`

**Prevention:**
- Define a `RealTimeGameEngine` interface extending `GameEngine` with an explicit tick-loop contract: `startLoop() / stopLoop()` or just document that `init()` starts and `destroy()` stops the loop.
- Add a discriminant to the `onStateUpdate` callback payload: `{ broadcast: true, state: unknown }` vs `{ forUserId: string, state: unknown }`. The arcade engine always uses `broadcast: true`. The routing logic in `room.ts` becomes explicit, not coincidental.
- Add the arcade game type to `GameType` in `shared/src/types.ts` as a coordinated change (same issue as existing Pitfall 9 for Snusking).
- `GameContainer.tsx` currently hardcodes `gameType() === 'snusking'` as the only branch. The arcade game needs its own `Show` branch with its own state type. Do not cast arcade state as `SnuskingProjectedState`.

**Phase:** Interface definition, before engine implementation.

---

### Pitfall 3: Socket.IO Flooding From Position Update Broadcasts

**What goes wrong:** The existing `onStateUpdate` callback in `room.ts` emits a Socket.IO event immediately every time it is called. For Snusking this happens at most once per player action — a handful of times per minute. For an arcade game with a 60fps server loop and 2–4 players, `onStateUpdate` would be called 60 times per second, emitting 60 Socket.IO events per second to each client. Socket.IO serializes state to JSON on each call. For a state containing the positions of 10–20 falling objects, this is substantial CPU and bandwidth per tick.

Worse: Socket.IO's default TCP-based transport guarantees delivery and ordering. If the server emits faster than the network can drain the buffer, frames queue up. The client receives stale positions followed by "catch up" bursts — the bar cannot keep up, collisions register late.

**Why it happens:** The callback-per-update pattern is invisible during local development (loopback latency is ~0.01ms). It only surfaces under real network conditions or when profiled.

**Consequences:**
- On a 50ms round-trip connection, the client is always ~3 frames behind
- Queued frames produce rubber-band catch-up jerks
- Server CPU spikes because JSON serialization runs 60x per second per game room
- Multiple simultaneous arcade rooms multiply the problem linearly

**Prevention:**
- Run the server physics loop at the authoritative rate (e.g. 20 ticks/second) and emit state only on each tick — not at 60fps. 20 ticks/second is sufficient for a casual falling-objects game and matches what players can perceive over a typical home connection.
- Add a tick-rate constant to the arcade engine: `const TICK_RATE_MS = 50;` (20 ticks/second). Do not use `requestAnimationFrame` server-side (Node.js does not have it natively without polyfills).
- Consider emitting only a diff (changed positions) rather than full state each tick. For 10 falling objects, the diff is small. This is an optimization to apply if profiling shows a problem, not upfront.
- Use Socket.IO's `volatile` flag for position updates: `socket.volatile.emit('game:state', ...)`. Volatile events are dropped if the client is not ready to receive, rather than queued. This trades occasional missed frames for no queue buildup. Appropriate for position data; **not** appropriate for score events, catch events, or powerup spawns.

**Phase:** Server engine implementation. The tick rate must be a constant from day one — it affects physics determinism.

---

### Pitfall 4: Client Authority Confusion — Who Owns the Bar Position?

**What goes wrong:** Real-time arcade games have a fundamental design question: does the client show the bar at the mouse position immediately (client-side prediction), or does it wait for the server to echo back the authoritative position? If the client waits for the server, there is 1–2 RTT of latency between mouse movement and visual response — the bar feels broken. If the client moves the bar immediately and the server also sends back position confirmations, the client will occasionally snap back when the server disagrees (rubber-banding).

For a casual falling-objects game where multiple players catch snus simultaneously, there is also the question: does each player see the other players' bars in real time, or only their own? If all bar positions are server-authoritative, every player's bar feels laggy to that player.

**Why it happens:** The existing platform has no client-side prediction anywhere — the turn-based game has no movement at all. Developers coming from the turn-based pattern will wait for server acknowledgment for everything, including the local bar.

**Consequences:**
- Client-waits-for-server: local bar is sluggish by exactly the network RTT. On a 100ms connection this is a 200ms lag between moving the mouse and seeing the bar move — unacceptable for a skill-based catching game.
- Applying Snusking's "server emits state, client renders state" pattern naively breaks the feel of the game entirely.

**Prevention:**
- Adopt a split authority model: **local bar is always client-authoritative**. The Solid.js arcade component reads mouse/touch position from DOM events and moves the local bar immediately — no server round-trip. The bar position the client sends to the server is used only to compute collisions server-side; the visual position on the client is never overridden by the server response.
- **Remote bars** (other players' bars) are server-authoritative. The client interpolates between received positions to smooth motion. No prediction needed for remote bars because no local player controls them.
- Catching events (score increments, caught objects disappearing) are server-authoritative and acknowledged via a state update. The client can show an optimistic "catch flash" effect but must reconcile with server state.
- Document this model explicitly in the arcade engine architecture. It is a departure from every other pattern in the codebase.

**Phase:** Client architecture, before building the arcade canvas/DOM renderer.

---

### Pitfall 5: rAF Loop Not Cleaned Up on Solid.js Component Unmount

**What goes wrong:** The arcade game's client renderer requires a `requestAnimationFrame` loop to animate falling objects and smooth bar movement between server ticks. In Solid.js, a component can unmount when the player navigates away, the game ends, or the socket disconnects. If the rAF loop is started in the component body without registering a cleanup, it continues running after unmount — attempting to read stale signals, write to DOM elements that no longer exist, and potentially holding references that prevent garbage collection.

The existing `SnuskingGame` component shows the correct pattern: `createEffect` with `setInterval` and `onCleanup(() => clearInterval(id))`. But `setInterval` is synchronous and returns an ID that's easy to track. `requestAnimationFrame` uses a recursive structure (`function tick() { rAF(tick); }`) that is easier to forget to cancel.

**Why it happens:** rAF loops are self-perpetuating. There is no error when they run against an unmounted component — the component just silently continues consuming CPU and potentially reading stale closed-over values.

**Consequences:**
- Memory leak: the arcade component's closures are kept alive by the rAF callback, preventing GC
- CPU waste: the loop continues running at vsync rate (typically 60fps) in a hidden tab or after navigation
- Silent state corruption: if the loop reads a Solid.js signal after the owner scope is disposed, Solid.js warns in dev mode and silently returns stale values in production
- Multiple games played in one session accumulate leaked loops — page performance degrades with each game

**Prevention:**
- Always cancel the rAF loop with `onCleanup(() => cancelAnimationFrame(rafId))`. Store the return value of `requestAnimationFrame` in an outer variable updated each frame: `rafId = requestAnimationFrame(tick)`.
- Use Solid.js `createEffect` with `onCleanup` as the canonical place to start the loop, not the component body directly.
- Add a `mounted` boolean ref that the loop checks at the top of each tick. If `!mounted`, the loop exits and does not re-schedule. This is a belt-and-suspenders guard against the rAF firing one last time after cleanup has already run.
- Test cleanup explicitly: navigate away from the game mid-session and verify CPU usage drops to baseline in browser DevTools.

**Phase:** Client component implementation. Must be present from the first working renderer — do not add cleanup "later."

---

### Pitfall 6: Server-Side setInterval Not Stopped When Game Ends or Room Empties

**What goes wrong:** The arcade engine starts a server-side `setInterval` (or equivalent) for its physics loop in `init()`. The existing `GameEngine.destroy()` contract requires cleanup. However, the `destroy()` call in `room.ts` only happens in two cases: (1) the game emits `status: 'ended'` and the `activeGames.delete` path runs, or (2) the 5-minute all-players-offline cleanup timer fires. If the arcade engine emits `game:end` from inside the loop but the loop is not stopped synchronously before the `activeGames.delete`, there is a race: the loop ticks once more after deletion, calls `onStateUpdate`, which the `room.ts` handler tries to route, finds no `roomCode` in `activeGames` (since it was deleted), and silently drops the event — or worse, emits to a room that may no longer exist in Socket.IO's room tracking.

**Why it happens:** The existing Snusking engine does not have a tick loop, so this race condition does not exist for it. The arcade engine introduces it for the first time.

**Consequences:**
- One or more "phantom ticks" after game end: falling objects continue to move and collide server-side after the game is declared over, potentially changing scores post-result
- Orphaned `setInterval` if `destroy()` is not called (e.g., if `room:leave` triggers cleanup but `destroy()` is not invoked on the engine — the current `room:leave` handler in `room.ts` does not call `engine.destroy()`)
- In a long session with many arcade games, leaked intervals accumulate and the server becomes progressively slower

**Prevention:**
- `destroy()` must call `clearInterval(this.loopId)` as its **first** action, before any state cleanup. The sequence must be: stop loop → clear state → deregister.
- When the game ends by score condition, the loop should set a `this.ended = true` flag and let the current tick complete normally, then not re-schedule. Do not call `clearInterval` from inside the loop body — call it from `destroy()`.
- Audit `room.ts` for all places where a room is torn down (`room:leave`, `room:start` error path, `room:delete`) and ensure each path calls `engine.destroy()` if an active game exists.
- Add a test: create a game, trigger end condition, wait 200ms, assert no further `onStateUpdate` calls.

**Phase:** Server engine implementation and room lifecycle integration.

---

### Pitfall 7: Collision Detection Bugs (Missed Catches, False Positives)

**What goes wrong:** Server-side collision detection between a bar (horizontal rectangle) and falling objects (circles or rectangles) is conceptually simple but fails at edge cases. Two common bugs: (1) "tunnel through" — a fast-falling object moves more than its own height in one tick, skipping past the bar zone entirely; (2) "phantom catch" — the bar's hitbox is wider than its visual representation, causing the player to catch objects they visually missed, or vice versa.

For a multiplayer game, both players' bars must be checked against all falling objects on the same tick. If the resolution order is player-A-first, player-B-second, and the same object collides with both bars simultaneously, the first player always gets credit — the second player is silently denied a catch they achieved.

**Why it happens:** Single-player catching game collision is simple. Multiplayer adds the simultaneous-hit resolution problem. Physics at discrete tick intervals adds the tunneling problem for fast objects.

**Consequences:**
- Missed catches feel random and unfair — players lose trust in the game's responsiveness
- False positives feel like the game is cheating for other players
- Simultaneous catches assigned to only one player without explanation cause confusion

**Prevention:**
- Use swept collision (check if the object's trajectory crossed the bar zone during the tick, not just whether it overlaps at tick-end). For a bar catching a falling object, the swept check is: did the object's Y position transition from above the bar to below the bar during this tick?
- Make hitboxes slightly forgiving (larger than visual by ~10px on each side). This is standard practice in catching games and is more important than pixel-perfect accuracy.
- For simultaneous catches, define an explicit resolution policy before implementation: either both players get credit (cooperative mode), or a tie-break rule applies (e.g., whose bar center is closer to the object center). Document this policy. Do not let the resolution be determined by iteration order.
- The bar hitbox width must exactly match the server-side width value used for collision, which must match the CSS width sent to clients. Store this as a shared constant in `@slutsnus/shared`.

**Phase:** Server physics implementation. Write unit tests for edge cases before integration testing.

---

### Pitfall 8: Powerup State Desync Between Players

**What goes wrong:** If the game includes powerups (wider bar, slow-down, point multiplier), each powerup has a state on the server: spawned, collected by player X, active until tick Y. The server broadcasts this state to all clients. If the client renders powerup activation effects based on received state, there is typically one tick of delay between the server deciding "player X collected powerup" and the client showing the effect. This is acceptable. The desync problem arises when the client shows a powerup as "available for collection" based on an old state snapshot while the server has already assigned it to another player — the client shows a false pickup opportunity.

For timed powerups (active for N seconds), the client must not derive remaining duration from its local clock. If client A has a 20ms clock drift from client B, they will disagree on when the powerup expires, producing visual inconsistency.

**Why it happens:** Clients naturally interpolate or extrapolate state between server ticks for visual smoothness. Powerup timing is a case where extrapolation produces visible errors.

**Consequences:**
- Player reaches for a powerup they can see, it "disappears" on contact because another player already took it — feels like a bug
- Powerup duration bar shows different remaining time on each player's screen
- In the worst case, a powerup registers as active on the client but the server has already ended it — the client shows an effect that has no gameplay impact

**Prevention:**
- Powerup availability must be determined **only** by the server. Clients never predict powerup collection — they render only what the current server state says.
- Powerup remaining duration must be computed from tick count, not wall-clock time. The server sends `expiresAtTick: number` and the client displays `(expiresAtTick - currentTick) * TICK_DURATION_MS`. Tick count is authoritative; local clock drift is irrelevant.
- When a powerup transitions from "available" to "collected" in the server state, the client must treat this as a discrete event (play collect animation for the correct player) rather than a smooth interpolated transition. Use a `createEffect` that compares previous and current powerup state to detect the transition.

**Phase:** Powerup design and server state schema. Settle the tick-based timing model before implementing any powerup.

---

### Pitfall 9: Game Loop Continuing After Match Ends (Score, Timeout, or Disconnect)

**What goes wrong:** The arcade game ends when a score target is reached, the round timer expires, or the last remaining player disconnects. In all three cases, the server-side loop must be stopped cleanly. The tricky case is a player disconnecting mid-game with one remaining opponent: the existing disconnect cleanup in `room.ts` starts a **5-minute timer** before calling `engine.destroy()`. For a turn-based game this is correct — disconnects are temporary network interruptions and 5 minutes is a reasonable rejoin window. For a real-time arcade game, a 5-minute wait with only one player left is not acceptable — the game should end (or at least pause) immediately on disconnect.

Additionally, the loop must not emit score updates after the end condition triggers. If the loop runs one extra tick after scoring, an object that was in mid-air might cross the bar after the winner was declared, adding phantom score.

**Why it happens:** The disconnect cleanup policy is shared across all game types via the same `room.ts` code path. It was designed for Snusking; the arcade game inherits it without consideration.

**Consequences:**
- Solo player left in a room continues the arcade game against no one for up to 5 minutes of server CPU
- End-state race: the loop ticks once more after `activeGames.delete`, causing phantom state emission (see Pitfall 6)
- If the single remaining player leaves, the loop has no players to broadcast to but continues running silently until the cleanup timer fires

**Prevention:**
- The arcade engine must have explicit disconnect policy configuration: `disconnectPolicy: 'immediate-end' | 'wait-for-rejoin'`. A falling-objects game should default to `immediate-end` — when a player disconnects, emit `status: 'ended'` from the engine immediately.
- The `destroy()` call path from immediate-end must not wait for the 5-minute timer. The engine signals the end via `onStateUpdate` with `status: 'ended'`, which causes `room.ts` to call `activeGames.delete` and the engine's `destroy()`. This already works for the Snusking case — use the same signal, just trigger it faster.
- Add a `this.ended` guard at the start of every loop tick: if `this.ended`, exit immediately without processing or emitting.
- Handle the single-player-remaining case explicitly: if `connectedPlayers.length < MINIMUM_PLAYERS_TO_CONTINUE`, end the game.

**Phase:** Server engine lifecycle and disconnect handling integration.

---

## Moderate Pitfalls

Mistakes that cause rework, polish debt, or degraded player experience but are recoverable.

---

### Pitfall 10: Canvas vs DOM Rendering Choice Regret

**What goes wrong:** The falling-objects arcade game can be rendered either on a `<canvas>` element (imperative 2D drawing) or as DOM elements with CSS transforms (declarative, Solid.js-native). The wrong choice causes pain proportional to how far the UI is built before the decision is reconsidered.

Canvas is more performant for many animated objects but requires imperative rendering code that works against Solid.js's reactive model. DOM/CSS is naturally reactive and integrates with Solid.js signals, but animating 20+ falling objects with CSS transforms can cause layout thrash if not done carefully.

The existing codebase uses DOM + CSS animations exclusively (see the `flyCard` animation functions in `snusking/index.tsx`). There is no canvas infrastructure anywhere.

**Why it happens:** Game developers default to canvas; web developers default to DOM. For a falling-objects game with ~10–20 simultaneous objects, the DOM approach is entirely viable and far easier to integrate with Solid.js.

**Consequences (wrong choice):**
- Canvas chosen: custom rendering loop required, no Solid.js reactivity, manual hit-testing for UI elements (score displays, buttons), accessibility lost, no CSS transitions
- DOM chosen without `will-change` and transform-only animations: jank from layout recalculation, potential reflow on each frame

**Prevention:**
- Use DOM + CSS transforms with `will-change: transform` on falling objects. Solid.js's fine-grained reactivity allows updating individual object positions without re-rendering the entire list.
- Represent each falling object as a `<div>` with `style={{ transform: \`translateY(${y}px) translateX(${x}px)\` }}`. Update position via a Solid.js store keyed by object ID.
- Use `translateY/translateX` (not `top/left`) to keep all animations on the compositor thread, avoiding layout recalculation.
- Only revisit canvas if profiling shows DOM performance is genuinely the bottleneck. Do not optimize before measuring.

**Phase:** Client component architecture, before first render implementation.

---

### Pitfall 11: Solid.js Store Update Frequency Causing Excessive Reactive Propagation

**What goes wrong:** Solid.js's fine-grained reactivity tracks individual property accesses. If the arcade game state is stored as a single nested store object (`createStore<ArcadeState>({...})`), updating `state.objects[id].y` on each tick causes only the component reading that specific path to re-render — this is correct and efficient. However, if the state is stored as a single `createSignal` (as `GameContainer.tsx` currently does: `createSignal<SnuskingProjectedState | null>(null)`), every tick replaces the entire signal value, causing every component that reads any part of the state to re-run.

At 20 ticks/second with 15 falling objects, an entire-state replacement fires reactive updates 20 times per second across all components that read any field.

**Why it happens:** `GameContainer.tsx` uses `createSignal` with the full state object. This is fine for Snusking (state updates happen a few times per minute). The arcade game inherits this pattern and the costs multiply.

**Consequences:**
- Score display re-renders 20 times per second even when the score hasn't changed
- Opponent bar positions re-render even when the player's own bar state is unchanged
- In Solid.js dev mode, the excessive re-renders are visible as reactive graph noise; in production they cause measurable frame drops at high object counts

**Prevention:**
- The arcade game's `GameContainer` branch should use `createStore` rather than `createSignal`. `createStore` allows surgical updates: `setStore('objects', id, 'y', newY)` updates only that path.
- Decompose the arcade state into logically stable regions: `{ objects: {...}, bars: {...}, score: {...}, phase: '...' }`. Objects change every tick; score changes on catch events; phase changes rarely. Components subscribe to the granularity they need.
- Do not apply this change to the existing Snusking state flow — it works fine with `createSignal` for the turn-based update cadence.

**Phase:** Client state management, before building the arcade component tree.

---

### Pitfall 12: Shared GameType Union Breaks TypeScript When Arcade Is Added

**What goes wrong:** `shared/src/types.ts` defines `type GameType = 'snusking'`. Adding `'snus-catcher'` to this union requires coordinated changes across: shared types, `GameContainer.tsx` (which branches on `gameType() === 'snusking'`), server `room.ts` (which reads `room.gameType`), the Prisma schema (if `gameType` is an enum at the database level), and any leaderboard queries filtered by game type. Missing any one of these causes silent runtime failures.

This is the same class of problem as existing PITFALLS.md Pitfall 9 — it recurs with each new game type added.

**Why it happens:** TypeScript's type union is a compile-time check. The database may store game type as a raw string, meaning a missing database migration is not caught by the type checker.

**Consequences:**
- Room start fails silently with `room:error` because `!gameRegistry[room.gameType]` evaluates as true for the new type
- The client's `GameContainer` falls through to the loading spinner because no `Show` branch matches the new game type
- Leaderboard entries are stored under the correct game type string but the UI never renders them because no filter matches

**Prevention:**
- Make this a checklist item for every new game type: add to (1) `GameType` union in shared types, (2) `gameRegistry` in `registry.ts`, (3) `GameContainer.tsx` with a new `Show` branch, (4) verify Prisma schema stores game type as a string (not an enum) to avoid migration requirements.
- Add a runtime assertion in `room:start` that throws a descriptive error (not a swallowed catch) when `gameType` is not in `gameRegistry`. This surfaces the registration gap immediately.

**Phase:** Platform integration, first task when adding the arcade game type.

---

### Pitfall 13: Object Spawn Randomness Diverges Between Players

**What goes wrong:** If each player's client independently generates falling object positions using `Math.random()`, their screens will show different objects in different positions. Catches will be impossible to validate because the server doesn't know where the objects are. Alternatively, if the server seeds object positions but uses `Math.random()` without a deterministic seed, server restarts or reconnects will produce different object sequences for players who rejoin.

**Why it happens:** Random number generation in game loops is easy to add without thinking about reproducibility or multi-player consistency.

**Consequences:**
- Player A sees a rare powerup falling at x=200; player B sees it at x=600 on their screen. Server checks collision at x=200 (its own random seed), player B misses because server disagrees on position.
- A reconnecting player sees a fresh random sequence of objects that doesn't match what the server currently has in play — they are catching different objects than the server knows about.

**Prevention:**
- Object spawn positions are generated exclusively by the server and included in the emitted state. Clients never generate object positions. The server's RNG state is authoritative.
- Use a seeded PRNG (e.g., a simple LCG with a per-game seed derived from room ID + session start timestamp) so that the object sequence for a given game is reproducible. This aids debugging and allows reconnecting clients to verify they are in sync.
- The state emitted to clients must include the current position and identity of every active falling object each tick (or just the diff). Clients render what the server sends — no client-side object simulation.

**Phase:** Server physics implementation, before any client rendering work.

---

## Minor Pitfalls

Mistakes that cause localized bugs or minor friction.

---

### Pitfall 14: Tick Rate Mismatch Between Animation and Server Updates

**What goes wrong:** If the server ticks at 20Hz (every 50ms) but the client rAF loop runs at 60fps, the client will receive 1 server update for every 3 animation frames. Without interpolation, falling objects will visually stutter — they jump by 3 ticks of distance every 3 frames rather than moving smoothly.

**Prevention:** The client rAF loop interpolates object positions between the last received server tick and the next expected one. Store the `lastTickTime` and `prevPositions` alongside `currentPositions`. Each rAF frame, compute `alpha = (now - lastTickTime) / TICK_DURATION_MS` and linearly interpolate between prev and current. This produces smooth 60fps visuals from 20Hz server updates.

**Phase:** Client rendering loop implementation.

---

### Pitfall 15: Mouse Position Not Adjusted for Canvas/Container Offset

**What goes wrong:** Mouse events give positions in viewport coordinates. The game container may be centered, padded, or scrolled. Using raw `event.clientX` as the bar position without subtracting the container's `offsetLeft` places the bar offset from where it should be.

**Prevention:** In the `mousemove` handler, subtract the container element's `getBoundingClientRect().left` from `event.clientX`. Store the container ref via Solid.js's `ref` attribute and read its bounding rect. Clamp the result to `[barHalfWidth, containerWidth - barHalfWidth]` to prevent the bar from leaving the play area.

**Phase:** Client input handling, first working build.

---

### Pitfall 16: Reconnect State Missing Arcade-Specific Snapshot

**What goes wrong:** The existing reconnect path in `room.ts` calls `turnEngine.projectState(userId)` — a `TurnBasedGameEngine`-specific method. If the arcade engine implements only the base `GameEngine` interface without a `projectState` equivalent, a reconnecting player gets no state snapshot and sees the loading spinner indefinitely.

**Prevention:** The arcade engine must implement `getState()` (the base interface) to return the current tick's full broadcast state. The `room:join` reconnect path in `room.ts` must be extended to handle `RealTimeGameEngine` types with a simple `engine.getState()` call, not just `TurnBasedGameEngine`. Add the instance check alongside the existing `TurnBasedGameEngine` check.

**Phase:** Reconnect handling, during server engine integration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Engine architecture decision | Forcing arcade loop into handleEvent (Pitfall 1) | Define server-owned tick loop in init(); handleEvent for discrete input only |
| Interface definition | Stretching existing GameEngine/TurnBasedGameEngine (Pitfall 2) | Define RealTimeGameEngine before writing engine code |
| Server physics loop | setInterval not stopped on game end or room teardown (Pitfall 6) | destroy() clears interval first; audit all room teardown paths |
| Socket.IO emit rate | Broadcasting 60fps state causes flooding and queue buildup (Pitfall 3) | 20 ticks/second; volatile flag for position data |
| Client authority model | Waiting for server echo before moving local bar (Pitfall 4) | Local bar is client-authoritative; only remote bars use server state |
| Client rendering | rAF loop not cleaned up on unmount (Pitfall 5) | onCleanup + mounted guard from day one |
| Canvas vs DOM decision | Switching rendering strategy mid-build (Pitfall 10) | Decide before first render: DOM + CSS transforms for Solid.js integration |
| Solid.js state | createSignal for full arcade state causes excessive re-renders (Pitfall 11) | createStore with fine-grained path updates for arcade component |
| Collision detection | Tunneling and simultaneous-catch resolution order (Pitfall 7) | Swept collision check; explicit tie-break policy documented before impl |
| Powerup timing | Client-side clock drift causing desync (Pitfall 8) | Tick-count-based expiry, never wall-clock |
| Game end on disconnect | 5-minute cleanup timer inherited from turn-based game (Pitfall 9) | Arcade engine signals immediate end; does not rely on cleanup timer |
| Object spawning | Client-side random generation diverges between players (Pitfall 13) | Server-only spawn; positions included in every emitted tick state |
| GameType registration | New type not propagated across shared/server/client (Pitfall 12) | Checklist: shared types + registry + GameContainer branch + Prisma string |
| Client animation smoothness | 20Hz server ticks produce stutter at 60fps without interpolation (Pitfall 14) | Linear interpolation in rAF loop between tick snapshots |
| Reconnect handling | Arcade engine has no projectState method (Pitfall 16) | Extend room:join reconnect path to handle RealTimeGameEngine.getState() |
| Mouse input | Raw clientX used without container offset subtraction (Pitfall 15) | getBoundingClientRect().left subtracted; result clamped to play area |

---

## Sources

**Confidence levels:**

- Pitfalls 1, 2, 3, 5, 6, 9, 12, 16: HIGH — Derived directly from codebase analysis of `server/src/socket/game.ts`, `room.ts`, `socket/index.ts`, `registry.ts`, `GameContainer.tsx`, `snusking/index.tsx`, and `shared/src/types.ts`. The code patterns and structural constraints cited are directly observable.
- Pitfalls 4, 7, 8, 10, 13, 14: HIGH — Standard established patterns in real-time multiplayer game development. Client-authoritative local bar, server-authoritative spawning, interpolation between server ticks, swept collision, and tick-based powerup timing are canonical solutions to canonical problems in this genre.
- Pitfalls 11, 15: MEDIUM — Solid.js-specific reactivity optimization and input coordinate handling. Patterns derived from Solid.js documentation conventions and DOM event handling fundamentals.

*Analysis performed from direct codebase reads. No external sources consulted in this session.*
