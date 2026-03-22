import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useRoom } from '../stores/room';
import Button from '../components/Button';
import { GameType, FactoryDifficulty } from '@slutsnus/shared';

type Game = { id: GameType; name: string; description: string; badges: string[]; tagline: string; icon: string };

const GAMES: Game[] = [
    {
        id: 'snusregn',
        name: 'Snusrain',
        tagline: 'Catch the snus. Watch out for bjudlocket.',
        description: 'Snus pouches rain from the sky in your own lane. Catch fresh ones, avoid spent ones. Powerups and debuffs included. 1v1 arcade.',
        badges: ['1-2 Players', 'Arcade', 'Real-time'],
        icon: '🌧️',
    },
    {
        id: 'snus-arena',
        name: 'Snus Arena',
        tagline: 'Choose your class. Fight for the arena.',
        description: 'Pick a class with unique abilities and battle it out in the arena. Use powerups, dodge projectiles, and outlast your opponent.',
        badges: ['1-4 Players', 'Action', 'Real-time'],
        icon: '⚔️',
    },
    {
        id: 'snus-farm',
        name: 'Snus Farm',
        tagline: 'Herd your chickens. Outsmart your rival farmer.',
        description: 'Chase chickens across a shared farm and push them into your pen. First farmer to 5 chickens wins.',
        badges: ['1-2 Players', 'Casual', 'Real-time'],
        icon: '🐔',
    },
    {
        id: 'snusfactory',
        name: 'Snusfactory',
        tagline: 'Grow it. Grind it. Package it. Sell it.',
        description: 'Co-op factory chaos. Grow tobacco, add the right flavor, package cans, and fulfill customer orders before time runs out.',
        badges: ['1-4 Players', 'Co-op', 'Real-time'],
        icon: '🏭',
    },
];

export default function Home() {
    const [auth] = useAuth();
    const [, roomActions] = useRoom();
    const navigate = useNavigate();

    const [selectedGame, setSelectedGame] = createSignal<Game | null>(null);
    const [joinCode, setJoinCode] = createSignal('');
    const [joinError, setJoinError] = createSignal('');
    const [creating, setCreating] = createSignal(false);
    const [startingSolo, setStartingSolo] = createSignal(false);
    const [joining, setJoining] = createSignal(false);
    const [factoryDifficulty, setFactoryDifficulty] = createSignal<FactoryDifficulty>('medium');

    const handleCreate = async () => {
        const game = selectedGame();
        if (!game) return;
        setCreating(true);
        try {
            const code = await roomActions.createRoom(game.id);
            navigate(`/lobby/${code}`);
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setCreating(false);
        }
    };

    const handleStartSolo = async () => {
        const game = selectedGame();
        if (!game) return;
        setStartingSolo(true);
        try {
            const diff = game.id === 'snusfactory' ? factoryDifficulty() : undefined;
            const code = await roomActions.startSolo(game.id, diff);
            navigate(`/game/${code}`);
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setStartingSolo(false);
        }
    };

    const handleJoin = async (e: Event) => {
        e.preventDefault();
        setJoinError('');
        const code = joinCode().trim();
        if (!code) return;
        setJoining(true);
        try {
            await roomActions.joinRoom(code);
            navigate(`/lobby/${code.toUpperCase()}`);
        } catch (e: unknown) {
            setJoinError(e instanceof Error ? e.message : 'Failed to join room');
        } finally {
            setJoining(false);
        }
    };

    const selectGame = (game: Game) => {
        setSelectedGame(prev => prev?.id === game.id ? null : game);
        setJoinError('');
        setJoinCode('');
    };

    return (
        <main class="home-page">
            <div class="home-glow" aria-hidden="true" />

            <section class="hero">
                <p class="hero-eyebrow">Browser games with friends</p>
                <h1 class="hero-title">Slutsnus</h1>
                <p class="hero-sub">For people who love snus and games</p>
            </section>

            <section class="home-games-section">
                <p class="home-section-label">Choose a game</p>
                <div class="home-games-grid">
                    {GAMES.map(game => (
                        <div
                            class={`home-game-card${selectedGame()?.id === game.id ? ' home-game-card--selected' : ''}`}
                            onClick={() => auth.user && selectGame(game)}
                            style={{ cursor: auth.user ? 'pointer' : 'default' }}
                        >
                            <div class="home-game-card-glow" aria-hidden="true" />
                            <div class="home-game-card-icon">
                                <span style={{ "font-size": "48px", "line-height": "1" }}>{game.icon}</span>
                            </div>
                            <div class="home-game-card-body">
                                <p class="home-game-card-tagline">{game.tagline}</p>
                                <h2 class="home-game-card-title">{game.name}</h2>
                                <p class="home-game-card-desc">{game.description}</p>
                                <div class="home-game-card-badges">
                                    {game.badges.map(b => <span class="badge">{b}</span>)}
                                </div>
                            </div>
                            <div class="home-game-card-cta">
                                {selectedGame()?.id === game.id ? 'Selected ✓' : auth.user ? 'Select →' : <><a href="/login">Log in</a> to play</>}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <Show when={selectedGame()}>
                {(game) => (
                    <section class="room-actions">
                        <div class="room-actions-header">
                        <p class="room-actions-label">Ready to play <strong>{game().name}</strong>?</p>
                        <Show when={game().id === 'snusfactory'}>
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
                                                    <linearGradient id={`home-tin-grad-${level}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stop-color="#2a6090" />
                                                        <stop offset="100%" stop-color="#0f2a45" />
                                                    </linearGradient>
                                                    <linearGradient id={`home-lid-grad-${level}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stop-color="#5090c0" />
                                                        <stop offset="100%" stop-color="#2a6090" />
                                                    </linearGradient>
                                                </defs>
                                                <ellipse cx="40" cy="68" rx="34" ry="8" fill="#1a2a3a" opacity="0.4" />
                                                <rect x="6" y="18" width="68" height="50" rx="10" ry="10" fill={`url(#home-tin-grad-${level})`} />
                                                <ellipse cx="40" cy="18" rx="34" ry="9" fill={`url(#home-lid-grad-${level})`} />
                                                <ellipse cx="40" cy="18" rx="28" ry="6" fill="#3a6090" opacity="0.5" />
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
                        </div>
                        <div class="room-actions-inner">
                            <Button onClick={handleStartSolo} disabled={startingSolo()}>
                                {startingSolo() ? 'Starting...' : 'Play Solo'}
                            </Button>
                            <Button onClick={handleCreate} disabled={creating()} variant="secondary">
                                {creating() ? 'Creating...' : 'Create Room'}
                            </Button>
                            <span class="room-actions-divider">or join one</span>
                            <form onSubmit={handleJoin} class="join-form">
                                <input
                                    class="input"
                                    placeholder="Room code"
                                    value={joinCode()}
                                    onInput={(e) => setJoinCode(e.currentTarget.value.toUpperCase())}
                                    maxLength={6}
                                    style={{ 'text-transform': 'uppercase' }}
                                />
                                <Button type="submit" variant="secondary" disabled={joining()}>{joining() ? 'Joining...' : 'Join'}</Button>
                            </form>
                        </div>
                        <Show when={joinError()}>
                            <p class="error-text" style={{ 'margin-top': '10px' }}>{joinError()}</p>
                        </Show>
                    </section>
                )}
            </Show>
        </main>
    );
}
