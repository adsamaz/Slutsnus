import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useSocket } from '../stores/socket';
import { useRoom } from '../stores/room';
import { getVolume, setVolume } from './audio';
import { SnusregnGame } from './snusregn/index';
import { bakeItemBitmaps } from './snusregn/render';
import type { ItemBitmaps } from './snusregn/render';
import { SnusArenaGame } from './snus-arena/index';
import { SnusFarmGame } from './snus-farm/index';
import type { SnusregnState, ArenaState, ArenaGameMode, FarmState, GameAction } from '@slutsnus/shared';
import freshSnusSrc from '../assets/freshsnus.svg';
import goldSnusSrc from '../assets/goldsnus.svg';
import spentSnusSrc from '../assets/spentsnus.svg';
import beerSrc from '../assets/beer.svg';
import wideBarSrc from '../assets/widebar.svg';
import slowRainSrc from '../assets/slowrain.svg';
import fastRainSrc from '../assets/fastrain.svg';
import shrinkBarSrc from '../assets/shrinkbar.svg';
import blindSrc from '../assets/blind.svg';

interface GameContainerProps {
    roomCode: string;
}

const makeImg = (src: string) => { const i = new Image(); i.src = src; return i; };
const snusregnImgs: Record<string, HTMLImageElement> = {
    fresh: makeImg(freshSnusSrc),
    beerSnus: makeImg(goldSnusSrc),
    spent: makeImg(spentSnusSrc),
    beer: makeImg(beerSrc),
    wideBar: makeImg(wideBarSrc),
    slowRain: makeImg(slowRainSrc),
    fastRain: makeImg(fastRainSrc),
    shrinkBar: makeImg(shrinkBarSrc),
    blind: makeImg(blindSrc),
};

// Kick off baking immediately at module load — finishes during the waiting screen
let snusregnBitmaps: ItemBitmaps = {};
Promise.all(
    Object.values(snusregnImgs).map(img =>
        img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); })
    )
).then(() => bakeItemBitmaps(snusregnImgs).then(b => { snusregnBitmaps = b; }));

export default function GameContainer(props: GameContainerProps) {
    const socket = useSocket();
    const [roomState] = useRoom();
    const navigate = useNavigate();

    const [gameState, setGameState] = createSignal<unknown>(null);
    const [arenaMode, setArenaMode] = createSignal<ArenaGameMode>('1v1');

    const onState = ({ state }: { state: unknown }) => setGameState(state);
    const onError = () => navigate('/');

    const onStarted = () => {
        setGameState(null);
        socket.emit('game:ready', { roomCode: props.roomCode });
    };
    // For snus-arena, host sends mode with room:start (emitted from LobbyPage).
    // GameContainer itself just needs to pass the mode down to the game component.

    let fallbackTimer: ReturnType<typeof setTimeout>;

    onMount(() => {
        socket.on('game:state', onState);
        socket.on('room:error', onError);
        socket.on('room:started', onStarted);
        // Ensure socket is in the room (handles reconnects), then signal ready to start
        socket.emit('room:join', { roomCode: props.roomCode });
        socket.emit('game:ready', { roomCode: props.roomCode });

        // If no game:state arrives within 3s, the game isn't running — go home
        fallbackTimer = setTimeout(() => {
            if (!gameState()) navigate('/');
        }, 3000);
    });

    onCleanup(() => {
        socket.off('game:state', onState);
        socket.off('room:error', onError);
        socket.off('room:started', onStarted);
        clearTimeout(fallbackTimer);
    });

    const gameType = () => roomState.room?.gameType ?? '';
    const isSolo = () => (roomState.room?.players.length ?? 0) <= 1;

    const [volume, setVolumeSignal] = createSignal(getVolume());
    const handleVolume = (e: Event) => {
        const v = parseFloat((e.target as HTMLInputElement).value);
        setVolume(v);
        setVolumeSignal(v);
    };

    return (
        <div class="game-wrapper">
            <div class="game-volume-control">
                <span>🔊</span>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume()}
                    onInput={handleVolume}
                    title="Sound volume"
                />
            </div>
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
                        imgs={snusregnImgs}
                        bitmaps={snusregnBitmaps}
                        onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
                    />
                )}
            </Show>
            <Show when={gameType() === 'snus-arena' ? gameState() : null}>
                {(s) => (
                    <SnusArenaGame
                        state={s() as ArenaState}
                        roomCode={props.roomCode}
                        isSolo={isSolo()}
                        onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
                    />
                )}
            </Show>
            <Show when={gameType() === 'snus-farm' ? gameState() : null}>
                {(s) => (
                    <SnusFarmGame
                        state={s() as FarmState}
                        roomCode={props.roomCode}
                        isSolo={isSolo()}
                        onAction={(action) => socket.emit('game:action', { roomCode: props.roomCode, action: action as GameAction })}
                    />
                )}
            </Show>
        </div>
    );
}
