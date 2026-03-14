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
