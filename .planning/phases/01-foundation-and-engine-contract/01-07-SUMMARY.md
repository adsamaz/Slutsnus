---
phase: 01-foundation-and-engine-contract
plan: "07"
subsystem: platform-cleanup
tags: [snusking, snus-rpg-removal, lobby, smoke-test, human-verified]

requires:
  - 01-05 (SnuskingEngine registered and per-player routing live)
  - 01-06 (Snusking client UI complete)
provides:
  - snus-rpg fully removed from codebase
  - gameRegistry has only 'snusking'
  - GameType = 'snusking' (union narrowed)
  - Lobby shows 'Snusking' label and 'N / 4' player count
  - Home.tsx creates rooms with gameType: 'snusking'
  - Human smoke test: approved
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  deleted:
    - server/src/games/snus-rpg/brands.ts
    - server/src/games/snus-rpg/engine.ts
    - server/src/games/snus-rpg/map.ts
    - server/src/games/snus-rpg/npc.ts
  modified:
    - server/src/games/registry.ts
    - client/src/games/GameContainer.tsx
    - shared/src/types.ts
    - client/src/pages/Lobby.tsx
    - client/src/pages/Home.tsx

key-decisions:
  - "snus-rpg deleted after SnuskingEngine confirmed working (Research Pitfall 1 guard respected)"
  - "Home.tsx GAMES array id changed from 'snus-rpg' to 'snusking' — root cause of silent start-game failure"
  - "Lobby game badge uses conditional: gameType === 'snusking' ? 'Snusking' : gameType"

requirements-completed:
  - REQ-CORE-01
  - REQ-CORE-02

duration: 10min
completed: 2026-03-13
---

# Phase 1 Plan 07: Remove snus-rpg, Update Lobby Labels, Human Smoke Test

**snus-rpg fully deleted, GameType narrowed to 'snusking', lobby shows 'Snusking' and player count — human smoke test approved**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-03-13
- **Tasks:** 2 (1 auto + 1 checkpoint)
- **Files modified:** 5, deleted: 4

## Accomplishments

- Deleted `server/src/games/snus-rpg/` (brands.ts, engine.ts, map.ts, npc.ts)
- `gameRegistry` now only contains `'snusking': SnuskingEngine`
- `GameType = 'snusking'` (snus-rpg removed from union)
- `GameContainer.tsx` routes only to SnuskingGame (SnusRpgGame import removed)
- Lobby badge: `'Snusking'`, player count: `N / 4`
- Home.tsx GAMES array updated to `id: 'snusking'`
- Human checkpoint: **approved**

## Task Commits

1. **Task 1: Remove snus-rpg, update types and lobby** — `597b117`
2. **Bug fix: Home.tsx room creation gameType** — `b45153b`

## Deviations from Plan

- **[Rule 1 - Bug] Home.tsx GAMES array still used `id: 'snus-rpg'`** — caused silent `room:error: Unknown game type` on start (Lobby doesn't listen for room:error). Fixed by updating to `id: 'snusking'`.

## Self-Check: PASSED

- FOUND: snus-rpg directory deleted
- FOUND: server/src/games/registry.ts contains only 'snusking'
- FOUND: shared/src/types.ts GameType = 'snusking'
- FOUND commit: 597b117 (feat(01-07): remove snus-rpg)
- FOUND commit: b45153b (fix(01-07): change room creation game type)
- Human checkpoint: approved by user
