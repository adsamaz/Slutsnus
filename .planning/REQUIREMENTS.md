# Requirements

**Project:** Snusking Platform
**Updated:** 2026-03-14

---

## v1.0 Requirements — Snusking Card Game

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

## v2.0 Requirements — Snus Catcher

### Game Core

- [x] **GAME-01**: Player can join a Snus Catcher 1v1 match from the lobby
- [x] **GAME-02**: Each player controls a bar via mouse on their own browser screen
- [x] **GAME-03**: Fresh snus pouches fall from the top of the screen continuously
- [x] **GAME-04**: Spent (nasty) snus pouches fall from the top and must be avoided
- [x] **GAME-05**: Catching a fresh pouch increments the player's score
- [x] **GAME-06**: Touching a spent pouch costs the player one life
- [x] **GAME-07**: Player starts with 3 lives
- [x] **GAME-08**: Player who loses all 3 lives first loses the match
- [x] **GAME-09**: Game ends and winner is declared when one player reaches 0 lives

### Powerups

- [ ] **PWR-01**: Snus Rain powerup — burst of extra fresh pouches falls briefly when caught
- [ ] **PWR-02**: Narrow Curse powerup — opponent's bar shrinks for ~5s when caught
- [ ] **PWR-03**: Shield powerup — next spent snus touched doesn't cost a life when caught
- [ ] **PWR-04**: Score Multiplier powerup — next 5 pouches caught count double when caught
- [ ] **PWR-05**: Powerups fall from the top like regular items and must be caught to activate

### Platform Integration

- [x] **PLAT-01**: Snus Catcher appears as a selectable game in the lobby
- [x] **PLAT-02**: Game state syncs between both players via Socket.IO in real time
- [x] **PLAT-03**: Game result (winner/loser) is written to the leaderboard on game end
- [ ] **PLAT-04**: Player can return to lobby after the game ends

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time movement or grid-based map in Snusking | Replaced entirely by turn-based card play |
| NPC AI enemies | Player vs player only platform |
| Single-player mode | Multiplayer only |
| Player-triggered situations (Snusking) | Defer to v3 |
| Spectator mode | Defer to future |
| In-game chat | Defer to future |
| Expanded card catalog beyond initial 8–12 brands | Defer to v3 |
| Deck building | Not this game |
| Shared playfield between players (Snus Catcher) | Independent boards simplify sync and prevent lane domination |
| Speed boost / slow powerups (Snus Catcher) | Bar is always instant to cursor — no speed mechanic |
| Wide bar / magnet / decoy powerups | Omitted in design — tighter powerup set chosen |

---

## Traceability — v2.0

| Requirement | Phase | Status |
|-------------|-------|--------|
| GAME-01 | Phase 5 | Complete |
| GAME-02 | Phase 6 | Complete |
| GAME-03 | Phase 6 | Complete |
| GAME-04 | Phase 6 | Complete |
| GAME-05 | Phase 6 | Complete |
| GAME-06 | Phase 6 | Complete |
| GAME-07 | Phase 6 | Complete |
| GAME-08 | Phase 6 | Complete |
| GAME-09 | Phase 6 | Complete |
| PWR-01 | Phase 7 | Pending |
| PWR-02 | Phase 7 | Pending |
| PWR-03 | Phase 7 | Pending |
| PWR-04 | Phase 7 | Pending |
| PWR-05 | Phase 7 | Pending |
| PLAT-01 | Phase 5 | Complete |
| PLAT-02 | Phase 6 | Complete |
| PLAT-03 | Phase 6 | Complete |
| PLAT-04 | Phase 6 | Pending |

**Coverage:**
- v2.0 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after v2.0 milestone start*
