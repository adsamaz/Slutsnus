---
phase: 02-card-design-balance-and-game-economy
plan: 03
subsystem: deck
tags: [card-catalog, event-pool, tdd, data-layer]
dependency_graph:
  requires: [02-01]
  provides: [SNUSKING_CARDS-12, SNUSKING_EVENTS, buildDeck-strength-flavor]
  affects: [engine.ts, rules.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, catalog data layer]
key_files:
  created: []
  modified:
    - server/src/games/snusking/deck.ts
    - server/src/games/snusking/deck.test.ts
decisions:
  - "Card empirePoints from research matrix: general=20, siberia=30, ettan=15, goteborg=18, grov=14, catch-licorice=22, odens-extreme=28, thunder-strong=25, knox-blue=17, lundgrens=16, velo=12, zyn=19"
  - "SNUSKING_EVENTS exported from deck.ts (not engine.ts) as it is catalog data, not engine logic"
  - "Tests written first (RED commit) then deck.ts updated (GREEN commit) per TDD protocol"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-13"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
requirements_satisfied: [CARD-SYS, EVENT-SYS]
---

# Phase 02 Plan 03: Deck Catalog and Event Pool Summary

12-card catalog with strength/flavor fields and SNUSKING_EVENTS pool with 3 situational events, all stamped onto SnuskingCardInstance by buildDeck().

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend deck.ts — 12-card catalog, event pool, buildDeck stamp | ede61be | deck.ts |
| 2 | Extend deck.test.ts with catalog and event pool tests | 3970412 (RED) / ede61be (GREEN) | deck.test.ts |

---

## What Was Built

### deck.ts changes

- Updated all 8 existing `SNUSKING_CARDS` entries with `strength` and `flavor` fields
- Added `canProvideImmunity: true` to the Göteborgs Rapé entry
- Added 4 new cards: Knox Blue (medium/tobacco/17), Lundgrens (low/citrus/16), Velo (low/mint/12), Zyn (medium/citrus/19)
- Exported new `SNUSKING_EVENTS` constant with 3 event cards (Sauna Night, Fishing Trip, Party)
- Updated `buildDeck()` to stamp `strength` and `flavor` onto every `SnuskingCardInstance`
- Deck grows from 24 (8×3) to 36 (12×3) cards
- Added `SnuskingEventCard` to imports from `@slutsnus/shared`

### deck.test.ts changes

- Updated import to include `SNUSKING_CARDS` and `SNUSKING_EVENTS`
- Added `SNUSKING_CARDS catalog (CARD-SYS)` describe block: 6 tests covering count, strength/flavor on all cards, goteborg immunity, buildDeck length, instances stamped
- Added `SNUSKING_EVENTS pool (EVENT-SYS)` describe block: 3 tests covering count and non-empty affinity arrays
- Total: 12 tests (3 existing shuffle + 6 catalog + 3 events), all green

---

## Test Results

```
Test Files  1 passed (1)
Tests       12 passed (12)
Duration    ~200ms
```

All must-haves satisfied:
- SNUSKING_CARDS has exactly 12 entries — confirmed
- Each entry has strength and flavor — confirmed
- Göteborgs Rapé has canProvideImmunity: true — confirmed
- SNUSKING_EVENTS has exactly 3 entries — confirmed
- buildDeck() stamps strength and flavor onto each instance — confirmed

---

## Deviations from Plan

None — plan executed exactly as written.

TDD protocol followed: RED commit (3970412) added failing tests first, GREEN commit (ede61be) implemented deck.ts changes. Both tasks' test blocks were written in a single RED commit since they cover the same data layer, then satisfied by a single GREEN implementation commit.

---

## Self-Check

## Self-Check: PASSED

- FOUND: server/src/games/snusking/deck.ts
- FOUND: server/src/games/snusking/deck.test.ts
- FOUND: .planning/phases/02-card-design-balance-and-game-economy/02-03-SUMMARY.md
- FOUND commit: ede61be (feat - deck.ts implementation)
- FOUND commit: 3970412 (test - RED state)
