# Project State

**Project:** Snusking
**Updated:** 2026-03-12

---

## Current Status

**Milestone:** 1.0 — Card Game Engine
**Active Phase:** Phase 1 — Foundation and Engine Contract (planned, ready to execute)
**Overall Progress:** 0 / 4 phases complete

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and Engine Contract | Planned — 7 plans ready |
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
