---
phase: 01-foundation-and-engine-contract
plan: "05"
subsystem: platform-wiring
tags: [snusking, registry, socket, per-player-state, reconnect, cleanup-timer]

requires:
  - 01-04 (SnuskingEngine implementing TurnBasedGameEngine)
provides:
  - gameRegistry['snusking'] pointing to SnuskingEngine
  - onUpdate routes forUserId payloads to individual sockets via onlineUsers
  - room:join emits projectState snapshot for reconnect (REQ-MULTI-03)
  - 5-minute session cleanup timer on all-offline (REQ-MULTI-04)
  - WinLossRecord schema model in prisma (persist pending migration)
affects:
  - 01-07 (snus-rpg removal depends on snusking being wired)

tech-stack:
  added: []
  patterns:
    - forUserId wrapper pattern for per-player socket routing
    - TurnBasedGameEngine cast for reconnect projectState check

key-files:
  modified:
    - server/src/games/registry.ts
    - server/src/socket/room.ts
    - server/prisma/schema.prisma

key-decisions:
  - "WinLossRecord schema added to prisma but upsert call deferred (no migration run — corner cut)"
  - "snus-rpg kept in registry until Plan 07 per Research Pitfall 1 guidance"
  - "Cleanup timer attached via fetchSockets() post-game-start rather than main disconnect handler"

requirements-completed:
  - REQ-NFR-05
  - REQ-MULTI-03
  - REQ-MULTI-04
  - REQ-NFR-01

duration: 5min
completed: 2026-03-13
---

# Phase 1 Plan 05: Platform Wiring — SnuskingEngine Registration and Per-Player State Routing

**SnuskingEngine registered in gameRegistry, onUpdate routes forUserId payloads to individual sockets, room:join sends reconnect snapshot, and 5-minute all-offline cleanup timer added**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-03-13
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- `gameRegistry['snusking']` → SnuskingEngine (snus-rpg preserved until Plan 07)
- `onUpdate` callback: `forUserId` payloads routed to individual sockets via `onlineUsers.get()`; fallback room-broadcast for safety
- `room:join` handler: casts activeGame engine to TurnBasedGameEngine, calls `projectState(userId)`, emits snapshot on reconnect
- Cleanup timer: cancel on `room:join`, schedule 5-minute `setTimeout` on all-players-offline after game start
- `WinLossRecord` model added to `schema.prisma` (composite key `userId + gameType`)

## Task Commits

1. **Task 1: Register SnuskingEngine, per-player routing, reconnect, cleanup** — `c7d992c`

## Deviations from Plan

- **WinLossRecord DB upsert skipped** — schema added but `prisma.winLossRecord.upsert()` call not implemented. Migration not run. Deferred to gap closure. Corner cut per user instruction to reduce tokens.

## Self-Check: PASSED

- FOUND: server/src/games/registry.ts contains 'snusking'
- FOUND: server/src/socket/room.ts contains forUserId routing
- FOUND commit: c7d992c (feat(01-05): register SnuskingEngine, per-player state routing, reconnect, and session cleanup)
