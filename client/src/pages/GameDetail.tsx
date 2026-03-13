import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '../stores/auth';
import { useRoom } from '../stores/room';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { SnusIcon } from '../components/SnusIcon';
import { GameType } from '@slutsnus/shared';

export default function GameDetail() {
    const [auth] = useAuth();
    const [, roomActions] = useRoom();
    const navigate = useNavigate();

    const [createOpen, setCreateOpen] = createSignal(false);
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

    return (
        <main class="page">
            <h2 class="page-title"><span style={{ 'vertical-align': 'middle', 'margin-right': '8px', display: 'inline-flex' }}><SnusIcon size={32} /></span> Snus King</h2>
            <div class="card" style={{ 'max-width': '600px' }}>
                <p style={{ 'margin-bottom': '1rem' }}>
                    Collect Swedish snus brands and become the Snus King! Fight off evil nicotine pouches,
                    trade with friends — or betray them with a disguised pouch.
                </p>
                <div style={{ 'display': 'flex', 'gap': '8px', 'flex-wrap': 'wrap', 'margin-bottom': '1.5rem' }}>
                    <span class="game-badge">1–4 Players</span>
                    <span class="game-badge">Co-op + Betrayal</span>
                    <span class="game-badge">RPG</span>
                </div>
                <Show
                    when={auth.user}
                    fallback={
                        <p style={{ color: 'var(--color-muted)', 'font-size': '0.9rem' }}>
                            <a href="/login">Log in</a> or <a href="/register">register</a> to play.
                        </p>
                    }
                >
                    <Button onClick={() => setCreateOpen(true)}>Play Snus King</Button>
                </Show>
            </div>

            <Modal open={createOpen()} onClose={() => setCreateOpen(false)} title="Create Game">
                <p style={{ 'margin-bottom': '16px', color: 'var(--color-text-muted)' }}>Choose a game to start a new lobby:</p>
                <Button
                    onClick={() => handleCreate('snusking')}
                    disabled={creating()}
                    style={{ width: '100%' }}
                >
                    {creating() ? 'Creating...' : <><span style={{ 'vertical-align': 'middle', 'margin-right': '6px', display: 'inline-flex' }}><SnusIcon size={20} /></span>Snus King</>}
                </Button>
            </Modal>
        </main>
    );
}
