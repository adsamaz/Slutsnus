import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, RoomInfo, RoomPlayer, GameResult, PlayerInfo } from '@slutsnus/shared';
import { prisma } from '../db/client';
import { gameRegistry } from '../games/registry';
import { activeGames } from './index';

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
            socket.join(roomCode);
            const info = await buildRoomInfo(room.id);
            if (info) io.to(roomCode).emit('room:update', { room: info });
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
            if (!room.players.every((p) => p.ready)) {
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
                io.to(roomCode).emit('game:state', { state });

                const s = state as { status: string; results?: GameResult[] };
                if (s.status === 'ended' && s.results) {
                    io.to(roomCode).emit('game:end', { results: s.results });
                    activeGames.delete(roomCode);

                    // Persist results
                    try {
                        await prisma.gameSession.update({
                            where: { id: session.id },
                            data: { endTime: new Date(), resultJson: JSON.stringify(s.results) },
                        });
                        for (const result of s.results) {
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
        } catch {
            socket.emit('room:error', { message: 'Failed to start game' });
        }
    });
}
