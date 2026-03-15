---
phase: 6
slug: core-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 (server workspace) |
| **Config file** | `server/vitest.config.ts` |
| **Quick run command** | `npm run test --workspace=server` |
| **Full suite command** | `npm run test --workspace=server && npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test --workspace=server`
- **After every plan wave:** Run `npm run test --workspace=server && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green + clean tsc + human playthrough
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 0 | GAME-02..09 | unit stubs | `npm run test --workspace=server` | ✅ (extend engine.test.ts) | ⬜ pending |
| 06-01-02 | 01 | 0 | GAME-02..09 | type check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 06-02-01 | 02 | 1 | GAME-03,04 | unit | `npm run test --workspace=server` | ✅ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | GAME-05,06,07 | unit | `npm run test --workspace=server` | ✅ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | GAME-08,09 | unit | `npm run test --workspace=server` | ✅ W0 | ⬜ pending |
| 06-02-04 | 02 | 1 | GAME-02 | unit | `npm run test --workspace=server` | ✅ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | PLAT-02 | unit | `npm run test --workspace=server` | ✅ | ⬜ pending |
| 06-04-01 | 04 | 2 | PLAT-04 | type check | `npx tsc --noEmit` | N/A | ⬜ pending |
| 06-05-01 | 05 | 3 | PLAT-03 | smoke | Manual: play game to end, check leaderboard | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `server/src/games/snus-catcher/engine.test.ts` — add RED stubs for physics (GAME-02..09): spawn, collision, lives, score, win condition
- [ ] `shared/src/types.ts` — add `SenusCatcherState`, `SenusCatcherPlayerState`, `SenusCatcherObject`, `SenusCatcherAction` types (verified by tsc, not unit tests)

*Wave 0 creates RED test stubs; implementation in Wave 1+ turns them GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snus pouches fall and bar catches them | GAME-03, GAME-05 | Canvas rendering — no automated test harness | Open two browser tabs, join same room, observe pouches falling and bar catching |
| Spent pouches cost lives | GAME-04, GAME-06 | Canvas + collision visual feedback | Touch a spent pouch, confirm HUD shows lives decrement |
| Win/loss screen displays on 0 lives | GAME-08, GAME-09 | UI rendering flow | Lose all 3 lives, confirm result screen shows winner/loser |
| Leaderboard written on game end | PLAT-03 | DB write via room.ts (existing) | After game ends, check leaderboard page shows new entry |
| Return to lobby button works | PLAT-04 | UI navigation | Click button on result screen, confirm lobby appears |
| Both players see real-time score/lives | PLAT-02 | Multi-tab socket sync | Score/lives update on both tabs simultaneously |
| 60fps canvas rendering without stutter | PLAT-02 | Visual inspection | Observe canvas animation smoothness throughout match |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
