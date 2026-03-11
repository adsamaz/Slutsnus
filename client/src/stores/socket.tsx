import {
    createContext,
    useContext,
    createEffect,
    onCleanup,
    ParentComponent,
} from 'solid-js';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@slutsnus/shared';
import { useAuth } from './auth';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketCtx = createContext<AppSocket | null>(null);

export const SocketProvider: ParentComponent = (props) => {
    const socket: AppSocket = io({ withCredentials: true, autoConnect: false });
    const [authState] = useAuth();

    createEffect(() => {
        if (authState.user) {
            socket.connect();
        } else {
            socket.disconnect();
        }
    });

    onCleanup(() => {
        socket.disconnect();
    });

    return <SocketCtx.Provider value={ socket }> { props.children } </SocketCtx.Provider>;
};

export function useSocket(): AppSocket {
    const ctx = useContext(SocketCtx);
    if (!ctx) throw new Error('useSocket must be used within SocketProvider');
    return ctx;
}
