import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import type { ArenaState, GameAction } from '@slutsnus/shared';
import { drawClassSelect, drawGame, drawEndScreen, getClassCardAtPoint } from './render';
import { CANVAS_W, CANVAS_H } from './constants';

interface SnusArenaProps {
    state: ArenaState;
    roomCode: string;
    onAction: (action: GameAction) => void;
}

const TICK_MS = 20;

export function SnusArenaGame(props: SnusArenaProps) {
    const socket = useSocket();
    const [authState] = useAuth();

    let canvasRef!: HTMLCanvasElement;

    const [currentState, setCurrentState] = createSignal<ArenaState>(props.state);
    const [prevState, setPrevState] = createSignal<ArenaState | null>(null);
    const [lastStateAt, setLastStateAt] = createSignal(Date.now());
    let rafId = 0;

    const myUserId = () => authState.user?.id ?? '';

    // ── Input state ──────────────────────────────────────────────────────────

    const keys = new Set<string>();
    let lastMoveEmit = 0;
    let lastAimEmit = 0;

    const getInputDelta = (): { dx: number; dy: number } => {
        let dx = 0, dy = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp'))    dy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown'))  dy += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft'))  dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
        return { dx, dy };
    };

    const onKeyDown = (e: KeyboardEvent) => {
        keys.add(e.code);

        // Ability keys
        if (currentState().status === 'playing') {
            if (e.code === 'KeyR' && !e.repeat) props.onAction({ type: 'arena:ability', payload: { slot: 'W' } } as GameAction);
        }
    };

    const onKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (currentState().status !== 'playing') return;
        const now = Date.now();
        if (now - lastAimEmit < 16) return;
        lastAimEmit = now;

        const rect = canvasRef.getBoundingClientRect();
        const me = currentState().players.find(p => p.userId === myUserId());
        if (!me) return;

        // Scale mouse coords to logical canvas coords
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const angle = Math.atan2(cy - me.y, cx - me.x);
        props.onAction({ type: 'arena:aim', payload: { angle } } as GameAction);
    };

    const onCanvasClick = (e: MouseEvent) => {
        if (currentState().status === 'selecting') {
            const me = currentState().players.find(p => p.userId === myUserId());
            if (me?.class !== null) return; // already selected
            const rect = canvasRef.getBoundingClientRect();
            const cls = getClassCardAtPoint(e.clientX, e.clientY, rect);
            if (cls) {
                props.onAction({ type: 'arena:select-class', payload: { class: cls } } as GameAction);
            }
            return;
        }
        if (currentState().status === 'playing') {
            if (e.button === 0) props.onAction({ type: 'arena:ability', payload: { slot: 'Q' } } as GameAction);
            if (e.button === 2) props.onAction({ type: 'arena:ability', payload: { slot: 'E' } } as GameAction);
        }
    };

    // ── Render loop ──────────────────────────────────────────────────────────

    const renderLoop = () => {
        const ctx = canvasRef?.getContext('2d');
        if (!ctx) { rafId = requestAnimationFrame(renderLoop); return; }

        const state = currentState();
        const alpha = Math.min(1, (Date.now() - lastStateAt()) / TICK_MS);

        if (state.status === 'selecting') {
            drawClassSelect(ctx, myUserId(), state, () => {}, null);
        } else if (state.status === 'playing') {
            // Emit movement throttled to 50ms
            const now = Date.now();
            if (now - lastMoveEmit >= 50) {
                lastMoveEmit = now;
                const { dx, dy } = getInputDelta();
                props.onAction({ type: 'arena:move', payload: { dx, dy } } as GameAction);
            }
            drawGame(ctx, state, prevState(), alpha, myUserId());
        } else {
            drawEndScreen(ctx, state, myUserId());
        }

        rafId = requestAnimationFrame(renderLoop);
    };

    // ── Socket listener ──────────────────────────────────────────────────────

    const onGameState = ({ state }: { state: unknown }) => {
        const next = state as ArenaState;
        setPrevState(currentState());
        setCurrentState(next);
        setLastStateAt(Date.now());
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    onMount(() => {
        socket.on('game:state', onGameState);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvasRef.addEventListener('mousemove', onMouseMove);
        canvasRef.addEventListener('mousedown', onCanvasClick);
        canvasRef.addEventListener('contextmenu', onContextMenu);
        rafId = requestAnimationFrame(renderLoop);
    });

    onCleanup(() => {
        socket.off('game:state', onGameState);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        if (canvasRef) {
            canvasRef.removeEventListener('mousemove', onMouseMove);
            canvasRef.removeEventListener('mousedown', onCanvasClick);
            canvasRef.removeEventListener('contextmenu', onContextMenu);
        }
        cancelAnimationFrame(rafId);
    });

    // ── Mode selector (shown before host starts) ─────────────────────────────
    // This is rendered as HTML since it's needed on the lobby page.
    // GameContainer passes mode via room:start payload.

    return (
        <div class="snus-arena-wrapper" style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '8px' }}>
            <Show when={currentState().status === 'selecting'}>
                <div style={{ color: '#aaa', 'font-size': '13px' }}>
                    Click a class card on the canvas to select your class
                </div>
            </Show>
            <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                style={{ cursor: 'crosshair', 'max-width': '100%' }}
            />
            <Show when={currentState().status === 'playing'}>
                <div style={{ color: '#888', 'font-size': '12px' }}>
                    WASD to move &nbsp;|&nbsp; LMB / RMB / R for abilities
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

