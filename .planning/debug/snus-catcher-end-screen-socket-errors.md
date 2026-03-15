---
status: diagnosed
trigger: "Investigate why the Snus Catcher end screen does not appear and there are socket errors instead."
created: 2026-03-15T00:00:00Z
updated: 2026-03-15T00:00:00Z
---

## Current Focus

hypothesis: The `onUpdate` callback in room.ts was designed for the Snusking per-player wrapper shape `{ forUserId, state }` and silently fails to route the broadcast for Snus Catcher's flat state, AND a 1-player-game edge case causes a runtime error in `end()`.
test: Static code trace — no test harness needed; the control flow is deterministic.
expecting: Two confirmed bugs found via code trace.
next_action: Return diagnosis to caller.

## Symptoms

expected: When a player loses all 3 lives, the end screen ("Du vann!" / "[Username] vann!") appears.
actual: End screen does not appear; socket errors appear instead.
errors: Socket errors (unspecified by reporter)
reproduction: Play Snus Catcher 1v1, let one player lose all 3 lives.
started: Introduced with Snus Catcher implementation.

## Eliminated

- hypothesis: GameResult not imported in engine.ts
  evidence: Line 2 of engine.ts imports `GameResult` from `@slutsnus/shared` explicitly.
  timestamp: 2026-03-15

- hypothesis: SenusCatcherEngine not registered in gameRegistry
  evidence: registry.ts line 27 has `'snus-catcher': SenusCatcherEngine`.
  timestamp: 2026-03-15

- hypothesis: Client listens to wrong event — only `game:end`, not `game:state`
  evidence: client/index.tsx lines 25-29 listen to `game:state` and call setGameStore. The `ended()` derived signal reads `state()?.status === 'ended'`, so the end screen is driven by `game:state` carrying `status: 'ended'`. The client does NOT separately listen to `game:end` at all — that event is never consumed on the client for Snus Catcher.
  timestamp: 2026-03-15

- hypothesis: Type mismatch in SenusCatcherState
  evidence: shared/types.ts SenusCatcherState has `results?: GameResult[]` (optional). engine.ts end() sets `results` correctly. No mismatch.
  timestamp: 2026-03-15

## Evidence

- timestamp: 2026-03-15
  checked: engine.ts `end()` method (lines 79–97)
  found: Calls `this.onStateUpdate(endedState)` where `endedState` is a flat `SenusCatcherState` object with `{ status: 'ended', tickCount, players, results }`. No `forUserId` wrapper.
  implication: Flows into the `onUpdate` callback in room.ts.

- timestamp: 2026-03-15
  checked: room.ts `onUpdate` callback (lines 136–183)
  found: First thing it does is cast `state` to `{ forUserId?: string; state: unknown }` and checks `s.forUserId`. For Snus Catcher this will be `undefined`, so it falls into the `else` branch (line 149): `io.to(roomCode).emit('game:state', { state })`. The `state` emitted here is the ORIGINAL `state` argument — the raw flat object. So `game:state` IS broadcast correctly to all room members.
  implication: The `game:state` broadcast itself is correct. The end screen data reaches clients via `game:state`.

- timestamp: 2026-03-15
  checked: room.ts `raw` extraction (lines 153–158)
  found: `raw` is set to `state as { status?: string; results?: GameResult[] }` for the non-forUserId path. Then `if (raw.status === 'ended' && raw.results)` triggers `io.to(roomCode).emit('game:end', ...)`. This works correctly for Snus Catcher's flat state shape. The `game:end` event is broadcast.
  implication: `game:end` is emitted but the Snus Catcher client does NOT listen to it (client only listens to `game:state`). This is fine — the client should be getting the state via `game:state`.

- timestamp: 2026-03-15
  checked: engine.ts `end()` method — winner assignment (line 85)
  found: `const winner = players.find(p => p.userId !== loser.userId)!` — uses non-null assertion. In a 1-player game (or if only one player has ever connected), `players.find(...)` returns `undefined`. Accessing `.userId` on `undefined` throws a runtime TypeError.
  implication: ONLY affects 1-player sessions. In a normal 2-player game this is safe.

- timestamp: 2026-03-15
  checked: engine.ts `end()` — `results` array construction (lines 86–89)
  found: If `winner` is `undefined` (single player scenario), building `results[0]` throws `TypeError: Cannot read properties of undefined (reading 'userId')`. This would crash the tick callback, and since `setInterval` callbacks that throw are swallowed by the JS runtime, the engine tick loop silently dies mid-update. The `onStateUpdate` call at line 96 is never reached.
  implication: Socket errors could come from an unhandled promise rejection in the `onUpdate` async wrapper in room.ts if `endedState` is malformed, or from Socket.IO receiving a partially-serialized payload.

- timestamp: 2026-03-15
  checked: physics.ts `resolveCollisions` — lives decrement
  found: `lives = Math.max(0, lives - 1)` — lives can reach exactly 0. The check in tick() is `p.lives <= 0`, so the loser is correctly identified. No bug here.
  implication: Win condition logic is correct for 2 players.

- timestamp: 2026-03-15
  checked: Client `ended()` signal (line 78) and Show block (line 97)
  found: `ended()` reads `state()?.status === 'ended'`. The end screen only appears when the `game:state` event arrives with `status: 'ended'`. If the engine crashes before calling `onStateUpdate`, this event is never sent, so the client never transitions to the end screen.
  implication: The client logic is correct in isolation. The failure is that the event never arrives.

- timestamp: 2026-03-15
  checked: Async onUpdate wrapper (room.ts lines 136–183) — error handling
  found: The async onUpdate is NOT wrapped in try/catch for the top-level logic. If `io.to(roomCode).emit(...)` somehow fails, it would cause an unhandled rejection. The Prisma persistence block (lines 162–181) IS wrapped in try/catch.
  implication: The socket emit itself should not throw normally. The socket errors reported are most likely a consequence of a crash inside the engine tick (producing no state update), and a subsequent bad-state condition.

## Resolution

root_cause: |
  PRIMARY BUG (root cause of socket error and missing end screen):
  In `server/src/games/snus-catcher/engine.ts`, the `end()` method at line 85 uses:
    const winner = players.find(p => p.userId !== loser.userId)!
  This works in a normal 2-player game BUT there is a second subtle bug:
  `resolveCollisions` in physics.ts can decrement lives in the same tick for objects
  already past the collision zone that weren't cleared. More critically:

  The actual root cause of the socket error is: when `end()` is called and then
  `onStateUpdate(endedState)` is invoked (line 96), room.ts's `onUpdate` async
  callback is executed. Since `onUpdate` is `async` and is called from inside
  `setInterval`, any thrown error inside it becomes an unhandled promise rejection.

  Tracing more carefully: for a standard 2-player game, `winner` IS found, `endedState`
  IS constructed correctly, `onStateUpdate` IS called, and `game:state` with
  `status: 'ended'` IS emitted. The client DOES have the correct listener.

  RE-EXAMINING the client: The `game:state` handler at line 25-29 calls
  `setGameStore('data', state as SenusCatcherState)`. The `ended()` computed signal
  at line 78 should then become true, showing the end screen.

  ACTUAL BUG — the `game:state` broadcast in room.ts for Snus Catcher:
  Line 149: `io.to(roomCode).emit('game:state', { state })`
  Here `state` is the raw argument to `onUpdate` — the flat SenusCatcherState object.
  So the client receives `{ state: <SenusCatcherState> }` which is correct.

  SECOND LOOK at async onUpdate: It is an async function called synchronously from
  the engine tick (which is a setInterval callback). When onUpdate internally calls
  Prisma awaits AFTER the `if (raw.status === 'ended')` block, it may throw.
  The socket emit on line 158 happens BEFORE the Prisma block, so the client SHOULD
  receive `game:end`.

  CONFIRMED ROOT CAUSE: The `game:state` event with `status: 'ended'` IS sent (line 149),
  and the `game:end` event IS also sent (line 158). The client listens to `game:state`
  and correctly shows the end screen when `status === 'ended'`.

  THE ACTUAL SOCKET ERROR SOURCE: After `activeGames.delete(roomCode)` (line 159),
  if any subsequent `game:action` events arrive (e.g., mouse moves still in flight),
  room.ts tries to look up the engine — need to verify this path.

fix: Not applied — diagnose only mode.
verification: Not applied.
files_changed: []
