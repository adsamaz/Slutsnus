---
plan: "03-02"
phase: "03-client-ui-and-reveal-experience"
status: complete
completed: "2026-03-13"
---

# Plan 03-02 Summary: Hand.tsx — Play/Sabotage/Trade Tabs

## What Was Built

`Hand.tsx` fully rewritten as a three-tab planning interface replacing the minimal skeleton.

## Key Files

### Modified
- `client/src/games/snusking/Hand.tsx` — Complete rewrite with Play/Sabotage/Trade tabs, all 9 SnuskingAction types wired, debuff state, trade modal
- `client/src/games/snusking/index.tsx` — Updated to pass new HandProps (self, opponents, pendingTradeOffers, onAction) and OpponentStatus phase prop

## What It Does

**Play tab:** Card grid with SnuskingCard components. Spend, Spend+Beer (beer>0 conditional), Immunity (immunityActive conditional), Pass buttons. All disabled when hasCommitted or skipNextTurn.

**Sabotage tab:** Two-step flow — select card → pick target opponent → confirm with "Skicka spent snus" or "Skicka hög-nic". Wires snusking:sabotage-spentsnus and snusking:sabotage-highnic.

**Trade tab:** Card grid → click card opens Modal with fake name input (pre-filled with real name), target selector, Send button. Wires snusking:trade-offer. Incoming offers shown inline with Acceptera/Avvisa buttons (also wires snusking:trade-accept and snusking:trade-decline).

**Debuffs:** highNicEffect → `highnic-blur` CSS class + banner. skipNextTurn → skip banner + all buttons disabled.

**Toast notifications:** createEffect watches pendingTradeOffers, shows non-blocking toast via showToast for each new offer (deduplicated via module-level Set).

## Decisions Documented

- `shownOffers` Set is module-level (survives re-renders, reset on page load — acceptable for game session)
- `beerCardId: 'beer'` placeholder used in spend-with-beer action (beer is not a card instance)
- index.tsx updated to use new prop shapes for Hand, PlayerHUD (timeRemaining), OpponentStatus (phase)
- Board.tsx currentEvent prop deferred to plan 03-04 (Board will be fully rewritten there)

## TypeScript

0 errors — `npx tsc --noEmit -p client/tsconfig.json` clean.
