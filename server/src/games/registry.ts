import { GameAction, PlayerInfo } from '@slutsnus/shared';
import { SnusRpgEngine } from './snus-rpg/engine';

export interface GameEngine {
    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void;
    handleEvent(playerId: string, action: GameAction): void;
    getState(): unknown;
    destroy(): void;
}

export const gameRegistry: Record<string, new () => GameEngine> = {
    'snus-rpg': SnusRpgEngine,
};
