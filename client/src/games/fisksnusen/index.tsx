import { createStore } from 'solid-js/store';
import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import { drawFrame, TREE_CAST_X_MIN, TREE_CAST_X_MAX } from './render';
import type { ScreenFlash, HitLabel } from './render';
import { CANVAS_W, CANVAS_H } from './constants';
import type { FiskeSnusState, GameAction, FiskePhase } from '@slutsnus/shared';
import {
    soundCast,
    soundNibble,
    soundBiteAlert,
    soundBoatAlert,
    soundSnusAlert,
    soundReelClick,
    soundReelMiss,
    soundStrikePerfect,
    soundStrikeGood,
    soundStrikeMiss,
    soundFishEscape,
    soundPerfektFiskesnus,
    soundSnusInWater,
    soundGameWin,
    soundGameLose,
    soundNo,
    soundStuckInTree,
    startBgMusic,
    stopBgMusic,
} from './sounds';

interface FiskeSnusGameProps {
    state: FiskeSnusState;
    roomCode: string;
    isSolo: boolean;
    onAction: (action: unknown) => void;
}

export function FiskeSnusGame(props: FiskeSnusGameProps) {
    const socket = useSocket();
    const [authState] = useAuth();

    const [gameStore, setGameStore] = createStore<{ data: FiskeSnusState | null }>({
        data: props.state ?? null,
    });

    const selfId = () => authState.user?.id ?? '';

    let canvasRef!: HTMLCanvasElement;
    let rafId: number;

    // Interpolation
    let prevState: FiskeSnusState | null = null;
    let lastStateAt = 0;

    // Mouse aim tracking (normalized 0–1 within self panel)
    let aimMouseX = 0.5;

    // Per-player previous phase tracking for sound triggers
    let prevPhases: Record<string, FiskePhase | undefined> = {};
    let prevNibbleCounts: Record<string, number> = {};
    let prevStatus = 'playing';

    // Flashes for perfect/miss result
    const flashes: ScreenFlash[] = [];
    // Hit labels that pop up on the meter after each strike
    const hitLabels: HitLabel[] = [];
    // Tree stuck: local timestamp used only for rendering the fade-out label
    let treeStuckUntil = 0;

    const addFlash = (color: string, alpha: number, duration: number) => {
        flashes.push({ color, alpha, expiresAt: performance.now() + duration, duration });
    };

    const addHitLabel = (result: 'perfect' | 'good' | 'miss') => {
        const now = performance.now();
        const duration = 700;
        const text = result === 'perfect' ? 'PERFECT!' : result === 'good' ? 'GOOD' : 'MISS';
        const color = result === 'perfect' ? '#ffe033' : result === 'good' ? '#88ff88' : '#ff4444';
        hitLabels.push({ text, color, expiresAt: now + duration, duration });
    };

    const onGameState = ({ state }: { state: unknown }) => {
        const next = state as FiskeSnusState;

        // Status change sounds
        if (next.status === 'ended' && prevStatus !== 'ended') {
            stopBgMusic();
            const selfResult = next.results?.find(r => r.userId === selfId());
            if (selfResult?.rank === 1) soundGameWin();
            else soundGameLose();
        }
        prevStatus = next.status;

        // Per-player sound triggers
        for (const player of next.players) {
            const pid = player.userId;
            const isSelfPlayer = pid === selfId();
            if (!isSelfPlayer) {
                const phasePrev = prevPhases[pid];
                if (phasePrev !== player.phase && player.phase === 'result') {
                    const fishCaught = player.stageResults.length >= 3 && player.stageResults[2] !== 'miss';
                    if (!fishCaught) soundNo();
                }
                prevPhases[pid] = player.phase;
                continue;
            }

            const phasePrev = prevPhases[pid];
            const phaseNow = player.phase;

            if (phasePrev !== phaseNow) {
                // Phase transition sounds
                if (phaseNow === 'casting' && phasePrev !== undefined) {
                    soundCast();
                } else if (phaseNow === 'bite') {
                    soundBiteAlert();
                } else if (phaseNow === 'boat') {
                    soundBoatAlert();
                } else if (phaseNow === 'snus') {
                    soundSnusAlert();
                } else if (phaseNow === 'result') {
                    const fishSize = player.lastFishSize;
                    const fishCaught = player.stageResults.length >= 3 && player.stageResults[2] !== 'miss';
                    const snusMiss = player.stageResults.length >= 4 && player.stageResults[3] === 'miss';

                    if (fishSize === 'big') {
                        soundPerfektFiskesnus();
                        addFlash('rgba(255,220,0)', 0.5, 600);
                    } else if (!fishCaught) {
                        soundFishEscape();
                        addFlash('rgba(200,50,50)', 0.35, 400);
                    } else if (snusMiss) {
                        soundSnusInWater();
                    } else if (fishSize === 'medium') {
                        soundStrikeGood();
                        addFlash('rgba(136,255,136)', 0.2, 350);
                    } else if (fishSize === 'small') {
                        soundStrikeGood();
                        // no flash for small fish — muted result
                    }
                }
                prevPhases[pid] = phaseNow;
            }

            // Nibble sounds
            const nibblePrev = prevNibbleCounts[pid] ?? 0;
            if (player.nibbleCount > nibblePrev) {
                soundNibble();
            }
            prevNibbleCounts[pid] = player.nibbleCount;

            // Reel sounds
            if (player.phase === 'reel') {
                const prevPlayer = prevState?.players.find(p => p.userId === pid);
                // Click when progress advances (player nudged into zone)
                const prevProgress = prevPlayer?.reelProgress ?? 0;
                if (player.reelProgress > prevProgress + 0.04) {
                    soundReelClick();
                }
                // Danger sound when bar leaves safe zone
                if (player.reelInDanger && !prevPlayer?.reelInDanger) {
                    soundReelMiss();
                }
            }

            // Stage result sounds (when lastStageResult changes)
            const lastResult = player.lastStageResult;
            const prevPlayer = prevState?.players.find(p => p.userId === pid);
            const prevLastResult = prevPlayer?.lastStageResult;
            if (lastResult !== prevLastResult && lastResult !== null) {
                if (lastResult === 'perfect' && player.phase !== 'result') {
                    soundStrikePerfect();
                    addHitLabel('perfect');
                } else if (lastResult === 'good' && player.phase !== 'result') {
                    soundStrikeGood();
                    addHitLabel('good');
                } else if (lastResult === 'miss' && player.phase !== 'result') {
                    soundStrikeMiss();
                    addHitLabel('miss');
                }
            }
        }

        prevState = gameStore.data;
        lastStateAt = performance.now();
        setGameStore('data', next);
    };

    onMount(() => {
        socket.on('game:state', onGameState);
        startBgMusic();

        const ctx = canvasRef.getContext('2d')!;

        // Handle space bar
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code !== 'Space' || e.repeat) return;
            const state = gameStore.data;
            if (!state || state.status !== 'playing') return;
            const self = state.players.find(p => p.userId === selfId());
            if (!self) return;
            const actionPhases: FiskePhase[] = ['bite', 'reel', 'boat', 'snus'];
            if (!actionPhases.includes(self.phase)) return;
            e.preventDefault();
            props.onAction({ type: 'fisksnusen:strike' } as GameAction);
        };

        // Track mouse position over self panel for aiming
        const onMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            const scaleX = canvasRef.width / rect.width;
            const px = (e.clientX - rect.left) * scaleX;
            aimMouseX = Math.max(0, Math.min(1, px / (canvasRef.width / 2)));
        };

        // Click to cast during aiming phase
        const onMouseClick = (e: MouseEvent) => {
            const state = gameStore.data;
            if (!state || state.status !== 'playing') return;
            const self = state.players.find(p => p.userId === selfId());
            if (!self || self.phase !== 'aiming') return;
            e.preventDefault();
            if (aimMouseX >= TREE_CAST_X_MIN && aimMouseX <= TREE_CAST_X_MAX) {
                // Hooked the tree — tell the server; set local timer for label fade-out
                treeStuckUntil = performance.now() + 3000;
                soundStuckInTree();
                props.onAction({ type: 'fisksnusen:tree-hit' } as GameAction);
                return;
            }
            props.onAction({ type: 'fisksnusen:cast', castX: aimMouseX } as GameAction);
        };

        window.addEventListener('keydown', onKeyDown);
        canvasRef.addEventListener('mousemove', onMouseMove);
        canvasRef.addEventListener('click', onMouseClick);

        const loop = () => {
            const state = gameStore.data;
            if (state && state.status === 'playing') {
                const now = performance.now();
                const elapsedMs = lastStateAt > 0 ? now - lastStateAt : 0;

                // Expire flashes
                let expired = 0;
                while (expired < flashes.length && flashes[expired].expiresAt <= now) expired++;
                if (expired > 0) flashes.splice(0, expired);

                // Expire hit labels
                let expiredLabels = 0;
                while (expiredLabels < hitLabels.length && hitLabels[expiredLabels].expiresAt <= now) expiredLabels++;
                if (expiredLabels > 0) hitLabels.splice(0, expiredLabels);

                drawFrame(ctx, canvasRef, state, selfId(), prevState, elapsedMs, now, flashes, aimMouseX, hitLabels, treeStuckUntil);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        onCleanup(() => {
            socket.off('game:state', onGameState);
            window.removeEventListener('keydown', onKeyDown);
            canvasRef.removeEventListener('mousemove', onMouseMove);
            canvasRef.removeEventListener('click', onMouseClick);
            cancelAnimationFrame(rafId);
            stopBgMusic();
        });
    });

    const state = () => gameStore.data;
    const ended = () => state()?.status === 'ended';
    const winner = () => state()?.results?.find(r => r.rank === 1);
    const isWinner = () => winner()?.userId === selfId();
    const isSolo = () => {
        const players = state()?.players ?? [];
        return players.length < 2 || players.every(p => p.userId === selfId() || p.isBot);
    };

    const [actionPending, setActionPending] = createSignal<'play-again' | 'lobby' | null>(null);

    return (
        <div class="fisksnusen-wrapper">
            <div style={{ display: ended() ? 'none' : 'flex', 'flex-direction': 'column', 'align-items': 'stretch' }}>
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    style={{ 'max-width': '100%', display: 'block' }}
                />
                <div style={{ 'text-align': 'center', color: 'rgba(255,255,255,0.5)', 'font-size': '12px', 'margin-top': '6px', 'font-family': 'monospace' }}>
                    Move mouse to aim · Click to cast · Space to strike/reel/snus
                </div>
            </div>
            <Show when={ended()}>
                <div class="snusregn-end-screen">
                    <h1 class={`snusregn-end-title ${isWinner() ? 'win' : 'lose'}`}>
                        {!isWinner()
                            ? 'Säg det inte'
                            : isSolo()
                                ? 'Good fishing!'
                                : 'You won!'}
                    </h1>
                    <div class="snusregn-end-body">
                        <div class="snusregn-end-scores">
                            {state()?.results?.map(r => (
                                <div class={`snusregn-end-score-row${r.userId === selfId() ? ' self' : ''}`}>
                                    {!isSolo() && <span class="rank">#{r.rank}</span>}
                                    <span class="name">{r.username}</span>
                                    <span class="score">{r.score}<span class="score-unit"> pts</span></span>
                                </div>
                            ))}
                        </div>
                        <div class="snusregn-end-actions">
                            <button
                                class={`snusregn-lobby-btn snusregn-play-again-btn${actionPending() === 'play-again' ? ' snusregn-btn-loading' : ''}`}
                                disabled={actionPending() !== null}
                                onClick={() => {
                                    setActionPending('play-again');
                                    if (isSolo()) {
                                        prevPhases = {};
                                        prevNibbleCounts = {};
                                        prevStatus = 'playing';
                                        flashes.length = 0;
                                        hitLabels.length = 0;
                                        socket.emit('room:start', { roomCode: props.roomCode });
                                        setGameStore('data', null);
                                        startBgMusic();
                                    } else {
                                        window.location.href = `/lobby/${props.roomCode}`;
                                    }
                                }}
                            >
                                {actionPending() === 'play-again' ? 'Loading…' : 'Play again'}
                            </button>
                            <button
                                class={`snusregn-lobby-btn${actionPending() === 'lobby' ? ' snusregn-btn-loading' : ''}`}
                                disabled={actionPending() !== null}
                                onClick={() => {
                                    setActionPending('lobby');
                                    window.location.href = '/';
                                }}
                            >
                                {actionPending() === 'lobby' ? 'Loading…' : 'Back'}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
