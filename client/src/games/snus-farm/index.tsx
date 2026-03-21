import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import type { FarmState, GameAction } from '@slutsnus/shared';
import { drawGame, drawEndScreen } from './render';
import { CANVAS_W, CANVAS_H } from './constants';

interface SnusFarmProps {
    state: FarmState;
    roomCode: string;
    onAction: (action: GameAction) => void;
}

export function SnusFarmGame(props: SnusFarmProps) {
    const socket = useSocket();
    const [authState] = useAuth();

    let canvasRef!: HTMLCanvasElement;

    const [currentState, setCurrentState] = createSignal<FarmState>(props.state);
    let rafId = 0;

    const myUserId = () => authState.user?.id ?? '';

    // ── Input ────────────────────────────────────────────────────────────────
    const keys = new Set<string>();
    let lastMoveEmit = 0;

    const getInputDelta = (): { dx: number; dy: number } => {
        let dx = 0, dy = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp'))    dy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown'))  dy += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
        return { dx, dy };
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
            e.preventDefault();
        }
        keys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

    // ── Render loop ──────────────────────────────────────────────────────────
    const renderLoop = () => {
        const ctx = canvasRef?.getContext('2d');
        if (!ctx) { rafId = requestAnimationFrame(renderLoop); return; }

        const state = currentState();

        if (state.status === 'playing') {
            // Emit movement throttled to 50ms
            const now = Date.now();
            if (now - lastMoveEmit >= 50) {
                lastMoveEmit = now;
                const { dx, dy } = getInputDelta();
                props.onAction({ type: 'farm:move', payload: { dx, dy } } as GameAction);
            }
            drawGame(ctx, state, myUserId());
        } else {
            drawEndScreen(ctx, state, myUserId());
        }

        rafId = requestAnimationFrame(renderLoop);
    };

    // ── Socket listener ──────────────────────────────────────────────────────
    const onGameState = ({ state }: { state: unknown }) => {
        setCurrentState(state as FarmState);
    };

    onMount(() => {
        socket.on('game:state', onGameState);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        rafId = requestAnimationFrame(renderLoop);
    });

    onCleanup(() => {
        socket.off('game:state', onGameState);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        cancelAnimationFrame(rafId);
    });

    return (
        <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '8px' }}>
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ 'max-width': '100%', display: 'block' }}
            />
            <Show when={currentState().status === 'playing'}>
                <div style={{ color: '#888', 'font-size': '12px' }}>
                    WASD / Arrow keys to move &nbsp;|&nbsp; Herd chickens into your pen
                </div>
            </Show>
            <Show when={currentState().status === 'ended'}>
                <div style={{ display: 'flex', gap: '12px', 'margin-top': '8px' }}>
                    <button
                        onClick={() => socket.emit('room:start', { roomCode: props.roomCode })}
                        style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '14px' }}
                    >
                        Play Again
                    </button>
                </div>
            </Show>
        </div>
    );
}
