import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { parse as parseCookies } from 'cookie';
import { ClientToServerEvents, ServerToClientEvents } from '@slutsnus/shared';
import { GameEngine } from '../games/registry';
import { roomHandlers, activeGameCleanupTimers } from './room';
import { gameHandlers } from './game';
import { friendsHandlers } from './friends';

// userId → set of socketIds
export const onlineUsers = new Map<string, Set<string>>();
// roomCode → active game engine
export const activeGames = new Map<string, GameEngine>();

export let io: Server<ClientToServerEvents, ServerToClientEvents>;

export function initSocket(httpServer: HttpServer): void {
    io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            credentials: true,
        },
    });

    // Auth middleware: verify JWT from httpOnly cookie
    io.use((socket, next) => {
        const rawCookies = socket.handshake.headers.cookie ?? '';
        const cookies = parseCookies(rawCookies);
        const token = cookies.token;

        if (!token) {
            next(new Error('Unauthorized'));
            return;
        }

        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
                userId: string;
                username: string;
            };
            socket.data.userId = payload.userId;
            socket.data.username = payload.username;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userId = socket.data.userId as string;

        // Track online presence
        if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
        onlineUsers.get(userId)!.add(socket.id);

        // Notify friends of online status
        broadcastFriendStatus(socket, userId, true);

        socket.on('disconnect', () => {
            const sockets = onlineUsers.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    onlineUsers.delete(userId);
                    broadcastFriendStatus(socket, userId, false);
                }
            }

            // 5-minute session cleanup when all players in a room go offline (REQ-MULTI-04)
            for (const roomCode of socket.rooms) {
                if (!activeGames.has(roomCode)) continue;
                const roomSockets = io.sockets.adapter.rooms.get(roomCode);
                const anyOnline = roomSockets
                    ? [...roomSockets].some(sid => sid !== socket.id)
                    : false;
                if (!anyOnline) {
                    const cleanupTimer = setTimeout(() => {
                        const engine = activeGames.get(roomCode);
                        if (engine) {
                            engine.destroy();
                            activeGames.delete(roomCode);
                        }
                    }, 5 * 60 * 1000);
                    activeGameCleanupTimers.set(roomCode, cleanupTimer);
                }
            }
        });

        roomHandlers(io, socket);
        gameHandlers(io, socket);
        friendsHandlers(io, socket);
    });
}

async function broadcastFriendStatus(
    socket: Socket,
    userId: string,
    online: boolean,
): Promise<void> {
    // We broadcast to all sockets; clients filter by their own friend list.
    socket.broadcast.emit('friends:status', { userId, online });
}
