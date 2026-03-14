# Snusking

## What This Is

Snusking is a multiplayer real-time game platform hosting multiple snus-themed games. The platform supports room/lobby management, authentication, friends, and a leaderboard. Games include the turn-based card game Snusking (build a snus empire through combos and sabotage) and the real-time arcade game Snus Catcher (catch falling snus pouches, avoid spent ones, outlast your opponent).

## Core Value

A snus-themed multiplayer game platform where every game is distinctly competitive — whether through card strategy or arcade reflexes.

## Current Milestone: v2.0 — Snus Catcher

**Goal:** A fully playable 1v1 arcade game where players catch falling snus pouches with a mouse-controlled bar, avoid spent snus that costs lives, and use powerups to gain an edge over their opponent.

**Target features:**
- Mouse-controlled bar catching falling snus pouches
- Lives system (3 lives), lose all lives = lose the match
- 4 powerups: Snus Rain, Narrow Curse, Shield, Score Multiplier
- Full platform integration (lobby, Socket.IO sync, leaderboard)

## Requirements

### Validated

<!-- Existing platform capabilities — already working. -->

- ✓ User registration and login with email/password — existing
- ✓ JWT session management, persists across refresh — existing
- ✓ Room creation, joining, and listing — existing
- ✓ Real-time multiplayer via Socket.IO — existing
- ✓ Friends system (add, invite, online status) — existing
- ✓ Leaderboard (score tracking per game session) — existing
- ✓ Player profiles — existing
- ✓ Pluggable game engine architecture (registry pattern) — existing

### Active

<!-- v2.0 Snus Catcher — new real-time arcade game -->

- [ ] 1v1 real-time arcade game: mouse-controlled bar catches falling snus pouches
- [ ] Spent snus pouches fall and must be avoided — touching costs a life
- [ ] Each player starts with 3 lives; losing all lives loses the match
- [ ] 4 powerups fall as catchable items: Snus Rain, Narrow Curse, Shield, Score Multiplier
- [ ] Snus Catcher selectable from lobby alongside Snusking
- [ ] Game state syncs between players via Socket.IO at 20Hz server tick
- [ ] Match result written to leaderboard on game end

### Out of Scope

- Real-time action movement in Snusking — replaced entirely by turn-based card play
- NPC AI enemies — all games are player vs player
- Grid-based map — not needed for either game format
- Single-player mode — multiplayer only
- Shared falling objects between players in Snus Catcher — each player has their own independent playfield

## Context

The project is a TypeScript monorepo (shared / server / client) using:
- **Server:** Express + Socket.IO + Prisma (PostgreSQL)
- **Client:** Solid.js + @solidjs/router + Vite
- **Shared:** Single source of truth for types across server and client

The existing `snus-rpg` game engine lives in `server/src/games/snus-rpg/` and `client/src/games/snus-rpg/`. Both will be fully replaced. The game registry pattern (`server/src/games/registry.ts`) and Socket.IO game action routing (`server/src/socket/game.ts`) will be reused.

Existing snus brand definitions (`brands.ts`) may be adapted as the basis for card definitions.

## Constraints

- **Tech stack:** TypeScript + Socket.IO + Solid.js — no stack changes
- **Platform:** Must work within existing room/lobby/auth infrastructure
- **Players:** 2–4 players per game session
- **Real-time:** Game state must sync via Socket.IO (existing pattern)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Replace snus-rpg entirely | Wrong genre/feel — want turn-based card game, not real-time action RPG | — Pending |
| Turn-based simultaneous reveal | All players choose secretly then reveal — avoids turn order advantage | — Pending |
| First to threshold wins | Cleaner win condition than timed rounds — creates a race dynamic | — Pending |
| Beer as separate resource | Gives players a meaningful hold-or-combine decision each turn | — Pending |
| Snus Catcher: independent playfields | Each player has their own falling objects — no shared board — simplifies sync and prevents one player dominating the other's lane | ✓ Good |
| Snus Catcher: server-authoritative collision | Client sends bar X only; server resolves all catches and hits — prevents cheating | ✓ Good |
| Snus Catcher: client-authoritative bar rendering | Bar renders at cursor position locally without waiting for server echo — eliminates input lag | ✓ Good |
| Snus Catcher: 20Hz server tick | Balances physics accuracy vs Socket.IO overhead; client interpolates to 60fps | ✓ Good |
| Snus Catcher: canvas rendering | 10–30 moving objects at 60fps — canvas over DOM avoids layout recalculation overhead | ✓ Good |
| Snus Catcher: 3 lives per player | Classic arcade feel, matches discussion | ✓ Good |

---
*Last updated: 2026-03-14 after v2.0 milestone start*
