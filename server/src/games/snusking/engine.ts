import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { randomInt } from 'crypto';
import type {
  SnuskingMasterState,
  SnuskingProjectedState,
  SnuskingOpponentState,
  SnuskingPlayerState,
  SnuskingAction,
  GameEndReason,
  GameResult,
} from '@slutsnus/shared';
import type { TurnBasedGameEngine, TurnPhase } from '../registry';
import type { PlayerInfo, GameAction } from '@slutsnus/shared';
import { buildDeck, shuffle, SNUSKING_EVENTS } from './deck';
import { drawCards, spendCards, checkWinCondition, MAX_HAND_SIZE } from './rules';

// ─── Constants ───────────────────────────────────────────────────────────────
const TURN_TIMER_MS = 45_000; // locked per CONTEXT.md

// suppress unused import warning — MAX_HAND_SIZE is used by drawCards internally
void MAX_HAND_SIZE;

// ─── Zod Action Schemas ──────────────────────────────────────────────────────
// Server-side validation only (REQ-NFR-02). Never imported by client.

const SnuskingActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snusking:spend'), cardIds: z.array(z.string()) }),
  z.object({ type: z.literal('snusking:pass') }),
  z.object({
    type: z.literal('snusking:trade-offer'),
    targetPlayerId: z.string(),
    cardInstanceId: z.string(),
    displayName: z.string().optional(),
  }),
  z.object({ type: z.literal('snusking:trade-accept'), offerId: z.string() }),
  z.object({ type: z.literal('snusking:trade-decline'), offerId: z.string() }),
  z.object({
    type: z.literal('snusking:spend-with-beer'),
    cardIds: z.array(z.string()),
    beerCardId: z.string(),
  }),
  z.object({
    type: z.literal('snusking:sabotage-spentsnus'),
    targetPlayerId: z.string(),
    cardInstanceId: z.string(),
  }),
  z.object({
    type: z.literal('snusking:sabotage-highnic'),
    targetPlayerId: z.string(),
    cardInstanceId: z.string(),
  }),
  z.object({ type: z.literal('snusking:activate-immunity') }),
]);

// ─── Engine ──────────────────────────────────────────────────────────────────

export class SnuskingEngine implements TurnBasedGameEngine {
  private masterState!: SnuskingMasterState;
  private pendingActions = new Map<string, SnuskingAction>();
  private turnTimer?: ReturnType<typeof setTimeout>;
  private onStateUpdate: (state: unknown) => void = () => {};

  // ── GameEngine interface ────────────────────────────────────────────────

  init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
    this.onStateUpdate = onStateUpdate;
    const playerMap: Record<string, SnuskingPlayerState> = {};
    for (const p of players) {
      playerMap[p.userId] = {
        userId: p.userId,
        username: p.username,
        hand: [],
        empireScore: 0,
        hasCommitted: false,
        isConnected: true,
        beer: 0,
        skipNextTurn: false,
        pendingDiscard: false,
        highNicEffect: false,
        immunityActive: false,
      };
    }
    this.masterState = {
      roomId,
      phase: 'draw',
      players: playerMap,
      deck: shuffle(buildDeck()),
      discardPile: [],
      currentEvent: null,
      turnNumber: 1,
      pendingTradeOffers: [],
      status: 'active',
      endReason: null,
      results: null,
    };
    this.startDrawPhase();
  }

  handleEvent(playerId: string, action: GameAction): void {
    if (this.masterState.phase !== 'planning') return;
    if (this.pendingActions.has(playerId)) return; // already committed — idempotent

    // Validate with Zod — silently reject invalid payloads (REQ-NFR-02)
    const parsed = SnuskingActionSchema.safeParse(action);
    if (!parsed.success) return;

    const validated = parsed.data;
    this.pendingActions.set(playerId, validated);
    this.masterState.players[playerId].hasCommitted = true;

    // Register trade offers (resolved during reveal)
    if (validated.type === 'snusking:trade-offer') {
      this.registerTradeOffer(playerId, validated);
    }

    // Sabotage and immunity actions are stored in pendingActions — delivered in startResolve()
    // No immediate side effects here.

    // Emit only commit status update — NOT the action content (REQ-MULTI-02, anti-pattern guard)
    this.emitPerPlayer();

    if (this.allPlayersActed()) {
      this.startReveal();
    }
  }

  getState(): unknown {
    // Returns master state — used only by registry/platform internals.
    // Per-player state: use projectState(playerId).
    return this.masterState;
  }

  destroy(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
  }

  // ── TurnBasedGameEngine interface ───────────────────────────────────────

  projectState(playerId: string): SnuskingProjectedState {
    const state = this.masterState;
    const self = state.players[playerId];

    const opponents: SnuskingOpponentState[] = Object.values(state.players)
      .filter(p => p.userId !== playerId)
      .map(p => ({
        userId: p.userId,
        username: p.username,
        handCount: p.hand.length,  // REQ-MULTI-01: count only, never hand contents
        empireScore: p.empireScore,
        hasCommitted: p.hasCommitted,
        isConnected: p.isConnected,
        beer: p.beer,
      }));

    // Only show trade offers targeting this player
    const pendingTradeOffers = state.pendingTradeOffers.filter(
      o => o.toPlayerId === playerId,
    );

    return {
      phase: state.phase,
      self: self ?? this.createEmptyPlayer(playerId),
      opponents,
      deckCount: state.deck.length,
      discardCount: state.discardPile.length,
      turnNumber: state.turnNumber,
      pendingTradeOffers,
      status: state.status,
      endReason: state.endReason,
      results: state.results,
      currentEvent: state.currentEvent,
    };
  }

  getCurrentPhase(): TurnPhase {
    return this.masterState.phase;
  }

  // ── Phase transitions ───────────────────────────────────────────────────

  private startDrawPhase(): void {
    this.masterState.phase = 'draw';
    this.pendingActions.clear();
    // Reset commit status for all players
    for (const p of Object.values(this.masterState.players)) {
      p.hasCommitted = false;
    }

    // Select event for this turn
    const eventIdx = randomInt(0, SNUSKING_EVENTS.length);
    this.masterState.currentEvent = SNUSKING_EVENTS[eventIdx];

    // Beer increment (+1/turn, cap 3)
    for (const player of Object.values(this.masterState.players)) {
      player.beer = Math.min(player.beer + 1, 3);
    }

    // Handle skipNextTurn (spent snus sabotage from previous turn)
    for (const [playerId, player] of Object.entries(this.masterState.players)) {
      if (player.skipNextTurn) {
        this.pendingActions.set(playerId, { type: 'snusking:pass' });
        player.hasCommitted = true;
        player.skipNextTurn = false;
      }
    }

    // Handle pendingDiscard (high-nic sabotage from previous turn)
    for (const player of Object.values(this.masterState.players)) {
      if (player.pendingDiscard && player.hand.length > 0) {
        const [discarded] = player.hand.splice(0, 1);
        this.masterState.discardPile.push(discarded);
        player.pendingDiscard = false;
        // highNicEffect stays true — emitted once in startPlanningPhase, then cleared
      }
    }

    // Draw cards for all players up to MAX_HAND_SIZE
    for (const playerId of Object.keys(this.masterState.players)) {
      this.masterState = drawCards(this.masterState, playerId);
    }
    // Immediately transition to planning
    this.startPlanningPhase();
  }

  private startPlanningPhase(): void {
    this.masterState.phase = 'planning';
    this.emitPerPlayer();
    // Clear transient highNicEffect after one emit cycle
    for (const player of Object.values(this.masterState.players)) {
      player.highNicEffect = false;
    }
    // Start 45-second timer — auto-pass any uncommitted players on expiry (REQ-CORE-05)
    this.turnTimer = setTimeout(() => {
      this.autoPassUncommitted();
      this.startReveal();
    }, TURN_TIMER_MS);
  }

  private startReveal(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
    this.masterState.phase = 'reveal';
    this.emitPerPlayer();
    // Brief reveal display, then resolve
    // In Phase 3, the client will animate this window. For now, transition immediately.
    setImmediate(() => this.startResolve());
  }

  private startResolve(): void {
    this.masterState.phase = 'resolve';

    // Step 1: Activate immunity (must happen before sabotage delivery)
    for (const [playerId, action] of this.pendingActions) {
      if (action.type === 'snusking:activate-immunity') {
        const player = this.masterState.players[playerId];
        if (player && player.beer >= 1) {
          player.immunityActive = true;
          player.beer -= 1;
        }
      }
    }

    // Step 2: Deliver sabotage (one-per-target, immunity blocks)
    const sabotagedThisTurn = new Set<string>();
    for (const [senderId, action] of this.pendingActions) {
      if (
        action.type !== 'snusking:sabotage-spentsnus' &&
        action.type !== 'snusking:sabotage-highnic'
      ) continue;

      const targetId = action.targetPlayerId;
      if (sabotagedThisTurn.has(targetId)) continue; // one-per-target limit
      const target = this.masterState.players[targetId];
      if (!target || target.immunityActive) continue; // blocked by immunity

      sabotagedThisTurn.add(targetId);

      // Transfer card from sender to target
      const sender = this.masterState.players[senderId];
      const cardIdx = sender?.hand.findIndex(c => c.instanceId === action.cardInstanceId) ?? -1;
      if (cardIdx !== -1 && sender) {
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

    // Step 3: Score spend actions (thread currentEvent through)
    for (const [playerId, action] of this.pendingActions) {
      if (action.type === 'snusking:spend') {
        this.masterState = spendCards(
          this.masterState, playerId, action.cardIds,
          this.masterState.currentEvent,
        );
      }
      if (action.type === 'snusking:spend-with-beer') {
        const player = this.masterState.players[playerId];
        if (player && player.beer >= 1) {
          player.beer -= 1;
          this.masterState = spendCards(
            this.masterState, playerId, action.cardIds,
            this.masterState.currentEvent,
            action.beerCardId,
          );
        } else {
          // Not enough beer — treat as plain spend (no bonus)
          this.masterState = spendCards(
            this.masterState, playerId, action.cardIds,
            this.masterState.currentEvent,
          );
        }
      }
      // pass: nothing to do
    }

    // Step 4: Resolve accepted trades with displayName masking
    this.resolveAcceptedTrades();

    // Step 5: Clear transient flags
    for (const player of Object.values(this.masterState.players)) {
      player.immunityActive = false;
    }

    // Step 6: Win condition check AFTER scoring (REQ-CORE-06, REQ-CORE-07)
    const endReason = checkWinCondition(this.masterState);
    if (endReason) {
      this.endGame(endReason);
      return;
    }

    this.masterState.turnNumber += 1;
    this.emitPerPlayer();

    // Advance to next draw phase
    setImmediate(() => this.startDrawPhase());
  }

  private endGame(endReason: GameEndReason): void {
    this.masterState.phase = 'ended';
    this.masterState.status = 'ended';
    this.masterState.endReason = endReason;

    const sorted = Object.values(this.masterState.players)
      .sort((a, b) => b.empireScore - a.empireScore);

    this.masterState.results = sorted.map((p, i) => ({
      userId: p.userId,
      username: p.username,
      score: p.empireScore,
      rank: i + 1,
    })) as GameResult[];

    // Emit end state per player — onStateUpdate handles leaderboard write (via room.ts)
    this.emitPerPlayer();
    this.destroy();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private allPlayersActed(): boolean {
    // Only count active/connected players and those who already committed
    // (disconnected players don't block the round)
    const activePlayerIds = Object.values(this.masterState.players)
      .filter(p => p.isConnected || this.pendingActions.has(p.userId))
      .map(p => p.userId);
    return activePlayerIds.every(id => this.pendingActions.has(id));
  }

  private autoPassUncommitted(): void {
    for (const playerId of Object.keys(this.masterState.players)) {
      if (!this.pendingActions.has(playerId)) {
        this.pendingActions.set(playerId, { type: 'snusking:pass' });
        this.masterState.players[playerId].hasCommitted = true;
      }
    }
  }

  private emitPerPlayer(): void {
    // Per-player projection — NEVER room-broadcast (REQ-NFR-01, REQ-MULTI-01)
    // The { forUserId, state } wrapper is read by room.ts onUpdate callback
    for (const playerId of Object.keys(this.masterState.players)) {
      this.onStateUpdate({
        forUserId: playerId,
        state: this.projectState(playerId),
      });
    }
  }

  private registerTradeOffer(
    fromPlayerId: string,
    action: { type: 'snusking:trade-offer'; targetPlayerId: string; cardInstanceId: string; displayName?: string },
  ): void {
    const realName = this.masterState.players[fromPlayerId]?.hand.find(
      c => c.instanceId === action.cardInstanceId,
    )?.name ?? 'Unknown';
    this.masterState.pendingTradeOffers.push({
      offerId: uuidv4(),
      fromPlayerId,
      toPlayerId: action.targetPlayerId,
      cardInstanceId: action.cardInstanceId,
      displayName: action.displayName ?? realName, // fake name or real name
      expiresAtTurn: this.masterState.turnNumber,
    });
  }

  private resolveAcceptedTrades(): void {
    // Phase 2: trades — find accepted offers and transfer cards with displayName masking
    const acceptedOfferIds = new Set<string>();
    for (const [, action] of this.pendingActions) {
      if (action.type === 'snusking:trade-accept') {
        acceptedOfferIds.add(action.offerId);
      }
    }
    for (const offer of this.masterState.pendingTradeOffers) {
      if (!acceptedOfferIds.has(offer.offerId)) continue;
      const fromPlayer = this.masterState.players[offer.fromPlayerId];
      const toPlayer = this.masterState.players[offer.toPlayerId];
      if (!fromPlayer || !toPlayer) continue;
      const cardIdx = fromPlayer.hand.findIndex(c => c.instanceId === offer.cardInstanceId);
      if (cardIdx === -1) continue;
      const [card] = fromPlayer.hand.splice(cardIdx, 1);
      // Mask real name with the displayName from the trade offer
      card.name = offer.displayName;
      toPlayer.hand.push(card);
    }
    // Clear resolved offers
    this.masterState.pendingTradeOffers = [];
  }

  private createEmptyPlayer(playerId: string): SnuskingPlayerState {
    return {
      userId: playerId,
      username: 'Unknown',
      hand: [],
      empireScore: 0,
      hasCommitted: false,
      isConnected: false,
      beer: 0,
      skipNextTurn: false,
      pendingDiscard: false,
      highNicEffect: false,
      immunityActive: false,
    };
  }
}
