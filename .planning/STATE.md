# Project State

**Project:** Snusking
**Updated:** 2026-03-12
**Last session:** Completed 01-06-PLAN.md (Snusking client UI components)

---

## Current Status

**Milestone:** 1.0 — Card Game Engine
**Active Phase:** Phase 1 — Foundation and Engine Contract (executing — plan 6 of 7 complete)
**Current Plan:** 01-07 (next to execute)
**Overall Progress:** 0 / 4 phases complete (6/7 plans in Phase 1 done)

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and Engine Contract | In progress — 6/7 plans complete |
| 2 | Card Design, Balance, and Game Economy | Not started |
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
- [x] Plan 01-06 complete — Snusking client UI components: Board, Hand, OpponentStatus, PlayerHUD, EndScreen, SnuskingGame root; GameContainer routing wired (4 min)
