import type { SnuskingCardInstance, SnuskingMasterState, GameEndReason } from '@slutsnus/shared';
import { shuffle } from './deck';

// Locked constant per CONTEXT.md decisions
export const MAX_HAND_SIZE = 5;
export const SCORE_THRESHOLD = 200;

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Returns the total empire points for a set of played cards. */
export function scoreCards(cards: SnuskingCardInstance[]): number {
  return cards.reduce((sum, card) => sum + card.empirePoints, 0);
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
): SnuskingMasterState {
  const player = state.players[playerId];
  if (!player) return state;

  const spentCards = player.hand.filter(c => cardIds.includes(c.instanceId));
  const remainingHand = player.hand.filter(c => !cardIds.includes(c.instanceId));
  const points = scoreCards(spentCards);

  return {
    ...state,
    discardPile: [...state.discardPile, ...spentCards],
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: remainingHand,
        empireScore: player.empireScore + points,
      },
    },
  };
}
