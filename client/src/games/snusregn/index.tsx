import { createStore } from 'solid-js/store';
import { createMemo, createResource, For, onMount, onCleanup, Show } from 'solid-js';
import { useSocket } from '../../stores/socket';
import { useAuth } from '../../stores/auth';
import { drawFrame, bakeItemBitmaps, LANE_W, BAR_WIDTH_DEFAULT, EFFECT_COLORS, EFFECT_LABELS, EFFECT_MAX_TICKS } from './render';
import type { ItemBitmaps, ScreenFlash } from './render';
import freshSnusSrc from '../../assets/freshsnus.webp';
import spentSnusSrc from '../../assets/spentsnus.webp';
import beerSrc from '../../assets/beer.svg';
import wideBarSrc from '../../assets/widebar.svg';
import slowRainSrc from '../../assets/slowrain.svg';
import fastRainSrc from '../../assets/fastrain.svg';
import shrinkBarSrc from '../../assets/shrinkbar.svg';
import blindSrc from '../../assets/blind.svg';
import type { SnusregnState, GameAction, SnusregnEffectType } from '@slutsnus/shared';
import { soundFreshCatch, soundFreshCatchBeer, soundLifeLost, soundPowerup, soundDebuff } from './sounds';
import './snusregn.css';

interface SnusregnGameProps {
    state: SnusregnState;
    roomCode: string;
    onAction: (action: unknown) => void;
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
                const beerActive = selfNext.effects.some(e => e.type === 'beer');
                popups.push({
                    text: scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`,
                    color: scoreDiff >= 3 && beerActive ? '#f0a500' : scoreDiff > 0 ? '#39d353' : '#f85149',
                    x: localBarXFraction * LANE_W,
                    y: barYPx,
                    duration: dur,
                    expiresAt: Date.now() + dur,
                });
                if (scoreDiff >= 3) soundFreshCatchBeer();
                else if (scoreDiff > 0) soundFreshCatch();
            }
            if (livesDiff < 0) {
                const dur = 900;
                popups.push({
                    text: `♥ -1`,
                    color: '#f85149',
                    x: LANE_W / 2,
                    y: 450,
                    duration: dur,
                    expiresAt: Date.now() + dur,
                    large: true,
                });
                flashes.push({
                    color: '#f85149',
                    duration: 500,
                    expiresAt: Date.now() + 500,
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
        }
        setGameStore('data', next);
    };
    socket.on('game:state', onGameState);
    onCleanup(() => socket.off('game:state', onGameState));

    let canvasRef!: HTMLCanvasElement;
    let localBarXFraction = 0.5;
    let lastEmit = 0;
    let rafId: number;
    let prevScore = 0;
    let prevLives = 0;
    let prevEffectTypes: SnusregnEffectType[] = [];
    const effectMaxTicks = new Map<SnusregnEffectType, number>();
    const popups: import('./render').ScorePopup[] = [];
    const flashes: ScreenFlash[] = [];
    const makeImg = (src: string) => { const i = new Image(); i.src = src; return i; };
    const imgs = {
        fresh:     makeImg(freshSnusSrc),
        spent:     makeImg(spentSnusSrc),
        beer:      makeImg(beerSrc),
        wideBar:   makeImg(wideBarSrc),
        slowRain:  makeImg(slowRainSrc),
        fastRain:  makeImg(fastRainSrc),
        shrinkBar: makeImg(shrinkBarSrc),
        blind:     makeImg(blindSrc),
    };
    let bitmaps: ItemBitmaps = {};

    onMount(() => {
        const ctx = canvasRef.getContext('2d')!;

        // Bake pre-rendered circular bitmaps once all images have loaded
        const bakeWhenReady = () => {
            const allLoaded = Object.values(imgs).every(img => img.complete && img.naturalWidth > 0);
            if (allLoaded) {
                bakeItemBitmaps(imgs).then(b => { bitmaps = b; });
            } else {
                setTimeout(bakeWhenReady, 50);
            }
        };
        bakeWhenReady();

        const loop = () => {
            const state = gameStore.data;
            const selfId = authState.user?.id ?? '';
            const now = Date.now();
            // Expire old popups and flashes
            while (popups.length > 0 && popups[0].expiresAt <= now) popups.shift();
            while (flashes.length > 0 && flashes[0].expiresAt <= now) flashes.shift();
            if (state && state.status === 'playing') {
                drawFrame(ctx, canvasRef, state, selfId, localBarXFraction, imgs, popups, bitmaps, flashes);
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        const onMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            // Scale from display size to logical resolution
            const scaleX = (canvasRef.width / 2) / (rect.width / 2);
            // Self is always in the left half — clamp to LANE_W
            const rawX = (e.clientX - rect.left) * scaleX;
            const halfBar = BAR_WIDTH_DEFAULT / 2;
            const laneX = Math.max(halfBar, Math.min(LANE_W - halfBar, rawX));
            localBarXFraction = laneX / LANE_W;

            const now = Date.now();
            if (now - lastEmit >= 30) {
                lastEmit = now;
                props.onAction({
                    type: 'snusregn:bar-move',
                    payload: { xFraction: localBarXFraction },
                } as GameAction);
            }
        };

        canvasRef.addEventListener('mousemove', onMouseMove);

        onCleanup(() => {
            canvasRef.removeEventListener('mousemove', onMouseMove);
            cancelAnimationFrame(rafId);
        });
    });

    const selfId = () => authState.user?.id ?? '';
    const state = () => gameStore.data;
    const ended = () => state()?.status === 'ended';
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
                                <div class="snusregn-effect-bar-row">
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
                                    class="snusregn-lobby-btn snusregn-play-again-btn"
                                    onClick={() => {
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
                                    Play again
                                </button>
                                <button
                                    class="snusregn-lobby-btn"
                                    onClick={() => { window.location.href = '/'; }}
                                >
                                    Back to lobby
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

