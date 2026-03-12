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
});
