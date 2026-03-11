# Feature Landscape

**Domain:** Turn-based multiplayer card game (Snusking)
**Researched:** 2026-03-11
**Confidence:** MEDIUM — core game design theory is HIGH confidence from training; specific balancing numbers are LOW confidence and need playtesting to validate

---

## Table Stakes

Features users expect from a turn-based card game. Missing any of these and the game feels broken, incomplete, or unplayable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Authoritative game state on server** | Without this, clients desync and cheating is trivial in any multiplayer game | Low | Already established by the existing Socket.IO architecture. Turn-based makes this easier than real-time. |
| **Turn structure with clear phase progression** | Players need to know: whose turn is it? What phase am I in? What can I do? | Medium | Simultaneous-reveal design (PROJECT.md) means phases are: Choose → Reveal → Resolve → Draw. All players must know when each phase transitions. |
| **Hand management — draw, hold, discard** | Players need a hand of cards they can see and reason about. Without a visible hand, there is no game. | Medium | Each player draws snus cards each turn. Hand size limit prevents hoarding. Must sync hand state per-player (private) while syncing board state (public). |
| **Win condition with visible progress** | Players must always know how far they are from winning. No progress visibility = no tension. | Low | Empire score threshold. Every player's current score must be permanently visible on screen. |
| **Turn timer / action timeout** | Without a timer, one AFK or slow player blocks all others indefinitely | Medium | Critical for multiplayer. Suggest 60–90 seconds for simultaneous-choose phase. Auto-pass if timer expires. |
| **Reconnect / rejoin support** | Network drops happen. Losing your game session because your WiFi blipped is a game-breaking failure mode. | Medium | Existing Socket.IO infrastructure handles reconnect at connection level. Game state must be resendable to a rejoining player. |
| **Game end screen with results** | Players need closure and a summary. Already exists in the prior engine's EndScreen component. | Low | Show final scores, rank, MVP card play. Wire to existing leaderboard persistence. |
| **Legible card display** | Cards must show: name, value, effect, context requirement (if any), beer-combo indicator. Unreadable cards = unplayable. | Medium | This is a UI challenge in Solid.js. Cards must work on mobile-width screens too. |
| **Action confirmation before commit** | In a simultaneous-reveal game, committing the wrong action is frustrating. A "lock in / change mind" UX prevents misclicks. | Low | Simple two-step: select action → confirm. Locked-in state shown to all (without revealing what action). |
| **Player identification on board** | At all times, which cards/resources belong to which player must be clear. | Low | Avatar color, username badge on hand area. |

---

## Differentiators

Features that make Snusking distinct and worth playing repeatedly. Not expected by genre convention, but what creates the "just one more game" feeling.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Simultaneous-reveal action resolution** | Eliminates turn-order advantage. Every player chooses secretly, all reveal at once, then effects resolve. Creates genuine strategic tension without "going last is better." | High | This is the most important differentiator. Requires a locked-in state model. Resolution order for conflicts must be deterministic and public. See dependencies. |
| **Contextual snus cards (Fishsnus, Bastusnus)** | Cards that are stronger in matching situations add a layer of "set up your own context" strategy beyond just playing the highest-value card. Creates asymmetric information and planning depth. | Medium | Each card has an optional `contextTag` (e.g. `fishing`, `sauna`, `party`). Base value applies always; bonus only when matching event is active. |
| **Event cards that shift the active context** | "Sauna Night" active: all Bastusnus cards deal +50% empire points. Players plan around upcoming/current events. Creates a shared board state to react to. | Medium | Event deck is drawn each round, visible to all. Creates a "public information" layer on top of private hands. |
| **Player-triggered situations** | Players can spend resources to trigger a specific event context, setting up their own combo. Creates aggressive counterplay — trigger the context your hand is built for, forcing rivals to adapt. | High | Triggering a situation must cost a meaningful resource (beer? a discard? spent snus). Must not be so cheap that every turn is a trigger. |
| **Beer as a hold-or-combine resource** | Beer as a separate holdable resource that modifies snus card effects when combined. The decision "do I combine now or hold beer for a bigger play later?" is a meaningful per-turn choice. | Medium | Beer does not score directly. It amplifies. A player sitting on beer is a threat. Beer should have a carry limit (max 2–3 units) to prevent hoarding stall strategies. |
| **Sabotage via deceptive trading** | You can trade "spent snus" (worthless) disguised as good snus, or offer high-nicotine snus with negative side effects to an opponent. The trade system carries strategic deception. | High | Existing snus-rpg had deceptive trade (displayedName vs realBrandId). Carry this forward. Deception creates social tension and memorable moments. The target sees the offered name, not the real card — until they accept. |
| **Snus brand identity on cards** | Real Swedish snus brand names (General, Siberia, Göteborgs Rapé, Ettan) as card identities gives the game its distinct personality and gives players with snus knowledge an in-joke meta layer. | Low | Brand data already exists in `brands.ts`. Adapt nicotineStrength → card power curve. |
| **Spending snus cards as empire investment** | Rather than just collecting points, players actively spend their hand to "invest" in empire points. This means holding cards is a choice — spend now for certain points, or hold for a combo/trade. | Medium | The core economy. Each card has a base empire value. Spending removes it from hand. Playing cards face-up on a "spent pile" signals what was used, creating information for other players. |

---

## Anti-Features

Features to deliberately NOT build, with explicit reasoning.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time continuous action** | Already scoped out in PROJECT.md. Incompatible with simultaneous-reveal design. Creates turn-order inequity and requires tick-loop complexity that the new engine replaces. | Turn-based phases with explicit commit step. |
| **NPC/AI opponents** | Out of scope per PROJECT.md. Adding AI adds enormous complexity for diminishing returns in a social/deception game. The deception mechanic is meaningless against AI. | 2–4 human players only. |
| **Single-player mode** | Out of scope per PROJECT.md. The core value loop (sabotage, trading, bluffing) requires human opponents. Solo play would be a hollow shell of the real game. | Multiplayer only. Can add "practice mode" later if demand emerges. |
| **Complex deck-building between games** | Pre-game deck construction (Magic: The Gathering style) adds a meta-game layer that kills session-start friction for a casual platform. | Fixed shared deck per game with known composition. Players strategize with what they draw, not what they built. |
| **Health points / combat damage** | The existing snus-rpg had HP and NPC combat. This belongs to the scrapped engine. Card games with HP introduce a second loss condition that splits focus from the empire score race. | Empire score is the only resource that matters for winning. Effects can be disruptive but not elimination-based. |
| **Grid/map movement** | Scoped out in PROJECT.md. Spatial positioning adds cognitive overhead irrelevant to the card game. The trade mechanic should be global (any player can trade any player), not proximity-gated. | Global player board. Trade is available to any player at any time (not proximity-limited like the old engine). |
| **Gacha / loot boxes / paid card unlocks** | This is a social game on an existing platform. Monetization complexity or perceived pay-to-win immediately poisons the social trust the sabotage mechanic requires. | Fixed card set available to all players. |
| **Persistent card upgrades / progression** | Inter-session progression creates power imbalance for new players in a deduction/deception game. | Session-scoped. Everyone starts equal each game. Leaderboard tracks wins, not card power. |
| **Spectator mode** | Nice-to-have but adds significant implementation complexity (partial information visibility, real-time feed). Not needed for MVP. | Defer indefinitely. Core game loop first. |
| **In-game chat** | Chat during a deception/sabotage game is tempting but creates harassment vectors and "kingmaking" through out-of-band coordination. The game should speak for itself. | Optional: post-game only chat. No in-game text chat. |

---

## Feature Dependencies

```
Turn structure (phases)
  └── Simultaneous-reveal resolution  ← most complex dependency
        └── Action lock-in UX
        └── Conflict resolution rules (what happens if two players target same card?)

Hand management (draw/hold/discard)
  └── Card legibility (display)
  └── Hand size limit
  └── Spend mechanic (empire points)

Beer resource
  └── Hold-or-combine decision
  └── Beer carry limit (anti-hoarding)
  └── Beer + snus combo effects

Contextual snus cards (e.g. Fishsnus)
  └── Event card system (active context)
        └── Player-triggered situations (spend resources to set context)

Sabotage via deceptive trading
  └── Trade offer/accept flow (inherited from snus-rpg: displayedName vs realBrandId)
  └── Spent snus card type (worthless card variant)
  └── High-nicotine negative-effect snus (powerful but harmful)

Win condition (score threshold)
  └── Score visibility on HUD at all times
  └── Game end detection → end screen → leaderboard write

Reconnect support
  └── State resend on rejoin
  └── Turn timer auto-pass (AFK player doesn't block reconnectors)
```

---

## MVP Recommendation

The MVP is the smallest playable game that demonstrates all three layers of the design: resource race + context combo + social deception.

**Prioritize for MVP:**

1. Turn structure with simultaneous-reveal (phases: Choose → Reveal → Resolve → Draw) — the game cannot exist without this
2. Hand management with draw, hold, spend (empire points), and discard
3. 8–12 snus brand cards with base values derived from existing `brands.ts`
4. Beer as a holdable resource with at least one snus+beer combo
5. 3 event card types (Sauna Night / Fishing Trip / Party) with matching contextual snus bonus
6. Deceptive trade mechanic (offer with displayed name, real card hidden)
7. Sabotage via spent snus transfer
8. Turn timer (60 seconds) with auto-pass
9. Win condition: first to 200 empire points
10. Score HUD, game end screen, leaderboard write

**Defer post-MVP:**

- Player-triggered situations (adds complexity to event system; needs event system solid first)
- Expanded card catalog beyond initial 8–12 brands
- High-nicotine negative-effect snus as sabotage vector (needs balance testing before shipping)
- Conflict resolution edge cases beyond common cases

---

## Balancing Principles

These are design constraints, not features to implement — but they must inform every feature decision.

**Principle 1: No dominant strategy.** If spending beer on every card is always correct, beer adds nothing. Beer combos must be contextually better (when event matches) but not universally optimal.

**Principle 2: Information asymmetry creates skill.** Players see their own hand, all players' scores, and the current event. They do not see other players' hands. The skill ceiling is reading opponents from their spend patterns and trades.

**Principle 3: Tempo matters.** Holding good cards while behind on score is a losing strategy. The race-to-threshold win condition means passive play loses. Events and beer should reward tempo, not stalling.

**Principle 4: Sabotage has a cost.** Setting up a deceptive trade requires spending a slot (giving away even a worthless card costs you a trade opportunity). If sabotage is costless it becomes the dominant strategy and the game devolves into who-screws-who, killing the empire-building tension.

**Principle 5: Lucky draws must not decide games.** The strongest snus brands (Siberia, Oden's Extreme) must not be so powerful that drawing one guarantees a win. Event multipliers plus beer give skilled players a path to overcome a weaker hand draw.

---

## Sources

- **HIGH confidence:** Established game design theory (simultaneous-reveal from Cosmic Encounter, Diplomacy; hand management from standard CCG design; tempo and information asymmetry from combinatorial game theory)
- **HIGH confidence:** Project requirements from `.planning/PROJECT.md` (validated requirements section)
- **HIGH confidence:** Existing engine analysis from `server/src/games/snus-rpg/engine.ts` (trade mechanic, brands, effects — all reusable)
- **MEDIUM confidence:** Specific card counts (8–12 for MVP), turn timer (60s), score threshold (200) — these are reasonable starting points from genre conventions but require playtesting to validate
- **LOW confidence:** WebSearch and Context7 unavailable during this session. No external verification of current best practices was possible. Core design theory is stable and unlikely to have changed materially.
