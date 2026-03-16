import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, GameType } from '@slutsnus/shared';
import { onlineUsers } from './index';
import { prisma } from '../db/client';

export function friendsHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket,
): void {
    const userId = socket.data.userId as string;
    const username = socket.data.username as string;

    socket.on('friends:invite', async ({ targetUserId, roomCode }) => {
        try {
            const room = await prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
            if (!room) return;

            const targetSockets = onlineUsers.get(targetUserId);
            if (!targetSockets) return;

            for (const sid of targetSockets) {
                io.to(sid).emit('friends:invite', {
                    fromUserId: userId,
                    fromUsername: username,
                    roomCode: room.code,
                    gameType: room.gameType as GameType,
                });
            }
        } catch { /* intentionally ignored */ }
    });

    socket.on('friends:inviteAccept', ({ roomCode }) => {
        socket.join(roomCode);
    });
}
