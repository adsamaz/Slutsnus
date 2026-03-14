import type { GameEngine } from '../registry';
import type { PlayerInfo, GameAction, SenusCatcherState, SenusCatcherPlayerState, GameResult } from '@slutsnus/shared';
import { spawnObject, moveObjects, resolveCollisions, PHYSICS } from './physics';

export class SenusCatcherEngine implements GameEngine {
    private tickInterval?: ReturnType<typeof setInterval>;
    private onStateUpdate: (state: unknown) => void = () => {};
    private tickCount = 0;
    private playerStates = new Map<string, SenusCatcherPlayerState>();
    private status: 'playing' | 'ended' = 'playing';

    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
        this.onStateUpdate = onStateUpdate;
        this.tickCount = 0;
        this.status = 'playing';
        this.playerStates = new Map(
            players.map(p => [p.userId, {
                userId: p.userId,
                username: p.username,
                score: 0,
                lives: PHYSICS.INITIAL_LIVES,
                barXFraction: 0.5,
                objects: [],
            }])
        );
        this.tickInterval = setInterval(() => this.tick(), PHYSICS.TICK_MS);
    }

    handleEvent(playerId: string, action: GameAction): void {
        if (action.type === 'snus-catcher:bar-move') {
            const payload = action.payload as { xFraction: number };
            const player = this.playerStates.get(playerId);
            if (player) {
                player.barXFraction = Math.max(0, Math.min(1, payload.xFraction));
            }
        }
    }

    getState(): unknown {
        return this.buildState();
    }

    destroy(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = undefined;
        }
    }

    private tick(): void {
        if (this.status === 'ended') return;
        this.tickCount++;

        // For each player: move objects, maybe spawn, resolve collisions
        const playerEntries = [...this.playerStates.entries()];
        for (const [playerId, player] of playerEntries) {
            let objects = moveObjects(player.objects);
            if (Math.random() < PHYSICS.SPAWN_CHANCE_PER_TICK) {
                const playerIndex = playerEntries.findIndex(([id]) => id === playerId);
                objects = [...objects, spawnObject(playerIndex, this.tickCount)];
            }
            const { updatedPlayer, remainingObjects } = resolveCollisions(player, objects);
            this.playerStates.set(playerId, { ...updatedPlayer, objects: remainingObjects });
        }

        // Check win condition
        const loser = [...this.playerStates.values()].find(p => p.lives <= 0);
        if (loser) {
            this.end(loser);
            return;
        }

        this.onStateUpdate(this.buildState());
    }

    private end(loser: SenusCatcherPlayerState): void {
        this.status = 'ended';
        clearInterval(this.tickInterval);
        this.tickInterval = undefined;

        const players = [...this.playerStates.values()];
        const winner = players.find(p => p.userId !== loser.userId)!;
        const results: GameResult[] = [
            { userId: winner.userId, username: winner.username, score: winner.score, rank: 1 },
            { userId: loser.userId, username: loser.username, score: loser.score, rank: 2 },
        ];
        const endedState: SenusCatcherState = {
            status: 'ended',
            tickCount: this.tickCount,
            players: players.map(p => ({ ...p, objects: [] })),
            results,
        };
        this.onStateUpdate(endedState);
    }

    private buildState(): SenusCatcherState {
        return {
            status: 'playing',
            tickCount: this.tickCount,
            players: [...this.playerStates.values()].map(p => ({ ...p })),
        };
    }
}
