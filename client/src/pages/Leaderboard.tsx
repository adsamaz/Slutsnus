import { createResource, createSignal, For, Show } from 'solid-js';
import { GameType, LeaderboardEntry } from '@slutsnus/shared';

const GAMES: { id: GameType; name: string }[] = [
    { id: 'snusregn', name: 'Snusrain' },
];

async function fetchLeaderboard(gameType: GameType): Promise<LeaderboardEntry[]> {
    const res = await fetch(`/api/leaderboard/${gameType}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load leaderboard');
    const data = await res.json();
    return data.entries ?? [];
}

export default function Leaderboard() {
    const [activeGame, setActiveGame] = createSignal<GameType>('snusregn');
    const [entries] = createResource(activeGame, fetchLeaderboard);

    return (
        <main class="page">
            <h2 class="page-title">Leaderboard</h2>

            <div class="tab-bar">
                <For each={GAMES}>
                    {(game) => (
                        <button
                            class={`tab-btn${activeGame() === game.id ? ' tab-btn--active' : ''}`}
                            onClick={() => setActiveGame(game.id)}
                        >
                            {game.name}
                        </button>
                    )}
                </For>
            </div>

            <div class="card">
                <Show when={entries.loading}>
                    <p class="muted">Loading...</p>
                </Show>
                <Show when={entries.error}>
                    <p class="error-text">Failed to load leaderboard</p>
                </Show>
                <Show when={!entries.loading && !entries.error}>
                    <Show
                        when={(entries() ?? []).length > 0}
                        fallback={<p class="muted">No scores yet. Be the first!</p>}
                    >
                        <table class="leaderboard-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Player</th>
                                    <th>Score</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={entries()}>
                                    {(entry) => (
                                        <tr>
                                            <td class={entry.rank <= 3 ? `rank-${entry.rank}` : ''}>{entry.rank}</td>
                                            <td>{entry.username}</td>
                                            <td>{entry.score}</td>
                                            <td>{new Date(entry.recordedAt).toLocaleDateString()}</td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </Show>
                </Show>
            </div>
        </main>
    );
}
