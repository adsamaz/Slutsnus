import { onMount, onCleanup, Show } from 'solid-js';
import { useAuth } from '../../stores/auth';
import { useSocket } from '../../stores/socket';
import { render as renderGame } from './renderer';
import Hud from './hud';
import TradeModal from './TradeModal';
import EndScreen from './EndScreen';
import type { SnusRpgState, TradeOffer } from '@slutsnus/shared';
import './styles.css';

interface SnusRpgGameProps {
    state: SnusRpgState;
    roomCode: string;
    ended: boolean;
    onPlayAgain: () => void;
    onLeaderboard: () => void;
}

export default function SnusRpgGame(props: SnusRpgGameProps) {
    const [authState] = useAuth();
    const sock = useSocket();
    let canvasRef!: HTMLCanvasElement;

    const myId = () => authState.user?.id ?? '';

    // Find incoming trade offer for this player from state
    const myTradeOffer = (): TradeOffer | null => {
        if (!props.state.tradeOffers) return null;
        return props.state.tradeOffers.find((o) => o.toPlayerId === myId()) ?? null;
    };

    // Resolve sender username from players record
    const tradeFromUsername = (): string => {
        const offer = myTradeOffer();
        if (!offer) return '';
        return props.state.players[offer.fromPlayerId]?.username ?? offer.fromPlayerId;
    };

    const keys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
        if (keys.has(e.code)) return;
        keys.add(e.code);

        const emit = sock.emit.bind(sock);
        const rc = props.roomCode;

        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                emit('game:action', { roomCode: rc, action: { type: 'move', payload: { direction: 'up' } } });
                break;
            case 'ArrowDown':
            case 'KeyS':
                emit('game:action', { roomCode: rc, action: { type: 'move', payload: { direction: 'down' } } });
                break;
            case 'ArrowLeft':
            case 'KeyA':
                emit('game:action', { roomCode: rc, action: { type: 'move', payload: { direction: 'left' } } });
                break;
            case 'ArrowRight':
            case 'KeyD':
                emit('game:action', { roomCode: rc, action: { type: 'move', payload: { direction: 'right' } } });
                break;
            case 'Space':
                e.preventDefault();
                emit('game:action', { roomCode: rc, action: { type: 'attack' } });
                break;
        }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.code);
    };

    onMount(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    });

    onCleanup(() => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    });

    // Render loop driven by state prop
    let rafId: number;
    const loop = () => {
        const ctx = canvasRef?.getContext('2d');
        if (ctx) renderGame(ctx, props.state);
        rafId = requestAnimationFrame(loop);
    };

    onMount(() => { rafId = requestAnimationFrame(loop); });
    onCleanup(() => { cancelAnimationFrame(rafId); });

    const handleAcceptTrade = () => {
        const offer = myTradeOffer();
        if (!offer) return;
        sock.emit('game:action', { roomCode: props.roomCode, action: { type: 'trade_accept', payload: { tradeId: offer.id } } });
    };

    const handleDeclineTrade = () => {
        const offer = myTradeOffer();
        if (!offer) return;
        sock.emit('game:action', { roomCode: props.roomCode, action: { type: 'trade_decline', payload: { tradeId: offer.id } } });
    };

    return (
        <div class="game-viewport">
            <canvas ref={canvasRef} width={750} height={750} class="game-canvas" tabIndex={0} />
            <Hud state={props.state} myId={myId()} />
            <Show when={myTradeOffer()}>
                {(offer) => (
                    <TradeModal
                        offer={offer()}
                        fromUsername={tradeFromUsername()}
                        onAccept={handleAcceptTrade}
                        onDecline={handleDeclineTrade}
                    />
                )}
            </Show>
            <Show when={props.ended}>
                <EndScreen
                    players={props.state.players}
                    myId={myId()}
                    onPlayAgain={props.onPlayAgain}
                    onLeaderboard={props.onLeaderboard}
                />
            </Show>
        </div>
    );
}
