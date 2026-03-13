---
phase: 2
slug: card-design-balance-and-game-economy
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
audited: 2026-03-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `server/vitest.config.ts` (exists) |
| **Quick run command** | `cd server && npm test -- --reporter=dot` |
| **Full suite command** | `cd server && npm test` |
| **Estimated runtime** | ~300ms |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npm test -- --reporter=dot`
- **After every plan wave:** Run `cd server && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** <1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-* | 02-01 | 1 | CARD-SYS | unit | `cd server && npm test -- deck.test` | ✅ deck.test.ts | ✅ green |
| 2-02-* | 02-02 | 1 | EVENT-SYS, EVENT-SYS-3 | unit | `cd server && npm test -- rules.test` | ✅ rules.test.ts | ✅ green |
| 2-03-* | 02-03 | 2 | BEER-RES, BEER-RES-2 | unit | `cd server && npm test -- rules.test engine.test` | ✅ both | ✅ green |
| 2-04-* | 02-04 | 2 | TRADE-SAB-2..6 | unit | `cd server && npm test -- engine.test` | ✅ engine.test.ts | ✅ green |
| 2-05-* | 02-05 | 3 | All Phase 2 | unit | `cd server && npm test` | ✅ full suite | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Total: 46 tests, 3 test files, all green.**

---

## Wave 0 Requirements

- [x] `server/src/games/snusking/rules.test.ts` — EVENT-SYS-3 multipliers (5 tests): 2x/1.5x/1x/combined/isSpentSnus
- [x] `server/src/games/snusking/engine.test.ts` — TRADE-SAB-2..5 (6 tests) + BEER-RES (4 tests): all green

*All wave 0 gaps resolved during execution — no new test files were needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blurry screen flag received by client | TRADE-SAB-3 | Client-side UI effect; server emits flag, Phase 3 renders it | Send high-nic sabotage, inspect socket payload for `highNicEffect: true` in projected state |
| Balance feel in 4-player session | BALANCE | Subjective; playtesting is Phase 4 | Human playtest session, track score curve |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s (actual: <1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-03-13

---

## Validation Audit 2026-03-13

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved (pre-existing) | 11 |
| Escalated | 0 |
