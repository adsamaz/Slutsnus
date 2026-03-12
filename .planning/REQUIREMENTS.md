# Requirements

**Project:** Snusking
**Version:** 1.0 — Card Game Engine
**Updated:** 2026-03-12

---

## Functional Requirements

### Game Core

- [ ] Turn-based card game engine replacing the `snus-rpg` engine entirely
- [ ] Up to 4 players per game session (minimum 2)
- [ ] All players choose actions simultaneously each turn, then reveal together
- [ ] Turn phases: Draw → Planning → Reveal → Resolve
- [ ] Turn timer (45–60 seconds) with auto-pass for AFK or disconnected players
- [ ] First player to reach the empire score threshold wins
- [ ] Win detection triggers game end screen and leaderboard write

### Card System

- [ ] Snus cards drawn from a shared deck each turn
- [ ] Players hold a hand of cards (size TBD during balance phase)
- [ ] Each card has a real identity and can optionally be displayed with a fake name during trading
- [ ] Contextual snus cards (e.g. Fishsnus, Bastusnus) score bonus points when matching the active event
- [ ] Spent snus cards (worthless/near-worthless) exist as a sabotage resource
- [ ] 8–12 snus brand cards in the initial catalog (General, Siberia, Göteborgs Rapé, Ettan, Fishsnus, Bastusnus, and others)

### Event System

- [ ] One event card revealed publicly at the start of each round (before planning phase opens)
- [ ] Event types: Sauna Night, Fishing Trip, Party (minimum 3)
- [ ] Matching snus cards played during a matching event receive a combo multiplier
- [ ] Events are visible to all players for the full duration of the round

### Beer Resource

- [ ] Beer is a separate holdable resource (not a snus card)
- [ ] Combining beer with certain snus cards grants a bonus effect
- [ ] Players can hold a maximum of 2–3 beer units (prevents hoarding)
- [ ] Unused beer does not automatically expire but is subject to the holding cap

### Trade and Sabotage

- [ ] Players can offer snus cards to other players during the planning phase
- [ ] Card displayed name can differ from real card identity (deceptive trading mechanic)
- [ ] Players can send spent snus cards to opponents (low-value sabotage)
- [ ] Players can send high-nicotine snus cards with negative side effects to opponents
- [ ] Maximum one sabotage action targeting the same opponent per turn
- [ ] At least one card type provides sabotage immunity for one turn

### Multiplayer Infrastructure

- [ ] Per-player state projection: each player only receives their own hand over the socket
- [ ] Opponents' commit status visible (has submitted / pending) without revealing their choice
- [ ] Reconnect support: rejoining player receives current state snapshot
- [ ] Game state persists through brief disconnects; player is auto-passed at timer expiry if still offline

---

## Non-Functional Requirements

- [ ] Server must never broadcast unified game state containing all players' hands
- [ ] Action payloads validated at the Socket.IO boundary (Zod, server-side only)
- [ ] Deck shuffling must use unbiased algorithm (`crypto.randomInt` Fisher-Yates)
- [ ] Game engine must implement a `TurnBasedGameEngine` interface extension (not stretch the real-time `GameEngine` interface)
- [ ] `GameType` registration must be propagated across shared types, DB enum, and client routing in a single coordinated commit

---

## Out of Scope (v1)

- Real-time movement or grid-based map
- NPC AI enemies
- Single-player mode
- Player-triggered situations (spend resources to activate a context) — defer to v2
- Spectator mode — defer to v2
- In-game chat — defer to v2
- Expanded card catalog beyond initial 8–12 brands — defer to v2
- Deck building — not this game

---

## Deferred Ideas

> Captured during planning — not acted on, not lost.

- Player-triggered situations: players spend resources to activate a context/event favoring their hand
- High-nicotine snus as a dedicated sabotage card type with balance tuning after playtesting
- Expanded brand catalog beyond launch set
- Spectator mode for watching friends play
