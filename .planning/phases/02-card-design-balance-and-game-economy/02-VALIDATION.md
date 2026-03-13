---
phase: 2
slug: card-design-balance-and-game-economy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
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
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npm test -- --reporter=dot`
- **After every plan wave:** Run `cd server && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-* | 02-01 | 1 | CARD-SYS | unit | `cd server && npm test -- deck.test` | ✅ extend deck.test.ts | ⬜ pending |
| 2-02-* | 02-02 | 1 | EVENT-SYS, EVENT-SYS-3 | unit | `cd server && npm test -- rules.test` | ✅ extend rules.test.ts | ⬜ pending |
| 2-03-* | 02-03 | 2 | BEER-RES, BEER-RES-2 | unit | `cd server && npm test -- rules.test engine.test` | ✅ extend both | ⬜ pending |
| 2-04-* | 02-04 | 2 | TRADE-SAB-2..6 | unit | `cd server && npm test -- engine.test` | ✅ extend engine.test.ts | ⬜ pending |
| 2-05-* | 02-05 | 3 | All Phase 2 | unit | `cd server && npm test` | ✅ full suite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/games/snusking/rules.test.ts` — extend with combo multiplier stubs (EVENT-SYS-3, BEER-RES-2); current `scoreCards` test is a placeholder `expect(true).toBe(true)`
- [ ] `server/src/games/snusking/engine.test.ts` — extend with RED stubs for sabotage state transitions (TRADE-SAB-2, TRADE-SAB-3, TRADE-SAB-4, TRADE-SAB-5) and beer accounting (BEER-RES)

*Existing infrastructure covers all phase requirements — no new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blurry screen flag received by client | TRADE-SAB-3 | Client-side UI effect; server emits flag, Phase 3 renders it | Send high-nic sabotage, inspect socket payload for `highNicEffect: true` in projected state |
| Balance feel in 4-player session | BALANCE | Subjective; playtesting is Phase 4 | Human playtest session, track score curve |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
