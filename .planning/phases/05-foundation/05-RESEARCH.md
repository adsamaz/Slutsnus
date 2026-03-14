# Phase 5: Foundation - Research

**Researched:** 2026-03-14
**Domain:** Multi-game platform extension — adding a second `GameType` to an existing TypeScript monorepo
**Confidence:** HIGH

## Summary

Phase 5 registers Snus Catcher as a second selectable game type on the platform. The work is almost entirely structural: extend the `GameType` union, wire up a stub engine that emits 20 Hz ticks, register it in the game registry, update `GameContainer` to route to the new game component, and add the game card to the `GAMES` array in `Home.tsx`. The Lobby page requires a display update for the new game type badge.

The defining risk of this phase is the **atomicity constraint**: `GameType` is a string literal union in `shared/src/types.ts` that is consumed in at least four places. If any of those four files lags, TypeScript errors cascade silently at runtime because the registry lookup is a `Record<string, ...>` (not type-checked at the call site). The locked decision from STATE.md mandates that all four files — shared types, server registry, `GameContainer`, and Lobby UI — are updated in a single commit.

The stub engine must satisfy the `GameEngine` interface (`init`, `handleEvent`, `getState`, `destroy`) and begin emitting `game:state` events to both sockets at 20 Hz via `setInterval` once `init` is called. This is sufficient to satisfy the phase success criterion "server emits game ticks to both sockets." No gameplay logic is needed in Phase 5; that is Phase 6's responsibility.

**Primary recommendation:** Implement Phase 5 as a single atomic commit touching all four propagation points simultaneously, with a minimal `SenusCatcherEngine` stub that ticks via `setInterval` at 50 ms.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GAME-01 | Player can join a Snus Catcher 1v1 match from the lobby | Requires `GameType` union expansion + `gameRegistry` entry + Home.tsx game card + room creation flow already handles arbitrary `GameType` strings via Prisma `String` column |
| PLAT-01 | Snus Catcher appears as a selectable game in the lobby | Home.tsx `GAMES` array drives the game selection UI; adding a new entry there satisfies this requirement |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.7.3 (workspace root) | Type safety across all propagation points | Already in use; literal union expansion is a type-level change only |
| Vitest | workspace (server) | Test runner for engine unit tests | Already configured in `server/vitest.config.ts` with `@slutsnus/shared` resolve alias |
| Socket.IO (server) | Already installed | Emit `game:state` to per-player sockets | `io.to(socketId).emit` pattern established in `room.ts` `onUpdate` closure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `setInterval` (Node built-in) | N/A | 20 Hz tick loop in stub engine | Needed the moment `init` is called; cleared in `destroy` |
| `@slutsnus/shared` workspace package | N/A | Single source of truth for `GameType` | All consumers import from here; changing `types.ts` propagates everywhere |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setInterval` at 50 ms | `setTimeout` recursive | `setInterval` is simpler for a fixed-rate stub; Phase 6 can refine |
| Stub emitting a minimal typed state object | Emitting raw `{}` | Emitting a typed stub state prevents client TypeScript errors when Phase 6 wires the real state shape |

**Installation:** No new packages required for Phase 5.

## Architecture Patterns

### Recommended Project Structure
```
server/src/games/
├── registry.ts              # Add 'snus-catcher' entry
└── snus-catcher/
    └── engine.ts            # SenusCatcherEngine stub

client/src/games/
├── GameContainer.tsx        # Add Show block for 'snus-catcher'
└── snus-catcher/
    └── index.tsx            # Placeholder component (canvas div + "Loading..." text)

shared/src/
└── types.ts                 # GameType union: 'snusking' | 'snus-catcher'
```

### Pattern 1: Atomic GameType Propagation
**What:** All four files that consume `GameType` are changed in the same commit.
**When to use:** Every time the `GameType` union grows.
**Files that must change together:**
1. `shared/src/types.ts` — union expansion: `export type GameType = 'snusking' | 'snus-catcher';`
2. `server/src/games/registry.ts` — new registry entry: `'snus-catcher': SenusCatcherEngine`
3. `client/src/games/GameContainer.tsx` — new `Show` block routing to the placeholder component
4. `client/src/pages/Home.tsx` — new entry in `GAMES` array (this is the lobby selection UI)

**Note on Lobby.tsx:** `Lobby.tsx` renders `r().gameType` inside the game badge. Since `GameType` is a string used in a template expression, not a discriminated branch, it does not need a code change — it already handles arbitrary string values. However, the badge label `{r().gameType === 'snusking' ? '🫙 Snusking' : r().gameType}` will fall through to `r().gameType` for `'snus-catcher'`, which is acceptable for Phase 5. Optionally improve to `'snus-catcher' ? 'Snus Catcher' : ...` for polish.

### Pattern 2: Stub Engine Implementing GameEngine
**What:** `SenusCatcherEngine` implements `GameEngine` (not `TurnBasedGameEngine`) because Snus Catcher is real-time, not turn-based.
**When to use:** Real-time arcade games — no `projectState` or `getCurrentPhase` needed.

```typescript
// server/src/games/snus-catcher/engine.ts
import type { GameEngine } from '../registry';
import type { PlayerInfo, GameAction } from '@slutsnus/shared';

const TICK_MS = 50; // 20 Hz — locked per STATE.md

export class SenusCatcherEngine implements GameEngine {
  private tickInterval?: ReturnType<typeof setInterval>;
  private onStateUpdate: (state: unknown) => void = () => {};
  private players: PlayerInfo[] = [];
  private tickCount = 0;

  init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
    this.players = players;
    this.onStateUpdate = onStateUpdate;
    this.tickCount = 0;
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    this.tickCount++;
    // Phase 5: broadcast identical stub state to all players (no per-player projection yet)
    // room.ts onUpdate will broadcast to roomCode since forUserId is absent
    this.onStateUpdate({ tickCount: this.tickCount, status: 'playing' });
  }

  handleEvent(_playerId: string, _action: GameAction): void {
    // Phase 5: no-op — Phase 6 implements bar movement and collision
  }

  getState(): unknown {
    return { tickCount: this.tickCount, status: 'playing' };
  }

  destroy(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
  }
}
```

**Key detail:** The `onUpdate` callback in `room.ts` already handles both the per-player `{ forUserId, state }` wrapper (used by Snusking) and a plain broadcast path (`io.to(roomCode).emit`). For Phase 5, the stub can emit plain objects and the server's `else` branch broadcasts to the whole room. This is fine for two players.

### Pattern 3: GameContainer Multi-Game Routing
**What:** `GameContainer.tsx` already uses `Show` blocks keyed on `gameType()`. Adding a second `Show` for `'snus-catcher'` is the correct extension pattern.

```typescript
// GameContainer.tsx — add after the snusking Show block
<Show when={gameType() === 'snus-catcher' ? gameState() : null}>
    {(_state) => (
        <SenusCatcherGame roomCode={props.roomCode} />
    )}
</Show>
```

**Note:** `SenusCatcherGame` in Phase 5 is a placeholder component. It does not need to consume state yet.

### Pattern 4: Home.tsx GAMES Array Extension
**What:** Add a second entry to the `GAMES` array in `Home.tsx`. The `id` field must exactly match the new `GameType` literal.

```typescript
{
    id: 'snus-catcher',
    name: 'Snus Catcher',
    tagline: 'Catch or die.',
    description: 'Catch fresh snus pouches falling from above. Dodge the spent ones. 1v1 arcade racing.',
    badges: ['2 Players', 'Arcade', 'Real-time'],
}
```

**Copy language:** Swedish copy for player-facing strings is the project convention. `tagline`, `description`, and `badges` in Home.tsx are currently in English (the existing Snusking entry is in English), so English is acceptable here. Lobby.tsx Swedish labels do not change.

### Anti-Patterns to Avoid
- **Partial propagation:** Adding `'snus-catcher'` to the registry but not to `GameType` in shared/types.ts. TypeScript will not catch this because `gameRegistry` is `Record<string, new () => GameEngine>` — string key, not `GameType`. The type error only surfaces downstream at `RoomInfo.gameType` assignments.
- **Implementing `TurnBasedGameEngine`:** Snus Catcher is real-time. Using `TurnBasedGameEngine` would require `projectState` and per-player routing complexity that belongs in Phase 6.
- **Emitting per-player wrapped state in Phase 5:** The `{ forUserId, state }` wrapper is needed only when different players should see different state. In Phase 5 stub, all players see the same tick count — broadcast is correct.
- **Starting the tick loop before `init`:** The `setInterval` must be created inside `init`, not in the constructor, to match the `GameEngine` lifecycle the server expects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socket room broadcast | Custom emit loop | `io.to(roomCode).emit(...)` | Already established in `room.ts` onUpdate fallback branch |
| Player-to-socket mapping | New Map tracking | `onlineUsers` map in `socket/index.ts` | Already maps userId → Set<socketId>; re-use for per-player emit in Phase 6 |
| Room lifecycle (start/stop) | Engine boot/teardown hooks | `room:start` handler in `room.ts` already calls `engine.init()` and `engine.destroy()` | Any `GameEngine` dropped into `gameRegistry` gets full lifecycle management for free |

**Key insight:** The server's `room:start` handler is game-agnostic — it instantiates whatever class is in `gameRegistry[room.gameType]`, calls `init`, and wires the cleanup timer. No server socket code needs to change for Phase 5.

## Common Pitfalls

### Pitfall 1: TypeScript Compiles Clean But Runtime Breaks
**What goes wrong:** `room.gameType` is stored as a plain `String` in Prisma. The server reads it back as `string` and casts to `RoomInfo['gameType']`. If `'snus-catcher'` is not added to the `GameType` union, the cast succeeds silently and `gameRegistry['snus-catcher']` is `undefined` — causing a runtime crash when the host starts the game.
**Why it happens:** `gameRegistry` is `Record<string, ...>` and `room.gameType` cast is unchecked.
**How to avoid:** Add `'snus-catcher'` to `GameType` in shared/types.ts first, then verify `tsc --noEmit` passes across all three workspaces.
**Warning signs:** `room:error: Unknown game type` emitted by server when host presses "Start".

### Pitfall 2: setInterval Accumulation on Multiple Init Calls
**What goes wrong:** If `init` is called twice (reconnect scenario, test setup), two tick loops run simultaneously, doubling emit rate and leaking the first timer.
**Why it happens:** No guard against double-init.
**How to avoid:** Call `clearInterval(this.tickInterval)` at the start of `init` before setting a new one. Or assert `!this.tickInterval`.
**Warning signs:** Clients receive duplicate `game:state` events at irregular intervals.

### Pitfall 3: `GameType` Literal Mismatch Between Client and Server
**What goes wrong:** Home.tsx uses `id: 'snus-catcher'` but registry.ts uses `'snuscatcher'` (no hyphen), or vice versa.
**Why it happens:** String literal typed as `GameType` on client, raw string key on server registry.
**How to avoid:** The `id` field in `Home.tsx` `GAMES` array must exactly match the string key in `gameRegistry` and the `GameType` literal in `types.ts`. Use the same string in all four places.
**Warning signs:** Room creates successfully (Prisma stores whatever string is passed) but start fails with "Unknown game type".

### Pitfall 4: Memory Leak When Room Ends Before Destroy
**What goes wrong:** `tickInterval` keeps firing after the room's engine is removed from `activeGames` but `destroy()` was never called (crash in `room:start` after `init`).
**Why it happens:** If `engine.init()` starts the interval, any exception after that point leaves the timer running.
**How to avoid:** `destroy()` must be idempotent and safe to call even before full initialization completes. Guard with `if (this.tickInterval)`.

### Pitfall 5: GameContainer Signal Type Mismatch
**What goes wrong:** `GameContainer.tsx` declares `gameState` as `createSignal<SnuskingProjectedState | null>`. The new `Show` block for `'snus-catcher'` will receive a value typed as `SnuskingProjectedState` even though it's actually a Snus Catcher state object.
**Why it happens:** The state signal is typed to Snusking specifically.
**How to avoid:** Widen the signal type to `createSignal<unknown>(null)` or introduce a union. For Phase 5 the `SenusCatcherGame` placeholder does not consume the state at all, so the narrowing can be deferred. The `Show` block in Phase 5 can simply check `gameType() === 'snus-catcher'` without using the state value in the child.

## Code Examples

Verified patterns from this codebase:

### GameType Union (shared/src/types.ts)
```typescript
// Current (line 31)
export type GameType = 'snusking';

// Phase 5 change
export type GameType = 'snusking' | 'snus-catcher';
```

### Registry Entry (server/src/games/registry.ts)
```typescript
import { SenusCatcherEngine } from './snus-catcher/engine';

export const gameRegistry: Record<string, new () => GameEngine> = {
    'snusking': SnuskingEngine,
    'snus-catcher': SenusCatcherEngine,
};
```

### GameContainer Multi-Game Routing Pattern
The existing pattern for Snusking is:
```typescript
// GameContainer.tsx (lines 36–44)
<Show when={gameType() === 'snusking' ? gameState() : null}>
    {(state) => (
        <SnuskingGame
            state={state() as SnuskingProjectedState}
            roomCode={props.roomCode}
            onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
        />
    )}
</Show>
```

The Snus Catcher addition follows the same shape but the Phase 5 placeholder component has no `state` prop:
```typescript
<Show when={gameType() === 'snus-catcher'}>
    <SenusCatcherGame roomCode={props.roomCode} />
</Show>
```

### Existing onUpdate Broadcast Path (server/src/socket/room.ts lines 136–150)
The Phase 5 stub engine emits plain objects (no `forUserId`), which uses the existing `else` branch:
```typescript
} else {
    // Fallback room-broadcast — used by Snus Catcher Phase 5 stub
    io.to(roomCode).emit('game:state', { state });
}
```

### Verifying TypeScript Compilation
```bash
# Run from workspace root
npx tsc --noEmit --project shared/tsconfig.json
npx tsc --noEmit --project server/tsconfig.json
npx tsc --noEmit --project client/tsconfig.json
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-game platform (only 'snusking') | Multi-game platform with `GameType` union | Phase 5 | All four propagation points must change atomically |
| Turn-based only (`TurnBasedGameEngine`) | Both turn-based and real-time (`GameEngine` base) | Phase 5 | `SenusCatcherEngine` implements `GameEngine` directly, not `TurnBasedGameEngine` |

**No deprecated patterns** introduced in this phase.

## Open Questions

1. **Lobby.tsx game badge label for `'snus-catcher'`**
   - What we know: Current code falls through to `r().gameType` (renders `'snus-catcher'` as raw string)
   - What's unclear: Whether Phase 5 should polish this to "Snus Catcher" or leave it for Phase 6
   - Recommendation: Add the display label in Phase 5 (one-line change) to avoid confusing the lobby UI during manual testing

2. **`GameContainer` state signal type widening**
   - What we know: `createSignal<SnuskingProjectedState | null>` is the current type; Snus Catcher state will be a different shape in Phase 6
   - What's unclear: Whether to widen now or let Phase 6 handle it
   - Recommendation: For Phase 5, the placeholder `SenusCatcherGame` doesn't consume state, so defer type widening to Phase 6 when the real state shape is defined. The `Show` block can gate on `gameType() === 'snus-catcher'` without accessing the state value.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (server workspace) |
| Config file | `server/vitest.config.ts` |
| Quick run command | `npm run test --workspace=server` |
| Full suite command | `npm run test --workspace=server` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GAME-01 | Snus Catcher room can be created and joined | smoke (manual) | Manual: create room via UI, second player joins | N/A — UI flow |
| PLAT-01 | Snus Catcher appears in game selection | smoke (manual) | Manual: verify Home page shows Snus Catcher card | N/A — UI flow |
| Phase 5 infra | `SenusCatcherEngine.init()` starts ticking | unit | `npm run test --workspace=server -- --testPathPattern snus-catcher` | ❌ Wave 0 |
| Phase 5 infra | `SenusCatcherEngine.destroy()` clears interval | unit | `npm run test --workspace=server -- --testPathPattern snus-catcher` | ❌ Wave 0 |
| Phase 5 infra | TypeScript compiles clean across all workspaces | type check | `npx tsc --noEmit` (all three workspaces) | N/A — compile check |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=server`
- **Per wave merge:** `npm run test --workspace=server` + `npx tsc --noEmit` on all three workspaces
- **Phase gate:** All tests green + clean `tsc --noEmit` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/src/games/snus-catcher/engine.test.ts` — covers init/tick/destroy lifecycle (REQ: GAME-01 infrastructure)
- [ ] `server/src/games/snus-catcher/engine.ts` — the stub itself (must exist before test can import it)

## Sources

### Primary (HIGH confidence)
- Direct source inspection of `shared/src/types.ts` — `GameType` union, all shared type definitions
- Direct source inspection of `server/src/games/registry.ts` — `gameRegistry` structure, `GameEngine` interface
- Direct source inspection of `server/src/socket/room.ts` — `room:start` handler, `onUpdate` callback, broadcast paths
- Direct source inspection of `client/src/games/GameContainer.tsx` — existing multi-game `Show` routing pattern
- Direct source inspection of `client/src/pages/Home.tsx` — `GAMES` array structure, `createRoom(game.id)` call
- Direct source inspection of `client/src/stores/room.tsx` — `createRoom(gameType: GameType)` signature confirms type propagation
- Direct source inspection of `server/vitest.config.ts` — test runner config, `@slutsnus/shared` alias

### Secondary (MEDIUM confidence)
- STATE.md locked decisions: atomic GameType propagation, 20 Hz tick rate (50ms setInterval), canvas rendering, `createStore` for game state — all from prior architectural decisions documented in project state

### Tertiary (LOW confidence)
- None — all findings are from direct source inspection of the actual codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns verified in existing source
- Architecture: HIGH — all four propagation points identified from direct source inspection
- Pitfalls: HIGH — runtime failure modes verified by tracing actual code paths (registry string lookup, Prisma string cast, setInterval accumulation)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable codebase — no external dependencies changing)
