import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@slutsnus/shared';
import { activeGames } from './index';

export function gameHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket,
): void {
    const userId = socket.data.userId as string;

    socket.on('game:action', ({ roomCode, action }) => {
        const engine = activeGames.get(roomCode);
        if (!engine) return;
        engine.handleEvent(userId, action);
    });
}
