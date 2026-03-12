import { describe, it, expect } from 'vitest';
import { shuffle, buildDeck } from './deck';

describe('shuffle (REQ-NFR-03)', () => {
  it('returns an array of the same length', () => {
    const deck = buildDeck();
    expect(shuffle(deck)).toHaveLength(deck.length);
  });

  it('contains the same cards after shuffle (no cards lost or duplicated)', () => {
    const deck = buildDeck();
    const shuffled = shuffle(deck);
    const originalIds = deck.map(c => c.instanceId).sort();
    const shuffledIds = shuffled.map(c => c.instanceId).sort();
    expect(shuffledIds).toEqual(originalIds);
  });

  it('produces different orderings across multiple shuffles (statistical: fails < 1 in 1000 runs)', () => {
    const deck = buildDeck();
    const shuffleA = shuffle(deck).map(c => c.instanceId).join(',');
    const shuffleB = shuffle(deck).map(c => c.instanceId).join(',');
    // With 24+ cards two independent shuffles being identical is astronomically unlikely
    expect(shuffleA).not.toEqual(shuffleB);
  });
});
