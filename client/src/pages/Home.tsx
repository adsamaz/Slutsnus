import { createSignal, Show } from 'solid-js';
import { useNavigate, A } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useRoom } from '../stores/room';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { GameType } from '@slutsnus/shared';

export default function Home() {
    const [auth] = useAuth();
    const [, roomActions] = useRoom();
    const navigate = useNavigate();

    const [createOpen, setCreateOpen] = createSignal(false);
    const [joinCode, setJoinCode] = createSignal('');
    const [joinError, setJoinError] = createSignal('');
    const [creating, setCreating] = createSignal(false);

    const handleCreate = async (gameType: GameType) => {
        setCreating(true);
        try {
            const code = await roomActions.createRoom(gameType);
            setCreateOpen(false);
            navigate(`/lobby/${code}`);
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = async (e: Event) => {
        e.preventDefault();
        setJoinError('');
        if (!joinCode().trim()) return;
        try {
            await roomActions.joinRoom(joinCode().trim());
            navigate(`/lobby/${joinCode().trim().toUpperCase()}`);
        } catch (e: unknown) {
            setJoinError(e instanceof Error ? e.message : 'Failed to join room');
        }
    };

    return (
        <main class="page">
            <section class="hero">
                <h1 class="hero-title">🎮 Slutsnus</h1>
                <p class="hero-sub">Play browser games with friends. Real-time co-op, lobbies, betrayal included.</p>
                <Show
                    when={auth.user}
                    fallback={
                        <div class="hero-actions">
                            <a href="/register" class="btn btn-primary" style={{ 'margin-right': '12px' }}>Get Started</a>
                            <a href="/login" class="btn btn-secondary">Login</a>
                        </div>
                    }
                >
                    <div class="hero-actions">
                        <Button onClick={() => setCreateOpen(true)}>Create Game</Button>
                        <form onSubmit={handleJoin} class="join-form" style={{ 'margin-top': '16px' }}>
                            <input
                                class="input"
                                placeholder="Enter room code"
                                value={joinCode()}
                                onInput={(e) => setJoinCode(e.currentTarget.value.toUpperCase())}
                                maxLength={6}
                                style={{ 'text-transform': 'uppercase' }}
                            />
                            <Button type="submit" variant="secondary" style={{ 'margin-left': '8px' }}>Join</Button>
                        </form>
                        <Show when={joinError()}>
                            <p class="error-text">{joinError()}</p>
                        </Show>
                    </div>
                </Show>
            </section>

            <section class="games-grid">
                <A href="/games/snus-rpg" style={{ 'text-decoration': 'none', color: 'inherit' }}>
                    <div class="card game-card">
                        <div class="game-card-icon">🎯</div>
                        <h3>Snus King</h3>
                        <p>
                            Collect Swedish snus brands and become the Snus King! Fight off evil nicotine pouches,
                            trade with friends — or betray them with a disguised pouch.
                        </p>
                        <div class="game-card-meta">
                            <span class="badge">1–4 Players</span>
                            <span class="badge">Co-op + Betrayal</span>
                            <span class="badge">RPG</span>
                        </div>
                    </div>
                </A>
            </section>

            <Modal open={createOpen()} onClose={() => setCreateOpen(false)} title="Create Game">
                <p style={{ 'margin-bottom': '16px', color: 'var(--color-text-muted)' }}>Choose a game to start a new lobby:</p>
                <Button
                    onClick={() => handleCreate('snus-rpg')}
                    disabled={creating()}
                    style={{ width: '100%' }}
                >
                    {creating() ? 'Creating...' : '🎯 Snus King'}
                </Button>
            </Modal>
        </main>
    );
}
