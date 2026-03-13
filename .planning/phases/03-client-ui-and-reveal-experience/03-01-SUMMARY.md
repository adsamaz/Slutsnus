---
phase: 03-client-ui-and-reveal-experience
plan: "01"
subsystem: ui

tags: [solid-js, css, card-game, snusking, typescript]

requires:
  - phase: 02-card-design-balance-and-game-economy
    provides: SnuskingCardStrength, SnuskingCardFlavor, SnuskingCardInstance types in shared/src/types.ts
  - phase: 01-foundation-and-engine-contract
    provides: SnuskingProjectedState, SnuskingOpponentState, SnuskingPlayerState types

provides:
  - SnuskingCard component (face-up/face-down/selected/combo/discard states) at client/src/games/snusking/SnuskingCard.tsx
  - snusking.css with complete game-specific CSS for all Phase 3 components (card, hand, opponent, HUD, event, reveal, end screen, lobby)

affects:
  - 03-02
  - 03-03
  - 03-04
  - 03-05

tech-stack:
  added: []
  patterns:
    - CSS class composition via runtime string join (no CSS modules)
    - Solid.js Show component for conditional card face rendering
    - Prop-driven class names for all visual states (no internal signals in SnuskingCard)
    - Single CSS file pattern — snusking.css imported once at index.tsx

key-files:
  created:
    - client/src/games/snusking/SnuskingCard.tsx
    - client/src/games/snusking/snusking.css
  modified: []

key-decisions:
  - "SnuskingCard is purely prop-driven — no createSignal, all state from parent"
  - "strength-dot and strength-badge share the same color class (e.g. strength-low) for DRY CSS"
  - "snusking.css includes lobby extensions on top of global.css lobby base classes — no duplication"
  - "score-pop keyframe uses translateX(-50%) to maintain centering while animating Y"
  - "face-down-icon uses the jar emoji (U+1FAD9) as snus can stand-in"

patterns-established:
  - "All snusking visual states are CSS classes added to .snusking-card root div"
  - "Strength color scale: low=#39d353 (green), medium=#ffa657 (yellow), high=#f97316 (orange), extreme=#da3633 (red)"
  - "Flavor emojis: tobacco=leaf, mint=snowflake, citrus=lemon, licorice=chocolate, sweet=candy"

requirements-completed:
  - CARD-VISUAL
  - CARD-SELECTED
  - CARD-FACEDOWN

duration: 15min
completed: 2026-03-13
---

# Phase 3 Plan 01: SnuskingCard Component and CSS Foundation Summary

**Solid.js SnuskingCard component with face-up/face-down/selected/combo/discard states plus a 569-line snusking.css covering all Phase 3 game UI classes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-13T16:00:00Z
- **Completed:** 2026-03-13T16:15:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `SnuskingCard.tsx` — fully typed Solid.js component handling all visual states purely from props (no signals); face-down mode shows snus can icon; face-up shows name, strength badge (color-coded), flavor badge (emoji+label), and points
- Created `snusking.css` (569 lines) — single CSS file for entire Phase 3 game UI: card, hand/tabs, opponent zone, PlayerHUD with beer mugs and debuff banners, timer ring, event flash/banner, reveal overlay, score pop, end screen, lobby extensions, and all four keyframe animations
- TypeScript compilation passes with zero errors

## Task Commits

No commits made per user instruction — single commit at end.

1. **Task 1: Create SnuskingCard component** - uncommitted (feat)
2. **Task 2: Create snusking.css with all game styles** - uncommitted (feat)

## Files Created/Modified

- `client/src/games/snusking/SnuskingCard.tsx` - Reusable card component; exports `SnuskingCard`; uses `Show` for conditional face rendering; strength/flavor maps defined as const records
- `client/src/games/snusking/snusking.css` - Complete snusking game styles; imported once at index.tsx (Plan 03-04 adds the import)

## Decisions Made

- Kept `SnuskingCard` purely prop-driven (no `createSignal`) — all selection/phase state lives in parent components, matching the plan's explicit requirement
- Used `Show` with accessor pattern `{(card) => ...}` for type-narrowing the optional `card` prop inside face-up branch
- `strength-dot` and `strength-badge` share the same `.strength-{level}` color class to keep CSS dry
- `snusking.css` includes a `.lobby-page` scoped class and `.snusking-highnic-blur` utility rather than duplicating any global.css classes
- `score-pop` keyframe preserves `translateX(-50%)` to maintain centering while animating upward

## Deviations from Plan

None — plan executed exactly as written. The score-pop keyframe was extended to maintain the centering transform (plan specified `translateY` only), which was necessary for correctness given the `left: 50%; transform: translateX(-50%)` positioning pattern.

## Issues Encountered

None. TypeScript compiled clean on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `SnuskingCard` is ready for import by all remaining Phase 3 plans (03-02 through 03-05)
- `snusking.css` defines all CSS class names needed by Board, Hand, OpponentStatus, PlayerHUD, EndScreen, RevealOverlay — later plans only need to add class names, not new CSS files
- Plan 03-04 adds `import './games/snusking/snusking.css'` to `client/src/index.tsx`

---
*Phase: 03-client-ui-and-reveal-experience*
*Completed: 2026-03-13*
