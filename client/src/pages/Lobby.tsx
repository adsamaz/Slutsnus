import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useSocket } from '../stores/socket';
import { useRoom } from '../stores/room';
import { useFriends } from '../stores/friends';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import type { RoomInfo, RoomPlayer, FactoryDifficulty } from '@slutsnus/shared';

export default function Lobby() {
    const params = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [authState] = useAuth();
    const socket = useSocket();
    const [roomState, roomActions] = useRoom();
    const [friendsState, friendsActions] = useFriends();

    const [ready, setReady] = createSignal(false);
    const [starting, setStarting] = createSignal(false);
    const [leaving, setLeaving] = createSignal(false);
    const [joining, setJoining] = createSignal(true);
    const [error, setError] = createSignal('');
    const [copied, setCopied] = createSignal(false);
    const [invited, setInvited] = createSignal<Set<string>>(new Set());
    const [factoryDifficulty, setFactoryDifficulty] = createSignal<FactoryDifficulty>('medium');

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
        if (!r) return false;
        if (r.players.length === 1 && r.players[0].userId === r.hostId) return true;
        if (r.players.length < 2) return false;
        return r.players.filter((p) => p.userId !== r.hostId).every((p) => p.ready);
    };

    const handleReady = () => {
        setReady(true);
        socket.emit('room:ready', { roomCode: params.code });
    };

    const arenaMode = () => {
        const count = room()?.players.length ?? 0;
        if (count <= 1) return 'Solo';
        if (count === 2) return '1v1';
        if (count === 3) return '2v1';
        return '2v2';
    };

    const handleStart = () => {
        setStarting(true);
        const r = room();
        socket.emit('room:start', {
            roomCode: params.code,
            ...(r?.gameType === 'snusfactory' ? { factoryDifficulty: factoryDifficulty() } : {}),
        });
    };

    const handleLeave = async () => {
        setLeaving(true);
        await roomActions.leaveRoom();
        navigate('/');
    };

    const handleInvite = (targetUserId: string) => {
        friendsActions.inviteFriend(targetUserId, params.code);
        setInvited((prev) => new Set([...prev, targetUserId]));
    };

    // Listen for game start
    const onStarted = (_data: { roomCode: string }) => navigate(`/game/${params.code}`);
    socket.on('room:started', onStarted);
    onCleanup(() => socket.off('room:started', onStarted));

    // Listen for host dissolving the room
    const onDissolved = () => navigate('/');
    socket.on('room:dissolved', onDissolved);
    onCleanup(() => socket.off('room:dissolved', onDissolved));

    const lobbyFull = () => (room()?.players.length ?? 0) >= (room()?.maxPlayers ?? 2);

    const invitableFriends = () => {
        const playerIds = new Set(room()?.players.map((p) => p.userId) ?? []);
        return friendsState.friends.filter(
            (f) => f.friendshipStatus === 'accepted' && f.online && !playerIds.has(f.userId)
        );
    };

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
                                <h3>
                                    Players ({r().players.length} / {r().maxPlayers ?? 2})
                                    <Show when={r().gameType === 'snus-arena'}>
                                        <span class="mode-badge">{arenaMode()}</span>
                                    </Show>
                                </h3>
                                <For each={r().players}>
                                    {(player: RoomPlayer) => (
                                        <div class="player-item">
                                            <Avatar username={player.username} avatarUrl={player.avatarUrl} size="md" />
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

                            <Show when={r().gameType === 'snusfactory' && isHost()}>
                                <div class="factory-difficulty-picker">
                                    <p class="factory-difficulty-label">Difficulty</p>
                                    <div class="factory-difficulty-tins">
                                        {(['easy', 'medium', 'hard'] as FactoryDifficulty[]).map((level, i) => (
                                            <button
                                                class={`factory-tin${factoryDifficulty() === level ? ' factory-tin--selected' : ''}`}
                                                onClick={() => setFactoryDifficulty(level)}
                                                title={level.charAt(0).toUpperCase() + level.slice(1)}
                                            >
                                                <svg viewBox="0 0 80 80" width="80" height="80" style={{ display: 'block' }}>
                                                    <defs>
                                                        <linearGradient id={`tin-grad-${level}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stop-color="#2a6090" />
                                                            <stop offset="100%" stop-color="#0f2a45" />
                                                        </linearGradient>
                                                        <linearGradient id={`lid-grad-${level}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stop-color="#5090c0" />
                                                            <stop offset="100%" stop-color="#2a6090" />
                                                        </linearGradient>
                                                    </defs>
                                                    {/* Tin body */}
                                                    <ellipse cx="40" cy="68" rx="34" ry="8" fill="#1a2a3a" opacity="0.4" />
                                                    <rect x="6" y="18" width="68" height="50" rx="10" ry="10" fill={`url(#tin-grad-${level})`} />
                                                    {/* Lid */}
                                                    <ellipse cx="40" cy="18" rx="34" ry="9" fill={`url(#lid-grad-${level})`} />
                                                    <ellipse cx="40" cy="18" rx="28" ry="6" fill="#3a6090" opacity="0.5" />
                                                    {/* Dots */}
                                                    {[0, 1, 2].map(d => (
                                                        <circle
                                                            cx={28 + d * 12}
                                                            cy="47"
                                                            r="5"
                                                            fill={d <= i ? '#e0eaf8' : 'none'}
                                                            stroke="#4a80b0"
                                                            stroke-width="1.5"
                                                        />
                                                    ))}
                                                </svg>
                                                <span class="factory-tin-label">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </Show>

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
                                <Button class="btn btn-danger" onClick={handleLeave} disabled={leaving()}>
                                    {leaving() ? 'Leaving...' : 'Leave'}
                                </Button>
                            </div>
                        </div>

                        <div class="lobby-sidebar card">
                            <h3>Invite friends</h3>
                            <Show when={lobbyFull()}>
                                <p class="muted">Lobby is full</p>
                            </Show>
                            <Show when={!lobbyFull() && invitableFriends().length === 0}>
                                <p class="muted">No friends online</p>
                            </Show>
                            <Show when={!lobbyFull()}>
                                <For each={invitableFriends()}>
                                    {(f) => (
                                        <div class="friend-item">
                                            <span class="status-dot online" />
                                            <span>{f.username}</span>
                                            <Button
                                                class="btn btn-secondary"
                                                style={{ 'margin-left': 'auto', padding: '4px 10px', 'font-size': '0.8rem' }}
                                                onClick={() => handleInvite(f.userId)}
                                                disabled={invited().has(f.userId)}
                                            >
                                                {invited().has(f.userId) ? '✓' : 'Invite'}
                                            </Button>
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </div>
                    </div>
                )}
            </Show>
        </main>
    );
}
