import type { SnuskingCardInstance, SnuskingMasterState, SnuskingEventCard, GameEndReason } from '@slutsnus/shared';
import { shuffle } from './deck';

// Locked constant per CONTEXT.md decisions
export const MAX_HAND_SIZE = 5;
export const STARTING_HAND_SIZE = 3;
export const SCORE_THRESHOLD = 200;

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Returns tiered event multiplier for a card against the active event.
 * Both strength + flavor match → 2.0x; one match → 1.5x; neither → 1.0x.
 */
function computeEventMultiplier(
  card: SnuskingCardInstance,
  event: SnuskingEventCard,
): number {
  const strengthMatch = card.strength != null && event.strengthAffinity.includes(card.strength);
  const flavorMatch = card.flavor != null && event.flavorAffinity.includes(card.flavor);
  if (strengthMatch && flavorMatch) return 2.0;
  if (strengthMatch || flavorMatch) return 1.5;
  return 1.0;
}

/**
 * Returns the total empire points for a set of played cards.
 * Optional event multiplier (applied after optional beer bonus):
 *   - beer +50% is applied FIRST to the designated beerCardId (only for high/extreme strength)
 *   - then event multiplier (2x/1.5x/1x) is applied per card
 * Math.round() at each multiplication step avoids fractional empire points.
 */
export function scoreCards(
  cards: SnuskingCardInstance[],
  activeEvent?: SnuskingEventCard | null,
  beerCardId?: string,
): number {
  return cards.reduce((sum, card) => {
    let points = card.empirePoints;
    // Beer bonus: +50% applied first, only for high/extreme strength cards
    if (
      beerCardId &&
      card.instanceId === beerCardId &&
      (card.strength === 'high' || card.strength === 'extreme')
    ) {
      points = Math.round(points * 1.5);
    }
    // Event multiplier applied after beer
    const multiplier = activeEvent ? computeEventMultiplier(card, activeEvent) : 1.0;
    return sum + Math.round(points * multiplier);
  }, 0);
}

// ─── Win Condition ───────────────────────────────────────────────────────────
// Called AFTER scoring in the resolve phase (REQ-CORE-06, REQ-CORE-07).
// Score threshold takes priority — checked first.

export function checkWinCondition(state: SnuskingMasterState): GameEndReason | null {
  // REQ-CORE-06: score threshold win
  const hasWinner = Object.values(state.players).some(p => p.empireScore >= SCORE_THRESHOLD);
  if (hasWinner) return 'score_threshold';

  // REQ-CORE-07: slut snus — deck AND discard both empty (nothing to reshuffle)
  if (state.deck.length === 0 && state.discardPile.length === 0) return 'slut_snus';

  return null;
}

// ─── Draw Logic ──────────────────────────────────────────────────────────────
// Draws cards for one player up to MAX_HAND_SIZE. Returns new state (pure).
// If draw pile empties mid-draw, reshuffles discard into deck and continues.
// If both deck and discard are empty, stops (slut snus condition — engine detects separately).

/**
 * Draws exactly one card for a player. If the deck is empty, reshuffles discard first.
 * If both are empty, returns state unchanged (slut snus condition).
 */
export function drawOneCard(state: SnuskingMasterState, playerId: string): SnuskingMasterState {
  const player = state.players[playerId];
  if (!player) return state;

  let deck = [...state.deck];
  let discardPile = [...state.discardPile];

  if (deck.length === 0) {
    if (discardPile.length === 0) return state; // slut snus
    deck = shuffle(discardPile);
    discardPile = [];
  }

  const hand = [...player.hand, deck.pop()!];

  return {
    ...state,
    deck,
    discardPile,
    players: { ...state.players, [playerId]: { ...player, hand } },
  };
}

export function drawCards(state: SnuskingMasterState, playerId: string): SnuskingMasterState {
  const player = state.players[playerId];
  if (!player) return state;

  let deck = [...state.deck];
  let discardPile = [...state.discardPile];
  const hand = [...player.hand];

  while (hand.length < MAX_HAND_SIZE) {
    if (deck.length === 0) {
      if (discardPile.length === 0) break; // slut snus — stop drawing
      // Reshuffle discard into deck
      deck = shuffle(discardPile);
      discardPile = [];
    }
    hand.push(deck.pop()!);
  }

  return {
    ...state,
    deck,
    discardPile,
    players: {
      ...state.players,
      [playerId]: { ...player, hand },
    },
  };
}

// ─── Spend Cards ─────────────────────────────────────────────────────────────
// Removes spent card instances from hand, adds to discard, credits empire score.

export function spendCards(
  state: SnuskingMasterState,
  playerId: string,
  cardIds: string[],
  activeEvent?: SnuskingEventCard | null,
  beerCardId?: string,
): SnuskingMasterState {
  const player = state.players[playerId];
  if (!player) return state;

  const spentCards = player.hand.filter(c => cardIds.includes(c.instanceId));
  const remainingHand = player.hand.filter(c => !cardIds.includes(c.instanceId));
  const points = scoreCards(spentCards, activeEvent, beerCardId);

  return {
    ...state,
    discardPile: [...state.discardPile, ...spentCards],
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: remainingHand,
        spentSnus: (player.spentSnus ?? 0) + spentCards.length,
        empireScore: player.empireScore + points,
      },
    },
  };
}
