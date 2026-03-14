---
phase: 5
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (server workspace) |
| **Config file** | `server/vitest.config.ts` |
| **Quick run command** | `npm run test --workspace=server` |
| **Full suite command** | `npm run test --workspace=server && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=server`
- **After every plan wave:** Run `npm run test --workspace=server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green + clean tsc
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | GAME-01 infra | unit | `npm run test --workspace=server -- --testPathPattern snus-catcher` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | GAME-01, PLAT-01 | type check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | GAME-01 infra | unit | `npm run test --workspace=server -- --testPathPattern snus-catcher` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/games/snus-catcher/engine.test.ts` — stubs for init/tick/destroy lifecycle (GAME-01 infrastructure)
- [ ] `server/src/games/snus-catcher/engine.ts` — stub implementation (must exist before test can import)

*Wave 0 creates RED test stubs; implementation in Wave 1 turns them GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Lobby shows "Snus Catcher" | PLAT-01 | UI rendering — no Solid.js test harness | Open app, confirm Snus Catcher card appears on Home page |
| Room create + join flow | GAME-01 | Multi-socket UI flow | Open two browser tabs, create Snus Catcher room, second tab joins |
| Server emits ticks to both sockets | GAME-01 | Real-time socket behavior | Open room, observe console for tick events from both socket perspectives |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
