---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Requirement Coverage
current_plan: 06-02 (next)
status: roadmap created
last_updated: "2026-03-14T23:26:23.010Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 7
  completed_plans: 4
  percent: 88
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Requirement Coverage
current_plan: Not started
status: roadmap created
last_updated: "2026-03-14T23:22:42.246Z"
progress:
  [█████████░] 88%
  completed_phases: 1
  total_plans: 7
  completed_plans: 3
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Requirement Coverage
current_plan: 05-02 (next)
status: roadmap created
last_updated: "2026-03-14T22:39:24.612Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Requirement Coverage
current_plan: —
status: roadmap created
last_updated: "2026-03-14T22:24:50.904Z"
progress:
  [██████████] 100%
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 95
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Snus Catcher
current_plan: —
status: roadmap created
last_updated: "2026-03-14T00:00:00Z"
progress:
  [██████████] 95%
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

**Project:** Snusking Platform
**Updated:** 2026-03-15
**Last session:** 2026-03-14T23:25:28Z

---

## Current Status

**Milestone:** 2.0 — Snus Catcher
**Active Phase:** Phase 6 — Snus Catcher: Core Loop (3/5 plans complete)
**Current Plan:** 06-04 (next)
**Overall Progress:** [█████████░] 88% — 21/24 plans complete across all phases

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and Engine Contract | Complete |
| 2 | Card Design, Balance, and Game Economy | In progress — 1/5 plans complete |
| 3 | Client UI and Reveal Experience | In progress — 1/5 plans complete (03-05 done) |
| 4 | Integration, Playtesting, and Balance Iteration | Not started |
| 5 | Snus Catcher: Foundation | Complete |
| 6 | Snus Catcher: Core Loop | Not started |
| 7 | Snus Catcher: Powerups | Not started |

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
- SnuskingCard is purely prop-driven (no createSignal) — all visual state (selected, disabled, combo, discarding) flows from parent
- snusking.css is the single CSS file for all Phase 3 game-specific styles — imported once at index.tsx
- Strength color scale: low=#39d353, medium=#ffa657, high=#f97316, extreme=#da3633 (reused from global palette)
- Swedish copy throughout all snusking UI — no English player-facing strings
- Return-to-lobby button in EndScreen uses window.location.href = '/' (hard navigation, not SPA route) — correct for post-game flow
- Self-aware winner detection in EndScreen: selfUserId comparison yields "Du har byggt riket!" vs "Riket är byggt!" + winner name
- RevealOverlay shows opponent hands as face-down card backs (handCount determines count) — actual cards remain server-private until resolve phase
- Board receives eventFlashActive as prop from index.tsx — Board is purely presentational, index.tsx owns all reactive state
- index.tsx applies snusking-highnic-blur class (matching CSS definition) when highNicEffect && phase === 'planning'
- ToastContainer mounted at root of snusking-game div (above all fixed-position overlays in DOM order)
- Snus Catcher: server-authoritative collision (client sends bar X fraction only; server resolves all catches)
- Snus Catcher: client-authoritative bar rendering (render at cursor immediately, never wait for server echo)
- Snus Catcher: 20Hz server tick (setInterval at 50ms) — balances physics accuracy vs Socket.IO overhead
- Snus Catcher: canvas rendering for game viewport (avoids DOM layout recalculation at 60fps for 10–30 moving objects)
- Snus Catcher: 3 lives per player — classic arcade feel
- Snus Catcher: independent playfields — each player has their own falling objects
- Snus Catcher: GameType propagation must be atomic (shared types + registry + GameContainer + lobby in one commit)
- Snus Catcher: use createStore not createSignal for 20Hz game state — prevents full re-render on every tick
- Snus Catcher: bar position emits throttled to 30ms intervals
- Snus Catcher: powerup timing via expiresAtTick (not wall-clock) — prevents client timer display divergence
- Snus Catcher: powerup balance values are LOW confidence starting points — implement as named constants, tune from playtesting
- Snus Catcher: lobby title must derive from gameType dynamically — hardcoded game name is a bug (caught during 05-02 verification)
- Snus Catcher: SenusCatcherObject.type uses 'fresh'/'spent' string union (not boolean) — explicit discriminant for collision logic
- Snus Catcher: objects array on SenusCatcherPlayerState (per-player, not top-level) — implements independent playfields model
- Snus Catcher: SenusCatcherAction uses payload wrapper for bar-move xFraction — consistent with GameAction interface pattern
- Snus Catcher: GameContainer signal widened to createSignal<unknown> — each Show block casts internally to its own state type, avoiding game-specific leakage at shared signal boundary
- Snus Catcher: render.ts is a pure module (no SolidJS imports, no signals) — drawFrame takes localBarX as pixel X, caller owns mouse-to-pixel conversion

---

## Open Questions

- ~~Exact `onStateUpdate` callback change approach~~ — resolved: `{ forUserId, state }` wrapper pattern (keeps `GameEngine.init()` signature unchanged)
- Maximum hand size (cards held simultaneously)? (resolve in Phase 2 balance design)
- Are trades resolved during the same reveal cycle, or queued for next turn? (resolve in Phase 2)
- Sabotage immunity card name and cost? (resolve in Phase 2)
- Snus Catcher: lobby game type selection UI scope — REST route change at room creation? (confirm in Phase 5)

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
- [x] Plan 03-01 complete — SnuskingCard component (face-up/face-down/selected/combo/discard states, prop-driven, zero signals) + snusking.css (569 lines, all Phase 3 game styles + keyframes) — TypeScript clean (15 min)
- [x] Plan 03-04 complete — RevealOverlay created (CSS 3D flip, self cards with comboLevel, opponents as face-down backs); Board rewritten (event flash full-screen overlay + persistent banner, Swedish labels); index.tsx rewritten (CSS import, ToastContainer, event flash timer via createEffect, highnic blur class, all Phase 3 components wired) (10 min)
- [x] Plan 03-05 complete — EndScreen polished (Swedish copy, self-aware winner detection, results table with rank/username/score, return button); Lobby redesigned (Swedish l10n throughout, snusking theme) (10 min)
- [x] v2.0 milestone started — requirements defined (18 requirements: GAME-01–09, PWR-01–05, PLAT-01–04)
- [x] v2.0 roadmap created — Phases 5, 6, 7 defined with success criteria and 100% requirement coverage
- [x] Plan 05-01 complete — SenusCatcherEngine stub (20Hz tick, 4 GREEN tests), GameType union expanded, atomic registration in registry/GameContainer/Home/Lobby (~20 min)
- [x] Plan 05-02 complete — Human verification passed (all 4 steps); lobby title bug fixed (dynamic gameType); GAME-01 and PLAT-01 satisfied (~10 min)
- [x] Phase 5 complete — Snus Catcher foundation verified end-to-end
- [x] Plan 06-01 complete — SenusCatcherState/PlayerState/Object/Action types in shared/src/types.ts; 22 RED it.todo() stubs for GAME-02–09 grouped by requirement in engine.test.ts (~5 min)
- [x] Plan 06-03 complete — GameContainer signal widened to unknown; SenusCatcherGame wired with state+onAction props; render.ts exports pure drawFrame; snus-catcher.css provides all layout and end-screen styles (~8 min)
