import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { SnuskingCardDefinition, SnuskingCardInstance, SnuskingEventCard } from '@slutsnus/shared';

// ─── Card Catalog ─────────────────────────────────────────────────────────────
// 12 real brand cards, each with strength and flavor for event affinity scoring.
// Phase 1 had 8 entries; Phase 2 adds 4 new cards and strength/flavor fields.

export const SNUSKING_CARDS: SnuskingCardDefinition[] = [
  { id: 'general',        name: 'General',              empirePoints: 20, strength: 'medium',  flavor: 'tobacco'  },
  { id: 'siberia',        name: 'Siberia -80',           empirePoints: 30, strength: 'extreme', flavor: 'tobacco'  },
  { id: 'ettan',          name: 'Ettan',                 empirePoints: 15, strength: 'low',     flavor: 'tobacco'  },
  { id: 'goteborg',       name: 'Göteborgs Rapé',        empirePoints: 18, strength: 'low',     flavor: 'licorice', canProvideImmunity: true },
  { id: 'grov',           name: 'Grov',                  empirePoints: 14, strength: 'medium',  flavor: 'tobacco'  },
  { id: 'catch-licorice', name: 'Catch Licorice',        empirePoints: 22, strength: 'medium',  flavor: 'licorice' },
  { id: 'odens-extreme',  name: "Oden's Extreme",        empirePoints: 28, strength: 'extreme', flavor: 'licorice' },
  { id: 'thunder-strong', name: 'Thunder Extra Strong',  empirePoints: 25, strength: 'high',    flavor: 'mint'     },
  { id: 'knox-blue',      name: 'Knox Blue',             empirePoints: 17, strength: 'medium',  flavor: 'tobacco'  },
  { id: 'lundgrens',      name: 'Lundgrens',             empirePoints: 16, strength: 'low',     flavor: 'citrus'   },
  { id: 'velo',           name: 'Velo',                  empirePoints: 12, strength: 'low',     flavor: 'mint'     },
  { id: 'zyn',            name: 'Zyn',                   empirePoints: 19, strength: 'medium',  flavor: 'citrus'   },
];

// ─── Event Pool ───────────────────────────────────────────────────────────────
// 3 situational events drawn each turn; engine picks one via startDrawPhase().
// Affinity arrays define which card strength/flavor combos score bonus points.

export const SNUSKING_EVENTS: SnuskingEventCard[] = [
  {
    id: 'sauna-night',
    name: 'Sauna Night',
    strengthAffinity: ['high', 'extreme'],
    flavorAffinity: ['tobacco', 'licorice'],
  },
  {
    id: 'fishing-trip',
    name: 'Fishing Trip',
    strengthAffinity: ['low', 'medium'],
    flavorAffinity: ['tobacco', 'licorice'],
  },
  {
    id: 'party',
    name: 'Party',
    strengthAffinity: ['medium', 'high'],
    flavorAffinity: ['mint', 'sweet', 'citrus'],
  },
];

// Copies of each card per deck — 3 copies × 12 cards = 36-card deck
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
        strength: def.strength,
        flavor: def.flavor,
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
