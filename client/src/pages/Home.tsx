import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useRoom } from '../stores/room';
import Button from '../components/Button';
import { SnusIcon } from '../components/SnusIcon';
import { GameType } from '@slutsnus/shared';

type Game = { id: GameType; name: string; description: string; badges: string[]; tagline: string };

const GAMES: Game[] = [
    {
        id: 'snusregn',
        name: 'Snusrain',
        tagline: 'Catch the snus. Watch out for bjudlocket.',
        description: 'Snus pouches rain from the sky in your own lane. Catch fresh ones, avoid spent ones. Powerups and debuffs included. 1v1 arcade.',
        badges: ['1-2 Players', 'Arcade', 'Real-time'],
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
            const code = await roomActions.startSolo(game.id);
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
                                <SnusIcon size={72} />
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
                        <p class="room-actions-label">Ready to play <strong>{game().name}</strong>?</p>
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
                                    style={{ 'text-transform': 'uppercase', width: '140px' }}
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
