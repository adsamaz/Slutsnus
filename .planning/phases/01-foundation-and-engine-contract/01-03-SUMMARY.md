---
phase: 01-foundation-and-engine-contract
plan: "03"
subsystem: game-engine
tags: [snusking, deck, rules, fisher-yates, crypto, pure-functions, typescript]

# Dependency graph
requires:
  - 01-02 (SnuskingCardInstance, SnuskingMasterState, GameEndReason types from shared)
provides:
  - SNUSKING_CARDS catalog with 8 real brand names
  - buildDeck() returning 24 SnuskingCardInstance with uuid v4 instanceIds
  - shuffle<T>() using crypto.randomInt Fisher-Yates (no Math.random)
  - scoreCards() summing empirePoints
  - checkWinCondition() returning score_threshold or slut_snus (null if neither)
  - drawCards() filling hand to MAX_HAND_SIZE with discard reshuffle fallback
  - spendCards() removing cards from hand and crediting empireScore
  - MAX_HAND_SIZE=5 and SCORE_THRESHOLD=200 constants
affects:
  - 01-04 (engine imports buildDeck, shuffle, drawCards, spendCards, checkWinCondition)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure functions — all rule functions return new state objects (no mutation)
    - crypto.randomInt Fisher-Yates for unbiased deck shuffle (REQ-NFR-03)
    - UUID v4 instanceIds on card instances (unique per deck build)

key-files:
  created:
    - server/src/games/snusking/deck.ts
    - server/src/games/snusking/rules.ts

key-decisions:
  - "COPIES_PER_CARD=3 gives 24-card deck (3 × 8 brands) — enough for 2-4 player games before reshuffle"
  - "drawCards reshuffles discard into deck mid-draw if deck runs dry — slut_snus only when both empty"
  - "spendCards adds cards to discardPile and credits empireScore immediately (not deferred)"
  - "scoreCards is a pure utility function reused by both spendCards and future scoring reports"

requirements-completed:
  - REQ-CORE-06
  - REQ-CORE-07
  - REQ-NFR-03

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 1 Plan 03: Card Catalog, Fisher-Yates Deck Builder, and Pure Rule Functions

**Card catalog with 8 real snus brands, Fisher-Yates shuffle using crypto.randomInt, and pure rule functions (scoreCards, checkWinCondition, drawCards, spendCards) — all deck.test.ts and rules.test.ts stubs GREEN**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-03-12
- **Tasks:** 2
- **Files created:** 2 (deck.ts, rules.ts)

## Accomplishments

- SNUSKING_CARDS: 8 real brand entries (General 20pts, Siberia -80 30pts, Ettan 15pts, Göteborgs Rapé 18pts, Grov 14pts, Catch Licorice 22pts, Oden's Extreme 28pts, Thunder Extra Strong 25pts)
- buildDeck(): 24 instances (3 copies × 8 cards) with uuid v4 instanceIds
- shuffle<T>(): Fisher-Yates with crypto.randomInt — no Math.random anywhere
- scoreCards(): sums empirePoints across SnuskingCardInstance[]
- checkWinCondition(): score_threshold if any player >= SCORE_THRESHOLD (200), slut_snus if deck+discard both empty, null otherwise
- drawCards(): fills hand to MAX_HAND_SIZE=5, reshuffles discard into deck if deck empties mid-draw
- spendCards(): removes cardIds from hand, adds to discardPile, credits empireScore
- All 9 tests pass GREEN (deck×3, rules×6)

## Task Commits

1. **Task 1+2: Card catalog, deck builder, Fisher-Yates shuffle, and pure rules** — `a5eca26`

## Files Created

- `server/src/games/snusking/deck.ts` — SNUSKING_CARDS, buildDeck(), shuffle()
- `server/src/games/snusking/rules.ts` — scoreCards(), checkWinCondition(), drawCards(), spendCards(), MAX_HAND_SIZE, SCORE_THRESHOLD

## Decisions Made

- `COPIES_PER_CARD = 3` gives 24-card deck — sufficient for 2-4 player games with mid-round reshuffle fallback
- `drawCards` reshuffles discard pile into deck before stopping draw — slut_snus only triggered when both deck and discard are empty
- All rule functions return new state objects (spread operator) — zero mutation for testability

## Deviations from Plan

None — plan executed exactly as written. Both deck.test.ts and rules.test.ts stubs turned GREEN immediately.

---

*Phase: 01-foundation-and-engine-contract*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: server/src/games/snusking/deck.ts
- FOUND: server/src/games/snusking/rules.ts
- FOUND commit: a5eca26 (feat(01-03): implement card catalog, Fisher-Yates deck builder, and pure rule functions)
