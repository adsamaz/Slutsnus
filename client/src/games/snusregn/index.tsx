import { createStore } from 'solid-js/store';
import { createEffect, createMemo, createResource, createSignal, For, onMount, onCleanup, Show } from 'solid-js';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import { drawFrame, LANE_W, LANE_GAP, BAR_WIDTH_DEFAULT, EFFECT_COLORS, EFFECT_LABELS, EFFECT_MAX_TICKS, OPPONENT_EFFECTS } from './render';
import type { ItemBitmaps, ScreenFlash } from './render';
import bjudlocketSrc from '../../assets/bjudlocket.webp';
import snusiconSrc from '../../assets/snusicon.webp';
import type { SnusregnState, GameAction, SnusregnEffectType } from '@slutsnus/shared';
import { soundFreshCatch, soundFreshCatchBeer, soundLifeLost, soundPowerup, soundDebuff, soundGameStart } from './sounds';
import './snusregn.css';

interface SnusregnGameProps {
    state: SnusregnState;
    roomCode: string;
    onAction: (action: unknown) => void;
    imgs: Record<string, HTMLImageElement>;
    bitmaps: ItemBitmaps;
}

export function SnusregnGame(props: SnusregnGameProps) {
    const socket = useSocket();
    const [authState] = useAuth();

    const [gameStore, setGameStore] = createStore<{ data: SnusregnState | null }>({
        data: props.state ?? null,
    });

    const BAR_Y_FROM_BOTTOM = 20 + 18; // must match engine: BAR_Y_FROM_BOTTOM + BAR_HEIGHT

    const onGameState = ({ state }: { state: unknown }) => {
        const next = state as SnusregnState;
        const selfId = authState.user?.id ?? '';
        const selfNext = next.players.find(p => p.userId === selfId);
        if (selfNext) {
            const scoreDiff = selfNext.score - prevScore;
            const livesDiff = selfNext.lives - prevLives;
            const barYPx = 900 - BAR_Y_FROM_BOTTOM;
            const currentEffectTypes = selfNext.effects.map(e => e.type);
            const newEffects = currentEffectTypes.filter(t => !prevEffectTypes.includes(t));

            if (scoreDiff !== 0) {
                const dur = 700;
                popups.push({
                    text: scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`,
                    color: scoreDiff >= 3 ? '#ffe033' : scoreDiff > 0 ? '#39d353' : '#f85149',
                    x: localBarXFraction * LANE_W,
                    y: barYPx,
                    duration: dur,
                    expiresAt: performance.now() + dur,
                });
                if (scoreDiff >= 3) soundFreshCatchBeer();
                else if (scoreDiff > 0) soundFreshCatch();

                // Flash rounded score on every 100-point milestone
                const prevMilestone = Math.floor(prevScore / 100);
                const nextMilestone = Math.floor(selfNext.score / 100);
                if (nextMilestone > prevMilestone && selfNext.score > 0) {
                    popups.push({
                        text: `${nextMilestone * 100}`,
                        color: '#ffe033',
                        x: LANE_W / 2,
                        y: 450,
                        duration: 1800,
                        expiresAt: performance.now() + 1800,
                        milestone: true,
                    });
                }
            }
            if (livesDiff < 0) {
                const dur = 900;
                popups.push({
                    text: `♥ -1`,
                    color: '#f85149',
                    x: LANE_W / 2,
                    y: 450,
                    duration: dur,
                    expiresAt: performance.now() + dur,
                    large: true,
                });
                flashes.push({
                    color: '#f85149',
                    duration: 350,
                    expiresAt: performance.now() + 350,
                });
                soundLifeLost();
            }
            for (const t of newEffects) {
                const effect = selfNext.effects.find(e => e.type === t);
                if (effect) effectMaxTicks.set(t, effect.remainingTicks);
                if (t === 'wideBar' || t === 'slowRain' || t === 'beer') soundPowerup();
                else soundDebuff();
            }
            // Remove entries for effects that have expired
            for (const t of prevEffectTypes) {
                if (!currentEffectTypes.includes(t)) effectMaxTicks.delete(t);
            }

            prevScore = selfNext.score;
            prevLives = selfNext.lives;
            prevEffectTypes = currentEffectTypes;

            // Keep cached half-bar width in sync with current effects
            localHalfBar = (BAR_WIDTH_DEFAULT / 2)
                * (selfNext.effects.some(e => e.type === 'wideBar') ? 2 : 1)
                * (selfNext.effects.some(e => e.type === 'shrinkBar') ? 0.5 : 1);
        }
        prevStateForInterp = gameStore.data;
        lastStateAt = performance.now();
        setGameStore('data', next);
    };
    socket.on('game:state', onGameState);
    onCleanup(() => socket.off('game:state', onGameState));

    let canvasRef!: HTMLCanvasElement;
    let localBarXFraction = 0.5;
    let localHalfBar = BAR_WIDTH_DEFAULT / 2;
    let lastEmit = 0;
    let rafId: number;
    const _selfId = authState.user?.id ?? '';
    const _initialSelf = props.state?.players.find(p => p.userId === _selfId);
    let prevScore = _initialSelf?.score ?? 0;
    let prevLives = _initialSelf?.lives ?? 0;
    let prevEffectTypes: SnusregnEffectType[] = _initialSelf?.effects.map(e => e.type) ?? [];
    const effectMaxTicks = new Map<SnusregnEffectType, number>();
    const popups: import('./render').ScorePopup[] = [];
    const flashes: ScreenFlash[] = [];
    // Interpolation: track when the last two states were received
    let prevStateForInterp: SnusregnState | null = null;
    let lastStateAt = 0;
    const SERVER_TICK_MS = 20;
    const imgs = props.imgs;
    let bitmaps: ItemBitmaps = props.bitmaps;
    const barMovePayload = { xFraction: 0.5 };
    const barMoveAction = { type: 'snusregn:bar-move', payload: barMovePayload } as GameAction;

    onMount(() => {
        soundGameStart();
        const ctx = canvasRef.getContext('2d')!;

        // Pre-size the canvas to avoid an expensive resize on the first rendered frame
        const initialPlayerCount = props.state?.players.length ?? 1;
        const hasOpponent = initialPlayerCount > 1 && props.state?.players.some(p => p.userId !== (_selfId));
        const initialW = hasOpponent ? LANE_W * 2 + LANE_GAP : LANE_W;
        if (canvasRef.width !== initialW) canvasRef.width = initialW;

        let cachedRect = canvasRef.getBoundingClientRect();
        const updateRect = () => { cachedRect = canvasRef.getBoundingClientRect(); };
        window.addEventListener('resize', updateRect);

        const loop = () => {
            const state = gameStore.data;
            const selfId = authState.user?.id ?? '';
            const now = performance.now();
            // Expire old popups and flashes (single splice instead of repeated shift)
            let expired = 0;
            while (expired < popups.length && popups[expired].expiresAt <= now) expired++;
            if (expired > 0) popups.splice(0, expired);
            expired = 0;
            while (expired < flashes.length && flashes[expired].expiresAt <= now) expired++;
            if (expired > 0) flashes.splice(0, expired);
            if (state && state.status === 'playing') {
                const elapsedMs = lastStateAt > 0 ? now - lastStateAt : 0;
                drawFrame(ctx, canvasRef, state, selfId, localBarXFraction, imgs, popups, bitmaps, flashes, prevStateForInterp, elapsedMs, now);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        const onMouseMove = (e: MouseEvent) => {
            const rect = cachedRect;
            const rawX = (e.clientX - rect.left) * (canvasRef.width / rect.width);
            const laneX = Math.max(localHalfBar, Math.min(LANE_W - localHalfBar, rawX));
            localBarXFraction = laneX / LANE_W;

            const now = performance.now();
            if (now - lastEmit >= 16) {
                lastEmit = now;
                barMovePayload.xFraction = localBarXFraction;
                props.onAction(barMoveAction);
            }
        };

        window.addEventListener('mousemove', onMouseMove);

        onCleanup(() => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', updateRect);
            cancelAnimationFrame(rafId);
        });
    });

    const selfId = () => authState.user?.id ?? '';
    const state = () => gameStore.data;
    const ended = () => state()?.status === 'ended';



    const [actionPending, setActionPending] = createSignal<'play-again' | 'lobby' | null>(null);

    createEffect(() => {
        if (gameStore.data !== null && actionPending() === 'play-again') {
            setActionPending(null);
        }
    });

    const winner = () => state()?.results?.find(r => r.rank === 1);
    const isWinner = () => winner()?.userId === selfId();
    const isSolo = () => {
        const players = state()?.players ?? [];
        return players.length < 2 || players.every(p => p.userId === selfId());
    };
    const selfEffects = createMemo(() =>
        state()?.players.find(p => p.userId === selfId())?.effects ?? []
    );

    interface HighscoreEntry { rank: number; userId: string; username: string; score: number; }
    const [highscores] = createResource(ended, async (isEnded) => {
        if (!isEnded) return [];
        const res = await fetch('/api/leaderboard/snusregn', { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        const entries: HighscoreEntry[] = data.entries ?? [];
        return entries.slice(0, 10);
    });

    return (
        <div class="snusregn-wrapper">
            <div style={{ display: ended() ? 'none' : 'flex', 'flex-direction': 'column', 'align-items': 'stretch' }}>
                <canvas
                    ref={canvasRef}
                    class="snusregn-canvas"
                    width={450}
                    height={900}
                />
                <Show when={selfEffects().length > 0}>
                    <div class="snusregn-effect-bars">
                        <For each={selfEffects()}>{(effect) => {
                            const color = EFFECT_COLORS[effect.type];
                            const max = effectMaxTicks.get(effect.type) ?? EFFECT_MAX_TICKS[effect.type];
                            const pct = Math.max(0, Math.min(1, effect.remainingTicks / max)) * 100;
                            return (
                                <div class={`snusregn-effect-bar-row${OPPONENT_EFFECTS.has(effect.type) && !isSolo() ? ' opponent' : ''}`}>
                                    <span class="snusregn-effect-label" style={{ color }}>{EFFECT_LABELS[effect.type]}</span>
                                    <div class="snusregn-effect-track">
                                        <div class="snusregn-effect-fill" style={{ width: `${pct}%`, background: color }} />
                                    </div>
                                </div>
                            );
                        }}</For>
                    </div>
                </Show>
            </div>
            <Show when={ended()}>
                <div class="snusregn-end-screen">
                    <h1 class={`snusregn-end-title ${isWinner() ? 'win' : 'lose'}`}>
                        {isSolo() ? 'Slut snus' : isWinner() ? 'You won!' : `${winner()?.username ?? 'Opponent'} won!`}
                    </h1>
                    <img src={!isSolo() && isWinner() ? snusiconSrc : bjudlocketSrc} alt="Bjudlocket" style={{ width: '180px', margin: '0.5rem auto 1.5rem', display: 'block', 'border-radius': '40px' }} />
                <div class="snusregn-end-columns">
                        <div class="snusregn-end-body">
                            <div class="snusregn-end-scores">
                                {state()?.results?.map(r => (
                                    <div class={`snusregn-end-score-row${r.userId === selfId() ? ' self' : ''}`}>
                                        {!isSolo() && <span class="rank">#{r.rank}</span>}
                                        <span class="name">{r.username}</span>
                                        <span class="score">{r.score}<span class="score-unit">p</span></span>
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
                                            prevScore = 0;
                                            prevLives = 0;
                                            prevEffectTypes = [];
                                            effectMaxTicks.clear();
                                            popups.length = 0;
                                            flashes.length = 0;
                                            socket.emit('room:start', { roomCode: props.roomCode });
                                            setGameStore('data', null);
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
                                    {actionPending() === 'lobby' ? 'Loading…' : 'Back to lobby'}
                                </button>
                            </div>
                        </div>
                        <div class="snusregn-highscore-panel">
                            <h2 class="snusregn-highscore-title">All-time highscore</h2>
                            <Show when={highscores.loading}>
                                <p class="snusregn-highscore-loading">Loading...</p>
                            </Show>
                            <Show when={!highscores.loading}>
                                <For each={highscores() ?? []}>{(entry, i) => {
                                    const isSelf = entry.userId === selfId();
                                    const selfScore = state()?.results?.find(r => r.userId === selfId())?.score ?? -1;
                                    const isNew = isSelf && i() === 0 && selfScore === entry.score;
                                    return (
                                        <div class={`snusregn-hs-row${isSelf ? ' hs-self' : ''}${isNew ? ' hs-new' : ''}`}>
                                            <span class="hs-rank">{entry.rank}</span>
                                            <span class="hs-name">{entry.username}{isNew && <span class="hs-new-badge">NEW!</span>}</span>
                                            <span class="hs-score">{entry.score}<span class="score-unit">p</span></span>
                                        </div>
                                    );
                                }}</For>
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}

