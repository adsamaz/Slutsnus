# Snusking

## What This Is

Snusking is a multiplayer real-time game platform built for 2–4 players. The platform supports room/lobby management, authentication, friends, and a leaderboard. The centerpiece game — also called Snusking — is a turn-based card game where players race to build the most powerful snus empire by drawing and playing Swedish snus cards, trading with allies, and strategically sabotaging rivals.

## Core Value

Build and win a snus empire before your rivals do — through smart card play, timely combos, and calculated betrayal.

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

<!-- The new Snusking game — replacing snus-rpg engine entirely. -->

- [ ] Turn-based card game engine replacing the current real-time snus-rpg engine
- [ ] Players draw snus cards each turn from a shared or personal deck
- [ ] Players spend snus cards to gain empire points (the win resource)
- [ ] Players can trade snus cards with teammates/other players
- [ ] Sabotage mechanic: give opponents spent snus (worthless) or strong snus with negative side effects
- [ ] Beer as a separate holdable resource that combines with snus cards for bonus effects
- [ ] Contextual snus cards (e.g. Fishsnus, Bastusnus) that are stronger in matching situations
- [ ] Event cards drawn each round (Sauna night, Fishing trip, Party) that boost matching snus
- [ ] Players can trigger situations/events to set up their own combos
- [ ] Up to 4 players per game
- [ ] First player to reach the empire score threshold wins
- [ ] All players choose actions simultaneously per turn, then reveal

### Out of Scope

- Real-time action movement — replaced entirely by turn-based card play
- NPC AI enemies — this is a player vs player game
- Grid-based map — not needed for card game format
- Single-player mode — multiplayer only

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

---
*Last updated: 2026-03-11 after initialization*
