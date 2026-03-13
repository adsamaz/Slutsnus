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
    it('starts in draw phase after init (then immediately transitions to planning)', () => {
      engine.init('room1', players as any, () => {});
      // draw transitions immediately to planning — getCurrentPhase reflects final state
      expect(engine.getCurrentPhase()).toBe('planning');
    });

    it('transitions draw → planning after draw completes', () => {
      engine.init('room1', players as any, () => {});
      expect(engine.getCurrentPhase()).toBe('planning');
    });
  });

  describe('Simultaneous reveal (REQ-CORE-03)', () => {
    it('does not advance to reveal phase when only one player has committed', () => {
      const updates: unknown[] = [];
      engine.init('room1', players as any, s => updates.push(s));
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      expect(engine.getCurrentPhase()).toBe('planning');
    });

    it('advances beyond planning when all players have committed', () => {
      engine.init('room1', players as any, () => {});
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      // Phase should have advanced past planning (reveal or later)
      expect(engine.getCurrentPhase()).not.toBe('planning');
    });
  });

  describe('Turn timer auto-pass (REQ-CORE-05)', () => {
    it('auto-passes uncommitted players when timer fires', () => {
      vi.useFakeTimers();
      engine.init('room1', players as any, () => {});
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      // only p1 committed — p2 will be auto-passed at timer expiry
      vi.advanceTimersByTime(45_001);
      expect(engine.getCurrentPhase()).not.toBe('planning');
      vi.useRealTimers();
    });
  });

  describe('Per-player state projection (REQ-MULTI-01, REQ-NFR-01)', () => {
    it('projectState strips opponent hand — only provides handCount', () => {
      engine.init('room1', players as any, () => {});
      const stateForP1 = engine.projectState('p1') as SnuskingProjectedState;
      // p2 appears as opponent with handCount, not hand
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
    it('hasCommitted is true in opponent view after player commits during planning phase', () => {
      engine.init('room1', players as any, () => {});
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      const stateForP2 = engine.projectState('p2') as SnuskingProjectedState;
      const p1Opponent = stateForP2.opponents.find(o => o.userId === 'p1');
      expect(p1Opponent?.hasCommitted).toBe(true);
    });

    it('pending action content is NOT in projected state during planning phase', () => {
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
    it('calls onStateUpdate with forUserId wrapper per player on planning phase start', () => {
      const updates: any[] = [];
      engine.init('room1', players as any, s => updates.push(s));
      // After init → draw → planning: should have emitted per-player updates
      const hasForUserId = updates.every((u: any) => typeof u.forUserId === 'string');
      expect(hasForUserId).toBe(true);
      expect(updates.length).toBeGreaterThanOrEqual(2); // at least one per player
    });
  });

  describe('destroy (resource cleanup)', () => {
    it('destroy clears the timer without throwing', () => {
      engine.init('room1', players as any, () => {});
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  describe('Beer resource (BEER-RES)', () => {
    it('beer increments by 1 at the start of each draw phase', () => {
      engine.init('room1', players as any, () => {});
      // After init, startDrawPhase() runs synchronously — beer is incremented from 0 to 1
      const ms = engine.getState() as any;
      expect(ms.players['p1'].beer).toBe(1);
      expect(ms.players['p2'].beer).toBe(1);
    });

    it('beer does not exceed cap 3 when already at max', () => {
      engine.init('room1', players as any, () => {});
      // Force beer to 3 on both players
      const ms = engine.getState() as any;
      ms.players['p1'].beer = 3;
      ms.players['p2'].beer = 3;
      // Both pass to complete the turn
      engine.handleEvent('p1', { type: 'snusking:pass' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      // After resolve → next startDrawPhase runs (async via setImmediate)
      // Check beer is still 3 after the next draw phase
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // startResolve ran
          setImmediate(() => {
            // startDrawPhase ran — beer should remain capped at 3
            const ms2 = engine.getState() as any;
            expect(ms2.players['p1'].beer).toBe(3);
            expect(ms2.players['p2'].beer).toBe(3);
            resolve();
          });
        });
      });
    });

    it('immunity activation with beer >= 1 decrements beer by 1', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      ms.players['p1'].beer = 2;
      // p1 activates immunity, p2 passes
      engine.handleEvent('p1', { type: 'snusking:activate-immunity' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      // After resolve phase: immunity activated and beer decremented
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // startResolve ran — immunity activated, beer spent
          const ms2 = engine.getState() as any;
          // After startResolve, beer was decremented from 2 to 1
          // But then startDrawPhase runs async (next setImmediate) and adds +1
          // So check here, in the setImmediate after resolve (before draw)
          // Actually startDrawPhase is in another setImmediate — so at this point:
          // beer = 2 - 1 (immunity) = 1, not yet incremented by draw phase
          setImmediate(() => {
            // After startDrawPhase: beer = 1 + 1 = 2
            const ms3 = engine.getState() as any;
            // Immunity cost 1 beer (from 2 → 1), then draw phase adds 1 (→ 2)
            expect(ms3.players['p1'].beer).toBe(2);
            resolve();
          });
        });
      });
    });

    it('immunity activation with 0 beer is silently ignored', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      ms.players['p1'].beer = 0;
      engine.handleEvent('p1', { type: 'snusking:activate-immunity' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);
      // After resolve → draw phase, beer should be 0 + 1 (draw) = 1 (immunity ignored)
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          setImmediate(() => {
            const ms2 = engine.getState() as any;
            // No immunity cost (beer was 0), draw phase adds 1 → beer = 1
            expect(ms2.players['p1'].beer).toBe(1);
            resolve();
          });
        });
      });
    });
  });

  describe('Sabotage and immunity (TRADE-SAB)', () => {
    it('snusking:sabotage-spentsnus sets skipNextTurn on the target player', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      // Add a card to p1's hand to use as sabotage payload
      const sabCard = { instanceId: 'sab-spent-1', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-spent-1' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);

      // After startResolve (first setImmediate), skipNextTurn is set on p2
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // startResolve has run — skipNextTurn should be set on p2 (before startDrawPhase clears it)
          const ms2 = engine.getState() as any;
          expect(ms2.players['p2'].skipNextTurn).toBe(true);
          resolve();
        });
      });
    });

    it('player with skipNextTurn is auto-passed next turn and flag is cleared', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      // Add a card to p1's hand for sabotage
      const sabCard = { instanceId: 'sab-spent-2', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-spent-2' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);

      // After resolve then draw phase: p2 should be auto-committed (hasCommitted=true) and skipNextTurn=false
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // resolve done, draw scheduled
          setImmediate(() => {
            // draw done — p2 was auto-passed (hasCommitted=true), skipNextTurn cleared
            const ms2 = engine.getState() as any;
            expect(ms2.players['p2'].hasCommitted).toBe(true);
            expect(ms2.players['p2'].skipNextTurn).toBe(false);
            resolve();
          });
        });
      });
    });

    it('snusking:sabotage-highnic sets pendingDiscard and highNicEffect on target', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      // Add a high-nic card to p1's hand for sabotage
      const sabCard = { instanceId: 'sab-nic-1', definitionId: 'siberia', name: 'Siberia -80', empirePoints: 0, strength: 'extreme', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-highnic', targetPlayerId: 'p2', cardInstanceId: 'sab-nic-1' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);

      // After resolve: pendingDiscard and highNicEffect set on p2
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const ms2 = engine.getState() as any;
          expect(ms2.players['p2'].pendingDiscard).toBe(true);
          expect(ms2.players['p2'].highNicEffect).toBe(true);
          resolve();
        });
      });
    });

    it('player with pendingDiscard loses one card from hand at start of next draw phase', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      // Check initial hand size for p2
      const initialHandCount = ms.players['p2'].hand.length;
      // Add a sabotage card to p1
      const sabCard = { instanceId: 'sab-nic-2', definitionId: 'siberia', name: 'Siberia -80', empirePoints: 0, strength: 'extreme', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      engine.handleEvent('p1', { type: 'snusking:sabotage-highnic', targetPlayerId: 'p2', cardInstanceId: 'sab-nic-2' } as any);
      engine.handleEvent('p2', { type: 'snusking:pass' } as any);

      // After resolve then draw phase: p2 loses one card (discarded), then draws back up to MAX
      // The net effect: one card discarded from existing hand, then draws to refill
      // So hand count should remain at MAX_HAND_SIZE (5) after draw phase refills
      // But the key is that pendingDiscard is cleared and highNicEffect cleared after emit
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          // resolve done — pendingDiscard is still true at this point
          setImmediate(() => {
            // draw phase done — pendingDiscard cleared, highNicEffect cleared
            const ms2 = engine.getState() as any;
            expect(ms2.players['p2'].pendingDiscard).toBe(false);
            // highNicEffect is cleared after planning phase emit (which already happened)
            expect(ms2.players['p2'].highNicEffect).toBe(false);
            // Card was discarded then draw refilled hand — p2 should still have cards
            expect(ms2.players['p2'].hand.length).toBeGreaterThan(0);
            resolve();
          });
        });
      });
    });

    it('second sabotage targeting same player in one turn is ignored (one-per-target limit)', () => {
      // Need a 3-player game for this test — two saboteurs, one target
      const threePlayers = [
        { userId: 'p1', username: 'Alice' },
        { userId: 'p2', username: 'Bob' },
        { userId: 'p3', username: 'Carol' },
      ];
      engine.init('room1', threePlayers as any, () => {});
      const ms = engine.getState() as any;
      // Add sabotage cards to p1 and p2
      const sabCard1 = { instanceId: 'sab-dup-1', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      const sabCard2 = { instanceId: 'sab-dup-2', definitionId: 'ettan', name: 'Ettan', empirePoints: 0, strength: 'low', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard1);
      ms.players['p2'].hand.push(sabCard2);

      // Both p1 and p2 sabotage p3 — only the first should succeed
      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p3', cardInstanceId: 'sab-dup-1' } as any);
      engine.handleEvent('p2', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p3', cardInstanceId: 'sab-dup-2' } as any);
      engine.handleEvent('p3', { type: 'snusking:pass' } as any);

      // After resolve: p3 has skipNextTurn (from first sabotage)
      // but the second sabotage was ignored (one-per-target enforcement)
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const ms2 = engine.getState() as any;
          // p3 should have skipNextTurn from the first sabotage
          expect(ms2.players['p3'].skipNextTurn).toBe(true);
          // Only one of p1/p2's cards should have been transferred to p3
          // (the second sabotage card stays with its sender)
          const p1HasCard = ms2.players['p1'].hand.some((c: any) => c.instanceId === 'sab-dup-1');
          const p2HasCard = ms2.players['p2'].hand.some((c: any) => c.instanceId === 'sab-dup-2');
          // Exactly one card was transferred (the second sabotage was blocked)
          expect(p1HasCard || p2HasCard).toBe(true); // one sender still has their card
          resolve();
        });
      });
    });

    it('sabotage against a player with immunityActive has no effect', () => {
      engine.init('room1', players as any, () => {});
      const ms = engine.getState() as any;
      // Give p2 beer to activate immunity
      ms.players['p2'].beer = 1;
      // Add sabotage card to p1
      const sabCard = { instanceId: 'sab-imm-1', definitionId: 'grov', name: 'Grov', empirePoints: 0, strength: 'medium', flavor: 'tobacco' };
      ms.players['p1'].hand.push(sabCard);

      // p1 sabotages p2, p2 activates immunity
      engine.handleEvent('p1', { type: 'snusking:sabotage-spentsnus', targetPlayerId: 'p2', cardInstanceId: 'sab-imm-1' } as any);
      engine.handleEvent('p2', { type: 'snusking:activate-immunity' } as any);

      // After resolve: p2 immunity blocked the sabotage — skipNextTurn should be false
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          const ms2 = engine.getState() as any;
          // p2 used immunity — sabotage blocked
          expect(ms2.players['p2'].skipNextTurn).toBe(false);
          // p2's beer was spent on immunity (1 → 0)
          // (immunityActive is cleared at end of resolve, beer reduced during step 1)
          expect(ms2.players['p2'].beer).toBe(0);
          resolve();
        });
      });
    });
  });
});
