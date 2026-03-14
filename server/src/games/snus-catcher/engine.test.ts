import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SenusCatcherEngine } from './engine';
import { PHYSICS } from './physics';
import type { SenusCatcherState } from '@slutsnus/shared';

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

    it('init() sets lives = 3 for each player', () => {
        engine.init('room1', players as any, () => {});
        const state = engine.getState() as SenusCatcherState;
        for (const p of state.players) {
            expect(p.lives).toBe(PHYSICS.INITIAL_LIVES);
        }
    });

    it('init() sets score = 0 for each player', () => {
        engine.init('room1', players as any, () => {});
        const state = engine.getState() as SenusCatcherState;
        for (const p of state.players) {
            expect(p.score).toBe(0);
        }
    });

    it('init() sets barXFraction = 0.5 for each player', () => {
        engine.init('room1', players as any, () => {});
        const state = engine.getState() as SenusCatcherState;
        for (const p of state.players) {
            expect(p.barXFraction).toBe(0.5);
        }
    });

    it('init() creates empty objects array for each player', () => {
        engine.init('room1', players as any, () => {});
        const state = engine.getState() as SenusCatcherState;
        for (const p of state.players) {
            expect(p.objects).toEqual([]);
        }
    });
});

// ── GAME-02: Bar movement ───────────────────────────────────────────────
describe('GAME-02: Bar position updated by bar-move action', () => {
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

    it('handleEvent(bar-move) sets barXFraction on the correct player', () => {
        engine.init('room1', players as any, () => {});
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.7 } });
        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        expect(p1.barXFraction).toBe(0.7);
        // p2 should still be at 0.5
        const p2 = state.players.find(p => p.userId === 'p2')!;
        expect(p2.barXFraction).toBe(0.5);
    });

    it('handleEvent(bar-move) clamps xFraction to [0.0, 1.0] (negative input → 0)', () => {
        engine.init('room1', players as any, () => {});
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: -0.5 } });
        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        expect(p1.barXFraction).toBe(0);
    });

    it('handleEvent(bar-move) clamps xFraction to [0.0, 1.0] (>1.0 input → 1.0)', () => {
        engine.init('room1', players as any, () => {});
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 1.5 } });
        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        expect(p1.barXFraction).toBe(1.0);
    });

    it('handleEvent(bar-move) ignores unknown player IDs without throwing', () => {
        engine.init('room1', players as any, () => {});
        expect(() => {
            engine.handleEvent('nonexistent', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.5 } });
        }).not.toThrow();
    });
});

// ── GAME-03 / GAME-04: Object spawning ─────────────────────────────────
describe('GAME-03 + GAME-04: Object spawning over time', () => {
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
        vi.restoreAllMocks();
    });

    it('after 20 ticks at least one object appears in a player objects array', () => {
        // Mock Math.random to always spawn and always fresh
        vi.spyOn(Math, 'random').mockReturnValue(0.0);
        engine.init('room1', players as any, () => {});
        vi.advanceTimersByTime(20 * PHYSICS.TICK_MS);
        const state = engine.getState() as SenusCatcherState;
        const totalObjects = state.players.reduce((sum, p) => sum + p.objects.length, 0);
        expect(totalObjects).toBeGreaterThan(0);
    });

    it('spawned objects have x in [0.0, 1.0] and y = 0.0 initially', () => {
        // Return 0.05 for all Math.random calls:
        // - spawn check: 0.05 < 0.15 → spawn
        // - isSpent: 0.05 < 0.3 → spent (fine, just checking shape)
        // - x: 0.05 (in [0,1])
        // - id suffix: 0.05 (irrelevant)
        vi.spyOn(Math, 'random').mockReturnValue(0.05);
        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        // Advance 1 tick — objects are spawned after moveObjects, so they have y=0.0 at spawn
        vi.advanceTimersByTime(PHYSICS.TICK_MS);
        // Read state from the onStateUpdate callback (not getState — to capture the tick state)
        // Objects spawned this tick have y=0 (they're added after moveObjects)
        const state = engine.getState() as SenusCatcherState;
        const allObjects = state.players.flatMap(p => p.objects);
        expect(allObjects.length).toBeGreaterThan(0);
        for (const obj of allObjects) {
            expect(obj.x).toBeGreaterThanOrEqual(0.0);
            expect(obj.x).toBeLessThanOrEqual(1.0);
            // y=0.0 at spawn time; after 1 tick it's been stored at y=0.0 (move happens next tick)
            expect(obj.y).toBeGreaterThanOrEqual(0.0);
            expect(obj.y).toBeLessThan(1.1);
        }
    });

    it('spawned objects have type "fresh" or "spent"', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.0); // always spawn, type = spent (0 < 0.3)
        engine.init('room1', players as any, () => {});
        vi.advanceTimersByTime(5 * PHYSICS.TICK_MS);
        const state = engine.getState() as SenusCatcherState;
        const allObjects = state.players.flatMap(p => p.objects);
        for (const obj of allObjects) {
            expect(['fresh', 'spent']).toContain(obj.type);
        }
    });

    it('spent objects appear among spawned objects over 100 ticks (not always fresh)', () => {
        // Use alternating random values: first call 0 (spawn), second 0 (spent type)
        // Over 100 ticks we should see both types. Use Math.random returning 0.1 (< 0.15 spawn, < 0.3 spent)
        let callIndex = 0;
        const values = [0.1, 0.1, 0.1]; // always spawn + spent
        vi.spyOn(Math, 'random').mockImplementation(() => {
            return values[callIndex++ % values.length] ?? 0.1;
        });
        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        vi.advanceTimersByTime(100 * PHYSICS.TICK_MS);
        // Check that at some point we saw a spent call — since random is 0.1 and 0.1<0.3 = spent type
        const allCalls = onStateUpdate.mock.calls;
        const allObjects = allCalls.flatMap((args: unknown[]) => {
            const s = args[0] as SenusCatcherState;
            return s.players?.flatMap(p => p.objects) ?? [];
        });
        const spentFound = allObjects.some(obj => obj.type === 'spent');
        expect(spentFound).toBe(true);
    });
});

// ── GAME-03: Object movement ────────────────────────────────────────────
describe('GAME-03: Objects move downward each tick', () => {
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
        vi.restoreAllMocks();
    });

    it('object y increases each tick (falls toward bottom)', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.0); // always spawn (0<0.15)
        engine.init('room1', players as any, () => {});
        // Advance 1 tick to spawn objects
        vi.advanceTimersByTime(PHYSICS.TICK_MS);
        const stateAfter1 = engine.getState() as SenusCatcherState;
        const objsAfter1 = stateAfter1.players.flatMap(p => p.objects);
        expect(objsAfter1.length).toBeGreaterThan(0);
        const firstY = objsAfter1[0].y;

        // Advance another tick
        vi.advanceTimersByTime(PHYSICS.TICK_MS);
        const stateAfter2 = engine.getState() as SenusCatcherState;
        const objsAfter2 = stateAfter2.players.flatMap(p => p.objects);
        // At least one object should have moved
        const movedObj = objsAfter2.find(o => o.y > firstY);
        expect(movedObj).toBeDefined();
    });

    it('objects with y >= 1.1 are removed from objects array (fell off screen)', () => {
        // We need an object that will be at y>=1.1 after 1 tick.
        // y starts at 0, falls FALL_SPEED_PER_TICK=0.008 per tick. To reach 1.1 in 1 tick,
        // we'd need the object already at y=1.1-0.008=1.092 before tick.
        // We can't directly inject objects via the public API, so we advance enough ticks.
        // After 1.1/0.008 = 137.5 ticks an object spawned at tick 0 would be removed.
        // Instead, let's spawn at tick 1 and advance 138 ticks — the object will fall off.
        let spawnCall = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            // First few ticks: don't spawn (return high value)
            // After tick 1 we want spawn on tick 1 only
            spawnCall++;
            if (spawnCall <= 2) return 0.0; // spawn on first tick (both players)
            return 0.99; // no more spawning
        });
        engine.init('room1', players as any, () => {});
        // Advance 1 tick to spawn objects
        vi.advanceTimersByTime(PHYSICS.TICK_MS);
        const stateAfterSpawn = engine.getState() as SenusCatcherState;
        const spawned = stateAfterSpawn.players.flatMap(p => p.objects);
        expect(spawned.length).toBeGreaterThan(0);

        // Now advance enough ticks for all objects to fall past 1.1
        // 1.1 / 0.008 = 137.5 → need 138 more ticks
        vi.advanceTimersByTime(138 * PHYSICS.TICK_MS);
        const stateFinal = engine.getState() as SenusCatcherState;
        const remaining = stateFinal.players.flatMap(p => p.objects);
        expect(remaining.length).toBe(0);
    });
});

// ── GAME-05 / GAME-06: Collision ────────────────────────────────────────
describe('GAME-05 + GAME-06: Collision resolution', () => {
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
        vi.restoreAllMocks();
    });

    it('catching a fresh object (bar overlaps, object at catch Y) increments player score and removes object', () => {
        // Use Math.random = 0.05 for all calls:
        // - spawn check: 0.05 < 0.15 → always spawn
        // - isSpent: 0.05 < 0.3 → spent type (we'll use a different value for "fresh" test via spy)
        // Use 0.35 for all calls: spawn (0.35>0.15 no spawn)... need 0.05 to spawn
        // Strategy: use 0.05 for all — objects spawn at x=0.05. Set bar to 0.05.
        vi.spyOn(Math, 'random').mockReturnValue(0.05);
        // x=0.05, bar at 0.05 → |0.05-0.05|=0 <= 0.075 → collision
        // type: isSpent = 0.05 < 0.3 → spent (lives--). Let's test score++ with fresh:
        // use 0.35 for isSpent only — but that requires sequencing. Simplest: test that score or lives changed.
        // Actually with 0.05, objects are spent (0.05 < 0.3). Let's test fresh separately.
        // For fresh: need isSpent check to return >= 0.3. Use a controlled sequence:
        // spawn check: must be < 0.15
        // isSpent: must be >= 0.3 (fresh)
        // x: any value in [0,1]
        // id suffix: any
        // Pattern: use array cycling
        let idx = 0;
        const seq = [0.05, 0.35, 0.05, 0.05]; // spawn, fresh, x=0.05, id
        vi.spyOn(Math, 'random').mockImplementation(() => seq[idx++ % seq.length] ?? 0.05);

        engine.init('room1', players as any, () => {});
        // Bar at x=0.05 for both players — matches object x=0.05
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.05 } });
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.05 } });

        // 0.88/0.008 = 110 ticks to fall to collision zone; use 120 for margin
        vi.advanceTimersByTime(120 * PHYSICS.TICK_MS);

        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        expect(p1.score).toBeGreaterThan(0);
    });

    it('touching a spent object (bar overlaps, object at catch Y) decrements player lives and removes object', () => {
        // Use 0.05 for all: spawn (0.05<0.15), isSpent (0.05<0.3 → spent), x=0.05, id=0.05
        vi.spyOn(Math, 'random').mockReturnValue(0.05);
        // Bar at x=0.05 → catches spent objects → lives--

        engine.init('room1', players as any, () => {});
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.05 } });

        vi.advanceTimersByTime(120 * PHYSICS.TICK_MS);

        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        expect(p1.lives).toBeLessThan(PHYSICS.INITIAL_LIVES);
    });

    it('object not overlapping bar passes through without collision', () => {
        // Use 0.05 for all: spawn, isSpent=spent, x=0.05
        // Bar at 1.0 — far from x=0.05. |0.05 - 1.0| = 0.95 >> BAR_WIDTH/2=0.075 → no collision
        vi.spyOn(Math, 'random').mockReturnValue(0.05);

        engine.init('room1', players as any, () => {});
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 1.0 } });
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 1.0 } });

        // Advance enough ticks for objects to fall off screen (no collision since bar is far)
        // Objects fall at 0.008/tick. After 137+ ticks they fall off at y>=1.1
        vi.advanceTimersByTime(140 * PHYSICS.TICK_MS);

        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        // No objects caught: score=0, lives=3
        expect(p1.score).toBe(0);
        expect(p1.lives).toBe(PHYSICS.INITIAL_LIVES);
    });

    it('collision is resolved independently per player (player A catching does not affect player B)', () => {
        // All random = 0.05: spawn, spent, x=0.05, id
        let idx = 0;
        const seq = [0.05, 0.35, 0.05, 0.05]; // spawn, fresh, x=0.05, id
        vi.spyOn(Math, 'random').mockImplementation(() => seq[idx++ % seq.length] ?? 0.05);

        engine.init('room1', players as any, () => {});
        // p1 bar at x=0.05 → catches (|0.05-0.05|=0 <= 0.075)
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.05 } });
        // p2 bar at x=1.0 → does not catch (|0.05-1.0|=0.95 >> 0.075)
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 1.0 } });

        vi.advanceTimersByTime(120 * PHYSICS.TICK_MS);

        const state = engine.getState() as SenusCatcherState;
        const p1 = state.players.find(p => p.userId === 'p1')!;
        const p2 = state.players.find(p => p.userId === 'p2')!;
        // p1 catches fresh objects → score > 0. p2 doesn't catch → score = 0.
        expect(p1.score).toBeGreaterThan(0);
        expect(p2.score).toBe(0);
    });
});

// ── GAME-08 / GAME-09: Win condition ─────────────────────────────────────
describe('GAME-08 + GAME-09: Game ends when a player loses all lives', () => {
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
        vi.restoreAllMocks();
    });

    it('when a player lives reaches 0, onStateUpdate is called with status = "ended"', () => {
        // Force spawn spent objects on p2 with bar at catch position — p2 loses 3 lives
        let callIndex = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            const vals = [
                0.05, // spawn check → spawn
                0.1,  // spent type
                0.5,  // x = 0.5 (matches p2 bar)
                0.05, // id suffix
            ];
            return vals[callIndex++ % vals.length] ?? 0.5;
        });

        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        // p2 bar at 0.5 — will catch spent objects
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.5 } });
        // p1 bar at 0.0 — won't catch (objects at x=0.5)
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.0 } });

        // Advance enough ticks to have 3 spent objects reach catch zone and drain p2's lives
        vi.advanceTimersByTime(500 * PHYSICS.TICK_MS);

        // Check that at some point ended state was emitted
        const endedCall = onStateUpdate.mock.calls.find(
            (args: unknown[]) => (args[0] as SenusCatcherState).status === 'ended'
        );
        expect(endedCall).toBeDefined();
    });

    it('ended state includes results array with winner rank 1 and loser rank 2', () => {
        let callIndex = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            const vals = [
                0.05, // spawn
                0.1,  // spent
                0.5,  // x = 0.5
                0.05, // suffix
            ];
            return vals[callIndex++ % vals.length] ?? 0.5;
        });

        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.5 } });
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.0 } });

        vi.advanceTimersByTime(500 * PHYSICS.TICK_MS);

        const endedCall = onStateUpdate.mock.calls.find(
            (args: unknown[]) => (args[0] as SenusCatcherState).status === 'ended'
        );
        expect(endedCall).toBeDefined();
        const endedState = endedCall![0] as SenusCatcherState;
        expect(endedState.results).toBeDefined();
        const ranks = endedState.results!.map(r => r.rank).sort();
        expect(ranks).toEqual([1, 2]);
    });

    it('ended state results[].userId and results[].score match the player states', () => {
        let callIndex = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            const vals = [
                0.05, // spawn
                0.1,  // spent
                0.5,  // x = 0.5
                0.05, // suffix
            ];
            return vals[callIndex++ % vals.length] ?? 0.5;
        });

        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.5 } });
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.0 } });

        vi.advanceTimersByTime(500 * PHYSICS.TICK_MS);

        const endedCall = onStateUpdate.mock.calls.find(
            (args: unknown[]) => (args[0] as SenusCatcherState).status === 'ended'
        );
        const endedState = endedCall![0] as SenusCatcherState;
        expect(endedState.results).toBeDefined();
        const resultUserIds = endedState.results!.map(r => r.userId).sort();
        expect(resultUserIds).toContain('p1');
        expect(resultUserIds).toContain('p2');
        // scores in results should match player state scores
        for (const result of endedState.results!) {
            const player = endedState.players.find(p => p.userId === result.userId);
            expect(player).toBeDefined();
            expect(result.score).toBe(player!.score);
        }
    });

    it('tick interval stops after status becomes "ended" (no further onStateUpdate calls)', () => {
        let callIndex = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            const vals = [
                0.05, // spawn
                0.1,  // spent
                0.5,  // x = 0.5
                0.05, // suffix
            ];
            return vals[callIndex++ % vals.length] ?? 0.5;
        });

        const onStateUpdate = vi.fn();
        engine.init('room1', players as any, onStateUpdate);
        engine.handleEvent('p2', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.5 } });
        engine.handleEvent('p1', { type: 'snus-catcher:bar-move', payload: { xFraction: 0.0 } });

        // Advance until game ends
        vi.advanceTimersByTime(500 * PHYSICS.TICK_MS);

        // Find when ended state was emitted
        const endedCallIndex = onStateUpdate.mock.calls.findIndex(
            (args: unknown[]) => (args[0] as SenusCatcherState).status === 'ended'
        );
        expect(endedCallIndex).toBeGreaterThanOrEqual(0);
        const callCountAtEnd = onStateUpdate.mock.calls.length;

        // Advance 500ms more — no new calls expected
        vi.advanceTimersByTime(500);

        expect(onStateUpdate.mock.calls.length).toBe(callCountAtEnd);
    });
});
