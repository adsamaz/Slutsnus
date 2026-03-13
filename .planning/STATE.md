---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 02-01 complete
status: in-progress
last_updated: "2026-03-13T15:39:00Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 12
  completed_plans: 11
  percent: 92
---

# Project State

**Project:** Snusking
**Updated:** 2026-03-13
**Last session:** Completed 02-01-PLAN.md (Phase 2 type contracts, type test fixtures updated, shared compiles clean)

---

## Current Status

**Milestone:** 1.0 — Card Game Engine
**Active Phase:** Phase 2 — Card Design, Balance, and Game Economy (executing — plan 1 of 5 complete)
**Current Plan:** 02-01 complete
**Overall Progress:** [█████████░] 92% — 11 / 12 plans complete

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and Engine Contract | Complete |
| 2 | Card Design, Balance, and Game Economy | In progress — 1/5 plans complete |
| 3 | Client UI and Reveal Experience | Not started |
| 4 | Integration, Playtesting, and Balance Iteration | Not started |

---

## Key Decisions Locked

- Replace `snus-rpg` engine entirely — no hybrid approach
- Simultaneous reveal (commit-then-reveal) is the defining mechanic
- Per-player state projection is non-negotiable — implement in Phase 1
- `TurnBasedGameEngine` interface extension — define before any implementation code
- No new frameworks — plain TypeScript class implementing existing `GameEngine` interface
- Zod (server-only) for action payload validation
- `crypto.randomInt` Fisher-Yates for deck shuffle
- DOM components (Solid.js) over canvas for card UI
- Beer hold cap: max 2–3 units
- Turn timer starting point: 45 seconds (tunable after playtesting)
- Score threshold starting point: 200 (tunable after playtesting)
- Import Snusking types from `@slutsnus/shared` (workspace package), not relative paths
- `SnuskingProjectedState` uses `self`/`opponents` fields (not `players` map) — confirmed by type definition
- Vitest resolve alias required for `@slutsnus/shared` in server workspace test runs
- Snusking types added directly to shared/src/types.ts (no separate file) — matches existing project convention
- GameContainer uses fragment wrapper so snus-rpg and snusking Show blocks coexist under the gameState accessor
- onAction in SnuskingGame casts to existing GameAction type — no new Snusking-specific action type needed at this layer
- SNUSKING_EVENTS exported from deck.ts as catalog data (not engine.ts logic)
- Use it.todo() for RED-state test stubs (not expect(true).toBe(false)) — avoids TypeScript errors before implementation types exist
- Group RED stubs by requirement ID in separate describe blocks (EVENT-SYS-3, BEER-RES, TRADE-SAB)
- Card empirePoints from research matrix: siberia=30, odens=28, thunder=25, catch-licorice=22, general=20, zyn=19, goteborg=18, knox-blue=17, lundgrens=16, ettan=15, grov=14, velo=12
- SnuskingCardDefinition.strength and flavor are required (non-optional) — all catalog entries must declare them
- sabotage actions split into sabotage-spentsnus and sabotage-highnic (not generic sabotage) — explicit union members aid Zod validation and engine dispatch

---

## Open Questions

- ~~Exact `onStateUpdate` callback change approach~~ — resolved: `{ forUserId, state }` wrapper pattern (keeps `GameEngine.init()` signature unchanged)
- Maximum hand size (cards held simultaneously)? (resolve in Phase 2 balance design)
- Are trades resolved during the same reveal cycle, or queued for next turn? (resolve in Phase 2)
- Sabotage immunity card name and cost? (resolve in Phase 2)

---

## Completed Work

- [x] Project initialized — PROJECT.md, REQUIREMENTS.md, ROADMAP.md
- [x] Codebase mapped — ARCHITECTURE.md, STACK.md, CONVENTIONS.md, TESTING.md, STRUCTURE.md, CONCERNS.md, INTEGRATIONS.md
- [x] Research complete — FEATURES.md, ARCHITECTURE.md, STACK.md, PITFALLS.md, SUMMARY.md
- [x] Phase 1 planned — 01-RESEARCH.md, 01-VALIDATION.md, 7 PLAN.md files (01-01 through 01-07)
- [x] Plan 01-01 complete — Vitest installed, RED-state test stubs for engine/rules/deck (4 min)
- [x] Plan 01-02 complete — TurnBasedGameEngine interface and full Snusking type contracts defined in registry.ts and shared/src/types.ts (4 min)
- [x] Plan 01-03 complete — Card catalog (8 real brands), Fisher-Yates shuffle (crypto.randomInt), pure rule functions (scoreCards, checkWinCondition, drawCards, spendCards) (5 min)
- [x] Plan 01-04 complete — SnuskingEngine FSM (draw→planning→reveal→resolve), simultaneous reveal, 45s auto-pass timer, per-player projectState, Zod action validation — all 22 tests GREEN (15 min)
- [x] Plan 01-06 complete — Snusking client UI components: Board, Hand, OpponentStatus, PlayerHUD, EndScreen, SnuskingGame root; GameContainer routing wired (4 min)
- [x] Plan 02-01 complete — Phase 2 type contracts: SnuskingCardStrength/Flavor, SnuskingEventCard, sabotage flags on SnuskingPlayerState, extended SnuskingAction union (9 total), type tests updated (2 min)
- [x] Plan 02-02 complete — 15 RED-state it.todo stubs: 5 event-multiplier stubs in rules.test.ts, 10 beer/sabotage stubs in engine.test.ts; baseline scoreCards asserts 35 points (8 min)
- [x] Plan 02-03 complete — 12-card catalog with strength/flavor, SNUSKING_EVENTS pool (3 events), buildDeck() stamps strength/flavor on instances — all 12 tests GREEN (2 min)
