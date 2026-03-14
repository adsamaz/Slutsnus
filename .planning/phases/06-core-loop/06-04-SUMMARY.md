---
phase: 06-core-loop
plan: "04"
subsystem: ui
tags: [solidjs, canvas, typescript, snus-catcher, game-loop, rAF]

# Dependency graph
requires:
  - phase: 06-core-loop/06-02
    provides: SenusCatcherEngine FSM emitting SenusCatcherState at 20Hz
  - phase: 06-core-loop/06-03
    provides: render.ts drawFrame, snus-catcher.css, GameContainer wiring

provides:
  - Complete SenusCatcherGame component: rAF loop, createStore, socket wiring, EndScreen

affects:
  - client/src/games/snus-catcher/index.tsx (fully rewritten from placeholder)
  - End-to-end game loop is now playable: server engine + socket + client component

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createStore wrapping state in { data: ... } for fine-grained updates without full re-render"
    - "rAF loop started in onMount, cancelled via onCleanup(cancelAnimationFrame) — prevents accumulation on remount"
    - "localBarX as plain let (not signal) — read in rAF closure every frame without SolidJS tracking overhead"
    - "useAuth() for selfId — useRoom() stores RoomInfo (no userId field), auth store has authState.user.id"

key-files:
  created: []
  modified:
    - client/src/games/snus-catcher/index.tsx

key-decisions:
  - "useAuth() used for selfId (authState.user.id) — useRoom() does not expose userId directly, only room: RoomInfo | null"
  - "selfResult helper retained but marked void — available for future per-player end-screen statistics"
  - "onGameState listener registered in component body (not onMount) — socket listeners should be active before canvas mounts per SolidJS pattern"

patterns-established:
  - "Canvas game component pattern: createStore for state, rAF in onMount, socket.on in component body with onCleanup"

requirements-completed: [GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, GAME-09, PLAT-02, PLAT-04]

# Metrics
duration: ~5min
completed: 2026-03-14
---

# Phase 6 Plan 04: Snus Catcher — SenusCatcherGame Component

**Complete SenusCatcherGame replacing Phase 5 placeholder: 60fps rAF loop via createStore, client-authoritative bar with 30ms throttle, socket wiring, and Swedish end screen with winner detection**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T23:31:00Z
- **Completed:** 2026-03-14T23:36:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced placeholder `index.tsx` (7 lines) with complete 128-line `SenusCatcherGame` component
- `createStore<{ data: SenusCatcherState | null }>` — prevents full re-render on every 20Hz server tick
- `socket.on('game:state', onGameState)` registered in component body with `onCleanup` unregistration — active before canvas mounts
- rAF loop inside `onMount`: reads `gameStore.data`, calls `drawFrame`, schedules next frame; `cancelAnimationFrame(rafId)` in `onCleanup` prevents accumulation
- `localBarX` as plain `let` variable — updated immediately from `mousemove`, never waits for server echo
- Bar-move emit throttled at `now - lastEmit >= 30` (30ms locked decision)
- End screen with self-aware winner detection: "Du vann!" vs "[name] vann!" + "Tillbaka till lobbyn" button using `window.location.href = '/'`
- Results table with rank, username, score columns
- TypeScript compiles clean: `npx tsc --noEmit -p client/tsconfig.json` exits 0
- Server tests unchanged: 72/72 pass

## Task Commits

1. **Task 1: Rewrite SenusCatcherGame component with full game loop and end screen** - `635fd49` (feat)

## Files Created/Modified

- `client/src/games/snus-catcher/index.tsx` — Complete SenusCatcherGame: createStore, rAF loop, socket wiring, mousemove handler, end screen

## Decisions Made

- `useAuth()` instead of `useRoom()` for `selfId`: `useRoom()` returns `[{ room: RoomInfo | null }, ...]` with no `userId` field; `authState.user.id` from `useAuth()` is the correct source for the current user's identity. The plan's note about checking the room store interface was necessary — `roomState.userId` as written in the plan template does not exist on the actual store type.
- Socket listener registered in component body (not inside `onMount`) — this ensures `game:state` events are captured even if they arrive before the canvas is attached to the DOM.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useAuth() instead of useRoom() for selfId**
- **Found during:** Task 1 (reading room.tsx store interface)
- **Issue:** Plan template used `useRoom()` with `roomState.userId`. The actual `RoomState` interface is `{ room: RoomInfo | null }` — there is no `userId` field. `useRoom()` cannot provide the current user's ID.
- **Fix:** Used `useAuth()` instead. `AuthState.user` is `UserPublic | null`, and `UserPublic.id` is the current user's ID. This matches how Snusking's `SnuskingProjectedState.self.userId` is ultimately sourced.
- **Files modified:** client/src/games/snus-catcher/index.tsx
- **Committed in:** 635fd49 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, store interface mismatch)
**Impact on plan:** Single-line import change (`useRoom` → `useAuth`), no scope change. All locked decisions implemented exactly as specified.

## Issues Encountered

None beyond the store interface deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SenusCatcherGame component is feature-complete and TypeScript-clean
- Game loop (server engine + socket emit + client rAF render) is fully wired end-to-end
- All GAME-02–09 and PLAT-02/04 requirements are now satisfied at the client layer
- Phase 6 Wave 2 complete — ready for 06-05 (Powerups, Phase 7 scope)

---
*Phase: 06-core-loop*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: client/src/games/snus-catcher/index.tsx
- FOUND: .planning/phases/06-core-loop/06-04-SUMMARY.md
- FOUND commit: 635fd49 (feat: SenusCatcherGame full implementation)
