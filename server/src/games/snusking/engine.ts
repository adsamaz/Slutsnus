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
import { drawOneCard, spendCards, checkWinCondition, MAX_HAND_SIZE, STARTING_HAND_SIZE } from './rules';

// ─── Constants ───────────────────────────────────────────────────────────────
const TURN_TIMER_MS = 45_000; // locked per CONTEXT.md

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
    type: z.literal('snusking:trade-offer-decoy'),
    targetPlayerId: z.string(),
    decoyCardInstanceId: z.string(),
  }),
  z.object({ type: z.literal('snusking:activate-immunity') }),
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
]);

// ─── Engine ──────────────────────────────────────────────────────────────────

export class SnuskingEngine implements TurnBasedGameEngine {
  private masterState!: SnuskingMasterState;
  private turnTimer?: ReturnType<typeof setTimeout>;
  private onStateUpdate: (state: unknown) => void = () => {};

  // ── GameEngine interface ────────────────────────────────────────────────

  init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
    this.onStateUpdate = onStateUpdate;
    const playerMap: Record<string, SnuskingPlayerState> = {};
    const turnOrder = players.map(p => p.userId);
    for (const p of players) {
      playerMap[p.userId] = {
        userId: p.userId,
        username: p.username,
        hand: [],
        spentSnus: 0,
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
      phase: 'playing',
      players: playerMap,
      deck: shuffle(buildDeck()),
      discardPile: [],
      currentEvent: null,
      turnNumber: 1,
      pendingTradeOffers: [],
      status: 'active',
      endReason: null,
      results: null,
      activePlayerId: null,
      turnOrder,
    };
    // Deal starting hand (STARTING_HAND_SIZE cards each, round-robin)
    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
      for (const playerId of turnOrder) {
        this.masterState = drawOneCard(this.masterState, playerId);
      }
    }
    this.startNextTurn();
  }

  handleEvent(playerId: string, action: GameAction): void {
    if (this.masterState.phase !== 'playing') return;
    // Only the active player may act
    if (this.masterState.activePlayerId !== playerId) return;
    if (this.masterState.players[playerId]?.hasCommitted) return; // already committed — idempotent

    // Validate with Zod — silently reject invalid payloads (REQ-NFR-02)
    const parsed = SnuskingActionSchema.safeParse(action);
    if (!parsed.success) return;

    const validated = parsed.data;

    // Resolve the action immediately
    this.resolveAction(playerId, validated);

    this.masterState.players[playerId].hasCommitted = true;

    // Win condition check after each action
    const endReason = checkWinCondition(this.masterState);
    if (endReason) {
      this.endGame(endReason);
      return;
    }

    this.advanceTurn();
  }

  getState(): unknown {
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
      discardTop: state.discardPile[state.discardPile.length - 1] ?? null,
      turnNumber: state.turnNumber,
      pendingTradeOffers,
      status: state.status,
      endReason: state.endReason,
      results: state.results,
      currentEvent: state.currentEvent,
      activePlayerId: state.activePlayerId,
    };
  }

  getCurrentPhase(): TurnPhase {
    return this.masterState.phase;
  }

  // ── Turn management ─────────────────────────────────────────────────────

  /** Begin a new round: pick event, increment beer, handle pending effects, seat first player. */
  private startNextTurn(): void {
    console.log(`[snusking] startNextTurn turnNumber=${this.masterState.turnNumber} order=${JSON.stringify(this.masterState.turnOrder)}`);
    // Select event for this turn
    const eventIdx = randomInt(0, SNUSKING_EVENTS.length);
    this.masterState.currentEvent = SNUSKING_EVENTS[eventIdx];

    // Beer increment (+1/turn, cap 3) — skip on the very first turn
    if (this.masterState.turnNumber > 1) {
      for (const player of Object.values(this.masterState.players)) {
        player.beer = Math.min(player.beer + 1, 3);
      }
    }

    // pendingDiscard: discard one card from hand (highNic sabotage effect from previous turn)
    for (const player of Object.values(this.masterState.players)) {
      if (player.pendingDiscard && player.hand.length > 0) {
        const [discarded] = player.hand.splice(0, 1);
        this.masterState.discardPile.push(discarded);
        player.pendingDiscard = false;
      }
    }

    // Clear highNicEffect and hasCommitted
    for (const player of Object.values(this.masterState.players)) {
      player.highNicEffect = false;
      player.hasCommitted = false;
    }

    // skipNextTurn: auto-commit skipped players
    for (const playerId of this.masterState.turnOrder) {
      const player = this.masterState.players[playerId];
      if (player?.skipNextTurn) {
        player.hasCommitted = true;
        player.skipNextTurn = false;
      }
    }

    this.masterState.activePlayerId = null;
    this.advanceTurn();
  }

  private advanceTurn(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = undefined;
    }
    // Find the next player in order who hasn't acted yet
    const committed = Object.entries(this.masterState.players).map(([id, p]) => `${id}:${p.hasCommitted}`);
    const nextPlayer = this.masterState.turnOrder.find(id => !this.masterState.players[id]?.hasCommitted);
    console.log(`[snusking] advanceTurn order=${JSON.stringify(this.masterState.turnOrder)} committed=[${committed}] next=${nextPlayer ?? 'END_OF_ROUND'}`);
    if (nextPlayer) {
      // Draw one card for the incoming active player (at start of their turn)
      if (this.masterState.players[nextPlayer] &&
          this.masterState.players[nextPlayer].hand.length < MAX_HAND_SIZE) {
        this.masterState = drawOneCard(this.masterState, nextPlayer);
      }
      this.masterState.activePlayerId = nextPlayer;
      this.emitPerPlayer();
      this.startPlayerTimer();
    } else {
      // All players have acted — end of round
      this.masterState.activePlayerId = null;
      this.masterState.turnNumber += 1;

      // Rotate turn order for next round (first player moves to end)
      const order = [...this.masterState.turnOrder];
      const first = order.shift()!;
      order.push(first);
      this.masterState.turnOrder = order;

      this.emitPerPlayer();

      // Advance to next turn
      setImmediate(() => this.startNextTurn());
    }
  }

  // ── Action resolution ───────────────────────────────────────────────────

  private resolveAction(playerId: string, action: SnuskingAction): void {
    switch (action.type) {
      case 'snusking:activate-immunity': {
        const player = this.masterState.players[playerId];
        if (player && player.beer >= 1) {
          player.immunityActive = true;
          player.beer -= 1;
        }
        break;
      }

      case 'snusking:spend': {
        this.masterState = spendCards(
          this.masterState, playerId, action.cardIds,
          this.masterState.currentEvent,
        );
        break;
      }

      case 'snusking:spend-with-beer': {
        const player = this.masterState.players[playerId];
        if (player && player.beer >= 1) {
          player.beer -= 1;
          this.masterState = spendCards(
            this.masterState, playerId, action.cardIds,
            this.masterState.currentEvent,
            action.beerCardId,
          );
        } else {
          this.masterState = spendCards(
            this.masterState, playerId, action.cardIds,
            this.masterState.currentEvent,
          );
        }
        break;
      }

      case 'snusking:trade-offer': {
        this.registerTradeOffer(playerId, action);
        break;
      }

      case 'snusking:trade-offer-decoy': {
        this.registerDecoyTradeOffer(playerId, action);
        break;
      }

      case 'snusking:trade-accept': {
        this.resolveTradeAccept(playerId, action.offerId);
        break;
      }

      case 'snusking:trade-decline': {
        this.masterState.pendingTradeOffers = this.masterState.pendingTradeOffers.filter(
          o => o.offerId !== action.offerId,
        );
        break;
      }

      case 'snusking:sabotage-spentsnus':
      case 'snusking:sabotage-highnic': {
        const targetId = action.targetPlayerId;
        const target = this.masterState.players[targetId];
        if (!target) break;
        if (target.immunityActive) break; // blocked by immunity

        const attacker = this.masterState.players[playerId];
        if (!attacker) break;
        const cardIdx = attacker.hand.findIndex(c => c.instanceId === action.cardInstanceId);
        if (cardIdx === -1) break;
        const [card] = attacker.hand.splice(cardIdx, 1);
        target.hand.push(card);

        if (action.type === 'snusking:sabotage-spentsnus') {
          target.skipNextTurn = true;
        } else {
          target.pendingDiscard = true;
          target.highNicEffect = true;
        }
        break;
      }

      case 'snusking:pass':
        // nothing to do
        break;
    }

    // Clear immunity after their turn resolves
    const player = this.masterState.players[playerId];
    if (player) player.immunityActive = false;
  }

  // ── End game ────────────────────────────────────────────────────────────

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

    this.emitPerPlayer();
    this.destroy();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private startPlayerTimer(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => {
      // Auto-pass the current player on timeout
      const activeId = this.masterState.activePlayerId;
      if (activeId && !this.masterState.players[activeId]?.hasCommitted) {
        this.masterState.players[activeId].hasCommitted = true;
        this.emitPerPlayer();
        this.advanceTurn();
      }
    }, TURN_TIMER_MS);
  }

  private emitPerPlayer(): void {
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
      displayName: action.displayName ?? realName,
      expiresAtTurn: this.masterState.turnNumber,
    });
  }

  private registerDecoyTradeOffer(
    fromPlayerId: string,
    action: { type: 'snusking:trade-offer-decoy'; targetPlayerId: string; decoyCardInstanceId: string },
  ): void {
    const player = this.masterState.players[fromPlayerId];
    if (!player) return;
    const realCard = player.hand.find(c => c.instanceId === action.decoyCardInstanceId);
    if (!realCard || player.spentSnus === 0) return;
    this.masterState.pendingTradeOffers.push({
      offerId: uuidv4(),
      fromPlayerId,
      toPlayerId: action.targetPlayerId,
      cardInstanceId: action.decoyCardInstanceId,
      displayName: realCard.name,
      expiresAtTurn: this.masterState.turnNumber,
    });
  }

  private resolveTradeAccept(playerId: string, offerId: string): void {
    const offerIdx = this.masterState.pendingTradeOffers.findIndex(o => o.offerId === offerId && o.toPlayerId === playerId);
    if (offerIdx === -1) return;
    const offer = this.masterState.pendingTradeOffers[offerIdx];
    this.masterState.pendingTradeOffers.splice(offerIdx, 1);

    const fromPlayer = this.masterState.players[offer.fromPlayerId];
    const toPlayer = this.masterState.players[offer.toPlayerId];
    if (!fromPlayer || !toPlayer) return;
    const cardIdx = fromPlayer.hand.findIndex(c => c.instanceId === offer.cardInstanceId);
    if (cardIdx === -1) return;
    const [card] = fromPlayer.hand.splice(cardIdx, 1);
    card.name = offer.displayName;
    card.traded = true;
    toPlayer.hand.push(card);
  }

  private createEmptyPlayer(playerId: string): SnuskingPlayerState {
    return {
      userId: playerId,
      username: 'Unknown',
      hand: [],
      spentSnus: 0,
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
