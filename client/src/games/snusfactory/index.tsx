import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import type { FactoryState, GameAction } from '@slutsnus/shared';
import { drawGame, drawEndScreen, triggerScoreFlash, triggerShake } from './render';
import { CANVAS_W, CANVAS_H, STATION_RECTS, PLAYER_INTERACT_RADIUS, ORDER_INTERACT_RADIUS } from './constants';
import type { StationType } from '@slutsnus/shared';
import {
    soundPickup, soundPlant, soundRipe,
    soundGrindStart, soundPackageStart,
    soundSell, soundNewOrder, soundOrderExpire,
    soundTimeLow, soundGameEnd, soundSnusPouch,
    startBgMusic, stopBgMusic,
} from './sounds';

interface SnusFactoryProps {
    state: FactoryState;
    roomCode: string;
    isSolo: boolean;
    onAction: (action: GameAction) => void;
}

export function SnusFactoryGame(props: SnusFactoryProps) {
    const socket = useSocket();
    const [authState] = useAuth();
    const navigate = useNavigate();

    let canvasRef!: HTMLCanvasElement;
    const [currentState, setCurrentState] = createSignal<FactoryState>(props.state);
    let rafId = 0;

    const myUserId = () => authState.user?.id ?? '';

    // ── Mouse state ──────────────────────────────────────────────────────────
    let mouseCanvasX = -1;
    let mouseCanvasY = -1;

    const getCanvasScale = () => {
        if (!canvasRef) return 1;
        return canvasRef.getBoundingClientRect().width / CANVAS_W;
    };

    const stationIdAtPoint = (cx: number, cy: number): StationType | null => {
        for (const [id, rect] of Object.entries(STATION_RECTS) as [StationType, typeof STATION_RECTS[StationType]][]) {
            if (cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h) {
                return id;
            }
        }
        return null;
    };

    const nearestStationToPlayer = (px: number, py: number): StationType | null => {
        let nearest: StationType | null = null;
        let nearestDist = Infinity;
        for (const [id, rect] of Object.entries(STATION_RECTS) as [StationType, typeof STATION_RECTS[StationType]][]) {
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            const dist = Math.hypot(px - cx, py - cy);
            const radius = id.startsWith('order-') ? ORDER_INTERACT_RADIUS : PLAYER_INTERACT_RADIUS;
            if (dist < radius && dist < nearestDist) {
                nearestDist = dist;
                nearest = id;
            }
        }
        return nearest;
    };

    // ── Sound tracking ───────────────────────────────────────────────────────

    let prevScore = 0;
    let prevOrderStates = new Map<string, number>(); // id → state (-1=empty)
    let prevPatchStates = new Map<string, number>(); // id → state
    let prevCarrying = new Map<string, string | null>(); // userId → item
    let prevSpeedBoost = new Map<string, number>(); // userId → speedBoostTicks
    let soundedGameEnd = false;
    let timeLowSounded = false;

    const initTracking = (state: FactoryState) => {
        prevScore = state.score;
        for (const s of state.stations) {
            if (s.id.startsWith('order-')) prevOrderStates.set(s.id, s.state);
            if (s.id.startsWith('patch-')) prevPatchStates.set(s.id, s.state);
        }
        for (const p of state.players) {
            prevCarrying.set(p.userId, p.carrying);
            prevSpeedBoost.set(p.userId, p.speedBoostTicks);
        }
    };

    const processSounds = (next: FactoryState) => {
        if (next.status === 'playing' && !soundedGameEnd) {
            startBgMusic();
        }

        if (next.status === 'playing') {
            // Snapshot score before updating so we can detect direction of change
            const oldScore = prevScore;

            // Score increased → sell sound + visual flash
            if (next.score > oldScore) {
                soundSell();
                triggerScoreFlash('#4eff8a');
            }
            prevScore = next.score;

            // Time low (once at 30s)
            if (!timeLowSounded && next.timeRemainingTicks <= 1500 && next.timeRemainingTicks > 0) {
                timeLowSounded = true;
                soundTimeLow();
            }

            // Orders: new order appeared, or expired
            for (const station of next.stations) {
                if (!station.id.startsWith('order-')) continue;
                const prev = prevOrderStates.get(station.id) ?? -1;
                if (prev === -1 && station.state > 0) {
                    soundNewOrder();
                } else if (prev > 0 && station.state === -1) {
                    // Was active, now cleared — expiry if score dropped, fulfillment if score rose
                    if (next.score <= oldScore) {
                        soundOrderExpire();
                        triggerShake(5, 10);
                    }
                }
                prevOrderStates.set(station.id, station.state);
            }

            // Patches: went from growing → ripe (-1)
            for (const station of next.stations) {
                if (!station.id.startsWith('patch-')) continue;
                const prev = prevPatchStates.get(station.id) ?? 0;
                if (prev > 0 && station.state === -1) soundRipe();
                prevPatchStates.set(station.id, station.state);
            }

            // Player carrying changes: pickup / plant
            for (const player of next.players) {
                const prev = prevCarrying.get(player.userId) ?? null;
                if (prev === null && player.carrying !== null) {
                    soundPickup();
                } else if (prev !== null && player.carrying === null) {
                    soundPlant();
                } else if (prev !== null && player.carrying !== null && prev !== player.carrying) {
                    soundPickup();
                }
                prevCarrying.set(player.userId, player.carrying);

                // Snus pouch collected: speedBoostTicks just went from 0 → positive
                const prevBoost = prevSpeedBoost.get(player.userId) ?? 0;
                if (prevBoost === 0 && player.speedBoostTicks > 0) {
                    soundSnusPouch();
                    triggerScoreFlash('#ffe04a');
                }
                prevSpeedBoost.set(player.userId, player.speedBoostTicks);
            }

            // Grinder / packager started processing
            for (const station of next.stations) {
                if (station.id === 'grinder') {
                    const prevState = prevOrderStates.get('_grinder') ?? 0;
                    if (prevState === 0 && station.state > 0) soundGrindStart();
                    prevOrderStates.set('_grinder', station.state);
                }
                if (station.id === 'packager') {
                    const prevState = prevOrderStates.get('_packager') ?? 0;
                    if (prevState === 0 && station.state > 0) soundPackageStart();
                    prevOrderStates.set('_packager', station.state);
                }
            }
        }

        if (next.status === 'ended' && !soundedGameEnd) {
            soundedGameEnd = true;
            stopBgMusic();
            const won = next.score >= next.targetScore;
            soundGameEnd(won);
        }
    };

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
        const movement = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (movement.includes(e.code) || e.code === 'KeyQ') e.preventDefault();
        keys.add(e.code);

        if (e.code === 'KeyQ') {
            props.onAction({ type: 'factory:drop' } as GameAction);
        }
    };

    const onKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.code);
    };

    const onMouseMove = (e: MouseEvent) => {
        if (!canvasRef) return;
        const scale = getCanvasScale();
        const rect = canvasRef.getBoundingClientRect();
        mouseCanvasX = (e.clientX - rect.left) / scale;
        mouseCanvasY = (e.clientY - rect.top) / scale;

        const hoveredStation = stationIdAtPoint(mouseCanvasX, mouseCanvasY);
        const state = currentState();
        const me = state.players.find(p => p.userId === myUserId());
        const interactable = me ? nearestStationToPlayer(me.x, me.y) : null;
        canvasRef.style.cursor = (hoveredStation && hoveredStation === interactable) ? 'pointer' : (hoveredStation ? 'pointer' : 'default');
    };

    const onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        const state = currentState();
        if (state.status !== 'playing') return;
        props.onAction({ type: 'factory:drop' } as GameAction);
    };

    const grinderSlotAtPoint = (cx: number, cy: number, state: ReturnType<typeof currentState>): 'leaf' | 'flavor' | null => {
        const grinder = state.stations.find(s => s.id === 'grinder');
        if (!grinder) return null;
        const gr = STATION_RECTS['grinder'];
        const slotW = 32, slotH = 32, slotGap = 6;
        const slotX = gr.x + gr.w / 2 - slotW / 2;
        const leafSlotY = gr.y + (gr.h - slotH * 2 - slotGap) / 2;
        const flavSlotY = leafSlotY + slotH + slotGap;
        if (grinder.leafLoaded && cx >= slotX && cx <= slotX + slotW && cy >= leafSlotY && cy <= leafSlotY + slotH) return 'leaf';
        if (grinder.flavorLoaded && cx >= slotX && cx <= slotX + slotW && cy >= flavSlotY && cy <= flavSlotY + slotH) return 'flavor';
        return null;
    };

    const onMouseClick = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const state = currentState();
        if (state.status !== 'playing') return;
        const me = state.players.find(p => p.userId === myUserId());
        if (!me) return;

        // Check grinder input slot clicks first
        const slot = grinderSlotAtPoint(mouseCanvasX, mouseCanvasY, state);
        if (slot && me.carrying === null) {
            const grinderDist = (() => {
                const gr = STATION_RECTS['grinder'];
                return Math.hypot(me.x - (gr.x + gr.w / 2), me.y - (gr.y + gr.h / 2));
            })();
            if (grinderDist < PLAYER_INTERACT_RADIUS) {
                props.onAction({ type: 'factory:grinder-slot-pickup', payload: { slot } } as GameAction);
                return;
            }
        }

        const interactable = nearestStationToPlayer(me.x, me.y);
        if (interactable) {
            props.onAction({ type: 'factory:interact', payload: { interacting: true } } as GameAction);
            // Send release on next tick so server sees edge
            setTimeout(() => {
                props.onAction({ type: 'factory:interact', payload: { interacting: false } } as GameAction);
            }, 50);
        }
    };

    // ── Render loop ──────────────────────────────────────────────────────────

    const renderLoop = () => {
        const ctx = canvasRef?.getContext('2d');
        if (!ctx) { rafId = requestAnimationFrame(renderLoop); return; }

        const state = currentState();

        if (state.status === 'playing') {
            const now = Date.now();
            if (now - lastMoveEmit >= 50) {
                lastMoveEmit = now;
                const { dx, dy } = getInputDelta();
                props.onAction({ type: 'factory:move', payload: { dx, dy } } as GameAction);
            }
            const me = state.players.find(p => p.userId === myUserId());
            const hoveredStation = stationIdAtPoint(mouseCanvasX, mouseCanvasY);
            const interactableStation = me ? nearestStationToPlayer(me.x, me.y) : null;
            drawGame(ctx, state, myUserId(), hoveredStation, interactableStation);
        } else {
            drawEndScreen(ctx, state, myUserId());
        }

        rafId = requestAnimationFrame(renderLoop);
    };

    // ── Socket listener ──────────────────────────────────────────────────────

    const onGameState = ({ state }: { state: unknown }) => {
        const next = state as FactoryState;
        processSounds(next);
        setCurrentState(next);
    };

    onMount(() => {
        initTracking(props.state);

        if (props.state.status === 'playing') startBgMusic();

        socket.on('game:state', onGameState);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        canvasRef.addEventListener('mousemove', onMouseMove);
        canvasRef.addEventListener('click', onMouseClick);
        canvasRef.addEventListener('contextmenu', onContextMenu);
        rafId = requestAnimationFrame(renderLoop);
    });

    onCleanup(() => {
        stopBgMusic();
        socket.off('game:state', onGameState);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvasRef.removeEventListener('mousemove', onMouseMove);
        canvasRef.removeEventListener('click', onMouseClick);
        canvasRef.removeEventListener('contextmenu', onContextMenu);
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
                    WASD to move &nbsp;|&nbsp; Click to interact &nbsp;|&nbsp; Right click to discard item
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
                        style={{ padding: '0.75rem 2rem', background: '#1f6feb', color: '#e6edf3', border: 'none', 'border-radius': '8px', cursor: 'pointer', 'font-size': '1.1rem', 'font-weight': '700', 'font-family': 'monospace' }}
                    >
                        Play again
                    </button>
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        style={{ padding: '0.75rem 2rem', background: '#238636', color: '#e6edf3', border: 'none', 'border-radius': '8px', cursor: 'pointer', 'font-size': '1.1rem', 'font-weight': '700', 'font-family': 'monospace' }}
                    >
                        Back to start
                    </button>
                </div>
            </Show>
        </div>
    );
}
