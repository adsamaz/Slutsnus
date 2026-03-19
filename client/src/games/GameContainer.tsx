import { createSignal, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useSocket } from '../stores/socket';
import { useRoom } from '../stores/room';
import { SnusregnGame } from './snusregn/index';
import type { SnusregnState, GameAction } from '@slutsnus/shared';

interface GameContainerProps {
    roomCode: string;
}

export default function GameContainer(props: GameContainerProps) {
    const socket = useSocket();
    const [roomState] = useRoom();
    const navigate = useNavigate();

    const [gameState, setGameState] = createSignal<unknown>(null);

    const onState = ({ state }: { state: unknown }) => setGameState(state);
    const onError = () => navigate('/');

    socket.on('game:state', onState);
    socket.on('room:error', onError);
    // Ensure socket is in the room (handles reconnects), then signal ready to start
    socket.emit('room:join', { roomCode: props.roomCode });
    socket.emit('game:ready', { roomCode: props.roomCode });

    // If no game:state arrives within 3s, the game isn't running — go home
    const fallbackTimer = setTimeout(() => {
        if (!gameState()) navigate('/');
    }, 3000);

    onCleanup(() => {
        socket.off('game:state', onState);
        socket.off('room:error', onError);
        clearTimeout(fallbackTimer);
    });

    const gameType = () => roomState.room?.gameType ?? '';

    return (
        <div class="game-wrapper">
            <Show when={!gameState()}>
                <div class="game-loading">
                    <p>Waiting for game to start...</p>
                </div>
            </Show>
            <Show when={gameType() === 'snusregn' ? gameState() : null}>
                {(s) => (
                    <SnusregnGame
                        state={s() as SnusregnState}
                        roomCode={props.roomCode}
                        onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
                    />
                )}
            </Show>
        </div>
    );
}
