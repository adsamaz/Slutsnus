# Phase 2: Card Design, Balance, and Game Economy - Research

**Researched:** 2026-03-13
**Domain:** TypeScript card game data modeling, pure function scoring, state machine flag tracking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Total: 12 cards** — 8 existing + 4 new: Knox Blue, Lundgrens, Velo, Zyn
- Velo and Zyn are nicotine pouches — modern/clean flavor profile
- Each card has **two properties**: `strength` (low/medium/high/extreme) and `flavor` (tobacco/mint/citrus/licorice/sweet)
- Event bonuses are property-based (not fixed home-event mapping): tiered bonus based on how many properties match the active event's affinity
- **Exactly 3 event types**: Sauna Night, Fishing Trip, Party
- Sauna Night affinity: high/extreme strength
- Fishing Trip affinity: tobacco/outdoor flavor
- Party affinity: social/sweet/mint flavor
- **Match both properties (strength + flavor)** → 2× multiplier
- **Match one property** → 1.5× multiplier
- **No match** → base empire points only
- Beer combo: +50% on high-strength card (applied before event multiplier)
- **Spent snus** sabotage → recipient auto-passed (skipped) that turn
- **High-nic sabotage** → recipient must discard one card at start of next planning phase + blurry screen UI flag
- One sabotage action per target per turn (existing rule)
- **Immunity card** — costs 1 beer to activate, blocks all incoming sabotage for that turn
- `displayName` ≠ real name in trade offers, reveals on spend
- Beer **not tradeable**
- Trade resolution: same turn — card arrives in recipient's hand before reveal phase
- Beer: +1/turn passive, cap 3, two uses (combo bonus, immunity activation)
- Hand size: 5 cards (confirmed Phase 1, unchanged)

### Claude's Discretion

- Exact affinity mapping for each event (which specific strength/flavor values each event rewards)
- Immunity card name and base empire point value
- Base empire point values for the 4 new cards (Knox Blue, Lundgrens, Velo, Zyn)
- Interaction order confirmed by CONTEXT.md: beer +50% applied before event multiplier

### Deferred Ideas (OUT OF SCOPE)

- Player-triggered situations (spend resources to activate a context/event) — v2 backlog
- Expanded brand catalog beyond 12 — v2
- Balance iteration on exact point values — Phase 4 playtesting
- Blurry/shaking screen UI effect for high-nic sabotage — Phase 3 (client UI); server only needs to emit the flag
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-SYS | 12 snus brand cards with `strength` and `flavor` properties | Type changes to `SnuskingCardDefinition` + catalog extension in deck.ts |
| CARD-SYS-2 | `isSabotageable` / `isSpentSnus` / `isHighNic` card roles | New optional boolean fields on `SnuskingCardDefinition` |
| EVENT-SYS | 3 event types (Sauna Night, Fishing Trip, Party) with property affinities | New `SnuskingEventCard` type replacing `currentEvent: null` |
| EVENT-SYS-2 | Event revealed publicly before planning phase opens | `currentEvent` in `SnuskingMasterState` emitted as part of `SnuskingProjectedState` |
| EVENT-SYS-3 | Combo multipliers: 2× / 1.5× / 1× based on property match count | `scoreCards()` signature change: add `activeEvent` param |
| BEER-RES | Beer: +1/turn passive, cap 3, two uses (combo and immunity) | `SnuskingPlayerState.beer` exists; `startDrawPhase()` increment logic needed |
| BEER-RES-2 | Beer combo: +50% on high-strength card spend, applied before event multiplier | `spendCards()` signature change: add `beerOnCardId` optional param |
| TRADE-SAB | Deceptive trading: `displayName` ≠ real name, reveals on spend | `SnuskingTradeOffer.displayName` already exists; card transfer must NOT copy `name` from definition |
| TRADE-SAB-2 | Spent snus sabotage → recipient turn auto-passed | New `skipNextTurn: boolean` flag on `SnuskingPlayerState`; checked in `startResolve()` |
| TRADE-SAB-3 | High-nic sabotage → discard + blurry screen flag | New `pendingDiscard: boolean` + `highNicEffect: boolean` flags on `SnuskingPlayerState` |
| TRADE-SAB-4 | Immunity card: costs 1 beer, blocks all incoming sabotage for that turn | New `snusking:activate-immunity` action; `immunityActive: boolean` flag on `SnuskingPlayerState` |
| TRADE-SAB-5 | One sabotage per target per turn limit (existing engine rule, confirm enforcement) | `handleEvent()` must reject duplicate sabotage targeting same player |
| TRADE-SAB-6 | Same-turn trade resolution: accepted card available before reveal | `resolveAcceptedTrades()` already runs in `startResolve()`; sabotage delivery must also run here |
</phase_requirements>

---

## Summary

Phase 2 is a pure TypeScript data-modeling and rule-function-extension phase. No new frameworks are needed. The Phase 1 engine FSM, deck builder, and test infrastructure all continue unchanged — this phase adds fields to existing types, extends the catalog, and adds new parameters to `scoreCards()` and `spendCards()`.

The most important design work is the combo matrix (balance document), which must be computed before any values are assigned to the 4 new cards or confirmed for the 8 existing ones. The math reveals a ceiling issue: with 5 high-strength cards against a matching event and beer spent on one card, a single turn can theoretically produce ~200+ points. This is fine for the 200-point threshold (3-5 turns per game is the intended pace), but setting base values too high risks a one-turn win.

The sabotage system requires adding three new state flags to `SnuskingPlayerState` (`skipNextTurn`, `pendingDiscard`, `highNicEffect`) and three new `SnuskingAction` union members (`snusking:sabotage-spend`, `snusking:sabotage-highnic`, `snusking:activate-immunity`). These are checked at the start of each phase transition, not as reactive events.

**Primary recommendation:** Write the balance document (combo matrix) as the first deliverable in Wave 0, before changing any code. Every card value decision flows from that matrix.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `*` (workspace) | Type-safe card definition and state modeling | Already in use; discriminated union pattern already established |
| Vitest | `^4.1.0` | Unit tests for scoring functions, state transitions, balance assertions | Already installed in server workspace; config at `server/vitest.config.ts` |
| Zod | `^4.3.6` | Schema validation for new action types at Socket.IO boundary | Already in use in engine.ts; new action types need matching Zod schemas |
| `crypto.randomInt` | Node built-in | Unbiased event card selection (same as deck shuffle) | REQ-NFR-03; already used in deck.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` v11 | `^11.0.3` | `instanceId` for new card instances | Already used in `buildDeck()`; no change needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain boolean flags on `SnuskingPlayerState` | Separate sabotage state object | Flags are simpler; a nested object adds projection complexity with no benefit at this scale |
| Property-based event affinity (locked decision) | Fixed home-event card mapping | Property-based is more flexible; already locked by user |

**Installation:** No new packages needed for this phase.

---

## Architecture Patterns

### Recommended Project Structure
```
shared/src/
└── types.ts              # SnuskingCardDefinition + strength/flavor, SnuskingEventCard,
                          # SnuskingPlayerState + sabotage flags, SnuskingAction union extensions

server/src/games/snusking/
├── deck.ts               # SNUSKING_CARDS extended to 12; SNUSKING_EVENTS added
├── rules.ts              # scoreCards(cards, event?, beerOnCardId?), spendCards updated
├── engine.ts             # beer increment, sabotage delivery, immunity check, event rotation
├── deck.test.ts          # existing — extend with catalog count/property tests
├── rules.test.ts         # extend with combo matrix assertions
└── engine.test.ts        # extend with sabotage state transition tests

.planning/phases/02-card-design-balance-and-game-economy/
└── BALANCE.md            # combo matrix document (Wave 0 deliverable before any code)
```

### Pattern 1: Extending the Discriminated Union (SnuskingAction)
**What:** Add new action variants to the existing discriminated union without breaking existing handlers.
**When to use:** Adding sabotage send, beer combo spend, and immunity activation.
**Example:**
```typescript
// In shared/src/types.ts — extend existing union
export type SnuskingAction =
  | { type: 'snusking:spend'; cardIds: string[] }
  | { type: 'snusking:pass' }
  | { type: 'snusking:trade-offer'; targetPlayerId: string; cardInstanceId: string; displayName?: string }
  | { type: 'snusking:trade-accept'; offerId: string }
  | { type: 'snusking:trade-decline'; offerId: string }
  // Phase 2 additions:
  | { type: 'snusking:spend-with-beer'; cardIds: string[]; beerCardId: string }
  | { type: 'snusking:sabotage-spentsnus'; targetPlayerId: string; cardInstanceId: string }
  | { type: 'snusking:sabotage-highnic'; targetPlayerId: string; cardInstanceId: string }
  | { type: 'snusking:activate-immunity' };
```

### Pattern 2: Pure Function Signature Extension (scoreCards)
**What:** Add optional parameters to `scoreCards()` and `spendCards()` to carry event and beer context. Existing call sites pass no arguments, so they get base-only scoring (backwards-compatible).
**When to use:** Any calculation that depends on game context that didn't exist before.
**Example:**
```typescript
// Source: derived from existing rules.ts pattern
export function scoreCards(
  cards: SnuskingCardInstance[],
  activeEvent?: SnuskingEventCard | null,
  beerCardId?: string,           // instanceId of the card getting the beer bonus
): number {
  return cards.reduce((sum, card) => {
    let points = card.empirePoints;
    // Beer bonus: +50% applied first (before multiplier)
    if (beerCardId && card.instanceId === beerCardId) {
      points = Math.round(points * 1.5);
    }
    // Event multiplier applied after beer
    const multiplier = activeEvent ? computeEventMultiplier(card, activeEvent) : 1;
    return sum + Math.round(points * multiplier);
  }, 0);
}
```

### Pattern 3: Sabotage Flag Lifecycle
**What:** Three new boolean flags on `SnuskingPlayerState` control sabotage effects. Flags are set during resolve phase and consumed (cleared) at the start of the next turn's draw/planning transition.
**When to use:** Any effect that spans turn boundaries.

```
Turn N (resolve phase):
  sabotage delivered → set flags on target player state:
    skipNextTurn: true   (spent snus)
    pendingDiscard: true (high-nic)
    highNicEffect: true  (high-nic — server emits flag to client)

Turn N+1 (draw phase, before dealing cards):
  if player.skipNextTurn:
    → auto-pass this player for the turn (skip planning entirely)
    → clear skipNextTurn
  if player.pendingDiscard:
    → discard one card from hand (random or first)
    → clear pendingDiscard
    → emit highNicEffect flag in projected state so client can show blurry screen
    → clear highNicEffect after first emit
```

### Pattern 4: Immunity Check Ordering
**What:** Immunity must be checked before sabotage delivery. The correct order in `startResolve()` is:
1. Activate any `snusking:activate-immunity` actions (set `immunityActive: true`, debit 1 beer)
2. Deliver sabotage actions — skip any target whose `immunityActive` is true
3. Credit scores from `snusking:spend` and `snusking:spend-with-beer` actions
4. Clear immunity flags for all players
5. Check win condition

### Pattern 5: Event Card Selection
**What:** At the start of each draw phase, one event is selected from the pool. Use the same `crypto.randomInt` pattern as deck shuffle.
**Example:**
```typescript
// In engine.ts startDrawPhase()
const eventIdx = randomInt(0, SNUSKING_EVENTS.length);
this.masterState.currentEvent = SNUSKING_EVENTS[eventIdx];
```

### Anti-Patterns to Avoid
- **Putting beer total on SnuskingCardInstance:** Beer is a player-level resource, not a card property. `SnuskingPlayerState.beer` (already exists) is the correct location.
- **Resolving sabotage during planning phase:** Sabotage targeting must be committed during planning (as a pending action) but only delivered during resolve — same as all other actions. Delivering early breaks the simultaneous reveal guarantee.
- **Copying definition name to card instance at trade time:** When a trade is accepted, the `displayName` from the offer should remain visible to the recipient until they play the card — the real `name` must not be exposed. The `SnuskingCardInstance` shape already supports this: the instance's `name` field can hold the display name. The true identity is stored only in `definitionId`.
- **Using floating point for point arithmetic:** Multipliers produce non-integer results. Use `Math.round()` at every multiplication step to avoid fractional empire points.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unbiased random event selection | Custom random logic | `crypto.randomInt` (already in deck.ts) | Same REQ-NFR-03 requirement; Fisher-Yates unnecessary for single selection but `crypto.randomInt` gives uniform index |
| Action validation for new action types | Custom type guards | Extend existing Zod discriminated union in `engine.ts` | Pattern already established; new variants are trivial additions |
| Card property lookup | Build lookup maps | Access `card.definitionId` → lookup in `SNUSKING_CARDS` constant | Catalog is small (12 entries); a Map is premature |

**Key insight:** This phase is almost entirely data definition and pure-function extension. The engine FSM machinery is complete; this phase fills in the values and conditions it evaluates.

---

## Combo Matrix (Balance Document)

This is the **design-first deliverable** — must be complete before assigning any card values.

### Combo Multiplier Formula

```
finalPoints(card, event, beerOnThisCard) =
  base
  × (1.5 if beer and card.strength in {high, extreme} else 1)
  × eventMultiplier(card, event)

where:
  eventMultiplier = 2.0  if card matches BOTH event strength AND event flavor affinity
                 = 1.5  if card matches ONE of event strength or flavor affinity
                 = 1.0  if no match
```

### Event Affinity Assignments (Claude's discretion, locked here for planner)

| Event | Strength Affinity | Flavor Affinity |
|-------|------------------|-----------------|
| Sauna Night | high, extreme | tobacco, licorice |
| Fishing Trip | low, medium | tobacco, licorice |
| Party | medium, high | mint, sweet, citrus |

**Rationale:**
- Sauna Night rewards the strongest, most classic snus (Siberia, Oden's, Thunder)
- Fishing Trip is the working-man's session — moderate strength, traditional tobacco
- Party rewards modern/flavored products — Velo, Zyn, Catch Licorice

### Existing 8 Cards — Proposed Strength/Flavor Assignments

| Card | strength | flavor | Base Points |
|------|----------|--------|-------------|
| General | medium | tobacco | 20 |
| Siberia -80 | extreme | tobacco | 30 |
| Ettan | low | tobacco | 15 |
| Göteborgs Rapé | low | licorice | 18 |
| Grov | medium | tobacco | 14 |
| Catch Licorice | medium | licorice | 22 |
| Oden's Extreme | extreme | licorice | 28 |
| Thunder Extra Strong | high | mint | 25 |

### 4 New Cards — Proposed Assignments (Claude's discretion)

| Card | strength | flavor | Base Points | Notes |
|------|----------|--------|-------------|-------|
| Knox Blue | medium | tobacco | 17 | Classic tobacco medium-strength — fills gap between Ettan and General |
| Lundgrens | low | citrus | 16 | Premium coastal brand; light citrus character |
| Velo | low | mint | 12 | Nicotine pouch — low strength, clean mint; modern tier |
| Zyn | medium | citrus | 19 | Nicotine pouch — medium strength, citrus; modern premium |

**Immunity card (Claude's discretion):**
- **Card name: "Lyckos" ("Lucky")**  — thematic feel of dodging sabotage
- Base empire points: 10 (low value offensively; its value is defensive)
- strength: low, flavor: sweet (matches Party; low offensive ceiling)
- Not added to the 12-card catalog — it is drawn from the same deck; the 12-card count includes Lyckos as card 13... **wait, locked decision is 12 total**.

  Resolution: Lyckos IS one of the 12 cards. Adjust: replace Velo with "Lyckos (immunity)" — but Velo is a locked decision (CONTEXT.md lists it explicitly). Therefore: the immunity property is an attribute of an existing card, OR Lyckos is added as card 13 violating the locked count.

  **Correct resolution:** The immunity card is a **role** (`isImmunityCard: true`) that can be assigned to one of the existing 12 cards rather than being a 13th card. Claude's discretion on which card gets the immunity role. Recommendation: **Göteborgs Rapé** receives `isImmunityCard: true` — thematically, it's the gentlemanly diplomat brand. Alternatively, a card's `isHighNic: true` or `isSpentSnus: true` roles distinguish sabotage cards.

  **Alternative resolution (preferred):** The immunity card is **not a 13th card in the deck**. It is a special in-hand effect: when a player holds any card tagged `canProvideImmunity: true` and chooses `snusking:activate-immunity`, they spend 1 beer and the immunity is granted. The card is NOT consumed — only the beer is spent. This preserves the 12-card catalog and aligns with CONTEXT.md's "at least one card type provides immunity."

  **Recommendation to planner:** Use the alternative resolution. Add `canProvideImmunity?: boolean` to `SnuskingCardDefinition`. Assign it to Göteborgs Rapé (`id: 'goteborg'`). The player must hold this card in hand to be eligible to activate immunity (spends 1 beer, card stays in hand).

### Max-Possible-Value Scenarios (per turn, 5 cards in hand)

**Scenario A — No event match, no beer:**
All 5 cards are Siberia (extreme, tobacco, 30 pts). Total: 150 pts.
→ From 0, requires 2+ turns minimum to win (50 points short per turn).

**Scenario B — Full event match (2×), no beer:**
Sauna Night active. All 5 cards match both: 5 × 30 × 2.0 = 300 pts.
→ One-turn win from 0. This is possible but requires all 5 cards to be Siberia/Oden's AND the right event AND already holding a full hand of extremes. In a 12-card deck with 3 copies each (36 cards total), drawing 5 extreme/tobacco cards is unlikely but possible.
→ **Concern:** single-turn win is theoretically possible with perfect setup. Phase 4 playtesting will catch this; CONTEXT.md defers exact value tuning.

**Scenario C — Beer on one high-strength card, matching event (best single-card):**
Siberia (30) × 1.5 beer = 45 × 2.0 event = 90 pts from one card.
Remaining 4 cards at base 30 × 2.0 = 240 pts total for hand.
→ Single turn still over 200. Same concern as Scenario B.

**Scenario D — Realistic average turn (mixed hand, Fishing Trip event, no beer):**
Hand: General (20 × 2.0 = 40), Ettan (15 × 2.0 = 30), Grov (14 × 1.5 = 21), Catch Licorice (22 × 1.0 = 22), Velo (12 × 1.0 = 12).
Total: 125 pts. Goal after 2 turns: 250 pts (win).
→ ~2-turn game with perfect alignment. Acceptable for Phase 1 value iteration.

**Scenario E — Sabotaged player (spent snus, turn skipped):**
Player skips an entire turn. Opponent gains one full turn uncontested.
Opportunity cost of being sabotaged with spent snus in a 200-point game: ~125 pts on a typical turn (Scenario D baseline) — extremely powerful. This validates the one-sabotage-per-target-per-turn limit.

**Balance Flag for Phase 4:**
The base point values for extreme cards (28-30) produce single-turn wins with a matching event. Phase 4 playtesting should reduce extreme card base values or increase the score threshold if games feel too short. Tunable parameters: `SCORE_THRESHOLD` constant in rules.ts (currently 200) and all `empirePoints` values in deck.ts.

---

## Common Pitfalls

### Pitfall 1: Breaking `scoreCards()` call sites in engine.ts
**What goes wrong:** Adding required parameters to `scoreCards()` breaks `spendCards()` which calls it internally, and breaks existing tests.
**Why it happens:** `spendCards()` calls `scoreCards(spentCards)` with no event context. If event is required, TypeScript compile fails.
**How to avoid:** Make `activeEvent` and `beerCardId` optional parameters with defaults of `null`/`undefined`. Existing call sites compile without changes.
**Warning signs:** TypeScript error `Expected N arguments, but got 1` at the `spendCards()` call.

### Pitfall 2: Emitting `highNicEffect` flag in every projected state
**What goes wrong:** The blurry-screen flag fires continuously instead of once-per-trigger.
**Why it happens:** If `highNicEffect: boolean` stays `true` on the player state, every `emitPerPlayer()` call sends the flag, causing the client to re-trigger the effect on every state update.
**How to avoid:** Clear `highNicEffect` from the player state after one `emitPerPlayer()` cycle. Emit the effect, then set the flag back to `false` in the same resolve phase before the next turn starts.
**Warning signs:** Client shows blurry screen persisting across multiple turns.

### Pitfall 3: Sabotage targeting same player twice in one turn
**What goes wrong:** A player sends both a spent snus sabotage and a high-nic sabotage to the same target in one turn, bypassing the one-per-target limit.
**Why it happens:** Phase 1 engine does not track sabotage targets per turn.
**How to avoid:** Track a `sabotageSentTo: Set<string>` in the per-turn action processing in `handleEvent()` or deduplicate in `startResolve()`. The simpler approach: during `startResolve()`, only apply the first sabotage action found targeting each player — ignore subsequent ones.
**Warning signs:** A player has both `skipNextTurn` and `pendingDiscard` set in the same resolve pass (impossible with the one-per-target rule).

### Pitfall 4: Trade `displayName` leaking real identity before spend
**What goes wrong:** When the trade is accepted and the card arrives in the recipient's hand, the `SnuskingCardInstance.name` field still holds the real card name (set at deck build time).
**Why it happens:** `resolveAcceptedTrades()` splices the card directly from the sender's hand and pushes it to the recipient. The instance's `name` field was set to the real name by `buildDeck()`.
**How to avoid:** When a trade offer is created, the `displayName` in `SnuskingTradeOffer` is what the recipient sees in their `pendingTradeOffers`. When the trade resolves and the card lands in the recipient's hand, override the `SnuskingCardInstance.name` field with the `displayName` from the offer. On spend (in `spendCards()`), use `definitionId` to look up the real `empirePoints` from `SNUSKING_CARDS` — the instance's name is cosmetic only.

  Alternatively: the client displays the trade offer's `displayName` for offered cards, and only on spend does it call back with the real `definitionId` lookup. This requires the client to distinguish "received via trade with fake name" from "drawn from deck." The simpler server-side approach (mutate the instance name field) is recommended.

### Pitfall 5: Beer cap not enforced at increment
**What goes wrong:** Beer exceeds cap 3 because the increment logic doesn't check.
**Why it happens:** `startDrawPhase()` will add `player.beer += 1` without a cap check.
**How to avoid:** `player.beer = Math.min(player.beer + 1, 3)` — always.
**Warning signs:** `beer` value > 3 appearing in projected state.

### Pitfall 6: Immunity activated without enough beer
**What goes wrong:** Player sends `snusking:activate-immunity` with 0 beer.
**Why it happens:** Client validation is absent (server-only Zod validates shape, not state).
**How to avoid:** In `handleEvent()`, when processing `snusking:activate-immunity`, check `player.beer >= 1` before setting flag. Silently ignore the action if beer is insufficient (same pattern as invalid Zod payload handling).

### Pitfall 7: `currentEvent` in `SnuskingProjectedState` is missing
**What goes wrong:** Client cannot display the active event because `projectState()` doesn't include it.
**Why it happens:** `SnuskingProjectedState` type and `projectState()` implementation were built before event cards existed.
**How to avoid:** Add `currentEvent: SnuskingEventCard | null` to `SnuskingProjectedState` and populate it from `this.masterState.currentEvent` in `projectState()`.

---

## Type Changes Required

This section documents every type in `shared/src/types.ts` that needs modification.

### 1. `SnuskingCardDefinition` — Add strength, flavor, and role fields
```typescript
export type SnuskingCardStrength = 'low' | 'medium' | 'high' | 'extreme';
export type SnuskingCardFlavor = 'tobacco' | 'mint' | 'citrus' | 'licorice' | 'sweet';

export interface SnuskingCardDefinition {
  id: string;
  name: string;
  empirePoints: number;
  strength: SnuskingCardStrength;    // ADDED Phase 2
  flavor: SnuskingCardFlavor;        // ADDED Phase 2
  isSpentSnus?: boolean;             // ADDED Phase 2 — sabotage type 1
  isHighNic?: boolean;               // ADDED Phase 2 — sabotage type 2
  canProvideImmunity?: boolean;      // ADDED Phase 2 — immunity role
}
```
**Breaking change:** All 8 existing catalog entries in `deck.ts` must be updated with `strength` and `flavor` values. TypeScript will enforce this at compile time.

### 2. `SnuskingEventCard` — New type (replaces `currentEvent: null`)
```typescript
export interface SnuskingEventCard {
  id: string;
  name: string;                          // 'Sauna Night' | 'Fishing Trip' | 'Party'
  strengthAffinity: SnuskingCardStrength[];
  flavorAffinity: SnuskingCardFlavor[];
}
```

### 3. `SnuskingMasterState` — `currentEvent` type change
```typescript
currentEvent: SnuskingEventCard | null;  // was: null (literal)
```

### 4. `SnuskingProjectedState` — Add `currentEvent`
```typescript
currentEvent: SnuskingEventCard | null;  // ADDED — client needs event for UI
```

### 5. `SnuskingPlayerState` — Add sabotage flags
```typescript
export interface SnuskingPlayerState {
  userId: string;
  username: string;
  hand: SnuskingCardInstance[];
  empireScore: number;
  hasCommitted: boolean;
  isConnected: boolean;
  beer: number;
  // Phase 2 additions:
  skipNextTurn: boolean;         // set by spent snus sabotage; cleared at turn start
  pendingDiscard: boolean;       // set by high-nic sabotage; cleared after forced discard
  highNicEffect: boolean;        // transient flag emitted to client once; cleared after emit
  immunityActive: boolean;       // set by immunity activation; cleared after resolve
}
```

### 6. `SnuskingAction` — Add Phase 2 action types
```typescript
export type SnuskingAction =
  | { type: 'snusking:spend'; cardIds: string[] }
  | { type: 'snusking:pass' }
  | { type: 'snusking:trade-offer'; targetPlayerId: string; cardInstanceId: string; displayName?: string }
  | { type: 'snusking:trade-accept'; offerId: string }
  | { type: 'snusking:trade-decline'; offerId: string }
  // Phase 2:
  | { type: 'snusking:spend-with-beer'; cardIds: string[]; beerCardId: string }
  | { type: 'snusking:sabotage-spentsnus'; targetPlayerId: string; cardInstanceId: string }
  | { type: 'snusking:sabotage-highnic'; targetPlayerId: string; cardInstanceId: string }
  | { type: 'snusking:activate-immunity' };
```

---

## Code Examples

### Combo multiplier helper
```typescript
// Source: derived from CONTEXT.md locked rules
function computeEventMultiplier(
  card: SnuskingCardInstance,
  def: SnuskingCardDefinition,
  event: SnuskingEventCard,
): number {
  const strengthMatch = event.strengthAffinity.includes(def.strength);
  const flavorMatch = event.flavorAffinity.includes(def.flavor);
  if (strengthMatch && flavorMatch) return 2.0;
  if (strengthMatch || flavorMatch) return 1.5;
  return 1.0;
}
```

Note: `scoreCards()` receives `SnuskingCardInstance[]` but event matching requires the `SnuskingCardDefinition` (for `strength` and `flavor`). Two implementation approaches:
1. Copy `strength` and `flavor` onto `SnuskingCardInstance` at deck-build time (simpler, slight duplication)
2. Look up `definitionId` in `SNUSKING_CARDS` catalog inside `scoreCards()` (more indirection)

**Recommendation:** Option 1 — stamp `strength` and `flavor` onto the instance at `buildDeck()` time. This keeps `scoreCards()` self-contained without needing a catalog reference parameter. `SnuskingCardInstance` gains optional `strength` and `flavor` fields.

### Beer increment in `startDrawPhase()`
```typescript
// In engine.ts, inside startDrawPhase(), before calling drawCards()
for (const player of Object.values(this.masterState.players)) {
  player.beer = Math.min(player.beer + 1, 3);  // +1/turn, cap 3
}
```

### Sabotage delivery in `startResolve()`
```typescript
// After immunity actions are processed:
const sabotagedThisTurn = new Set<string>(); // enforce one-per-target

for (const [senderId, action] of this.pendingActions) {
  if (
    action.type === 'snusking:sabotage-spentsnus' ||
    action.type === 'snusking:sabotage-highnic'
  ) {
    const targetId = action.targetPlayerId;
    if (sabotagedThisTurn.has(targetId)) continue; // one-per-target limit
    const target = this.masterState.players[targetId];
    if (!target || target.immunityActive) continue; // blocked by immunity

    sabotagedThisTurn.add(targetId);

    // Transfer the card from sender to target hand (same as trade, but not chosen)
    const sender = this.masterState.players[senderId];
    const cardIdx = sender.hand.findIndex(c => c.instanceId === action.cardInstanceId);
    if (cardIdx !== -1) {
      const [card] = sender.hand.splice(cardIdx, 1);
      target.hand.push(card);
    }

    if (action.type === 'snusking:sabotage-spentsnus') {
      target.skipNextTurn = true;
    } else {
      target.pendingDiscard = true;
      target.highNicEffect = true;
    }
  }
}
```

### Handling `skipNextTurn` in `startDrawPhase()`
```typescript
// Before dealing cards, check skip flags
for (const [playerId, player] of Object.entries(this.masterState.players)) {
  if (player.skipNextTurn) {
    // Auto-pass this player immediately — they skip planning
    this.pendingActions.set(playerId, { type: 'snusking:pass' });
    player.hasCommitted = true;
    player.skipNextTurn = false;
  }
}
```

### Handling `pendingDiscard` in `startDrawPhase()`
```typescript
// After skip check, before drawCards:
for (const player of Object.values(this.masterState.players)) {
  if (player.pendingDiscard && player.hand.length > 0) {
    // Discard the first card in hand (or implement random selection)
    const [discarded] = player.hand.splice(0, 1);
    this.masterState.discardPile.push(discarded);
    player.pendingDiscard = false;
    // highNicEffect stays true — emitted in this turn's emitPerPlayer, then cleared
  }
}
// After emitPerPlayer() in startPlanningPhase(), clear highNicEffect:
for (const player of Object.values(this.masterState.players)) {
  player.highNicEffect = false;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `currentEvent: null` (literal type) | `SnuskingEventCard \| null` | Phase 2 | Requires type update in both MasterState and ProjectedState |
| `scoreCards(cards)` — sum only | `scoreCards(cards, event?, beerCardId?)` | Phase 2 | Optional params preserve backwards compat |
| No sabotage state | Three boolean flags on `SnuskingPlayerState` | Phase 2 | Flags checked at phase transition boundaries |
| `SnuskingAction` has 5 members | `SnuskingAction` has 9 members | Phase 2 | Each new member needs a Zod schema in `engine.ts` |

**Deprecated/outdated:**
- `currentEvent: null` literal type in `SnuskingMasterState` — replace with `SnuskingEventCard | null`
- `displayName: this.masterState.players[...].name` in `registerTradeOffer()` — Phase 2 adds client-supplied `displayName` to the trade-offer action

---

## Open Questions

1. **Should `SnuskingCardInstance` copy `strength` and `flavor` from definition?**
   - What we know: `scoreCards()` operates on instances; event matching needs definition properties
   - What's unclear: Whether to stamp properties on instance or look up definition by `definitionId`
   - Recommendation: Stamp on instance at `buildDeck()` time (simpler `scoreCards()` implementation). Adds 2 fields to `SnuskingCardInstance` type.

2. **Does the trade-offer action need a client-supplied `displayName`?**
   - What we know: CONTEXT.md says `displayName ≠ real name`; the current `registerTradeOffer()` sets `displayName` from the card's real name
   - What's unclear: Whether the client chooses the fake name or the server generates one
   - Recommendation: Add `displayName?: string` to `snusking:trade-offer` action (client can supply a fake name; defaults to real name if absent). Planner should confirm.

3. **Sabotage card consumption on send: is the card removed from sender's hand?**
   - What we know: Spent snus is sent to the opponent — it occupies their hand slot, clogging it
   - What's unclear: Whether the sabotage card leaves the sender's hand (transferred) or stays (copied)
   - Recommendation: Transfer (sender loses the card). This preserves deck integrity (no card duplication). The code example above implements transfer.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `server/vitest.config.ts` (exists) |
| Quick run command | `cd server && npm test -- --reporter=verbose` |
| Full suite command | `cd server && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD-SYS | 12 cards in catalog, each with strength + flavor | unit | `cd server && npm test -- deck.test` | ✅ extend `deck.test.ts` |
| EVENT-SYS | 3 events in pool, each with non-empty affinities | unit | `cd server && npm test -- deck.test` | ✅ extend `deck.test.ts` |
| EVENT-SYS-3 | 2× multiplier when both properties match | unit | `cd server && npm test -- rules.test` | ✅ extend `rules.test.ts` |
| EVENT-SYS-3 | 1.5× multiplier when one property matches | unit | `cd server && npm test -- rules.test` | ✅ extend `rules.test.ts` |
| EVENT-SYS-3 | 1× when no match | unit | `cd server && npm test -- rules.test` | ✅ extend `rules.test.ts` |
| BEER-RES | Beer increments +1 each turn, caps at 3 | unit | `cd server && npm test -- engine.test` | ✅ extend `engine.test.ts` |
| BEER-RES-2 | Beer +50% applied before event multiplier | unit | `cd server && npm test -- rules.test` | ✅ extend `rules.test.ts` |
| TRADE-SAB-2 | Spent snus sets `skipNextTurn` on target; target auto-passed next turn | unit | `cd server && npm test -- engine.test` | ✅ extend `engine.test.ts` |
| TRADE-SAB-3 | High-nic sets `pendingDiscard` + `highNicEffect`; card discarded next draw | unit | `cd server && npm test -- engine.test` | ✅ extend `engine.test.ts` |
| TRADE-SAB-4 | Immunity activation sets flag; sabotage blocked for immunized player | unit | `cd server && npm test -- engine.test` | ✅ extend `engine.test.ts` |
| TRADE-SAB-5 | Second sabotage targeting same player in same turn is ignored | unit | `cd server && npm test -- engine.test` | ✅ extend `engine.test.ts` |
| TRADE-SAB-6 | Accepted trade card arrives in recipient's hand same turn | unit | `cd server && npm test -- engine.test` | ✅ (existing test covers basic trade) |
| CARD-SYS-2 | `isSpentSnus` card cannot generate empire points for sender | unit | `cd server && npm test -- rules.test` | ❌ Wave 0 |
| BEER-RES | Beer immunity: `immunityActive` requires beer >= 1; rejected if 0 | unit | `cd server && npm test -- engine.test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd server && npm test -- --reporter=dot`
- **Per wave merge:** `cd server && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/src/games/snusking/rules.test.ts` — extend with combo multiplier tests (REQ EVENT-SYS-3, BEER-RES-2). File exists but `scoreCards` test is a placeholder stub (`expect(true).toBe(true)`).
- [ ] `server/src/games/snusking/engine.test.ts` — extend with sabotage state transition tests (REQ TRADE-SAB-2, TRADE-SAB-3, TRADE-SAB-4, TRADE-SAB-5, BEER-RES)
- [ ] No new test files needed — all new tests extend existing files

*(Framework already installed; vitest.config.ts exists; alias for `@slutsnus/shared` already configured.)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `server/src/games/snusking/engine.ts`, `rules.ts`, `deck.ts` — full implementation reading
- Direct type inspection: `shared/src/types.ts` — all existing Snusking types
- Direct test inspection: `*.test.ts` files — existing test patterns and stubs
- `server/package.json` — Vitest 4.1.0 confirmed installed
- `server/vitest.config.ts` — test config confirmed with `@slutsnus/shared` alias

### Secondary (MEDIUM confidence)
- `.planning/phases/02-card-design-balance-and-game-economy/02-CONTEXT.md` — user decisions (authoritative for this project)
- `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` — project context

### Tertiary (LOW confidence)
- Balance math in combo matrix — derived from locked decision rules in CONTEXT.md; values are starting points for Phase 4 playtesting iteration

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed from package.json; no new dependencies needed
- Architecture patterns: HIGH — derived from direct code reading of existing engine patterns
- Type changes: HIGH — all fields derived from locked CONTEXT.md decisions mapped to existing type shapes
- Balance math: MEDIUM — formula is HIGH confidence (derived from locked rules); specific base values are LOW confidence (intentionally deferred to Phase 4)
- Pitfalls: HIGH — all identified from direct reading of existing code and known patterns for this architecture

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable codebase; no fast-moving dependencies)
