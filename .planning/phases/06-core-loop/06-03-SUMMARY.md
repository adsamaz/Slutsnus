---
phase: 06-core-loop
plan: "03"
subsystem: ui
tags: [solidjs, canvas, typescript, snus-catcher, css]

# Dependency graph
requires:
  - phase: 06-core-loop
    provides: SenusCatcherState, SenusCatcherPlayerState, SenusCatcherObject types (from 06-01)
  - phase: 05-snus-catcher-foundation
    provides: SenusCatcherGame component stub, GameContainer routing
provides:
  - GameContainer.tsx with createSignal<unknown> signal type (game-agnostic)
  - SenusCatcherGame props interface: state, onAction, roomCode
  - render.ts with drawFrame pure canvas function
  - snus-catcher.css with wrapper, canvas, end-screen, results table, lobby button styles
affects:
  - 06-04 (canvas component — imports drawFrame from render.ts and snus-catcher.css)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GameContainer signal typed as unknown — each Show block casts internally to its own state type"
    - "render.ts is a pure module (no SolidJS imports, no signals, no side effects) — testable and importable from rAF loop"
    - "CSS classes prefixed with snus-catcher- to avoid collisions with snusking styles"

key-files:
  created:
    - client/src/games/snus-catcher/render.ts
    - client/src/games/snus-catcher/snus-catcher.css
  modified:
    - client/src/games/GameContainer.tsx
    - client/src/games/snus-catcher/index.tsx

key-decisions:
  - "GameContainer signal widened to unknown instead of union type — avoids game-specific leakage at shared signal boundary"
  - "SenusCatcherGame props interface extended before GameContainer wiring — avoids @ts-expect-error suppression"
  - "drawFrame takes localBarX as pixel argument (not fraction) — caller owns the conversion, pure function stays simple"

patterns-established:
  - "Pure canvas render module pattern: export single drawFrame function, no side effects, tested by importing directly"

requirements-completed: [PLAT-02]

# Metrics
duration: 8min
completed: 2026-03-15
---

# Phase 6 Plan 03: Snus Catcher — GameContainer Wiring and Canvas Render Module

**GameContainer signal widened to unknown, SenusCatcherGame wired with state+onAction props, render.ts exports pure drawFrame for canvas loop, snus-catcher.css provides all layout and end-screen styles**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-14T23:17:00Z
- **Completed:** 2026-03-14T23:25:28Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- GameContainer.tsx: `createSignal<SnuskingProjectedState | null>` replaced with `createSignal<unknown>` — signal boundary is now game-agnostic
- SenusCatcherGame Show block gates on `gameState()` and passes typed `state` and `onAction` props (matching the Snusking Show block pattern)
- `index.tsx` props interface extended to accept `state: SenusCatcherState` and `onAction: (action: SenusCatcherAction) => void` — TypeScript compiles clean without any @ts-expect-error suppression
- `render.ts` created: pure `drawFrame(ctx, canvas, state, selfId, localBarX)` draws background, falling objects (fresh=green/spent=red), client-authoritative player bar, opponent bar from server state, and HUD (score, lives circles, opponent summary)
- `snus-catcher.css` created: wrapper, canvas (4:3 aspect ratio, cursor:none), end-screen, results table, lobby button with hover

## Task Commits

1. **Task 1: Widen GameContainer signal type and wire SenusCatcherGame props** - `4066b68` (feat)
2. **Task 2: Create render.ts with canvas draw functions and snus-catcher.css** - `1198ac7` (feat)

## Files Created/Modified

- `client/src/games/GameContainer.tsx` — signal widened to unknown; SenusCatcherGame Show block passes state+onAction
- `client/src/games/snus-catcher/index.tsx` — props interface extended with state and onAction
- `client/src/games/snus-catcher/render.ts` — pure drawFrame function for canvas game loop
- `client/src/games/snus-catcher/snus-catcher.css` — canvas wrapper, end-screen, results table, lobby button styles

## Decisions Made

- Extended SenusCatcherGame props interface first (rather than using @ts-expect-error in GameContainer) — keeps TypeScript clean end-to-end and avoids suppression debt
- drawFrame takes `localBarX` as pixel X (not fraction) — the caller (rAF loop in Plan 04) owns mouse-to-pixel conversion; pure function receives ready-to-use values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- GameContainer signal boundary is game-agnostic — any future game type can reuse the same pattern
- render.ts is complete and tested via TypeScript compilation — Plan 04 imports drawFrame and wires rAF loop
- snus-catcher.css is complete — Plan 04 imports it once at index.tsx
- No blockers

---
*Phase: 06-core-loop*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: client/src/games/GameContainer.tsx
- FOUND: client/src/games/snus-catcher/render.ts
- FOUND: client/src/games/snus-catcher/snus-catcher.css
- FOUND: client/src/games/snus-catcher/index.tsx
- FOUND: .planning/phases/06-core-loop/06-03-SUMMARY.md
- FOUND commit: 4066b68 (feat: widen GameContainer signal and wire SenusCatcherGame props)
- FOUND commit: 1198ac7 (feat: render.ts and snus-catcher.css)
