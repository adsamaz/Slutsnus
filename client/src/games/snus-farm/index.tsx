import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import type { FarmState, GameAction } from '@slutsnus/shared';
import { drawGame, drawEndScreen } from './render';
import { CANVAS_W, CANVAS_H } from './constants';
import { soundFarmStart, soundChickenCaptured, soundFarmMilestone, soundFarmWin, soundFarmLose, soundSnusPickup, soundSnusSpawn } from './sounds';

interface SnusFarmProps {
    state: FarmState;
    roomCode: string;
    isSolo: boolean;
    onAction: (action: GameAction) => void;
}

export function SnusFarmGame(props: SnusFarmProps) {
    const socket = useSocket();
    const [authState] = useAuth();
    const navigate = useNavigate();

    let canvasRef!: HTMLCanvasElement;

    const [currentState, setCurrentState] = createSignal<FarmState>(props.state);
    let rafId = 0;

    const myUserId = () => authState.user?.id ?? '';

    // ── Sound state tracking ─────────────────────────────────────────────────

    let prevScores = new Map<string, number>();
    let soundedGameEnd = false;
    let prevSnusId: string | null = null;

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

    // ── Sound logic ──────────────────────────────────────────────────────────

    const processSounds = (next: FarmState) => {
        if (next.status === 'playing') {
            for (const player of next.players) {
                const prevScore = prevScores.get(player.userId) ?? player.score;
                if (player.score > prevScore) {
                    const gained = player.score - prevScore;
                    // Play capture sound for each chicken gained
                    for (let i = 0; i < gained; i++) soundChickenCaptured();
                    // Milestone every 5 points
                    const prevMilestone = Math.floor(prevScore / 5);
                    const nextMilestone = Math.floor(player.score / 5);
                    if (nextMilestone > prevMilestone && player.score > 0) {
                        soundFarmMilestone();
                    }
                }
                prevScores.set(player.userId, player.score);
            }
        }

        // Snus spawned: was absent, now present
        if (prevSnusId === null && next.snus !== null) {
            soundSnusSpawn();
        }
        // Snus picked up: was present, now gone
        if (prevSnusId !== null && next.snus === null) {
            soundSnusPickup();
        }
        prevSnusId = next.snus?.id ?? null;

        if (next.status === 'ended' && !soundedGameEnd) {
            soundedGameEnd = true;
            const myResult = next.results?.find(r => r.userId === myUserId());
            const won = myResult?.rank === 1;
            if (won) soundFarmWin();
            else soundFarmLose();
        }
    };

    // ── Socket listener ──────────────────────────────────────────────────────
    const onGameState = ({ state }: { state: unknown }) => {
        const next = state as FarmState;
        processSounds(next);
        setCurrentState(next);
    };

    onMount(() => {
        soundFarmStart();

        // Seed score tracking
        for (const p of props.state.players) {
            prevScores.set(p.userId, p.score);
        }

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
                        onClick={() => {
                            if (props.isSolo) {
                                socket.emit('room:start', { roomCode: props.roomCode });
                            } else {
                                navigate(`/lobby/${props.roomCode}`);
                            }
                        }}
                        style={{ padding: '8px 20px', background: '#2563eb', color: '#fff', border: 'none', 'border-radius': '6px', cursor: 'pointer', 'font-size': '14px' }}
                    >
                        Play Again
                    </button>
                </div>
            </Show>
        </div>
    );
}
