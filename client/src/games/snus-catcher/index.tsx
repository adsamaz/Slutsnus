import { createStore } from 'solid-js/store';
import { onMount, onCleanup, Show } from 'solid-js';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import { drawFrame } from './render';
import type { SenusCatcherState, GameAction } from '@slutsnus/shared';
import './snus-catcher.css';

interface SenusCatcherGameProps {
    state: SenusCatcherState;
    roomCode: string;
    onAction: (action: unknown) => void;
}

export function SenusCatcherGame(props: SenusCatcherGameProps) {
    const socket = useSocket();
    const [authState] = useAuth();

    // createStore — NOT createSignal. Locked decision: prevents full re-render on every 20Hz tick.
    const [gameStore, setGameStore] = createStore<{ data: SenusCatcherState | null }>({
        data: props.state ?? null,
    });

    // Listen for game:state socket events and update store
    const onGameState = ({ state }: { state: unknown }) => {
        setGameStore('data', state as SenusCatcherState);
    };
    socket.on('game:state', onGameState);
    onCleanup(() => socket.off('game:state', onGameState));

    let canvasRef!: HTMLCanvasElement;
    // Client-authoritative bar position — updated immediately from mousemove, never from server
    let localBarX = 400; // default center of 800px canvas
    let lastEmit = 0;
    let rafId: number;

    onMount(() => {
        const ctx = canvasRef.getContext('2d')!;

        // rAF loop — MUST have onCleanup(cancelAnimationFrame) to prevent accumulation on remount
        const loop = () => {
            const state = gameStore.data;
            const selfId = authState.user?.id ?? '';
            if (state && state.status === 'playing') {
                drawFrame(ctx, canvasRef, state, selfId, localBarX);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        // Mouse tracking — client-authoritative bar rendering, throttled emit
        const onMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            // Scale mouse position to canvas logical resolution
            const scaleX = canvasRef.width / rect.width;
            localBarX = Math.max(0, Math.min(canvasRef.width, (e.clientX - rect.left) * scaleX));

            const now = Date.now();
            if (now - lastEmit >= 30) { // 30ms throttle — locked in STATE.md
                lastEmit = now;
                props.onAction({
                    type: 'snus-catcher:bar-move',
                    payload: { xFraction: localBarX / canvasRef.width },
                } as GameAction);
            }
        };

        canvasRef.addEventListener('mousemove', onMouseMove);

        onCleanup(() => {
            canvasRef.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(rafId); // Locked: must cancel rAF on cleanup
        });
    });

    const selfId = () => authState.user?.id ?? '';
    const state = () => gameStore.data;
    const ended = () => state()?.status === 'ended';

    const selfResult = () => state()?.results?.find(r => r.userId === selfId());
    const winner = () => state()?.results?.find(r => r.rank === 1);
    const isWinner = () => winner()?.userId === selfId();

    // Suppress unused variable warning — selfResult is available for future use
    void selfResult;

    return (
        <div class="snus-catcher-wrapper">
            <Show when={!ended()}>
                <canvas
                    ref={canvasRef}
                    class="snus-catcher-canvas"
                    width={800}
                    height={600}
                />
            </Show>
            <Show when={ended()}>
                <div class="snus-catcher-end-screen">
                    <h1>{isWinner() ? 'Du vann!' : `${winner()?.username ?? 'Motståndaren'} vann!`}</h1>
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th>Plats</th>
                                <th>Spelare</th>
                                <th>Poäng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state()?.results?.map(r => (
                                <tr class={r.userId === selfId() ? 'winner-row' : ''}>
                                    <td>#{r.rank}</td>
                                    <td>{r.username}</td>
                                    <td>{r.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button
                        class="snus-catcher-lobby-btn"
                        onClick={() => { window.location.href = '/'; }}
                    >
                        Tillbaka till lobbyn
                    </button>
                </div>
            </Show>
        </div>
    );
}
