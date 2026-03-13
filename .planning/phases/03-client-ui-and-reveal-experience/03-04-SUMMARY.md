---
phase: 03-client-ui-and-reveal-experience
plan: "04"
subsystem: ui

tags: [solid-js, css, card-game, snusking, typescript, reveal-animation, event-flash]

requires:
  - phase: 03-client-ui-and-reveal-experience
    plan: "01"
    provides: SnuskingCard component, snusking.css (reveal-overlay, reveal-card-flip, event-flash, event-banner classes)
  - phase: 03-client-ui-and-reveal-experience
    plan: "02"
    provides: Hand component with self/opponents/pendingTradeOffers/onAction props
  - phase: 03-client-ui-and-reveal-experience
    plan: "03"
    provides: PlayerHUD with self/opponents/timeRemaining/maxTime props; OpponentStatus with phase prop

provides:
  - RevealOverlay component at client/src/games/snusking/RevealOverlay.tsx (CSS 3D card flip, self + opponent rows)
  - Board component (rewritten) at client/src/games/snusking/Board.tsx (event flash overlay + persistent banner + deck info)
  - SnuskingGame root at client/src/games/snusking/index.tsx (all components wired, ToastContainer mounted, event flash timer, highnic blur)

affects:
  - GameContainer (consumes SnuskingGame which is the export from index.tsx)

tech-stack:
  added: []
  patterns:
    - createEffect for reactive side effects (event flash timer, planning phase reset)
    - createSignal for local UI state (eventFlashActive, lastEventId, timeRemaining)
    - Switch/Match for phase-based conditional rendering
    - Show for status-based conditional rendering (ended vs active)
    - CSS import at component root (snusking.css imported once in index.tsx)
    - CSS class derived from accessor (gameClass() for highnic blur)

key-files:
  created:
    - client/src/games/snusking/RevealOverlay.tsx
  modified:
    - client/src/games/snusking/Board.tsx
    - client/src/games/snusking/index.tsx

key-decisions:
  - "highnic-blur CSS class is snusking-highnic-blur (matches snusking.css definition) — not highnic-blur"
  - "RevealOverlay shows opponent hands as face-down cards (handCount determines count) — server does not expose actual opponent cards during reveal phase"
  - "Board shows event-banner-label span ('Händelse') as context label before the event name"
  - "ToastContainer mounted at root of snusking-game div so toasts appear above all other content"
  - "event flash timeout is 2500ms (within the 2–3s spec range) matching the event-flash-in keyframe duration"
  - "gameClass() uses snusking-highnic-blur (not inline filter style) to leverage the CSS transition defined in snusking.css"

patterns-established:
  - "RevealOverlay: self cards with comboLevel computed locally from event affinities; opponents shown as face-down SnuskingCard with no props"
  - "Board: eventFlashActive prop (not internal signal) — parent (index.tsx) owns timer logic"
  - "index.tsx owns all reactive state for the game session; child components are prop-driven"

requirements-completed:
  - REVEAL-ANIMATION
  - EVENT-FLASH
  - EVENT-BANNER
  - BOARD-LAYOUT
  - PHASE-ROUTING

duration: 10min
completed: 2026-03-13
---

# Phase 3 Plan 04: RevealOverlay, Board, and index.tsx Integration Summary

**RevealOverlay component with CSS 3D flip, Board rewritten with event flash/banner, and index.tsx wired with ToastContainer, all Phase 3 components, and event flash timer**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-13T22:50:00Z
- **Completed:** 2026-03-13T23:00:00Z
- **Tasks:** 2
- **Files created:** 1 (RevealOverlay.tsx)
- **Files modified:** 2 (Board.tsx, index.tsx)

## Accomplishments

- Created `RevealOverlay.tsx` — full-screen overlay shown during `reveal` phase; self cards render with face-up SnuskingCard components and computed comboLevel (gold/silver/null based on event affinity match); opponent hands render as face-down SnuskingCard stubs (handCount determines count since actual opponent cards are server-private until resolve); all cards wrapped in `.reveal-card-flip` div that triggers the 350ms `card-flip` keyframe animation on mount
- Rewrote `Board.tsx` — added `currentEvent: SnuskingEventCard | null` and `eventFlashActive: boolean` props; renders full-screen `.event-flash` overlay (with `.event-flash-title` and `.event-flash-desc`) when active; renders persistent `.event-banner` (with `.event-banner-label` "Händelse" prefix) when event exists and flash is done; Swedish-localized board-info labels (Runda/Kortlek/Kasserad/Fas)
- Rewrote `index.tsx` — adds CSS import at top; mounts `ToastContainer` at root; drives `eventFlashActive` via `createEffect` watching phase+currentEvent (2500ms timer); drives `timeRemaining` reset on planning phase transition; passes `eventFlashActive()` to Board; routes `reveal` phase to `RevealOverlay`; applies `snusking-highnic-blur` class when `highNicEffect && phase === 'planning'`; TypeScript compiles with zero errors

## Task Commits

No commits made per user instruction — single commit at end.

1. **Task 1: Create RevealOverlay and rewrite Board** - uncommitted (feat)
2. **Task 2: Rewrite index.tsx — wire all components and event flash timer** - uncommitted (feat)

## Files Created/Modified

- `client/src/games/snusking/RevealOverlay.tsx` — New component; exports `RevealOverlay`; uses local `comboLevel()` helper; renders self/opponent rows both wrapped in `.reveal-card-flip`
- `client/src/games/snusking/Board.tsx` — Rewritten; exports `Board`; new props `currentEvent` and `eventFlashActive`; Swedish labels; event flash + persistent banner with `Show`
- `client/src/games/snusking/index.tsx` — Rewritten; exports `SnuskingGame`; imports `./snusking.css`, `RevealOverlay`, `ToastContainer`; all reactive signals local; no `timeRemaining` prop (was removed in favor of local signal)

## Decisions Made

- `snusking-highnic-blur` class name (matching CSS definition in snusking.css line 533) was used instead of the plan's pseudocode `highnic-blur` — the CSS file defines `.snusking-highnic-blur` with blur filter and transition
- RevealOverlay opponent rows show face-down card backs (no actual card data) because `SnuskingOpponentState` only exposes `handCount` — the actual cards remain server-private until resolve phase
- Board receives `eventFlashActive` as a prop from index.tsx rather than managing its own timer — this keeps all reactive state in the game root and Board purely presentational
- The `SnuskingGameProps` interface in the rewritten index.tsx removed the optional `timeRemaining?: number` prop (was in the old skeleton) since the local signal now handles this
- `ToastContainer` is placed first inside the game div so toast z-index layering works correctly against the fixed-position RevealOverlay and event-flash overlays

## Deviations from Plan

None — plan executed exactly as written. One minor adjustment: the CSS class name `snusking-highnic-blur` was used (matching actual CSS definition) where the plan's pseudocode showed `highnic-blur` — this is a correctness fix not a deviation.

## Issues Encountered

None. TypeScript compiled clean on first attempt with zero errors.

## Self-Check: PASSED

- `client/src/games/snusking/RevealOverlay.tsx` — FOUND
- `client/src/games/snusking/Board.tsx` — FOUND (modified)
- `client/src/games/snusking/index.tsx` — FOUND (modified)
- TypeScript: 0 errors

## Next Phase Readiness

- All Phase 3 components are now wired into `SnuskingGame` and ready for Phase 4 integration/playtesting
- Event flash and reveal animation are purely CSS-driven — no runtime dependencies
- ToastContainer is active and ready to receive trade offer toasts from the Hand component (Plan 03-02)

---
*Phase: 03-client-ui-and-reveal-experience*
*Completed: 2026-03-13*
