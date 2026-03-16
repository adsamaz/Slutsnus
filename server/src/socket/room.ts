import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, RoomInfo, RoomPlayer, GameResult, PlayerInfo } from '@slutsnus/shared';
import { prisma } from '../db/client';
import { gameRegistry, TurnBasedGameEngine } from '../games/registry';
import { activeGames, onlineUsers } from './index';

// Tracks pending cleanup timers when all players in a room go offline (REQ-MULTI-04)
const activeGameCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function buildRoomInfo(roomId: string): Promise<RoomInfo | null> {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { players: { include: { user: true } } },
    });
    if (!room) return null;
    const players: RoomPlayer[] = room.players.map((rp) => ({
        userId: rp.userId,
        username: rp.user.username,
        ready: rp.ready,
    }));
    return {
        id: room.id,
        code: room.code,
        gameType: room.gameType as RoomInfo['gameType'],
        hostId: room.hostId,
        status: room.status as RoomInfo['status'],
        players,
    };
}

export function roomHandlers(
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    socket: Socket,
): void {
    const userId = socket.data.userId as string;

    socket.on('room:join', async ({ roomCode }) => {
        try {
            const room = await prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
            if (!room) {
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }

            // Cancel any pending 5-minute cleanup timer for this room on reconnect (REQ-MULTI-04)
            const pendingCleanup = activeGameCleanupTimers.get(roomCode);
            if (pendingCleanup) {
                clearTimeout(pendingCleanup);
                activeGameCleanupTimers.delete(roomCode);
            }

            socket.join(roomCode);
            const info = await buildRoomInfo(room.id);
            if (info) io.to(roomCode).emit('room:update', { room: info });

            // Reconnect: if a game is in progress, send this player their current projected state (REQ-MULTI-03)
            const existingEngine = activeGames.get(roomCode);
            if (existingEngine && typeof (existingEngine as TurnBasedGameEngine).projectState === 'function') {
                const turnEngine = existingEngine as TurnBasedGameEngine;
                const snapshot = turnEngine.projectState(userId);
                socket.emit('game:state', { state: snapshot });
            }
        } catch {
            socket.emit('room:error', { message: 'Failed to join room' });
        }
    });

    socket.on('room:ready', async ({ roomCode }) => {
        try {
            const room = await prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
            if (!room) return;
            await prisma.roomPlayer.updateMany({
                where: { roomId: room.id, userId },
                data: { ready: true },
            });
            const info = await buildRoomInfo(room.id);
            if (info) io.to(roomCode).emit('room:update', { room: info });
        } catch { /* intentionally ignored */ }
    });

    socket.on('room:leave', async ({ roomCode }) => {
        try {
            const room = await prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
            if (!room) return;
            await prisma.roomPlayer.deleteMany({ where: { roomId: room.id, userId } });
            socket.leave(roomCode);

            const remaining = await prisma.roomPlayer.findMany({ where: { roomId: room.id } });
            if (remaining.length === 0) {
                await prisma.room.delete({ where: { id: room.id } });
                return;
            }
            if (room.hostId === userId) {
                await prisma.room.update({ where: { id: room.id }, data: { hostId: remaining[0].userId } });
            }
            const info = await buildRoomInfo(room.id);
            if (info) io.to(roomCode).emit('room:update', { room: info });
        } catch { /* intentionally ignored */ }
    });

    socket.on('room:start', async ({ roomCode }) => {
        try {
            const room = await prisma.room.findUnique({
                where: { code: roomCode.toUpperCase() },
                include: { players: { include: { user: true } } },
            });
            if (!room) {
                socket.emit('room:error', { message: 'Room not found' });
                return;
            }
            if (room.hostId !== userId) {
                socket.emit('room:error', { message: 'Only the host can start the game' });
                return;
            }
            if (!room.players.filter((p: { userId: string; ready: boolean }) => p.userId !== room.hostId).every((p: { userId: string; ready: boolean }) => p.ready)) {
                socket.emit('room:error', { message: 'Not all players are ready' });
                return;
            }
            if (!gameRegistry[room.gameType]) {
                socket.emit('room:error', { message: 'Unknown game type' });
                return;
            }

            await prisma.room.update({ where: { id: room.id }, data: { status: 'playing' } });

            const session = await prisma.gameSession.create({ data: { roomId: room.id } });

            const players: PlayerInfo[] = room.players.map((rp) => ({
                userId: rp.userId,
                username: rp.user.username,
            }));

            const EngineClass = gameRegistry[room.gameType];
            const engine = new EngineClass();

            const onUpdate = async (state: unknown) => {
                // Per-player projection: all Snusking state updates use { forUserId, state } wrapper
                const s = state as { forUserId?: string; state: unknown };
                if (s.forUserId) {
                    // Route to the target player's sockets only (REQ-NFR-01, REQ-MULTI-01)
                    const socketIds = onlineUsers.get(s.forUserId);
                    if (socketIds) {
                        for (const socketId of socketIds) {
                            io.to(socketId).emit('game:state', { state: s.state });
                        }
                    }
                } else {
                    // Fallback room-broadcast (not used by Snusking — kept for safety)
                    io.to(roomCode).emit('game:state', { state });
                }

                // Determine which object carries status/results
                const raw = s.forUserId
                    ? (s.state as { status?: string; results?: GameResult[] })
                    : (state as { status?: string; results?: GameResult[] });

                if (raw.status === 'ended' && raw.results) {
                    io.to(roomCode).emit('game:end', { results: raw.results });
                    activeGames.delete(roomCode);
                    // Reset room to waiting so players can use "Play again"
                    await prisma.room.update({ where: { code: roomCode }, data: { status: 'waiting' } }).catch(() => { /* intentionally ignored */ });

                    // Persist results
                    try {
                        await prisma.gameSession.update({
                            where: { id: session.id },
                            data: { endTime: new Date(), resultJson: JSON.stringify(raw.results) },
                        });
                        for (const result of raw.results) {
                            await prisma.gameSessionPlayer.upsert({
                                where: { sessionId_userId: { sessionId: session.id, userId: result.userId } },
                                create: { sessionId: session.id, userId: result.userId, score: result.score, rank: result.rank },
                                update: { score: result.score, rank: result.rank },
                            });
                            await prisma.leaderboardEntry.create({
                                data: {
                                    gameType: room.gameType,
                                    userId: result.userId,
                                    score: result.score,
                                },
                            });
                        }
                    } catch { /* intentionally ignored */ }
                }
            };

            engine.init(room.id, players, onUpdate);
            activeGames.set(roomCode, engine);

            io.to(roomCode).emit('room:started', { roomCode });

            // 5-minute session cleanup when all players disconnect (REQ-MULTI-04)
            // Listen for any socket disconnect and check if the room is now all-offline
            io.in(roomCode).fetchSockets().then((roomSockets) => {
                for (const roomSocket of roomSockets) {
                    roomSocket.on('disconnect', () => {
                        // Check if any player in this room is still online
                        const roomPlayerIds = players.map(p => p.userId);
                        const anyOnline = roomPlayerIds.some(
                            pid => (onlineUsers.get(pid)?.size ?? 0) > 0,
                        );
                        if (!anyOnline && activeGames.has(roomCode)) {
                            const cleanupTimer = setTimeout(() => {
                                const activeEngine = activeGames.get(roomCode);
                                if (activeEngine) {
                                    activeEngine.destroy();
                                    activeGames.delete(roomCode);
                                }
                            }, 5 * 60 * 1000);
                            activeGameCleanupTimers.set(roomCode, cleanupTimer);
                        }
                    });
                }
            }).catch(() => { /* intentionally ignored */ });
        } catch {
            socket.emit('room:error', { message: 'Failed to start game' });
        }
    });
}
