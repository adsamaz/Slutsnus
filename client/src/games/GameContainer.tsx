import { createSignal, onCleanup, Show } from 'solid-js';
import { useSocket } from '../stores/socket';
import { useRoom } from '../stores/room';
import { useNavigate } from '@solidjs/router';
import SnusRpgGame from './snus-rpg/index';
import type { SnusRpgState } from '@slutsnus/shared';

interface GameContainerProps {
    roomCode: string;
}

type AnyGameState = SnusRpgState;

export default function GameContainer(props: GameContainerProps) {
    const socket = useSocket();
    const [roomState] = useRoom();
    const navigate = useNavigate();

    const [gameState, setGameState] = createSignal<AnyGameState | null>(null);
    const [ended, setEnded] = createSignal(false);

    const onState = ({ state }: { state: unknown }) => setGameState(state as AnyGameState);
    const onEnd = (_data: { results: unknown[] }) => {
        setEnded(true);
    };

    socket.on('game:state', onState);
    socket.on('game:end', onEnd);

    onCleanup(() => {
        socket.off('game:state', onState);
        socket.off('game:end', onEnd);
    });

    const gameType = () => roomState.room?.gameType ?? '';

    const handlePlayAgain = () => {
        navigate(`/lobby/${props.roomCode}`);
    };

    const handleLeaderboard = () => {
        navigate('/leaderboard');
    };

    return (
        <div class="game-wrapper">
            <Show when={!gameState()}>
                <div class="game-loading">
                    <p>Waiting for game to start...</p>
                </div>
            </Show>
            <Show when={gameState()}>
                {(state) => (
                    <Show when={gameType() === 'snus-rpg'}>
                        <SnusRpgGame
                            state={state() as SnusRpgState}
                            roomCode={props.roomCode}
                            ended={ended()}
                            onPlayAgain={handlePlayAgain}
                            onLeaderboard={handleLeaderboard}
                        />
                    </Show>
                )}
            </Show>
        </div>
    );
}
