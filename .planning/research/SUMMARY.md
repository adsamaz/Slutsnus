# Project Research Summary

**Project:** Snus Catcher — 1v1 Real-Time Arcade Game
**Domain:** Real-time falling-object arcade game integrated into an existing turn-based multiplayer platform
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

Snus Catcher is a 1v1 real-time arcade game where each player controls a horizontal catch bar via mouse to collect fresh snus pouches while dodging spent ones. It is being added to a platform that already runs a turn-based card game (Snusking) with full auth, lobby, rooms, Socket.IO infrastructure, and leaderboard persistence. The core research conclusion is clear: Snus Catcher fits the existing `GameEngine` interface without modification and requires zero new npm packages. The implementation pattern is a server-owned `setInterval` tick loop at 20 Hz that drives physics and emits per-player projected state, paired with a canvas-based Solid.js client component running `requestAnimationFrame` at 60 fps with linear interpolation between server ticks.

The recommended approach is a strict server-authoritative model for scores and collisions, combined with client-authoritative bar position rendering to eliminate input lag. Object spawning, AABB collision detection, powerup activation, and win/loss determination all live on the server. The client renders what the server sends; the only client-side prediction is moving the local catch bar immediately on mouse input without waiting for a server echo. All four powerup types — Snus Rain, Narrow Curse, Shield, Score Multiplier — are implemented as catchable falling items rather than button-press activations, which preserves skill expression and eliminates a client-exploit vector.

The primary risks are architectural: the platform was designed around discrete turn-based actions, and retrofitting a continuous tick loop requires deliberate prevention of several failure modes. The tick loop must start in `engine.init()` and stop in `engine.destroy()`; state must be emitted only from the tick callback, never from `handleEvent`; the rAF loop on the client must be cleaned up in Solid.js `onCleanup`; powerup timing must use tick counts rather than wall-clock time. All 16 identified pitfalls are preventable with specific patterns documented in PITFALLS.md — none are open research questions.

---

## Key Findings

### Recommended Stack

The platform stack is fixed: TypeScript 5.7.3, Express, Socket.IO 4.8.1, Solid.js 1.9.3, Vite 6.1.0, Prisma 5.22.0. No new packages are needed. All required capabilities come from browser built-ins (Canvas 2D API, `requestAnimationFrame`, `pointermove` events) and Node.js built-ins (`setInterval`, `Math.random`).

See `.planning/research/STACK.md` for full rationale and all alternatives considered and rejected.

**Core technologies:**
- `setInterval` at 50ms (Node.js built-in): server-authoritative 20 Hz game tick — sufficient for straight-line falling physics, dramatically lower overhead than 60 Hz
- Canvas 2D API (browser built-in): game viewport rendering — avoids DOM layout recalculation at 60 fps for 10–30 moving objects
- `requestAnimationFrame` (browser built-in): client render loop at 60 fps with linear interpolation between 20 Hz server ticks
- `pointermove` events (browser built-in): unified mouse and touch input, manually throttled to match tick rate before emitting
- AABB collision (4 comparison expressions, no library): server-side hit detection — no physics library is justified for axis-aligned rectangles
- `game:action` / `game:state` (existing Socket.IO events): reused as-is; bar movement is a `game:action`, state ticks arrive as `game:state`

### Expected Features

See `.planning/research/FEATURES.md` for full feature tree, dependency graph, and per-component complexity estimates.

**Must have (table stakes):**
- Authoritative server game loop (tick-based, server-owned `setInterval`) — without this, clients desync immediately
- Server-managed per-player falling item spawning (positions generated server-side, never client-side)
- Mouse-controlled catch bar (client emits X position as fraction; server uses for collision only)
- Two item types: fresh snus (catch for points) vs spent snus (avoid, costs a life)
- Lives system (3 lives per player) — primary engagement and win condition driver
- Score accumulation — tiebreaker and engagement metric
- Win condition: first player to reach 0 lives loses; opponent wins
- Per-player isolated playfield — each player has their own lane; items are on a shared logical field, each player just has their own bar
- Score and lives HUD with real-time opponent status visible at all times
- Game end screen with result — wires to existing `game:end` and leaderboard write
- Reconnect/rejoin support — state snapshot resent on socket reconnect (existing pattern)

**Should have (differentiators):**
- Powerup: Snus Rain — fresh-snus burst in catcher's lane for 5 seconds
- Powerup: Narrow Curse — shrinks opponent bar width 50% for 8 seconds
- Powerup: Shield — absorbs the next 1 spent-snus hit
- Powerup: Score Multiplier — 2x points for 6 seconds, enables Snus Rain synergy
- Powerups as catchable falling items (not button-press) — skill expression preserved
- Speed escalation over time — linear fall speed increase per tick count
- Opponent status visibility (lives, active effects) in real time
- Snus-themed visual identity (fresh vs spent pouches visually distinct)

**Defer (post-MVP):**
- Powerup balance tuning (durations, spawn rates, width modifier percentages) — requires playtesting data
- Speed escalation curve tuning — start with a linear formula, adjust from real sessions
- Visual polish with brand-specific snus art — functional placeholder assets ship first
- Mobile touch controls — mouse/trackpad mechanic requires a different interaction model

### Architecture Approach

The game follows a layered architecture with strict separation between server physics (pure functions in `physics.ts` and `powerups.ts`), the engine orchestrator (`engine.ts` implementing `GameEngine`), and a canvas-based client component tree. The `GameEngine` interface already supports both paradigms — the arcade engine is identical in contract to the existing Snusking engine but adds a server-side `setInterval` tick loop inside `init()` and `destroy()`. Three existing files require modification; nine new files are created.

See `.planning/research/ARCHITECTURE.md` for the full component map, data flow diagrams, and the recommended 7-layer build order.

**Major components:**
1. `SenusCatcherEngine` (`server/src/games/snus-catcher/engine.ts`) — tick loop, master state, per-player state projection, win/loss detection; orchestrates physics and powerups
2. `physics.ts` / `powerups.ts` (`server/src/games/snus-catcher/`) — pure functions: spawn objects, advance Y positions, check AABB collisions, apply and tick powerup effects; independently unit-testable
3. `ArcadeCanvas.tsx` (`client/src/games/snus-catcher/`) — canvas renderer with rAF loop and client-side Y interpolation between server ticks
4. `PowerupHUD.tsx` + `OpponentStrip.tsx` — reactive Solid.js DOM overlays positioned over the canvas; updated via signals, not rAF
5. `SenusCatcherGame` root component (`index.tsx`) — orchestrates mouse input throttling, `sc:bar-move` action emission, and child component wiring into `GameContainer`

**Modified files (minimal surface area):**
- `shared/src/types.ts` — add `'snus-catcher'` to `GameType`, add `SenusCatcher*` types and export `TICK_MS` constant
- `server/src/games/registry.ts` — one-line addition: `'snus-catcher': SenusCatcherEngine`
- `client/src/games/GameContainer.tsx` — generalize state signal type, add `snus-catcher` rendering branch

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all 16 pitfalls with full prevention strategies and phase-specific warnings.

1. **Server tick loop driven by client events** — the physics loop must be owned by the server (`setInterval` in `init()`); `handleEvent` stores bar position only and never triggers emission or tick advancement
2. **`setInterval` not stopped on game end or room teardown** — `destroy()` must call `clearInterval` as its first action; audit all room teardown paths; add `this.ended` guard at the top of every tick callback
3. **Socket.IO flooding from high-frequency state broadcasts** — emit state only from the 20 Hz tick, never from `handleEvent`; use Socket.IO `volatile` flag for position data to prevent queue buildup under latency
4. **Client bar position waiting for server echo** — local bar is client-authoritative (render at mouse position immediately); server receives bar X for collision only and never echoes it back to override the visual
5. **rAF loop not cleaned up on Solid.js component unmount** — `onCleanup(() => cancelAnimationFrame(rafId))` from day one; add a `mounted` boolean guard inside the rAF callback as belt-and-suspenders
6. **Powerup timing via wall clock** — powerup expiry must use `expiresAtTick: number`; client displays `(expiresAtTick - currentTick) * TICK_MS`; wall-clock drift between clients makes timer displays diverge

---

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the phase-specific warnings in PITFALLS.md, a 4-phase structure is recommended.

### Phase 1: Foundation — Shared Types and Engine Registration

**Rationale:** All other layers import from shared types. The `GameType` registration must happen as a single coordinated change to avoid the cascading silent failures described in Pitfall 12. The engine skeleton (with a real tick loop but placeholder physics) confirms the integration seam works before physics is built on top of it.

**Delivers:** `'snus-catcher'` registered across shared types, game registry, GameContainer, and Lobby UI; `SenusCatcherEngine` stub with a running `setInterval` tick loop emitting placeholder state; one browser tab can enter a snus-catcher room and receive ticks; TypeScript compiles clean across all layers.

**Addresses:** Infrastructure prerequisites for all table-stakes features; `GameType` propagation across shared/server/client/DB.

**Avoids:** Pitfall 12 (uncoordinated GameType registration causes silent `room:error` failures), Pitfall 2 (using TurnBasedGameEngine interface for an arcade engine).

**Research flag:** Standard patterns — direct codebase analysis is authoritative. No additional research needed.

---

### Phase 2: Server Physics — Core Game Loop

**Rationale:** Physics and powerup logic must be proven correct in isolation (unit-tested pure functions) before the client renders anything. Collision bugs are far harder to debug once a visual layer exists. Speed escalation and the lives system are part of the server loop, not the UI, so they belong here.

**Delivers:** `physics.ts` and `powerups.ts` with unit tests covering edge cases (tunneling, simultaneous hits, simultaneous-catch resolution); `SenusCatcherEngine` with real object spawning, AABB collision, lives deduction, score accumulation, speed escalation, all four powerup types, and win/loss detection; two players can play a fully functional (visually unpolished) game in two browser tabs.

**Addresses:** Authoritative server game loop, server-managed item spawning, two item types, lives system, score accumulation, speed escalation, win condition, powerup effects.

**Avoids:** Pitfall 1 (arcade loop forced into handleEvent), Pitfall 6 (setInterval not stopped), Pitfall 7 (collision tunneling and simultaneous-catch resolution order), Pitfall 13 (client-side random spawn), Pitfall 8 (powerup timing desync), Pitfall 9 (game continuing 5 minutes after disconnect).

**Research flag:** Standard patterns — AABB collision, setInterval game loops, per-player state projection are textbook. Unit test edge cases before integration.

---

### Phase 3: Client Rendering — Canvas, HUD, and Input

**Rationale:** The canvas renderer and HUD components require finalized types (Phase 1) and benefit from a running server (Phase 2) for integration testing, but can be developed against a mock state signal. The canvas vs DOM decision (canvas for game viewport, Solid.js signals for HUD overlays) must be settled before this phase begins — switching mid-build is Pitfall 10.

**Delivers:** `ArcadeCanvas.tsx` with rAF loop, client-side Y interpolation, and bar rendering; `PowerupHUD.tsx` (lives, score, active powerup timers as reactive DOM); `OpponentStrip.tsx` (opponent score and curse indicator); `EndScreen.tsx`; mouse input throttling and `sc:bar-move` action emission; full end-to-end playable game in two browser tabs with 60 fps smooth motion.

**Addresses:** Mouse-controlled catch bar, per-player HUD, opponent status visibility, game end screen, reconnect support, smooth visuals.

**Avoids:** Pitfall 4 (bar waiting for server echo), Pitfall 5 (rAF not cleaned up), Pitfall 10 (canvas vs DOM regret), Pitfall 11 (createSignal for full arcade state causing excessive reactive propagation), Pitfall 14 (20 Hz ticks producing stutter at 60 fps without interpolation), Pitfall 15 (raw clientX without container offset subtraction).

**Research flag:** The interpolation feel (linear vs eased alpha curve) requires playtesting to tune. Start with linear lerp (`prev + (curr - prev) * alpha`) and adjust from real sessions.

---

### Phase 4: Powerup Polish, Balance, and Visual Identity

**Rationale:** Powerups depend on a stable physics layer (Phase 2) and a working client (Phase 3). Balance values (durations, spawn rates, width modifier percentages) require playtesting data — implementing them last allows tuning against real gameplay. Visual polish (brand-specific assets, CSS identity) is cleanly separable and belongs at the end.

**Delivers:** All 4 powerup types tuned from playtesting; powerup effect durations as named constants (adjustable); opponent Narrow Curse visual indicator; snus-themed visual assets for fresh/spent/powerup items; CSS polish and brand identity.

**Addresses:** Full powerup differentiator set (Snus Rain, Narrow Curse, Shield, Score Multiplier), snus-themed visual identity.

**Avoids:** Pitfall 8 (powerup timing desync — tick-based expiry enforced from Phase 2; Phase 4 only tunes the constants).

**Research flag:** Powerup balance values are LOW confidence starting points. Treat initial durations and rates as hypotheses. Plan an explicit tuning pass after first 3–5 real sessions.

---

### Phase Ordering Rationale

- Types before everything: all layers depend on shared type contracts; uncoordinated `GameType` additions cause silent runtime failures that TypeScript cannot catch at the DB layer
- Server physics before client: collision correctness is far easier to verify with unit tests in isolation than end-to-end; a bug in `physics.ts` caught by a unit test takes 5 minutes to fix; the same bug found during client development takes hours
- Core loop before powerups: powerup effects layer onto a stable physics foundation; adding powerup complexity to an unstable loop multiplies debugging surface
- Polish last: placeholder assets ship a functional game; polished assets on a broken physics engine do not

### Research Flags

Phases with well-documented patterns (skip additional research):
- **Phase 1:** Existing codebase fully audited; `GameType` registration pattern is fully known and documented
- **Phase 2:** AABB collision, setInterval game loops, per-player state projection — canonical patterns; no research needed
- **Phase 3:** Canvas 2D API, rAF loop, Solid.js `onMount`/`onCleanup` — established patterns; `snusking/index.tsx` provides working templates in the existing codebase

Phases requiring iteration rather than research:
- **Phase 4:** Powerup balance constants (durations, spawn rates, width modifier percentages) are LOW confidence and must be tuned from playtesting data, not researched

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All capabilities use browser/Node.js built-ins and existing platform packages. No new dependencies. Derived from direct codebase read confirming zero utility library usage in existing game files. |
| Features | HIGH | Table stakes derived from genre conventions and full codebase audit. Powerup balance values (durations, width modifiers) are MEDIUM — require playtesting validation before treating as final. |
| Architecture | HIGH | `GameEngine` interface, socket routing, per-player state projection all directly audited from source. Component structure follows existing Snusking pattern with documented, deliberate deviations. |
| Pitfalls | HIGH | 12 of 16 pitfalls derived directly from codebase analysis. 4 from established real-time multiplayer game development canon. All have specific, tested prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Powerup balance values:** Snus Rain duration (5s starting point), Narrow Curse width modifier (50% starting point), Shield single-hit absorption, Score Multiplier duration (6s/8s) — genre convention starting points, not validated. Keep as named constants from day one; tune after first real sessions.
- **Client interpolation feel:** The alpha curve for Y-position interpolation (linear vs ease-out) affects perceived game smoothness. Start with linear lerp; evaluate after seeing motion quality under real network conditions.
- **Tick rate:** 20 Hz (50ms) is the recommendation; ARCHITECTURE.md notes 30 Hz (33ms) as a valid alternative with marginally smoother feel at slightly higher CPU cost. Validate with profiling under real network conditions, not local loopback.
- **Lobby game type selection UI:** Adding `'snus-catcher'` as a selectable game type may require a client-side UI change and potentially a REST route change at room creation. Confirm scope of this change in Phase 1.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: `server/src/games/registry.ts`, `server/src/games/snusking/engine.ts`, `server/src/socket/game.ts`, `server/src/socket/room.ts` — `GameEngine` interface contract, per-player `onStateUpdate` routing, tick loop patterns
- Direct codebase analysis: `client/src/games/GameContainer.tsx`, `client/src/games/snusking/index.tsx` — existing rAF animation patterns, `game:state` reception, `onCleanup` socket teardown
- Direct codebase analysis: `shared/src/types.ts` — `GameType` union, `ServerToClientEvents`, `ClientToServerEvents`
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md` — platform integration contracts

### Secondary (MEDIUM confidence)

- Genre conventions: falling-object arcade games (Breakout, Tetris, Fruit Ninja browser ports) — server-tick plus client-render separation, lives-based win conditions, powerup design patterns
- Established real-time multiplayer patterns: client-authoritative local input with server-authoritative scoring, AABB swept collision, tick-based powerup timing, hybrid authority model

### Tertiary (LOW confidence)

- Powerup balance values — starting points from similar genre titles; require playtesting validation before treating as final
- Client interpolation feel (linear vs eased alpha) — aesthetic judgment requiring real-session evaluation

---

*Research completed: 2026-03-14*
*Ready for roadmap: yes*
