import {
    createContext,
    useContext,
    onMount,
    onCleanup,
    ParentComponent,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { RoomInfo, GameType } from '@slutsnus/shared';
import { useSocket } from './socket';

interface RoomState {
    room: RoomInfo | null;
}

interface RoomActions {
    createRoom(gameType: GameType): Promise<string>;
    joinRoom(code: string): Promise<void>;
    leaveRoom(): Promise<void>;
    setRoom(room: RoomInfo): void;
}

type RoomContext = [RoomState, RoomActions];

const RoomCtx = createContext<RoomContext>();

export const RoomProvider: ParentComponent = (props) => {
    const [state, setState] = createStore<RoomState>({ room: null });
    const socket = useSocket();

    const createRoom = async (gameType: GameType): Promise<string> => {
        const res = await fetch('/api/rooms/create', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameType }),
        });
        if (!res.ok) {
            const err = await res.json() as { error: string };
            throw new Error(err.error);
        }
        const room = await res.json() as RoomInfo;
        setState('room', room);
        return room.code;
    };

    const joinRoom = async (code: string): Promise<void> => {
        const res = await fetch('/api/rooms/join', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        if (!res.ok) {
            const err = await res.json() as { error: string };
            throw new Error(err.error);
        }
        const room = await res.json() as RoomInfo;
        setState('room', room);
    };

    const leaveRoom = async (): Promise<void> => {
        const code = state.room?.code;
        if (!code) return;
        socket.emit('room:leave', { roomCode: code });
        await fetch(`/api/rooms/${code}/leave`, { method: 'DELETE', credentials: 'include' });
        setState('room', null);
    };

    const setRoom = (room: RoomInfo) => setState('room', room);

    onMount(() => {
        socket.on('room:update', ({ room }) => setState('room', room));
    });

    onCleanup(() => {
        socket.off('room:update');
    });

    return (
        <RoomCtx.Provider value= { [state, { createRoom, joinRoom, leaveRoom, setRoom }]} >
        { props.children }
        </RoomCtx.Provider>
  );
};

export function useRoom(): RoomContext {
    const ctx = useContext(RoomCtx);
    if (!ctx) throw new Error('useRoom must be used within RoomProvider');
    return ctx;
}
