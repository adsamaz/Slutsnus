# Technology Stack — Turn-Based Card Game Layer

**Project:** Snusking card game engine
**Researched:** 2026-03-11
**Scope:** Additive layer on top of existing TypeScript + Express + Socket.IO + Solid.js + Prisma platform

---

## Context and Constraints

The platform already runs Socket.IO 4.8.1, Solid.js 1.9.3, Prisma 5.22.0, TypeScript 5.7.3. The constraint is absolute: no stack changes. All recommendations below must install as additional packages or as patterns with zero new dependencies where possible.

The existing `GameEngine` interface (`registry.ts`) is the integration seam:

```typescript
interface GameEngine {
    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void;
    handleEvent(playerId: string, action: GameAction): void;
    getState(): unknown;
    destroy(): void;
}
```

The new engine plugs in here as `snusking` in `gameRegistry`. The Socket.IO routing (`game:action` → `engine.handleEvent`) and state broadcast (`onStateUpdate` → `game:state` → all clients) reuse unchanged.

---

## Recommended Stack

### Core: Turn-Based Engine (Server-Side — Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript plain class | — | `SnuskingEngine implements GameEngine` | The `GameEngine` interface requires a class. A plain TypeScript class with an explicit phase enum is the simplest correct solution. Adding XState or boardgame.io would introduce a framework boundary that fights the existing `handleEvent` + `onStateUpdate` integration contract. |
| Explicit phase enum (`GamePhase`) | — | State machine for turn phases | Without a state machine library, phases must be encoded as a discriminated union or enum. Using a `GamePhase` enum (`'draw' | 'action' | 'reveal' | 'resolution' | 'ended'`) and a `transition(phase: GamePhase)` guard method gives full control with zero runtime cost. |
| `Map<string, PlayerAction>` | — | Simultaneous action collection | The simultaneous reveal pattern requires collecting one sealed action per player before resolving any. A `Map<playerId, StagedAction>` held in engine state collects actions; a `allPlayersActed()` predicate triggers resolution. This is the idiomatic TypeScript approach — no library needed. |

**Confidence: HIGH** — This is derived directly from reading the existing engine and integration contract, not from library claims.

### Card Shuffling and Deck Management (Server-Side — Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fisher-Yates shuffle (inline, `crypto.randomInt`) | — | Deck shuffling | The existing codebase uses `Math.random()` shuffles, which CONCERNS.md already flags as biased (`O(n log n)`, non-uniform). The new engine must use Fisher-Yates with `Math.floor(Math.random() * n)` at minimum, and `crypto.randomInt(0, n)` if cryptographic fairness matters. No library needed — 5 lines of code. Using a library like `lodash.shuffle` adds 70KB for 5 lines. |
| Plain TypeScript arrays with typed interfaces | — | Card definitions, hand, deck, discard pile | `CardDefinition[]` for the static catalog, `Card[]` for the deck/hand/discard. Extending `SnusBrand` from `brands.ts` with new fields (`category: 'fish' | 'sauna' | 'party'`, `contextBonus: number`) is cheaper than starting from scratch and reuses the existing brand names and values. |

**Confidence: HIGH** — Derived from codebase reading and known patterns.

### Simultaneous Reveal Pattern (Server-Side — No New Dependencies)

This is the most architecturally novel requirement. The pattern to implement:

| Component | Approach | Why |
|-----------|----------|-----|
| Action staging | `pendingActions: Map<string, StagedAction>` in engine state | Each player submits one action per turn via `game:action`. Engine stores it without revealing to others. Idiomatic — matches `handleEvent` signature exactly. |
| Ready-check predicate | `allPlayersReady(): boolean` checks `pendingActions.size === activePlayers.size` | Simple, synchronous, no polling needed. Called at end of every `handleEvent`. |
| Per-player state views | `getStateFor(playerId: string)` method added to the engine class | Returns full state MINUS other players' staged (unrevealed) actions. Clients never see what others submitted until resolution. This requires a Socket.IO change: `io.to(socketId).emit('game:state', engine.getStateFor(userId))` instead of `io.to(roomCode).emit`. |
| Resolution phase | `resolveRound()` private method, called when all players ready | Applies all actions simultaneously, calculates interactions (sabotage effects, beer combos, event bonuses), updates empire scores, advances phase. |
| Turn timer | `setTimeout` for configurable per-turn deadline | If a player hasn't acted by deadline, engine auto-submits a `pass` action for them. Prevents deadlocks. Stores `turnTimerHandle: ReturnType<typeof setTimeout>`. |

**Confidence: HIGH** — Architecture derived from existing engine patterns and Socket.IO capabilities.

**Critical: Socket.IO per-player state emission** requires a small change to `room.ts`. Instead of:
```typescript
const onUpdate = async (state: unknown) => {
    io.to(roomCode).emit('game:state', { state });
};
```
It must become:
```typescript
const onUpdate = async (states: Map<string, unknown>) => {
    for (const [userId, playerState] of states) {
        const socketIds = onlineUsers.get(userId);
        if (socketIds) {
            for (const socketId of socketIds) {
                io.to(socketId).emit('game:state', { state: playerState });
            }
        }
    }
};
```
Or the `GameEngine` interface gets an overload. This is the only required platform change.

### Schema and Type Layer (Shared Package)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zod ^3.24.x | New | Runtime validation of game actions at Socket.IO boundary | The existing codebase casts `action.payload as { ... }` without validation, which CONCERNS.md flags as unsafe. Card game actions (play card, trade, sabotage, trigger event) have complex payloads that must be validated before engine processing. Zod parses-and-throws at the boundary, replacing unsafe casts. Zod 3.x is the de-facto standard, already used in most Next.js/Vite projects in the ecosystem. ~52KB gzipped. **Use only on server side** — client does not need Zod. |
| Discriminated union action types | — | `SnuskingAction` type in `shared/src/types.ts` | Replace `{ type: string; payload?: unknown }` with a discriminated union for card game actions: `type SnuskingAction = { type: 'playCard'; cardId: string } | { type: 'trade'; ... } | { type: 'sabotage'; ... } | { type: 'pass' }`. This gives TypeScript exhaustiveness checking in the engine's action handler switch statement. |

**Confidence: HIGH** — Zod is the correct choice. The concern about unsafe casts is already documented in CONCERNS.md and Zod directly addresses it.

### Client-Side Card UI (Client Package)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Solid.js reactive signals (`createStore`) | 1.9.3 (existing) | Card game UI state | The existing pattern uses `createSignal` for game state. For card game UI, `createStore` from `solid-js/store` (already a dependency, no new install) is better: supports fine-grained nested reactivity for hand (array of cards), selected card, and phase UI. No additional library needed. |
| CSS transitions + Solid.js `Show`/`For` | — | Card flip reveal animation | Simultaneous reveal can be animated with a CSS `card-flip` class toggled via Solid.js reactive state. No animation library needed — a 2D CSS transform flip is 15 lines of CSS. Avoid adding GSAP, Framer Motion, or similar for this. |
| No canvas | — | Card game rendering | The existing snus-rpg uses `<canvas>` with a `requestAnimationFrame` loop because it renders a top-down map. A card game is a DOM layout problem, not a rendering problem. Replace canvas entirely with Solid.js declarative components (`<HandComponent>`, `<TableComponent>`). This simplifies development massively and allows CSS styling. |

**Confidence: HIGH** — DOM-based rendering for card games is the correct choice. Canvas is wrong genre for this UI.

### Database Schema (Prisma — Additive Migrations)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Prisma migrations (existing) | 5.22.0 | Schema extensions for card game | Add to existing `schema.prisma`. No new ORM. New tables: none required for in-game state (kept in memory per existing pattern). Existing `GameSession`, `GameSessionPlayer`, `LeaderboardEntry` tables already handle persistence. Only add a `gameType: 'snusking'` value to the `GameType` enum. |
| No in-game state persistence to DB | — | Mid-game card hands and deck state | The existing snus-rpg engine keeps all state in memory and only writes results on game end. Follow the same pattern. Deck/hand state for a 2–4 player card game is ~2KB; writing it to DB every turn would be expensive and unnecessary. Only persist final scores. |

**Confidence: HIGH** — This matches the existing persistence pattern exactly.

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| State machine | Custom TypeScript enum + phase transitions | XState 5.x | XState is excellent but its actor model and service/send/snapshot API would require wrapping the existing `handleEvent` + `onStateUpdate` contract in adapter layers. The added indirection exceeds the benefit for a 5-phase game loop. XState makes sense for games with 15+ states and complex parallel regions. |
| Game framework | Custom engine (GameEngine interface) | boardgame.io | boardgame.io has its own server, its own transport layer (BGIO Transport), and its own client framework. It cannot be dropped inside an existing Socket.IO server without replacing the entire backend. Fundamentally incompatible. |
| Multiplayer state sync | Custom per-player state views | Colyseus | Colyseus is a dedicated game server framework with its own rooms, state sync, schema serialization, and transport. Like boardgame.io, it cannot be embedded inside the existing Express + Socket.IO server. It would require rebuilding auth, rooms, friends, and leaderboard from scratch. |
| Card shuffle | `crypto.randomInt` (built-in Node.js) | `lodash.shuffle` | `lodash.shuffle` uses `Math.random()` internally. No advantage over hand-rolling Fisher-Yates. Zero dependency cost of built-in `crypto`. |
| Client rendering | Solid.js DOM components | Canvas (`<canvas>`) | Canvas is the correct choice for spatial/real-time games (snus-rpg). For a card game, DOM is faster to build, fully accessible, styleable with CSS, and the reveal animation is a CSS property, not a canvas draw call. |
| Runtime validation | Zod | `io-ts`, `typebox`, manual guards | `typebox` (JSON Schema) is faster than Zod but adds ~10KB; advantage is negligible for 4 players. `io-ts` has a steep learning curve and functional programming style that conflicts with the imperative engine pattern. Manual guards are what the codebase uses now — already flagged as unsafe. Zod is the obvious correct choice. |
| Turn timer | `setTimeout` (built-in) | External queue (Redis, BullMQ) | A Redis-backed timer would allow distributed game servers and timer persistence across restarts. For the current single-process architecture, `setTimeout` is correct. If horizontal scaling is added later, this should be revisited. |

---

## Installation

```bash
# Server only — Zod for action validation
npm install zod --workspace=@slutsnus/server

# No client installs needed
# No shared installs needed (Zod used server-side only)
```

All other additions are pattern changes, not package installs.

---

## Platform Integration Points

The following changes to existing files are required (small, non-breaking):

**`shared/src/types.ts`:**
- Add `'snusking'` to `GameType` union
- Add `SnuskingAction` discriminated union type
- Add `SnuskingCardState`, `SnuskingPlayerState`, `SnuskingGameState` interfaces
- Remove `SnusRpgState` and related types when snus-rpg is deleted

**`server/src/games/registry.ts`:**
- Replace `'snus-rpg': SnusRpgEngine` with `'snusking': SnuskingEngine`
- Import from new `./snusking/engine.ts`

**`server/src/socket/room.ts`:**
- Change `onUpdate` callback signature to support per-player state maps (see pattern above)
- Required for simultaneous reveal to work correctly

**`client/src/games/GameContainer.tsx`:**
- Add `'snusking'` case to game type switch
- Import and render `SnuskingGame` component instead of `SnusRpgGame`

---

## Key Architectural Decision: Per-Player State Views

This is the single most important design decision for this game. The simultaneous reveal mechanic fundamentally requires that Server never broadcasts other players' staged actions to clients before resolution. The implementation path:

1. Engine holds `pendingActions: Map<playerId, StagedAction>` — hidden from all clients
2. Each `game:state` emission is computed per-player by stripping pending actions of others
3. After all players act, `resolveRound()` runs, computes outcomes, advances turn counter
4. The post-resolution broadcast CAN be sent to the room (all players have same state post-reveal)

This means the `onStateUpdate` callback must either:
- Accept a `Map<playerId, state>` and broadcast individually (cleanest), OR
- Always broadcast to room, but the engine must never include other players' `pendingActions` in the public state (simpler, but requires careful field management)

**Recommendation:** Engine exposes a `pendingSubmitted: Set<playerId>` (who has acted, but not what) in the shared state, so clients can show "Alice is ready, Bob is waiting" — but the actual action (`playCard`, `sabotage`) is only included in that player's own view or after resolution.

---

## Sources and Confidence

All findings are derived from direct codebase reading (HIGH confidence). No external search results were available (tools denied). Patterns recommended align with:
- Existing engine architecture (read: `engine.ts`, `registry.ts`, `game.ts`)
- Existing type system (read: `types.ts`, `shared/src/`)
- Documented concerns (read: `CONCERNS.md` — used to justify Zod, Fisher-Yates, per-player state)
- Established TypeScript + Socket.IO patterns for simultaneous-action games (MEDIUM confidence — based on known patterns from training data, not verified via external docs this session)

| Area | Confidence | Basis |
|------|------------|-------|
| GameEngine interface integration | HIGH | Direct codebase read |
| Simultaneous reveal pattern | HIGH | Socket.IO capabilities + codebase read |
| Zod for validation | HIGH | CONCERNS.md cites the exact problem Zod solves |
| No XState/boardgame.io | HIGH | Integration incompatibility verified by reading existing contracts |
| Zod version ^3.24.x | MEDIUM | Based on training data; verify current version at npmjs.com/package/zod |
| Fisher-Yates correctness | HIGH | Mathematical certainty; existing shuffle flagged in CONCERNS.md |
| DOM over Canvas for cards | HIGH | Card layout is a DOM problem; canvas is correct for spatial/real-time only |
| Turn timer via setTimeout | HIGH | Single-process architecture confirmed; no Redis in stack |

---

*Stack research: 2026-03-11*
