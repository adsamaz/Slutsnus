import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useSocket } from '../stores/socket';
import { useRoom } from '../stores/room';
import { useFriends } from '../stores/friends';
import Button from '../components/Button';
import type { RoomInfo, RoomPlayer } from '@slutsnus/shared';

export default function Lobby() {
    const params = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [authState] = useAuth();
    const socket = useSocket();
    const [roomState, roomActions] = useRoom();
    const [friendsState, friendsActions] = useFriends();

    const [ready, setReady] = createSignal(false);
    const [starting, setStarting] = createSignal(false);
    const [joining, setJoining] = createSignal(true);
    const [error, setError] = createSignal('');
    const [copied, setCopied] = createSignal(false);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(params.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    createEffect(async () => {
        try {
            await roomActions.joinRoom(params.code);
            socket.emit('room:join', { roomCode: params.code });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to join lobby');
        } finally {
            setJoining(false);
        }
    });

    const room = (): RoomInfo | null => roomState.room;
    const myId = (): string => authState.user?.id ?? '';
    const isHost = (): boolean => room()?.hostId === myId();

    const allReady = (): boolean => {
        const r = room();
        if (!r || r.players.length < 2) return false;
        return r.players.filter((p) => p.userId !== r.hostId).every((p) => p.ready);
    };

    const handleReady = () => {
        setReady(true);
        socket.emit('room:ready', { roomCode: params.code });
    };

    const handleStart = () => {
        setStarting(true);
        socket.emit('room:start', { roomCode: params.code });
    };

    const handleLeave = async () => {
        await roomActions.leaveRoom();
        navigate('/');
    };

    const handleInvite = (targetUserId: string) => {
        friendsActions.inviteFriend(targetUserId, params.code);
    };

    // Listen for game start
    const onStarted = (_data: { roomCode: string }) => navigate(`/game/${params.code}`);
    socket.on('room:started', onStarted);
    onCleanup(() => socket.off('room:started', onStarted));

    const onlineAcceptedFriends = () =>
        friendsState.friends.filter((f) => f.friendshipStatus === 'accepted' && f.online);

    return (
        <main class="page lobby-page">
            <Show when={joining()}>
                <p>Connecting to lobby...</p>
            </Show>
            <Show when={!joining() && error()}>
                <div class="card" style={{ 'max-width': '480px', margin: '2rem auto' }}>
                    <p class="error-text">{error()}</p>
                    <Button onClick={() => navigate('/')}>Back</Button>
                </div>
            </Show>
            <Show when={!joining() && !error() && room()}>
                {(r) => (
                    <div class="lobby-layout">
                        <div class="lobby-main card">
                            <div class="lobby-header">
                                <div class="lobby-title-row">
                                    <h2>{r().gameType === 'snusregn' ? 'Snusrain' : ''} — Lobby</h2>
                                    <span class="lobby-code">
                                        Code: <strong>{r().code}</strong>
                                        <button class="copy-code-btn" onClick={handleCopyCode} title="Copy room code">
                                            {copied() ? '✓' : '⧉'}
                                        </button>
                                    </span>
                                </div>
                                <span class={`game-badge ${r().gameType}`}>
                                    {r().gameType === 'snusregn' ? '🫙 Snusrain' : r().gameType}
                                </span>
                            </div>

                            <div class="player-list">
                                <h3>Players ({r().players.length} / 4)</h3>
                                <For each={r().players}>
                                    {(player: RoomPlayer) => (
                                        <div class="player-item">
                                            <span class={`status-dot ${player.ready || player.userId === r().hostId ? 'online' : 'offline'}`} />
                                            <span class="player-name">{player.username}</span>
                                            <Show when={player.userId === r().hostId}>
                                                <span class="host-badge">Host</span>
                                            </Show>
                                            <Show when={player.userId !== r().hostId}>
                                                <span class={`ready-badge ${player.ready ? 'ready' : 'not-ready'}`}>
                                                    {player.ready ? '✓ Ready' : '⏳ Not ready'}
                                                </span>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>

                            <div class="lobby-actions">
                                <Show when={!isHost()}>
                                    <Button
                                        class={ready() ? 'btn btn-secondary' : 'btn btn-primary'}
                                        onClick={handleReady}
                                        disabled={ready()}
                                    >
                                        {ready() ? '✓ Ready' : 'Ready'}
                                    </Button>
                                </Show>
                                <Show when={isHost()}>
                                    <Button
                                        class="btn btn-primary"
                                        onClick={handleStart}
                                        disabled={!allReady() || starting()}
                                    >
                                        {starting() ? 'Starting...' : 'Start game'}
                                    </Button>
                                </Show>
                                <Button class="btn btn-danger" onClick={handleLeave}>
                                    Leave
                                </Button>
                            </div>
                        </div>

                        <div class="lobby-sidebar card">
                            <h3>Invite friends</h3>
                            <Show when={onlineAcceptedFriends().length === 0}>
                                <p class="muted">No friends online</p>
                            </Show>
                            <For each={onlineAcceptedFriends()}>
                                {(f) => (
                                    <div class="friend-item">
                                        <span class="status-dot online" />
                                        <span>{f.username}</span>
                                        <Button
                                            class="btn btn-secondary"
                                            style={{ 'margin-left': 'auto', padding: '4px 10px', 'font-size': '0.8rem' }}
                                            onClick={() => handleInvite(f.userId)}
                                        >
                                            Invite
                                        </Button>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                )}
            </Show>
        </main>
    );
}
