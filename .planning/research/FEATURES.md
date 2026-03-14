# Feature Landscape

**Domain:** 1v1 real-time falling-object arcade game (Snus Catcher)
**Researched:** 2026-03-14
**Confidence:** HIGH for game loop architecture and genre conventions (stable domain, decades of established patterns); MEDIUM for powerup interaction design (well-understood patterns but specific balance requires playtesting); HIGH for platform integration (existing codebase fully audited)

---

## Context: This is a Subsequent Milestone

The platform already provides (do not re-research or re-implement):

- Auth, JWT session, httpOnly cookie — existing
- Lobby, room creation/joining, room code routing — existing
- Socket.IO 4.8.1 real-time infrastructure, `game:action` / `game:state` / `game:end` events — existing
- Game engine registry pattern (`GameEngine` interface, `gameRegistry` map) — existing
- Friends system, leaderboard persistence (GameSession, LeaderboardEntry tables) — existing
- `GameContainer.tsx` wrapper that routes by game type — existing
- `@slutsnus/shared` types package — existing, needs new types added

The new game must plug into all of the above without altering existing infrastructure.

---

## Table Stakes

Features that must exist for the game to feel functional and fair. Missing any one of these produces a broken or unplayable experience.

| Feature | Why Expected | Complexity | Platform Dependency |
|---------|--------------|------------|---------------------|
| **Authoritative server game loop** | Without server authority, clients can desync immediately. Catching items locally and reporting to server is trivially exploitable. | Medium | Extends existing `GameEngine` interface. New game type registered in `gameRegistry`. |
| **Server-managed falling item spawning** | Item position, type, and fall speed must originate on server. Clients render what the server says exists — never the other way. | Medium | Server tick loop (like existing snus-rpg 100ms interval). Items are entities in server state. |
| **Mouse-controlled catch bar** | The core interaction. Player moves a horizontal bar by mouse position. Missing this = no game. | Low | Client emits `game:action` with `{ type: 'move', payload: { x: number } }`. Thin input layer over existing socket action pattern. |
| **Two item types: fresh snus (catch) vs spent snus (avoid)** | The fundamental catch/dodge mechanic. Without this binary, there is no decision-making. | Low | Item type field on each entity. Server spawns both types. |
| **Lives system (3 lives each)** | Standard arcade lives UI. Touching a spent snus item costs 1 life. At 0 lives, player loses. | Low | Per-player state field. Loss condition triggers game end. |
| **Score accumulation** | Each caught fresh snus = +points. Score is the secondary win condition (tiebreaker) and the engagement metric. | Low | Per-player score field in server state. |
| **Win/loss condition: opponent loses all lives** | Primary win condition for 1v1. When one player reaches 0 lives, the other wins. | Low | Server detects, emits `game:end`. Wires to existing end-screen and leaderboard write. |
| **Per-player isolated playfield** | Each player has their own vertical lane/canvas. Items falling in your lane do not affect your opponent's lane. | Medium | Server maintains two independent item sets (one per player). State projection sends each player only their own lane + opponent score/lives. |
| **Score and lives HUD** | Both players must see: own score, own lives, opponent score, opponent lives — at all times. | Low | HUD component in Solid.js. Opponent values received via per-player state projection (opponent summary only, not full state). |
| **Game end screen with result** | Shows winner, final scores. Existing EndScreen component pattern already established in the platform. | Low | Reuses existing `game:end` event, end-screen Solid.js component. Wires to leaderboard write. |
| **Reconnect / rejoin support** | Network drops must not discard the game. State snapshot resent on socket reconnect. | Medium | Existing pattern from Snusking engine. Server keeps state, resends on `room:join` if game is active. |

---

## Differentiators

Features that make Snus Catcher distinct, replayable, and memorable. None are expected by genre convention alone — they are the "why play this instead of any other falling-object game" layer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Powerup: Snus Rain** | All-fresh-snus rain for 5 seconds — pure score explosion opportunity. Creates a "quick, go!" frenzy moment that makes skill visible. | Medium | Server spawns a burst of fresh items for the triggering player's lane only. Duration tracked in server state. Does not affect opponent. |
| **Powerup: Narrow Curse (opponent)** | Shrinks the opponent's catch bar width for 10 seconds. Classic competitive interference. Forces opponent to micro-manage mouse precision. | Medium | Targeted debuff. Server stores `barWidthModifier` per player. Opponent's catch bar shrinks client-side when modifier active. Server enforces actual hitbox width, not client. |
| **Powerup: Shield** | Blocks the next 1 spent-snus hit. Creates a strategic "save it or use it" question — activate now or hold for a worse moment. | Low | Server stores `shieldActive: boolean` per player. On next spent-snus collision: absorb hit, clear shield. |
| **Powerup: Score Multiplier** | 2x points on all fresh-snus catches for 8 seconds. Best used during Snus Rain if timed correctly. Creates skill expression through powerup synergy. | Low | Server stores `scoreMultiplier` and `multiplierExpiresAt` per player. Synergy with Snus Rain is intentional and a skill differentiator. |
| **Powerup items fall like regular items** | Powerups appear as distinct falling items — player must catch the powerup item to activate it. Not a button. The cost of getting a powerup is catching it (potentially while dodging spent snus). | Low | Powerup entities have a `kind: 'powerup'` field and a `powerupType` field. Same collision system as regular items. |
| **Snus-themed visual identity** | Fresh snus pouches look appetizing; spent snus looks nasty/used. Powerup items have brand-appropriate visual identities. Gives the game a distinct personality consistent with the platform. | Low | CSS/asset work. No engine complexity. Aligns with existing snus brand identity on the platform. |
| **Speed escalation over time** | Items fall faster as game progresses. Creates natural difficulty curve. Prevents matches from stalling. Adds urgency without an explicit timer. | Low | Server tick: fall speed = baseFallSpeed + (tickCount * escalationFactor). Cap at maxFallSpeed to keep it playable. |
| **Opponent status visibility** | Seeing opponent's lives drain in real-time makes every mistake feel meaningful. Creates emotional investment in both your own performance and your opponent's. | Low | Opponent summary (score, lives, active effects) included in each per-player state push. No hidden-state concerns — lives and score are public information. |

---

## Anti-Features

Features to explicitly NOT build, with reasoning.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Client-side hit detection** | Trusting client to report its own catches is the #1 exploitability vector in arcade games. Any player can fake catches. | Server owns all collision detection. Client sends mouse X position only. Server resolves hits. |
| **Shared playfield (both players on same canvas)** | Shared field creates read-confusion (whose items are whose?), layout problems on different screen sizes, and unnecessary collision complexity between two independent games. | Per-player isolated lanes on server. Two side-by-side views on client. Clean and clear. |
| **Real-time mouse position broadcast to opponent** | Broadcasting raw mouse X to opponent every frame is wasteful traffic and creates a "read your opponent's inputs" meta that cheapens the game. | Opponent sees only score/lives/active powerup effects. No raw position sharing. |
| **Player-vs-player item interference (direct)** | Items physically crossing over into opponent's lane, or one player "throwing" items at the other, creates a fundamentally different and more complex game. | Narrow Curse powerup provides indirect interference (shrinks opponent bar). Direct lane invasion is out of scope. |
| **AI/bot opponent** | Bot adds complexity without adding the social context that makes the game fun. | 2 human players only for this game. |
| **Power-ups available via button press (not caught)** | Button-activated powerups remove the arcade skill expression. If powerups are free, every player always has every powerup. | Powerups must be caught as falling items. Getting them is part of the skill expression. |
| **Persistent powerup unlocks between sessions** | Unlockable powerup sets create power imbalance and add meta-game complexity. | All powerups available to all players in every match. Session-scoped only. |
| **Game timer as primary win condition** | Pure timed scoring turns the game into a math problem ("I'm 50 points ahead, I'll just avoid everything"). A lives system forces engagement. | Lives-based elimination. Score is tiebreaker. Timer could be a hard upper-bound safety net only (e.g., 5-minute max), not the primary win condition. |
| **Spectator mode** | Significant implementation complexity for partial-information rendering. Not needed for MVP. | Defer indefinitely. Core loop first. |
| **In-game chat** | Harassment vector with minimal value in a real-time arcade game where players are focused on the screen. | No in-game chat. Post-game result screen is the social moment. |
| **Mobile touch controls** | Mouse-bar mechanic is fundamentally mouse/trackpad driven. Touch controls require a different interaction model (tap to move bar? drag?). Out of scope for this milestone. | Desktop browser only for this game. Can revisit if demand emerges. |

---

## Feature Dependencies

```
Server game loop (tick-based)
  └── Falling item spawning (per-player, independent lanes)
        └── Item types: fresh snus, spent snus, powerup items
        └── Speed escalation (fall speed increases with tick count)
        └── Collision detection (server-side, per player)
              └── Lives decrement on spent snus hit
              └── Score increment on fresh snus catch
              └── Powerup activation on powerup catch
                    └── Snus Rain effect (spawn burst in catcher's lane)
                    └── Narrow Curse effect (set barWidthModifier on opponent)
                    └── Shield effect (set shieldActive on catcher)
                    └── Score Multiplier effect (set scoreMultiplier + expiry on catcher)

Mouse input (client)
  └── Mouse X → game:action { type: 'move', x: number }
        └── Server updates playerBarX per player
        └── Server uses playerBarX in collision detection only
        └── Client renders bar at locally-tracked X (no round-trip lag for visuals)

Per-player state projection
  └── Each player receives: own lane items, own score, own lives, own active effects
  └── Each player receives: opponent score, opponent lives, opponent active effects (summary only)
  └── Neither player receives: opponent's raw bar position or item list

Win/loss detection
  └── Lives system (3 lives each)
        └── 0 lives → player loses → game:end emitted
        └── Opponent wins → leaderboard write → end screen

Existing platform (already built, no changes needed)
  └── room:start → gameRegistry.instantiate('snus-catcher') → engine.init()
  └── game:action → engine.handleEvent(playerId, action)
  └── game:state → per-player projection sent to each socket
  └── game:end → existing leaderboard persistence
  └── GameContainer.tsx → routes to Snus Catcher client component by game type
```

---

## MVP Recommendation

The MVP is the smallest playable 1v1 game that demonstrates the core catch/dodge loop and at least one powerup interaction.

**Prioritize for MVP:**

1. Server tick loop with per-player item spawning (fresh snus + spent snus, no powerups yet)
2. Mouse-controlled catch bar: client emits X position, server uses for collision
3. Lives system (3 lives), score accumulation
4. Win condition: 0 lives = lose, opponent wins
5. Per-player state projection via existing `game:state` event
6. Speed escalation over time (simple linear increase)
7. HUD: own score, own lives, opponent score, opponent lives
8. Game end screen + leaderboard write (reuse existing patterns)
9. Reconnect support (reuse existing state-resend pattern)
10. All 4 powerup types as falling items (after core loop is stable)

**Defer post-MVP:**

- Powerups (Snus Rain, Narrow Curse, Shield, Score Multiplier) — get core loop solid first, then layer powerups in
- Snus Rain + Score Multiplier synergy tuning — needs playtesting data
- Speed escalation curve tuning — start simple, adjust from playtesting
- Visual polish (brand-specific snus art) — functional placeholder assets first

---

## Complexity Notes

| Component | Complexity | Reason |
|-----------|------------|--------|
| Server game loop (tick, items, collision) | Medium | New real-time loop, but existing 100ms snus-rpg tick pattern is a clear template |
| Per-player state projection | Medium | Must send different state snapshots to each player. Existing card game did this for private hands — same pattern applies. |
| Mouse input → server bar position | Low | Client emits X on `mousemove`, server stores per player. No interpolation needed for this genre at typical tick rates. |
| Powerup: Shield | Low | Boolean flag + single collision intercept |
| Powerup: Score Multiplier | Low | Numeric multiplier + timestamp expiry |
| Powerup: Snus Rain | Medium | Server-controlled item burst; duration tracking |
| Powerup: Narrow Curse | Medium | Cross-player effect; opponent bar width modifier enforced at server collision boundary |
| Speed escalation | Low | Single formula on tick count |
| Client canvas rendering | Medium | Solid.js + Canvas API. Existing snus-rpg had a canvas renderer — adapt the render loop pattern. |
| New shared types (SnusCatcherState, etc.) | Low | Straightforward type addition to `shared/src/types.ts`. Must also add game type to DB enum and `gameRegistry`. |

---

## Sources

- **HIGH confidence:** Game loop and architecture patterns from established browser arcade game design (Breakout, Tetris, Fruit Ninja browser ports — all use server-tick + client-render separation for networked play)
- **HIGH confidence:** Platform integration points from audited codebase files (`.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md`)
- **HIGH confidence:** Existing engine patterns from `server/src/games/snus-rpg/engine.ts` architecture as documented in `ARCHITECTURE.md`
- **HIGH confidence:** Socket.IO game event contracts from `.planning/codebase/INTEGRATIONS.md` (events: `game:action`, `game:state`, `game:end`)
- **MEDIUM confidence:** Powerup design patterns (well-established in falling-object genre — Tetris attack items, Tetris Battle powerups, Puzzle Bobble powerups) — specific balance values (durations, widths) are LOW confidence and require playtesting
- **NOTE:** WebSearch unavailable during this session. External sources could not be verified. Core game loop theory for this genre is highly stable and unlikely to have changed materially.
