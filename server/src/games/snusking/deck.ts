import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { SnuskingCardDefinition, SnuskingCardInstance } from '@slutsnus/shared';

// ─── Card Catalog ─────────────────────────────────────────────────────────────
// Phase 1: real brand names with simple empire point values.
// Phase 2 will add situation/event bonus fields.

export const SNUSKING_CARDS: SnuskingCardDefinition[] = [
  { id: 'general',          name: 'General',              empirePoints: 20 },
  { id: 'siberia',          name: 'Siberia -80',           empirePoints: 30 },
  { id: 'ettan',            name: 'Ettan',                 empirePoints: 15 },
  { id: 'goteborg',         name: 'Göteborgs Rapé',        empirePoints: 18 },
  { id: 'grov',             name: 'Grov',                  empirePoints: 14 },
  { id: 'catch-licorice',   name: 'Catch Licorice',        empirePoints: 22 },
  { id: 'odens-extreme',    name: "Oden's Extreme",        empirePoints: 28 },
  { id: 'thunder-strong',   name: 'Thunder Extra Strong',  empirePoints: 25 },
];

// Copies of each card per deck — 3 copies × 8 cards = 24-card deck
const COPIES_PER_CARD = 3;

// ─── Deck Builder ─────────────────────────────────────────────────────────────

export function buildDeck(): SnuskingCardInstance[] {
  const instances: SnuskingCardInstance[] = [];
  for (const def of SNUSKING_CARDS) {
    for (let i = 0; i < COPIES_PER_CARD; i++) {
      instances.push({
        instanceId: uuidv4(),
        definitionId: def.id,
        name: def.name,
        empirePoints: def.empirePoints,
      });
    }
  }
  return instances;
}

// ─── Fisher-Yates Shuffle ─────────────────────────────────────────────────────
// Uses crypto.randomInt for unbiased results (REQ-NFR-03).
// Replaces the biased Math.random()-sort pattern documented in CONCERNS.md.

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array]; // never mutate input
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1); // crypto.randomInt — cryptographically uniform
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
