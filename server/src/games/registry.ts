import { GameAction, PlayerInfo, FactoryDifficulty } from '@slutsnus/shared';
import { SnusregnEngine } from './snusregn/engine';
import { SnusArenaEngine } from './snus-arena/engine';
import { SnusFarmEngine } from './snus-farm/engine';
import { SnusFactoryEngine } from './snusfactory/engine';
import { FiskeSnusEngine } from './fisksnusen/engine';

export interface GameEngineOptions {
    difficulty?: FactoryDifficulty;
}

export interface GameEngine {
    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void, options?: GameEngineOptions): void;
    handleEvent(playerId: string, action: GameAction): void;
    getState(): unknown;
    destroy(): void;
}

export type TurnPhase = 'draw' | 'planning' | 'reveal' | 'resolve' | 'ended';

// Extension of GameEngine for turn-based games with simultaneous reveal.
export interface TurnBasedGameEngine extends GameEngine {
    /** Returns state shaped for a specific player — strips other players' hands. */
    projectState(playerId: string): unknown;
    /** Returns the current FSM phase. */
    getCurrentPhase(): TurnPhase;
}

export const gameRegistry: Record<string, new () => GameEngine> = {
    'snusregn': SnusregnEngine,
    'snus-arena': SnusArenaEngine,
    'snus-farm': SnusFarmEngine,
    'snusfactory': SnusFactoryEngine,
    'fisksnusen': FiskeSnusEngine,
};
