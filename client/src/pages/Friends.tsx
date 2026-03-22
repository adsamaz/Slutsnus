import { createSignal, For, Show } from 'solid-js';
import { useFriends } from '../stores/friends';
import Button from '../components/Button';
import Avatar from '../components/Avatar';
import type { UserPublic } from '@slutsnus/shared';

export default function Friends() {
    const [friendsState, friendsActions] = useFriends();

    const [searchQuery, setSearchQuery] = createSignal('');
    const [searching, setSearching] = createSignal(false);
    const [searchResults, setSearchResults] = createSignal<UserPublic[]>([]);
    const handleSearch = async () => {
        const q = searchQuery().trim();
        if (!q) return;
        setSearching(true);
        try {
            const results = await friendsActions.searchUsers(q);
            setSearchResults(results);
        } finally {
            setSearching(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const accepted = () => friendsState.friends.filter((f) => f.friendshipStatus === 'accepted');
    const pending = () => friendsState.friends.filter((f) => f.friendshipStatus === 'pending' && f.direction === 'incoming');
    const outgoing = () => friendsState.friends.filter((f) => f.friendshipStatus === 'pending' && f.direction === 'outgoing');

    return (
        <main class="page">
            <h2 class="page-title">Friends</h2>

            {/* Search */}
            <div class="card" style={{ 'margin-bottom': '1.5rem' }}>
                <h3>Find Players</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        class="input"
                        style={{ flex: 1 }}
                        placeholder="Search by username..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <Button onClick={handleSearch} disabled={searching()}>
                        {searching() ? 'Searching...' : 'Search'}
                    </Button>
                </div>
                <Show when={searchResults().length > 0}>
                    <div class="search-results" style={{ 'margin-top': '1rem' }}>
                        <For each={searchResults()}>
                            {(user) => {
                                const existing = () => friendsState.friends.find((f) => f.userId === user.id);
                                return (
                                    <div class="friend-item">
                                        <Avatar username={user.username} avatarUrl={user.avatarUrl} />
                                        <span>{user.username}</span>
                                        <Show
                                            when={!existing()}
                                            fallback={<span class="muted" style={{ 'margin-left': 'auto', 'font-size': '0.8rem' }}>{existing()?.friendshipStatus === 'accepted' ? 'Friends' : 'Pending...'}</span>}
                                        >
                                            <Button
                                                class="btn btn-secondary"
                                                style={{ 'margin-left': 'auto', padding: '4px 10px', 'font-size': '0.8rem' }}
                                                onClick={() => friendsActions.sendRequest(user.id)}
                                            >
                                                Add Friend
                                            </Button>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>
            </div>

            {/* Incoming Pending Requests */}
            <Show when={pending().length > 0}>
                <div class="card" style={{ 'margin-bottom': '1.5rem' }}>
                    <h3>Pending Requests</h3>
                    <For each={pending()}>
                        {(f) => (
                            <div class="friend-item">
                                <Avatar username={f.username} avatarUrl={f.avatarUrl} />
                                <span>{f.username}</span>
                                <div style={{ 'margin-left': 'auto', display: 'flex', gap: '6px' }}>
                                    <Button
                                        class="btn btn-primary"
                                        style={{ padding: '4px 10px', 'font-size': '0.8rem' }}
                                        onClick={() => friendsActions.acceptRequest(f.userId)}
                                    >
                                        Accept
                                    </Button>
                                    <Button
                                        class="btn btn-danger"
                                        style={{ padding: '4px 10px', 'font-size': '0.8rem' }}
                                        onClick={() => friendsActions.declineRequest(f.userId)}
                                    >
                                        Decline
                                    </Button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* Outgoing Pending Requests */}
            <Show when={outgoing().length > 0}>
                <div class="card" style={{ 'margin-bottom': '1.5rem' }}>
                    <h3>Sent Requests</h3>
                    <For each={outgoing()}>
                        {(f) => (
                            <div class="friend-item">
                                <Avatar username={f.username} avatarUrl={f.avatarUrl} />
                                <span>{f.username}</span>
                                <span class="muted" style={{ 'margin-left': 'auto', 'font-size': '0.8rem' }}>Pending...</span>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* Friends List */}
            <div class="card">
                <h3>Friends ({accepted().length})</h3>
                <Show when={accepted().length === 0}>
                    <p class="muted">No friends yet. Search for players above!</p>
                </Show>
                <For each={accepted()}>
                    {(f) => (
                        <div class="friend-item">
                            <Avatar username={f.username} avatarUrl={f.avatarUrl} />
                            <span class={`status-dot ${f.online ? 'online' : 'offline'}`} />
                            <span>{f.username}</span>
                            <Show when={f.online}>
                                <span class="online-label">Online</span>
                            </Show>
                            <div style={{ 'margin-left': 'auto', display: 'flex', gap: '6px' }}>
<Button
                                    class="btn btn-danger"
                                    style={{ padding: '4px 4px', 'font-size': '0.8rem' }}
                                    onClick={() => friendsActions.removeFriend(f.userId)}
                                >
                                    Remove
                                </Button>
                            </div>
                        </div>
                    )}
                </For>
            </div>
        </main>
    );
}
