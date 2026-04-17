import { createResource, createSignal, For, Show } from 'solid-js';
import { GameType, LeaderboardEntry } from '@slutsnus/shared';
import Avatar from '../components/Avatar';

const GAMES: { id: GameType; name: string; timeBased: boolean; hasDifficulty?: boolean }[] = [
    { id: 'snusregn', name: 'Snusrain', timeBased: false },
    { id: 'snus-farm', name: 'Snus Farm', timeBased: true },
    { id: 'snus-arena', name: 'Snus Arena', timeBased: true },
    { id: 'snusfactory', name: 'Snus Factory', timeBased: true, hasDifficulty: true },
];

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    if (minutes > 0) {
        return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }
    return `${seconds}.${String(centiseconds).padStart(2, '0')}s`;
}

async function fetchLeaderboard(gameType: GameType): Promise<LeaderboardEntry[]> {
    const res = await fetch(`/api/leaderboard/${gameType}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load leaderboard');
    const data = await res.json();
    return data.entries ?? [];
}

export default function Leaderboard() {
    const [activeGame, setActiveGame] = createSignal<GameType>('snusregn');
    const [entries] = createResource(activeGame, fetchLeaderboard);

    const currentGame = () => GAMES.find(g => g.id === activeGame())!;

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
                        <div class="leaderboard-list">
                            <div class="leaderboard-header">
                                <span class="lb-col-rank">#</span>
                                <span class="lb-col-player">Player</span>
                                <Show when={currentGame().hasDifficulty}>
                                    <span class="lb-col-diff">Difficulty</span>
                                </Show>
                                <span class="lb-col-score">{currentGame().timeBased ? 'Time' : 'Score'}</span>
                                <span class="lb-col-date">Date</span>
                            </div>
                            <For each={entries()}>
                                {(entry, i) => {
                                    const prevDiff = () => i() > 0 ? entries()![i() - 1].difficulty : null;
                                    const isNewGroup = () => currentGame().hasDifficulty && entry.difficulty !== prevDiff();
                                    return (
                                        <>
                                            <Show when={isNewGroup()}>
                                                <div class="leaderboard-group-label">{entry.difficulty}</div>
                                            </Show>
                                            <div class={`leaderboard-row${entry.rank <= 3 ? ` leaderboard-row--rank-${entry.rank}` : ''}`}>
                                                <span class="lb-col-rank lb-rank-num">{entry.rank}</span>
                                                <span class="lb-col-player leaderboard-player">
                                                    <Avatar username={entry.username} avatarUrl={entry.avatarUrl} size="sm" />
                                                    {entry.username}
                                                </span>
                                                <Show when={currentGame().hasDifficulty}>
                                                    <span class="lb-col-diff lb-diff-val">{entry.difficulty ?? '—'}</span>
                                                </Show>
                                                <span class="lb-col-score lb-score-val">
                                                    {currentGame().timeBased
                                                        ? (entry.timeTakenMs != null ? formatTime(entry.timeTakenMs) : '—')
                                                        : entry.score}
                                                </span>
                                                <span class="lb-col-date lb-muted">{new Date(entry.recordedAt).toLocaleDateString()}</span>
                                            </div>
                                        </>
                                    );
                                }}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>
        </main>
    );
}
