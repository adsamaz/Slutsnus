---
phase: 1
slug: foundation-and-engine-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Wave 0 installs) |
| **Config file** | `server/vitest.config.ts` — Wave 0 creates |
| **Quick run command** | `npm test --workspace=@slutsnus/server` |
| **Full suite command** | `npm test --workspace=@slutsnus/server -- --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test --workspace=@slutsnus/server`
- **After every plan wave:** Run `npm test --workspace=@slutsnus/server -- --coverage` + `tsc --noEmit` across all workspaces
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test (2-socket game start → play 3 rounds → end screen)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | REQ-NFR-04 | type-check | `tsc --noEmit` in server workspace | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | REQ-NFR-05 | type-check | `tsc --noEmit` in shared workspace | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | REQ-NFR-03 | unit | `vitest run server/src/games/snusking/deck.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | REQ-CORE-03 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | REQ-CORE-04 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 1 | REQ-CORE-05 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 1 | REQ-CORE-06 | unit | `vitest run server/src/games/snusking/rules.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 1 | REQ-CORE-07 | unit | `vitest run server/src/games/snusking/rules.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-09 | 01 | 1 | REQ-MULTI-01 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-10 | 01 | 1 | REQ-MULTI-02 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-11 | 01 | 1 | REQ-NFR-01 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-12 | 01 | 1 | REQ-NFR-02 | unit | `vitest run server/src/games/snusking/engine.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-13 | 01 | 2 | REQ-MULTI-03 | manual | see Manual-Only Verifications | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/vitest.config.ts` — Vitest configuration for server workspace
- [ ] `server/src/games/snusking/engine.test.ts` — stubs for REQ-CORE-03, REQ-CORE-04, REQ-CORE-05, REQ-MULTI-01, REQ-MULTI-02, REQ-NFR-01, REQ-NFR-02
- [ ] `server/src/games/snusking/rules.test.ts` — stubs for REQ-CORE-06, REQ-CORE-07
- [ ] `server/src/games/snusking/deck.test.ts` — stubs for REQ-NFR-03
- [ ] Framework install: `npm install -D vitest --workspace=@slutsnus/server`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reconnecting player receives current projected state | REQ-MULTI-03 | Requires two Socket.IO clients, one disconnect/reconnect cycle, and state snapshot comparison — needs full running server stack | Start game with 2 sockets. Disconnect one mid-planning phase. Reconnect it. Verify received `game:state` matches `projectState(userId)` for that player only. Verify opponent hands are NOT in the snapshot. |
| Slut Snus end screen displays before results | REQ-CORE-07 | UI end-to-end, requires actual gameplay | Play until deck + discard both empty; verify special "Slut Snus" screen appears before final scores. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
