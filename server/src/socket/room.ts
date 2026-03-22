import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, RoomInfo, RoomPlayer, GameResult, PlayerInfo } from '@slutsnus/shared';
import { prisma } from '../db/client';
import { gameRegistry, TurnBasedGameEngine } from '../games/registry';
import { activeGames, onlineUsers } from './index';
type RoomPlayerWithUser = Awaited<ReturnType<typeof prisma.roomPlayer.findFirstOrThrow<{ include: { user: true } }>>>;

// Tracks pending cleanup timers when all players in a room go offline (REQ-MULTI-04)
export const activeGameCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Tracks game:ready acknowledgements before the engine starts
const pendingGameStarts = new Map<string, { readySet: Set<string>; startFn: () => void }>();

async function buildRoomInfo(roomId: string): Promise<RoomInfo | null> {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { players: { include: { user: true } } },
    });
    if (!room) return null;
    const players: RoomPlayer[] = room.players.map((rp: RoomPlayerWithUser) => ({
        userId: rp.userId,
        username: rp.user.username,
        avatarUrl: rp.user.avatarUrl,
        ready: rp.ready,
    }));
    return {
        id: room.id,
        code: room.code,
        gameType: room.gameType as RoomInfo['gameType'],
        hostId: room.hostId,
        status: room.status as RoomInfo['status'],
        players,
        maxPlayers: room.maxPlayers,
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

            // Reconnect: if a game is in progress, send this player their current state (REQ-MULTI-03)
            const existingEngine = activeGames.get(roomCode);
            if (existingEngine) {
                if (typeof (existingEngine as TurnBasedGameEngine).projectState === 'function') {
                    const snapshot = (existingEngine as TurnBasedGameEngine).projectState(userId);
                    socket.emit('game:state', { state: snapshot });
                } else {
                    const snapshot = existingEngine.getState();
                    if (snapshot !== null) socket.emit('game:state', { state: snapshot });
                }
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
            if (room.hostId === userId && remaining.length > 0) {
                io.to(roomCode).emit('room:dissolved');
                await prisma.roomPlayer.deleteMany({ where: { roomId: room.id } });
                await prisma.room.delete({ where: { id: room.id } });
                return;
            }
            if (remaining.length === 0) {
                await prisma.room.delete({ where: { id: room.id } });
                return;
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
            const isSolo = room.players.length === 1 && room.players[0].userId === room.hostId;
            if (!isSolo && room.players.length < 2) {
                socket.emit('room:error', { message: 'Need at least 2 players to start' });
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

            const humanPlayers: PlayerInfo[] = room.players.map((rp: RoomPlayerWithUser) => ({
                userId: rp.userId,
                username: rp.user.username,
            }));

            // For snus-arena, infer mode from human player count:
            //   1 → solo (add 1 bot)
            //   2 → 1v1 (no bots)
            //   3 → 2v1 (no bots, engine assigns [0,1]=alpha [2]=beta)
            //   4 → 2v2 (no bots, engine assigns [0,1]=alpha [2,3]=beta)
            const players: PlayerInfo[] = [...humanPlayers];
            if (room.gameType === 'snus-arena' && humanPlayers.length === 1) {
                players.push({ userId: 'bot-0', username: 'Bot' });
            }
            // For snus-farm solo, inject a bot so the right pen has an owner
            if (room.gameType === 'snus-farm' && humanPlayers.length === 1) {
                players.push({ userId: 'bot-0', username: 'Bot' });
            }

            const EngineClass = gameRegistry[room.gameType];
            const engine = new EngineClass();

            const onUpdate = async (state: unknown) => {
                // Per-player projection: turn-based state updates use { forUserId, state } wrapper
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
                    // Fallback room-broadcast
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
                    await prisma.roomPlayer.updateMany({ where: { roomId: room.id }, data: { ready: false } }).catch(() => { /* intentionally ignored */ });

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
                                    timeTakenMs: result.timeTakenMs ?? null,
                                },
                            });
                        }
                    } catch { /* intentionally ignored */ }
                }
            };

            // Destroy any previously running engine for this room before starting a new one
            const existingEngine = activeGames.get(roomCode);
            if (existingEngine) {
                existingEngine.destroy();
                activeGames.delete(roomCode);
            }

            activeGames.set(roomCode, engine);

            // Clear any stale pending start for this room
            pendingGameStarts.delete(roomCode);

            pendingGameStarts.set(roomCode, {
                readySet: new Set(),
                startFn: () => {
                    engine.init(room.id, players, onUpdate);
                },
            });

            io.to(roomCode).emit('room:started', { roomCode });
        } catch {
            socket.emit('room:error', { message: 'Failed to start game' });
        }
    });

    socket.on('game:ready', async ({ roomCode }) => {
        const pending = pendingGameStarts.get(roomCode.toUpperCase());
        if (!pending) return;

        pending.readySet.add(userId);

        const room = await prisma.room.findUnique({
            where: { code: roomCode.toUpperCase() },
            include: { players: true },
        });
        if (!room) return;

        // Only wait for human players (bots don't emit game:ready)
        const allReady = room.players.every((p: { userId: string }) => pending.readySet.has(p.userId));
        if (allReady) {
            pendingGameStarts.delete(roomCode.toUpperCase());
            pending.startFn();
        }
    });
}
