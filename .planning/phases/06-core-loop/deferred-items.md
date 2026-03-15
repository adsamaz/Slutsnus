# Deferred Items — Phase 06 Core Loop

## Pre-existing TypeScript errors (server workspace)

Discovered during 06-05 Task 1 pre-flight check. These errors exist in the committed codebase before Phase 6 began and are not caused by any Phase 6 changes.

**Scope:** Out of scope for Phase 6 (Snus Catcher Core Loop). All snus-catcher files compile without direct errors.

### registry.type-test.ts — TurnPhase mismatch
- `TurnPhase` in `registry.ts` is `'playing' | 'ended'` but the type-test asserts it must include `'draw' | 'planning' | 'reveal' | 'resolve' | 'ended'`
- This needs to be resolved when Snusking Phase 2 work resumes

### snusking/engine.ts — Phase 2 in-progress type errors
- `spentSnus` missing from player state initializer
- Phase string `'draw'` not assignable to `'playing' | 'ended'`
- `SnuskingProjectedState` missing `discardTop` and `activePlayerId`
- These are caused by uncommitted Phase 2 working-tree changes that extended the type contracts but haven't updated the engine fully

### routes/friends.ts, leaderboard.ts, rooms.ts
- `string | string[]` from Express query params not narrowed before Prisma calls
- Pre-existing since before Phase 5

### socket/index.ts, socket/room.ts
- TS6059 rootDir violation for `@slutsnus/shared` path alias
- Pre-existing architectural issue (monorepo cross-package import vs rootDir constraint)
- Project uses Vitest alias workaround for tests; production build works via ts-node

**Recommended resolution:** Address in Phase 2 Snusking implementation plans when TurnPhase and state types are finalized.
