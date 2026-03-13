# Phase 3: Client UI and Reveal Experience - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the Solid.js card game UI. Skeleton components from Phase 1 (Board, Hand, OpponentStatus, PlayerHUD, EndScreen, index.tsx) exist but are placeholders. This phase replaces them with fully functional, styled components built against the finalized `SnuskingProjectedState` shape. No engine changes — UI only.

</domain>

<decisions>
## Implementation Decisions

### Card Visual Design
- **Layout:** Taller card block showing: brand name (bold), strength (icon + color-coded badge), flavor (icon + color-coded badge), empire points
- **Strength indicators:** Color-coded dot/bar (green=low, yellow=medium, orange=high, red=extreme) + icon
- **Flavor indicators:** Small emoji icon per flavor category (🌿 tobacco, ❄️ mint, 🍋 citrus, 🍫 licorice, 🍬 sweet) + colored text badge
- **Selected state:** Card lifts (translateY) + bright accent border highlight. Classic card game feel.
- **Face-down cards:** Dark green/brown card back with snus can icon or "SNUS" text — used for opponents' hands and pre-reveal state

### Reveal Animation
- **Flip timing:** All played cards flip simultaneously — 300–400ms CSS 3D flip animation. Reinforces the simultaneous reveal mechanic.
- **Combo feedback:** Matching card gets a colored glow (gold for 2×, silver for 1.5×) + a floating '+X pts' number that animates up and fades out
- **Card exit:** After resolve phase, played cards slide toward the discard pile indicator before the next draw phase

### Planning Phase UX
- **Action layout:** Tab-based panel — tabs: "Play", "Sabotage", "Trade"
- **Play tab:** Current hand with select → spend flow. "Spend + Beer" button appears when beer > 0 and card(s) selected. "Immunity" and "Pass" buttons in this tab.
- **Sabotage tab:** Hand shows sabotage-eligible cards. Select card first → player picker appears → confirm. One sabotage per target per turn (engine-enforced).
- **Trade tab:** Hand shown. Select card → modal opens with: card display, 'As:' fake name field (pre-filled with real name, editable), target player picker, Send button.
- **Incoming trades:** Toast/notification overlay at top of screen — "[Player] offers you [CARD NAME] — Accept / Decline". Multiple offers stack. Non-blocking.

### Event Card Display
- **Entry:** Full-screen flash when the turn's draw phase begins — event name + affinity description fills the screen for 2–3 seconds (CSS transition)
- **Persistent:** Shrinks to a banner at the top of the board for the rest of the turn. Always visible during planning.

### Status & Effects
- **Beer display (self):** 🍺 icons in PlayerHUD — filled/empty mugs showing current count vs max (3). Immediate visual read.
- **Beer display (opponents):** Shown in each opponent zone — informs decisions about their likely immunity use.
- **Turn timer:** Circular countdown ring in the board area. Color shifts green → yellow → red as time runs low.
- **Skip-next-turn debuff (spent snus sabotage):** Red/yellow banner shown during planning: "Your turn is skipped this round." Action buttons are disabled. Player can watch but cannot submit.
- **High-nic sabotage effect (blur):** Persistent blur filter on the game container for the entire planning phase of the affected turn. Clears when planning ends. Debuff reminder, not just a flash.
- **Pending discard (high-nic):** Auto-discards the lowest value card server-side — no UI prompt needed on client.

### Lobby Redesign (from Phase 1 deferred)
- Full lobby redesign is in scope for Phase 3 (deferred from Phase 1 context)
- Claude's discretion on the extent of the redesign — keep it functional and consistent with the game's theme

### Claude's Discretion
- Exact color palette and CSS variables
- Typography sizing and spacing
- Transition durations (within the ranges specified above)
- Lobby redesign extent
- CSS animation implementation details (keyframe names, easing curves)
- Auto-discard card selection logic if there are ties (lowest value)

</decisions>

<specifics>
## Specific Ideas

- "Slut Snus" end screen already has Swedish text ("Snuset är slut. Spelet är slut." and "Riket är byggt!") — keep this tone throughout
- High-nic blur is persistent all planning phase — it's meant to be punishing and make planning harder, not just a notification
- Simultaneous flip is the visual payoff of the core mechanic — the reveal animation should feel like the dramatic moment it is
- Beer mugs 🍺 as icons are thematic and immediately readable at a glance

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/games/snusking/Board.tsx` — skeleton: phase, deckCount, discardCount, turnNumber. Extend with event banner and timer ring.
- `client/src/games/snusking/Hand.tsx` — skeleton: card select + spend/pass. Extend with beer combo button; fold into tab structure.
- `client/src/games/snusking/OpponentStatus.tsx` — skeleton: name, score, handCount, hasCommitted, isConnected. Add beer display.
- `client/src/games/snusking/PlayerHUD.tsx` — skeleton: self + opponent scores. Add beer mug icons, debuff indicators.
- `client/src/games/snusking/EndScreen.tsx` — already has "Slut Snus" and "score_threshold" branching with Swedish text. Mostly done.
- `client/src/games/snusking/index.tsx` — root SnuskingGame with Switch/Match on phase. Add RevealOverlay here.
- `client/src/components/Toast.tsx` — existing Toast component for incoming trade notification toasts
- `client/src/components/Modal.tsx` — existing Modal component for trade dialog

### Established Patterns
- Solid.js `<Switch>/<Match>` for phase-conditional rendering — already in use in index.tsx
- `createSignal` for local UI state (selected cards already use this pattern in Hand.tsx)
- `<For>` for list rendering — already used in all list components
- `<Show>` for conditional UI — already used throughout
- CSS class-based styling (no CSS modules apparent — plain class strings)
- TypeScript strict mode; all props typed via interfaces

### Integration Points
- `SnuskingProjectedState.currentEvent: SnuskingEventCard | null` — drives event flash and banner
- `SnuskingPlayerState.highNicEffect: boolean` — drives blur filter on game container
- `SnuskingPlayerState.skipNextTurn: boolean` — drives skip banner and disabled planning UI
- `SnuskingPlayerState.beer: number` — drives beer mug HUD
- `SnuskingOpponentState.beer: number` — shown in opponent zone
- `SnuskingProjectedState.pendingTradeOffers` — drives incoming trade toasts
- `SnuskingAction` union — all new action types (`spend-with-beer`, `sabotage-spentsnus`, `sabotage-highnic`, `trade-offer`, `activate-immunity`) need to be wired to onAction

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-client-ui-and-reveal-experience*
*Context gathered: 2026-03-13*
