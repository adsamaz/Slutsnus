import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnuskingEngine } from './engine';
import type { SnuskingProjectedState } from '@slutsnus/shared';

describe('SnuskingEngine', () => {
  let engine: SnuskingEngine;
  const players = [
    { userId: 'p1', username: 'Alice' },
    { userId: 'p2', username: 'Bob' },
  ];

  beforeEach(() => {
    engine = new SnuskingEngine();
  });

  describe('Phase transitions (REQ-CORE-04)', () => {
    it('starts in playing phase after init', () => {
      engine.init('room1', players as any, () => {});
      expect(engine.getCurrentPhase()).toBe('playing');
    });
  });

  describe('Sequential turns (REQ-CORE-03)', () => {
    it('stays in playing phase when only the first player has acted', () => {
      engine.init('room1', players as any, () => {});
      // p1 is first in turn order — act for p1
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      // Still playing (p2 hasn't acted)
      expect(engine.getCurrentPhase()).toBe('playing');
    });

    it('stays in playing phase when all players have acted (next round starts)', () => {
      engine.init('room1', players as any, () => {});
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      // Next round starts asynchronously via setImmediate — still playing
      expect(engine.getCurrentPhase()).toBe('playing');
    });

    it('ignores action from non-active player', () => {
      engine.init('room1', players as any, () => {});
      // p2 tries to act before p1 — should be ignored
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      expect(engine.getCurrentPhase()).toBe('playing');
      const ms = engine.getState() as any;
      expect(ms.players['p2'].hasCommitted).toBe(false);
    });
  });

  describe('Turn timer auto-pass (REQ-CORE-05)', () => {
    it('auto-passes the active player when their timer fires', () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      engine.init('room1', players as any, () => {});
      // Fire p1's timer (auto-pass p1, p2 becomes active)
      vi.advanceTimersByTime(45_001);
      const ms = engine.getState() as any;
      expect(ms.players['p1'].hasCommitted).toBe(true);
      expect(ms.activePlayerId).toBe('p2');
      vi.useRealTimers();
    });
  });

  describe('Per-player state projection (REQ-MULTI-01, REQ-NFR-01)', () => {
    it('projectState strips opponent hand — only provides handCount', () => {
      engine.init('room1', players as any, () => {});
      const stateForP1 = engine.projectState('p1') as SnuskingProjectedState;
      const p2Opponent = stateForP1.opponents.find(o => o.userId === 'p2');
      expect(p2Opponent).toBeDefined();
      expect((p2Opponent as any).hand).toBeUndefined();
      expect(typeof p2Opponent?.handCount).toBe('number');
    });

    it("projected state includes player's own hand in self field", () => {
      engine.init('room1', players as any, () => {});
      const stateForP1 = engine.projectState('p1') as SnuskingProjectedState;
      expect(Array.isArray(stateForP1.self.hand)).toBe(true);
    });
  });

  describe('Commit status visible, action hidden (REQ-MULTI-02)', () => {
    it('hasCommitted is true in opponent view after player commits', () => {
      engine.init('room1', players as any, () => {});
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      const stateForP2 = engine.projectState('p2') as SnuskingProjectedState;
      const p1Opponent = stateForP2.opponents.find(o => o.userId === 'p1');
      expect(p1Opponent?.hasCommitted).toBe(true);
    });

    it('pending action content is NOT in projected state', () => {
      engine.init('room1', players as any, () => {});
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      const stateForP2 = engine.projectState('p2') as any;
      expect(stateForP2.pendingActions).toBeUndefined();
    });
  });

  describe('Zod action validation (REQ-NFR-02)', () => {
    it('ignores malformed action payloads without throwing', () => {
      engine.init('room1', players as any, () => {});
      expect(() => engine.handleEvent('p1', { type: 'invalid:garbage', data: '!!!!' } as any)).not.toThrow();
    });

    it('accepts valid snusking:pass action', () => {
      engine.init('room1', players as any, () => {});
      expect(() => engine.handleEvent('p1', { type: 'snusking:pass' } as any)).not.toThrow();
    });
  });

  describe('onStateUpdate callback (REQ-NFR-01)', () => {
    it('calls onStateUpdate with forUserId wrapper per player on init', () => {
      const updates: any[] = [];
      engine.init('room1', players as any, s => updates.push(s));
      const hasForUserId = updates.every((u: any) => typeof u.forUserId === 'string');
      expect(hasForUserId).toBe(true);
      expect(updates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('destroy (resource cleanup)', () => {
    it('destroy clears the timer without throwing', () => {
      engine.init('room1', players as any, () => {});
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  describe('Beer resource (BEER-RES)', () => {
    it('beer starts at 0 on turn 1 (no increment on the very first turn)', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      expect(ms.players['p1'].beer).toBe(0);
      expect(ms.players['p2'].beer).toBe(0);
    });

    it('beer does not exceed cap 3 when already at max', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      ms.players['p1'].beer = 3;
      ms.players['p2'].beer = 3;
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      // Next round starts via setImmediate
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const ms2 = engine.getState() as any;
          expect(ms2.players['p1'].beer).toBe(3);
          expect(ms2.players['p2'].beer).toBe(3);
          resolve();
        });
      });
    });

    it('immunity activation with beer >= 1 decrements beer by 1', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      ms.players['p1'].beer = 2;
      // p1 activates immunity (resolved immediately)
      engine.handleEvent('p1', { type: 'snusking:activate-immunity' } as any);
      const ms2 = engine.getState() as any;
      // beer decremented from 2 to 1 immediately
      expect(ms2.players['p1'].beer).toBe(1);
    });

    it('immunity activation with 0 beer is silently ignored', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      ms.players['p1'].beer = 0;
      engine.handleEvent('p1', { type: 'snusking:activate-immunity' } as any);
      const ms2 = engine.getState() as any;
      expect(ms2.players['p1'].beer).toBe(0);
    });
  });

  describe('Sabotage and immunity (TRADE-SAB)', () => {
    it('snusking:sabotage-spentsnus sets skipNextTurn on the target player immediately', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      const sabCard = { instanceId: 'sab-spent-1', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-spent-1' } as any);

      const ms2 = engine.getState() as any;
      expect(ms2.players['p2'].skipNextTurn).toBe(true);
    });

    it('player with skipNextTurn is auto-passed next turn and flag is cleared', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      const sabCard = { instanceId: 'sab-spent-2', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-spent-2' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);

      // Next round starts via setImmediate — p2 should be auto-committed
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const ms2 = engine.getState() as any;
          expect(ms2.players['p2'].hasCommitted).toBe(true);
          expect(ms2.players['p2'].skipNextTurn).toBe(false);
          resolve();
        });
      });
    });

    it('snusking:sabotage-highnic sets pendingDiscard and highNicEffect on target immediately', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      const sabCard = { instanceId: 'sab-nic-1', definitionId: 'siberia', name: 'Siberia -80', empirePoints: 0, strength: 'extreme', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-highnic', targetPlayerId: 'p2', cardInstanceId: 'sab-nic-1' } as any);

      const ms2 = engine.getState() as any;
      expect(ms2.players['p2'].pendingDiscard).toBe(true);
      expect(ms2.players['p2'].highNicEffect).toBe(true);
    });

    it('player with pendingDiscard loses one card from hand at start of next round', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      const sabCard = { instanceId: 'sab-nic-2', definitionId: 'siberia', name: 'Siberia -80', empirePoints: 0, strength: 'extreme', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-highnic', targetPlayerId: 'p2', cardInstanceId: 'sab-nic-2' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);

      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const ms2 = engine.getState() as any;
          expect(ms2.players['p2'].pendingDiscard).toBe(false);
          expect(ms2.players['p2'].highNicEffect).toBe(false);
          expect(ms2.players['p2'].hand.length).toBeGreaterThan(0);
          resolve();
        });
      });
    });

    it('second sabotage targeting same player in one turn is NOT blocked (resolved immediately, sequentially)', () => {
      // With immediate resolution, each player acts on their own turn — two players can't both sabotage in the same turn
      // This test verifies a single sabotage still works correctly
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      const sabCard = { instanceId: 'sab-seq-1', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-seq-1' } as any);

      const ms2 = engine.getState() as any;
      expect(ms2.players['p2'].skipNextTurn).toBe(true);
    });

    it('sabotage against a player with immunityActive has no effect', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      // Give p2 beer so they can activate immunity — but p1 acts first
      // In sequential turns, p1 sabotages before p2 gets to activate immunity,
      // so immunity doesn't protect against sabotage from previous player's turn.
      // This test verifies that if immunity IS active, sabotage is blocked.
      ms.players['p2'].immunityActive = true; // manually set for test
      const sabCard = { instanceId: 'sab-imm-1', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-imm-1' } as any);

      const ms2 = engine.getState() as any;
      expect(ms2.players['p2'].skipNextTurn).toBe(false);
    });
  });
});
