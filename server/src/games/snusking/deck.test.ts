import { describe, it, expect } from 'vitest';
import { shuffle, buildDeck, SNUSKING_CARDS, SNUSKING_EVENTS } from './deck';

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
    // With 36+ cards two independent shuffles being identical is astronomically unlikely
    expect(shuffleA).not.toEqual(shuffleB);
  });
});

describe('SNUSKING_CARDS catalog (CARD-SYS)', () => {
  it('has exactly 12 card definitions', () => {
    expect(SNUSKING_CARDS).toHaveLength(12);
  });

  it('every card has a strength value', () => {
    for (const card of SNUSKING_CARDS) {
      expect(card.strength).toBeDefined();
    }
  });

  it('every card has a flavor value', () => {
    for (const card of SNUSKING_CARDS) {
      expect(card.flavor).toBeDefined();
    }
  });

  it('Göteborgs Rapé has canProvideImmunity: true', () => {
    const goteborg = SNUSKING_CARDS.find(c => c.id === 'goteborg');
    expect(goteborg?.canProvideImmunity).toBe(true);
  });

  it('buildDeck produces 36 instances (12 cards × 3 copies)', () => {
    expect(buildDeck()).toHaveLength(36);
  });

  it('every deck instance has strength and flavor stamped', () => {
    for (const instance of buildDeck()) {
      expect(instance.strength).toBeDefined();
      expect(instance.flavor).toBeDefined();
    }
  });
});

describe('SNUSKING_EVENTS pool (EVENT-SYS)', () => {
  it('has exactly 3 event definitions', () => {
    expect(SNUSKING_EVENTS).toHaveLength(3);
  });

  it('every event has at least one strength affinity value', () => {
    for (const event of SNUSKING_EVENTS) {
      expect(event.strengthAffinity.length).toBeGreaterThan(0);
    }
  });

  it('every event has at least one flavor affinity value', () => {
    for (const event of SNUSKING_EVENTS) {
      expect(event.flavorAffinity.length).toBeGreaterThan(0);
    }
  });
});
