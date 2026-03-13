import { createSignal, onCleanup, Show } from 'solid-js';
import { useSocket } from '../stores/socket';
import { useRoom } from '../stores/room';
import { SnuskingGame } from './snusking/index';
import type { SnuskingProjectedState, GameAction } from '@slutsnus/shared';

interface GameContainerProps {
    roomCode: string;
}

export default function GameContainer(props: GameContainerProps) {
    const socket = useSocket();
    const [roomState] = useRoom();

    const [gameState, setGameState] = createSignal<SnuskingProjectedState | null>(null);

    const onState = ({ state }: { state: unknown }) => setGameState(state as SnuskingProjectedState);

    socket.on('game:state', onState);

    onCleanup(() => {
        socket.off('game:state', onState);
    });

    const gameType = () => roomState.room?.gameType ?? '';

    return (
        <div class="game-wrapper">
            <Show when={!gameState()}>
                <div class="game-loading">
                    <p>Waiting for game to start...</p>
                </div>
            </Show>
            <Show when={gameType() === 'snusking' ? gameState() : null}>
                {(state) => (
                    <SnuskingGame
                        state={state() as SnuskingProjectedState}
                        roomCode={props.roomCode}
                        onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
                    />
                )}
            </Show>
        </div>
    );
}
