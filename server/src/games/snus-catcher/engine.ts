import type { GameEngine } from '../registry';
import type { PlayerInfo, GameAction } from '@slutsnus/shared';

const TICK_MS = 50; // 20 Hz — locked per STATE.md

export class SenusCatcherEngine implements GameEngine {
    private tickInterval?: ReturnType<typeof setInterval>;
    private onStateUpdate: (state: unknown) => void = () => {};
    private tickCount = 0;

    init(_roomId: string, _players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        // Guard against double-init accumulation
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
        this.onStateUpdate = onStateUpdate;
        this.tickCount = 0;
        this.tickInterval = setInterval(() => this.tick(), TICK_MS);
    }

    private tick(): void {
        this.tickCount++;
        this.onStateUpdate({ tickCount: this.tickCount, status: 'playing' });
    }

    handleEvent(_playerId: string, _action: GameAction): void {
        // Phase 5: no-op — Phase 6 implements bar movement and collision
    }

    getState(): unknown {
        return { tickCount: this.tickCount, status: 'playing' };
    }

    destroy(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = undefined;
        }
    }
}
