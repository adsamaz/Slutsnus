import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SenusCatcherEngine } from './engine';

describe('SenusCatcherEngine', () => {
    let engine: SenusCatcherEngine;
    const players = [
        { userId: 'p1', username: 'Alice' },
        { userId: 'p2', username: 'Bob' },
    ];

    beforeEach(() => {
        vi.useFakeTimers();
        engine = new SenusCatcherEngine();
    });

    afterEach(() => {
        engine.destroy();
        vi.useRealTimers();
    });

    it('init() starts emitting state at ~20 Hz', () => {
        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);

        vi.advanceTimersByTime(100);

        // At 20 Hz (50ms interval), 100ms should yield at least 1 call
        expect(onStateUpdate).toHaveBeenCalled();
    });

    it('destroy() clears the interval — no more ticks after destroy', () => {
        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        vi.advanceTimersByTime(50);

        engine.destroy();
        const callCountAfterDestroy = onStateUpdate.mock.calls.length;

        vi.advanceTimersByTime(200);

        // No additional calls after destroy
        expect(onStateUpdate.mock.calls.length).toBe(callCountAfterDestroy);
    });

    it('calling init() twice does not accumulate two intervals', () => {
        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        engine.init('room1', players as any, onStateUpdate);

        // Reset call count after second init
        onStateUpdate.mockClear();

        vi.advanceTimersByTime(50);

        // Should fire exactly once (one interval, not two)
        expect(onStateUpdate).toHaveBeenCalledTimes(1);
    });

    it('getState() returns an object with a tickCount property', () => {
        engine.init('room1', players as any, () => {});
        vi.advanceTimersByTime(100);

        const state = engine.getState() as { tickCount: number };
        expect(state).toHaveProperty('tickCount');
        expect(typeof state.tickCount).toBe('number');
    });
});

// ── GAME-07: Initial state ──────────────────────────────────────────────
describe('GAME-07: Player starts with 3 lives', () => {
    it.todo('init() sets lives = 3 for each player');
    it.todo('init() sets score = 0 for each player');
    it.todo('init() sets barXFraction = 0.5 for each player');
    it.todo('init() creates empty objects array for each player');
});

// ── GAME-02: Bar movement ───────────────────────────────────────────────
describe('GAME-02: Bar position updated by bar-move action', () => {
    it.todo('handleEvent(bar-move) sets barXFraction on the correct player');
    it.todo('handleEvent(bar-move) clamps xFraction to [0.0, 1.0] (negative input → 0)');
    it.todo('handleEvent(bar-move) clamps xFraction to [0.0, 1.0] (>1.0 input → 1.0)');
    it.todo('handleEvent(bar-move) ignores unknown player IDs without throwing');
});

// ── GAME-03 / GAME-04: Object spawning ─────────────────────────────────
describe('GAME-03 + GAME-04: Object spawning over time', () => {
    it.todo('after 20 ticks at least one object appears in a player objects array');
    it.todo('spawned objects have x in [0.0, 1.0] and y = 0.0 initially');
    it.todo('spawned objects have type "fresh" or "spent"');
    it.todo('spent objects appear among spawned objects over 100 ticks (not always fresh)');
});

// ── GAME-03: Object movement ────────────────────────────────────────────
describe('GAME-03: Objects move downward each tick', () => {
    it.todo('object y increases each tick (falls toward bottom)');
    it.todo('objects with y >= 1.1 are removed from objects array (fell off screen)');
});

// ── GAME-05 / GAME-06: Collision ────────────────────────────────────────
describe('GAME-05 + GAME-06: Collision resolution', () => {
    it.todo('catching a fresh object (bar overlaps, object at catch Y) increments player score and removes object');
    it.todo('touching a spent object (bar overlaps, object at catch Y) decrements player lives and removes object');
    it.todo('object not overlapping bar passes through without collision');
    it.todo('collision is resolved independently per player (player A catching does not affect player B)');
});

// ── GAME-08 / GAME-09: Win condition ─────────────────────────────────────
describe('GAME-08 + GAME-09: Game ends when a player loses all lives', () => {
    it.todo('when a player lives reaches 0, onStateUpdate is called with status = "ended"');
    it.todo('ended state includes results array with winner rank 1 and loser rank 2');
    it.todo('ended state results[].userId and results[].score match the player states');
    it.todo('tick interval stops after status becomes "ended" (no further onStateUpdate calls)');
});
