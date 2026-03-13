import { describe, it, expect } from 'vitest';
import { checkWinCondition, scoreCards } from './rules';
import type {
  SnuskingMasterState,
  SnuskingCardInstance,
  SnuskingCardStrength,
  SnuskingCardFlavor,
  SnuskingEventCard,
} from '@slutsnus/shared';

// ─── Event card fixtures ──────────────────────────────────────────────────────
const SAUNA_NIGHT: SnuskingEventCard = {
  id: 'sauna-night',
  name: 'Sauna Night',
  strengthAffinity: ['high', 'extreme'],
  flavorAffinity: ['tobacco', 'licorice'],
};

const PARTY: SnuskingEventCard = {
  id: 'party',
  name: 'Party',
  strengthAffinity: ['medium', 'high'],
  flavorAffinity: ['mint', 'sweet', 'citrus'],
};

describe('checkWinCondition (REQ-CORE-06, REQ-CORE-07)', () => {
  it('returns null when no win condition is met', () => {
    expect(checkWinCondition(makeState({ scores: [100, 150], deckSize: 10, discardSize: 5 }))).toBeNull();
  });

  it('returns score_threshold when any player reaches 200 (REQ-CORE-06)', () => {
    expect(checkWinCondition(makeState({ scores: [200, 50], deckSize: 10, discardSize: 5 }))).toBe('score_threshold');
  });

  it('returns score_threshold when player exceeds 200 (REQ-CORE-06)', () => {
    expect(checkWinCondition(makeState({ scores: [250, 50], deckSize: 10, discardSize: 5 }))).toBe('score_threshold');
  });

  it('returns slut_snus when deck and discard are both empty (REQ-CORE-07)', () => {
    expect(checkWinCondition(makeState({ scores: [100, 150], deckSize: 0, discardSize: 0 }))).toBe('slut_snus');
  });

  it('does NOT return slut_snus when deck is empty but discard is non-empty', () => {
    // discard can still be reshuffled — not slut snus yet
    expect(checkWinCondition(makeState({ scores: [100, 150], deckSize: 0, discardSize: 5 }))).toBeNull();
  });
});

describe('scoreCards (REQ-CORE-06)', () => {
  it('returns the sum of empire points for all spent cards (baseline)', () => {
    // Baseline: two cards, no event, no beer
    const cards = [
      makeCardInstance('general', 20),
      makeCardInstance('ettan', 15),
    ];
    expect(scoreCards(cards)).toBe(35);
  });
});

describe('scoreCards with event multipliers (EVENT-SYS-3)', () => {
  it('returns 2x points when card matches both event strength and flavor (both match → 2x)', () => {
    // extreme + tobacco vs Sauna Night (strengthAffinity: high/extreme, flavorAffinity: tobacco/licorice)
    // both match → 2.0x: Math.round(30 * 2.0) = 60
    const card = makeCardInstance('siberia', 30, { strength: 'extreme', flavor: 'tobacco' });
    expect(scoreCards([card], SAUNA_NIGHT)).toBe(60);
  });

  it('returns 1.5x points when card matches one event property (one match → 1.5x)', () => {
    // high + mint vs Sauna Night: strength 'high' is in affinity (match), 'mint' is NOT in tobacco/licorice (no match)
    // one match → 1.5x: Math.round(25 * 1.5) = Math.round(37.5) = 38
    const card = makeCardInstance('thunder', 25, { strength: 'high', flavor: 'mint' });
    expect(scoreCards([card], SAUNA_NIGHT)).toBe(38);
  });

  it('returns 1x points when card matches neither event property (no match → 1x)', () => {
    // low + mint vs Sauna Night: 'low' NOT in high/extreme, 'mint' NOT in tobacco/licorice
    // no match → 1.0x: Math.round(12 * 1.0) = 12
    const card = makeCardInstance('velo', 12, { strength: 'low', flavor: 'mint' });
    expect(scoreCards([card], SAUNA_NIGHT)).toBe(12);
  });

  it('beer +50% on high-strength card is applied before event 2x multiplier (combined → 3x base)', () => {
    // high + mint vs Party (strengthAffinity: medium/high, flavorAffinity: mint/sweet/citrus)
    // both strength 'high' and flavor 'mint' match → 2.0x event multiplier
    // beer bonus FIRST: Math.round(25 * 1.5) = Math.round(37.5) = 38
    // then event 2x: Math.round(38 * 2.0) = 76
    const card = makeCardInstance('thunder', 25, { strength: 'high', flavor: 'mint', instanceId: 'inst-thunder' });
    expect(scoreCards([card], PARTY, 'inst-thunder')).toBe(76);
  });

  it('isSpentSnus card scores 0 empire points for owner', () => {
    // empirePoints=0 — no bonus logic can change a zero base
    const card = makeCardInstance('spent-snus', 0, { strength: 'low', flavor: 'tobacco' });
    expect(scoreCards([card], SAUNA_NIGHT)).toBe(0);
  });
});

// Test helper — builds a minimal SnuskingCardInstance for scoring tests
function makeCardInstance(
  definitionId: string,
  empirePoints: number,
  opts?: { strength?: SnuskingCardStrength; flavor?: SnuskingCardFlavor; instanceId?: string },
): SnuskingCardInstance {
  return {
    instanceId: opts?.instanceId ?? `inst-${definitionId}`,
    definitionId,
    name: definitionId,
    empirePoints,
    strength: opts?.strength,
    flavor: opts?.flavor,
  };
}

// Test helper — builds a minimal SnuskingMasterState for rule tests
function makeState(opts: { scores: number[]; deckSize: number; discardSize: number }): SnuskingMasterState {
  const players: SnuskingMasterState['players'] = {};
  opts.scores.forEach((score, i) => {
    const id = `player${i}`;
    players[id] = {
      userId: id, username: `Player ${i}`, hand: [], empireScore: score,
      hasCommitted: false, isConnected: true, beer: 0,
      skipNextTurn: false, pendingDiscard: false, highNicEffect: false, immunityActive: false,
    };
  });
  return {
    roomId: 'test-room',
    phase: 'resolve',
    players,
    deck: Array(opts.deckSize).fill(null),
    discardPile: Array(opts.discardSize).fill(null),
    currentEvent: null,
    turnNumber: 1,
    pendingTradeOffers: [],
    status: 'active',
    endReason: null,
    results: null,
  } as unknown as SnuskingMasterState;
}
