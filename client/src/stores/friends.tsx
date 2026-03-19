import {
    createContext,
    useContext,
    onMount,
    onCleanup,
    ParentComponent,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { FriendInfo, UserPublic, GameType } from '@slutsnus/shared';
import { useSocket } from './socket';
import { showToast } from '../components/Toast';

export interface PendingInvite {
    fromUserId: string;
    fromUsername: string;
    roomCode: string;
    gameType: GameType;
}

interface FriendsState {
    friends: FriendInfo[];
    pendingInvite: PendingInvite | null;
}

interface FriendsActions {
    fetchFriends(): Promise<void>;
    sendRequest(targetUserId: string): Promise<void>;
    acceptRequest(requesterId: string): Promise<void>;
    declineRequest(requesterId: string): Promise<void>;
    removeFriend(userId: string): Promise<void>;
    searchUsers(q: string): Promise<UserPublic[]>;
    inviteFriend(targetUserId: string, roomCode: string): void;
    acceptInvite(roomCode: string): void;
    clearInvite(): void;
}

type FriendsContext = [FriendsState, FriendsActions];

const FriendsCtx = createContext<FriendsContext>();

export const FriendsProvider: ParentComponent = (props) => {
    const [state, setState] = createStore<FriendsState>({ friends: [], pendingInvite: null });
    const socket = useSocket();

    const fetchFriends = async () => {
        const res = await fetch('/api/friends', { credentials: 'include' });
        if (res.ok) setState('friends', await res.json() as FriendInfo[]);
    };

    const sendRequest = async (targetUserId: string) => {
        const res = await fetch('/api/friends/request', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId }),
        });
        if (!res.ok) throw new Error((await res.json() as { error: string }).error);
        await fetchFriends();
    };

    const acceptRequest = async (requesterId: string) => {
        const res = await fetch('/api/friends/accept', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requesterId }),
        });
        if (!res.ok) throw new Error((await res.json() as { error: string }).error);
        await fetchFriends();
    };

    const declineRequest = async (requesterId: string) => {
        const res = await fetch('/api/friends/decline', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requesterId }),
        });
        if (!res.ok) throw new Error((await res.json() as { error: string }).error);
        await fetchFriends();
    };

    const removeFriend = async (userId: string) => {
        await fetch(`/api/friends/${userId}`, { method: 'DELETE', credentials: 'include' });
        await fetchFriends();
    };

    const searchUsers = async (q: string): Promise<UserPublic[]> => {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(q)}`, {
            credentials: 'include',
        });
        if (!res.ok) return [];
        return res.json();
    };

    const inviteFriend = (targetUserId: string, roomCode: string) => {
        socket.emit('friends:invite', { targetUserId, roomCode });
    };

    const acceptInvite = (roomCode: string) => {
        socket.emit('friends:inviteAccept', { roomCode });
        setState('pendingInvite', null);
    };

    const clearInvite = () => setState('pendingInvite', null);

    onMount(() => {
        fetchFriends();

        socket.on('friends:status', ({ userId, online }) => {
            setState('friends', (f) => f.userId === userId, 'online', online);
        });

        socket.on('friends:update', () => {
            fetchFriends();
        });

        socket.on('friends:invite', (data) => {
            setState('pendingInvite', data);
            showToast(
                `${data.fromUsername} invited you to play ${data.gameType}!`,
                'info',
                8000,
            );
        });
    });

    onCleanup(() => {
        socket.off('friends:status');
        socket.off('friends:update');
        socket.off('friends:invite');
    });

    return (
        <FriendsCtx.Provider
            value={[state, { fetchFriends, sendRequest, acceptRequest, declineRequest, removeFriend, searchUsers, inviteFriend, acceptInvite, clearInvite }]}
        >
            {props.children}
        </FriendsCtx.Provider>
    );
};

export function useFriends(): FriendsContext {
    const ctx = useContext(FriendsCtx);
    if (!ctx) throw new Error('useFriends must be used within FriendsProvider');
    return ctx;
}
