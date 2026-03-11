import { createResource, For, Show } from 'solid-js';

interface LeaderboardEntry {
    rank: number;
    username: string;
    score: number;
    playedAt: string;
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await fetch('/api/leaderboard/snus-rpg', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load leaderboard');
    const data = await res.json();
    return data.entries ?? [];
}

export default function Leaderboard() {
    const [entries] = createResource(fetchLeaderboard);

    return (
        <main class="page">
            <h2 class="page-title">Leaderboard — Snus King</h2>
            <div class="card">
                <Show when={entries.loading}>
                    <p class="muted">Loading...</p>
                </Show>
                <Show when={entries.error}>
                    <p class="error-text">Failed to load leaderboard</p>
                </Show>
                <Show when={!entries.loading && !entries.error}>
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
                                        <td>{new Date(entry.playedAt).toLocaleDateString()}</td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </Show>
            </div>
        </main>
    );
}
