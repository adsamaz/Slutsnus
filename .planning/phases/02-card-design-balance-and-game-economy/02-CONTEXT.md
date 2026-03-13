# Phase 2: Card Design, Balance, and Game Economy - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Design and implement the complete card catalog (12 brands), event system (3 types), beer resource mechanics, sabotage system (two card types + immunity), and deceptive trading. The Phase 1 engine FSM stays unchanged — this phase populates the values and rules it evaluates. `currentEvent: null` in `SnuskingMasterState` becomes a real type; card definitions gain strength/flavor properties for bonus scoring.

</domain>

<decisions>
## Implementation Decisions

### Card Catalog
- **Total: 12 cards** — 8 existing + 4 new: Knox Blue, Lundgrens, Velo, Zyn
- Note: Velo and Zyn are nicotine pouches (not traditional snus) — treat as premium/modern tier cards with distinct flavor profile properties
- Each card has **two properties**: `strength` (low/medium/high/extreme) and `flavor` (tobacco/mint/citrus/licorice/sweet)
- Event bonuses are property-based (not fixed home-event mapping): tiered bonus based on how many properties match the active event's affinity

### Event Cards
- **Exactly 3 event types** for this phase: Sauna Night, Fishing Trip, Party
- Each event defines which strength and flavor profiles it rewards
- Sauna Night → high/extreme strength affinity
- Fishing Trip → tobacco/outdoor flavor affinity
- Party → social/sweet/mint flavor affinity
- (Claude's discretion: exact affinity mapping for each event)

### Combo Bonus Rules
- **Match both properties (strength + flavor)** → 2× multiplier
- **Match one property** → 1.5× multiplier
- **No match** → base empire points only
- Beer combo: spending 1 beer with a high-strength card (high/extreme tier) adds +50% to that card's points (applied before event multiplier, Claude's discretion on interaction order)

### Sabotage — Two Card Types
1. **Spent snus** (low-value sabotage): 0 empire points if played; clogs recipient's hand; **effect on recipient: their action is auto-passed (skipped) for that turn**
2. **High-nicotine negative-effect card**: worth some points if played honestly, but when sent as sabotage → recipient must discard one card at start of next planning phase + UI shows a blurry/shaking screen effect for that player
- One sabotage action per target per turn (existing engine rule — unchanged)

### Sabotage Immunity Card
- At least one card type provides immunity
- **Activation cost: 1 beer unit** — spent beer triggers the shield
- Blocks all incoming sabotage for that turn
- (Claude's discretion: card name and base empire point value)

### Deceptive Trading
- `displayName` field already exists on `SnuskingTradeOffer` (Phase 1 infrastructure)
- Real card identity **reveals on spend** — recipient sees the fake name until they play the card
- Beer is **not tradeable** — beer stays personal, no fake beer offers
- Trade resolution: **same turn** — accepted trades complete before the reveal phase, so the received card can be played that turn

### Beer Resource
- **Acquisition: 1 beer automatically granted per turn** (passive income, no acquisition decision)
- **Hold cap: 3 units** — at cap, new beer is lost (prevents hoarding)
- **Two uses:**
  1. **Combo bonus** — spend 1 beer with a high-strength card play → +50% to that card's points
  2. **Sabotage immunity** — spend 1 beer to activate immunity card (blocks all incoming sabotage for the turn)
- The beer decision (save for defense vs spend for offense) is the core resource tension

### Hand Size
- **5 cards** — confirmed from Phase 1, no change

### Trade Timing (resolves open STATE.md question)
- Trades offered in planning phase, **accepted trades complete before reveal** — card arrives in recipient's hand in the same turn

### Sabotage Immunity Name (open from STATE.md)
- Claude's discretion on card name — capture as a named card in the catalog with appropriate empire point value

</decisions>

<specifics>
## Specific Ideas

- Velo and Zyn are nicotine pouches, not traditional snus — their flavor/strength profile should reflect their modern/clean character vs classic tobacco-forward brands
- High-nicotine sabotage card produces a **blurry/shaking screen** UI effect on the recipient — this is a client-side visual to implement in Phase 3, but the server event needs to flag it
- The 2× combo when both properties match should feel like a big moment — the "perfect game" scenario to aim for
- "Slut snus" end screen (from Phase 1) — keep as-is, no changes needed here

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/games/snusking/deck.ts` — `SNUSKING_CARDS: SnuskingCardDefinition[]` is the catalog to extend; `buildDeck()` and `shuffle()` are ready
- `server/src/games/snusking/rules.ts` — `scoreCards()`, `spendCards()`, `drawCards()`, `checkWinCondition()` all need updating for bonus logic
- `shared/src/types.ts` — `SnuskingCardDefinition` needs `strength` and `flavor` fields added; `SnuskingMasterState.currentEvent: null` needs a real `SnuskingEventCard` type; `SnuskingPlayerState` already has `beer: number`

### Established Patterns
- Card definitions are plain objects in `deck.ts` — no class hierarchy, no factory pattern
- Rules are pure functions (state in → state out) — scoring bonus logic follows the same pattern
- `SnuskingAction` discriminated union in `shared/src/types.ts` — add sabotage action types here
- Server-only Zod validation at Socket.IO boundary — new actions need Zod schemas in engine.ts

### Integration Points
- `SnuskingCardDefinition` in `shared/src/types.ts` — add `strength` and `flavor` fields (breaking change, all catalog entries need updating)
- `SnuskingMasterState.currentEvent` — change from `null` literal to `SnuskingEventCard | null`
- `scoreCards()` in `rules.ts` — needs active event parameter to apply multipliers
- `spendCards()` in `rules.ts` — needs beer parameter and event parameter for combo resolution
- New `SnuskingAction` types for sabotage send, beer combo spend, immunity activation

</code_context>

<deferred>
## Deferred Ideas

- Player-triggered situations (spend resources to activate a context/event) — v2 backlog, already noted in REQUIREMENTS.md
- Expanded brand catalog beyond 12 — v2
- Balance iteration on point values (exact numbers) — Phase 4 playtesting will tune these
- Blurry/shaking screen UI effect for high-nic sabotage — Phase 3 (client UI), but server must emit the right event flag

</deferred>

---

*Phase: 02-card-design-balance-and-game-economy*
*Context gathered: 2026-03-13*
