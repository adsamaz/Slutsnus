---
status: resolved
trigger: "game-click-no-navigation"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — game card was an unlinked div with no navigation wired up, and no game detail route existed
test: Read Home.tsx and App.tsx
expecting: N/A — root cause confirmed and fix applied
next_action: await human verification

## Symptoms

expected: Clicking a game navigates to its detail/play page
actual: Nothing happens at all — no visual feedback, no navigation
errors: No console errors
reproduction: Click any game card/link (e.g. "Snus King") in the app
started: Never worked — fresh feature not yet functional

## Eliminated

- hypothesis: Route /game/:id is missing entirely
  evidence: App.tsx has /game/:code route but it is for a live game session with a room code, not a game detail page
  timestamp: 2026-03-11T00:00:00Z

## Evidence

- timestamp: 2026-03-11T00:00:00Z
  checked: client/src/pages/Home.tsx lines 78-97
  found: The .game-card div contains game info and conditionally renders a "Play" Button for logged-in users. The Button onClick calls setCreateOpen(true), opening a modal to create a room. The card itself (the div) has NO onClick handler and NO anchor/link wrapping it.
  implication: Clicking the card body/title does nothing. Clicking "Play" opens a modal (which does work). There is no game detail page route — the only game-related route is /game/:code for live sessions.

- timestamp: 2026-03-11T00:00:00Z
  checked: client/src/App.tsx
  found: Routes defined: /, /login, /register, /lobby/:code, /game/:code, /friends, /leaderboard, /profile. No route like /games or /games/:slug exists.
  implication: There is nowhere to navigate TO when clicking a game card, because no game detail/info page exists yet.

## Resolution

root_cause: The game card in Home.tsx was a plain <div> with no click handler or link wrapper. No game detail route existed in App.tsx. Clicking the card did nothing because there was nowhere to navigate to and no handler was attached.
fix: Created GameDetail page at client/src/pages/GameDetail.tsx. Registered route /games/:slug in App.tsx. Wrapped the game card div in Home.tsx with an <A href="/games/snus-rpg"> from @solidjs/router. Removed the redundant "Play" button from the card (moved to the detail page).
verification: confirmed by user — clicking game card navigates to detail page successfully
files_changed:
  - client/src/pages/GameDetail.tsx (created)
  - client/src/App.tsx (added GameDetail import and /games/:slug route)
  - client/src/pages/Home.tsx (wrapped game card with <A> link, removed inline Play button)
