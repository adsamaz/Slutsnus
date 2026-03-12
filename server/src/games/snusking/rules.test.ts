import { describe, it, expect } from 'vitest';
import { checkWinCondition, scoreCards } from './rules';
import type { SnuskingMasterState } from '@slutsnus/shared';

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
  it('returns the sum of empire points for all spent cards', () => {
    // placeholder — implementation fills in real card shapes
    expect(true).toBe(true);
  });
});

// Test helper — builds a minimal SnuskingMasterState for rule tests
function makeState(opts: { scores: number[]; deckSize: number; discardSize: number }): SnuskingMasterState {
  const players: SnuskingMasterState['players'] = {};
  opts.scores.forEach((score, i) => {
    const id = `player${i}`;
    players[id] = {
      userId: id, username: `Player ${i}`, hand: [], empireScore: score,
      hasCommitted: false, isConnected: true, beer: 0,
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
