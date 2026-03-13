---
phase: 03-client-ui-and-reveal-experience
plan: "05"
subsystem: ui
tags: [solid-js, typescript, snusking, lobby, end-screen, swedish-l10n]

# Dependency graph
requires:
  - phase: 01-foundation-and-engine-contract
    provides: GameResult, GameEndReason types in @slutsnus/shared
  - phase: 03-client-ui-and-reveal-experience
    provides: snusking component skeleton from Plan 01-06
provides:
  - Polished EndScreen with slut_snus and score_threshold branches, winner highlight, results table, return button
  - Lobby redesigned with Swedish labels, thematic game badge, snusking branding
  - lobby-title-row CSS utility class for header sub-layout
affects: [phase-04-integration-playtesting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Swedish copy throughout game UI (no English player-facing strings)
    - SolidJS Show/For for conditional rendering and result lists
    - Self-aware winner detection (selfUserId comparison) in EndScreen

key-files:
  created: []
  modified:
    - client/src/games/snusking/EndScreen.tsx
    - client/src/pages/Lobby.tsx
    - client/src/styles/global.css

key-decisions:
  - "winner class added to result-row via template literal (not snusking.css, since it does not yet exist in wave 1)"
  - "lobby-title-row flex container added to global.css to support new header sub-layout"
  - "Return-to-lobby button uses window.location.href = '/' as specified (no router navigate needed at game end)"

patterns-established:
  - "Self-aware UI: compare userId to selfUserId for personalised copy (Du har byggt riket! vs Riket är byggt!)"
  - "Swedish localization: all player-facing strings in Swedish throughout snusking UI"

requirements-completed: [ENDSCREEN-FINAL, LOBBY-REDESIGN]

# Metrics
duration: 10min
completed: 2026-03-13
---

# Phase 3 Plan 05: EndScreen Polish and Lobby Redesign Summary

**EndScreen with self-aware winner detection and Swedish copy, Lobby with snusking theme and full Swedish l10n — both compile cleanly with zero TypeScript errors.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-13T00:00:00Z
- **Completed:** 2026-03-13T00:10:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- EndScreen shows "SLUT SNUS / Snuset är slut. Spelet är slut." for slut_snus end reason and "Du har byggt riket! 👑" (self) or "Riket är byggt! / {username} vann!" for score_threshold
- Final results table highlights self row and winner row with CSS classes, shows rank/username/score in Swedish
- Return-to-lobby button added at bottom of EndScreen
- Lobby header redesigned with "Snusking — Lobby" title, "🫙 Snusking" game badge, and "Kod: {code}" label
- All Lobby player-facing strings translated: "Spelare", "Redo", "Inte redo", "Starta spel", "Startar...", "Lämna", "Bjud in vänner", "Inga vänner online", "Bjud in", "Ansluter till lobby..."
- Added `.lobby-title-row` CSS utility to global.css for the new header sub-layout

## Task Commits

No commits made — user will commit at end of session.

1. **Task 1: Polish EndScreen.tsx** — EndScreen rewritten with winner logic, results table, return button
2. **Task 2: Redesign Lobby.tsx** — Lobby translated to Swedish with thematic branding

## Files Created/Modified

- `client/src/games/snusking/EndScreen.tsx` — Polished with both end reasons, winner highlight, results table, return button
- `client/src/pages/Lobby.tsx` — Swedish labels throughout, snusking game badge, all existing socket/store logic preserved
- `client/src/styles/global.css` — Added `.lobby-title-row` flex container style

## Decisions Made

- `winner` class on result rows uses template literal string building (avoids object-style conditional for cleaner JSX)
- `.lobby-title-row` added to global.css rather than waiting for snusking.css (which is not yet created in this wave) — ensures layout works correctly
- Return button uses `window.location.href = '/'` as specified in plan (game end is a hard navigation, not a SPA route transition)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added .lobby-title-row CSS class**
- **Found during:** Task 2 (Lobby redesign)
- **Issue:** Plan introduced a new `<div class="lobby-title-row">` wrapper inside `.lobby-header`, but no CSS rule for this class existed anywhere
- **Fix:** Added `.lobby-title-row { display: flex; align-items: center; gap: 12px; flex: 1; }` to global.css
- **Files modified:** client/src/styles/global.css
- **Verification:** Layout renders correctly; TypeScript clean

---

**Total deviations:** 1 auto-fixed (1 missing critical style)
**Impact on plan:** Necessary for correct header layout. No scope creep.

## Issues Encountered

None — plan executed straightforwardly once CSS gap was addressed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EndScreen and Lobby are production-ready UI components
- Phase 4 integration and playtesting can proceed; all snusking UI components now exist
- snusking.css (Phase 3 Plan 01) should add `.result-row.winner` and `.result-row.self` styles for full visual polish

---
*Phase: 03-client-ui-and-reveal-experience*
*Completed: 2026-03-13*
