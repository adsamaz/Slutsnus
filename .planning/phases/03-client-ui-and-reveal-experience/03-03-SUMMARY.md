---
plan: "03-03"
phase: "03-client-ui-and-reveal-experience"
status: complete
completed: "2026-03-13"
---

# Plan 03-03 Summary: PlayerHUD + OpponentStatus

## What Was Built

`PlayerHUD.tsx` and `OpponentStatus.tsx` both fully rewritten. PlayerHUD was already complete from a prior partial attempt; OpponentStatus needed the face-down card backs and Swedish copy.

## Key Files

### Modified
- `client/src/games/snusking/PlayerHUD.tsx` — Beer mugs, SVG timer ring, debuff banners, opponent score list (complete)
- `client/src/games/snusking/OpponentStatus.tsx` — Face-down SnuskingCard backs, commit indicator, beer count, disconnected state

## What They Do

**PlayerHUD:**
- BeerMugs sub-component renders 🍺/🫗 icons up to max 3
- Inline SVG circular timer ring: `stroke-dasharray/offset` driven by timeRemaining/maxTime. Color class: green >50%, yellow >20%, red otherwise. Displays numeric countdown.
- Self section: username, score (poäng), beer mugs, debuff banners (skip/highnic/immunity)
- Opponent section: name + score + beer mugs for each opponent

**OpponentStatus:**
- Per-opponent zone: header (name, score, beer icons), commit dot (Redo/Tänker...), face-down SnuskingCard backs (count = handCount, shown during planning+reveal phases only), disconnected label
- Uses `<SnuskingCard />` with no card prop = face-down mode
- Swedish copy throughout

## TypeScript

0 errors — `npx tsc --noEmit -p client/tsconfig.json` clean.
