import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
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
import { buildDeck, shuffle } from './deck';
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
  }),
  z.object({ type: z.literal('snusking:trade-accept'), offerId: z.string() }),
  z.object({ type: z.literal('snusking:trade-decline'), offerId: z.string() }),
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

    // Apply all pending actions — spend cards, credit scores (score BEFORE win check)
    for (const [playerId, action] of this.pendingActions) {
      if (action.type === 'snusking:spend') {
        this.masterState = spendCards(this.masterState, playerId, action.cardIds);
      }
      // pass: nothing to do
      // trade actions: resolved via pending trade offers (Phase 1 basic trades)
    }

    // Resolve accepted trades
    this.resolveAcceptedTrades();

    // Win condition check AFTER scoring (REQ-CORE-06, REQ-CORE-07)
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
    action: { type: 'snusking:trade-offer'; targetPlayerId: string; cardInstanceId: string },
  ): void {
    this.masterState.pendingTradeOffers.push({
      offerId: uuidv4(),
      fromPlayerId,
      toPlayerId: action.targetPlayerId,
      cardInstanceId: action.cardInstanceId,
      displayName: this.masterState.players[fromPlayerId]?.hand.find(
        c => c.instanceId === action.cardInstanceId,
      )?.name ?? 'Unknown',
      expiresAtTurn: this.masterState.turnNumber,
    });
  }

  private resolveAcceptedTrades(): void {
    // Phase 1: basic trade — find accepted offers and transfer cards
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
    };
  }
}
