import { GameAction, PlayerInfo } from '@slutsnus/shared';
import { SnusregnEngine } from './snusregn/engine';

export interface GameEngine {
    init(roomId: string, players: PlayerInfo[], onStateUpdate: (state: unknown) => void): void;
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
};
