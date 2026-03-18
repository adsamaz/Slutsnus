import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { RoomInfo, RoomPlayer } from '@slutsnus/shared';

type RoomPlayerWithUser = Awaited<ReturnType<typeof prisma.roomPlayer.findFirstOrThrow<{ include: { user: true } }>>>;

const router = Router();
router.use(authMiddleware);

function generateCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function buildRoomInfo(roomId: string): Promise<RoomInfo | null> {
    const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { players: { include: { user: true } } },
    });
    if (!room) return null;

    const players: RoomPlayer[] = room.players.map((rp: RoomPlayerWithUser) => ({
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

router.post('/create', async (req: AuthenticatedRequest, res: Response) => {
    const { gameType } = req.body as { gameType: string };
    if (!gameType) {
        res.status(400).json({ error: 'gameType is required' });
        return;
    }

    try {
        let code = generateCode();
        let attempts = 0;
        while (await prisma.room.findUnique({ where: { code } })) {
            code = generateCode();
            if (++attempts > 10) {
                res.status(500).json({ error: 'Could not generate unique room code' });
                return;
            }
        }

        const room = await prisma.room.create({
            data: {
                code,
                gameType,
                hostId: req.user!.userId,
                players: { create: { userId: req.user!.userId, ready: false } },
            },
        });

        res.status(201).json(await buildRoomInfo(room.id));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/join', async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.body as { code: string };
    if (!code) {
        res.status(400).json({ error: 'Room code is required' });
        return;
    }

    try {
        const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }
        if (room.status !== 'waiting') {
            res.status(400).json({ error: 'Room is not accepting players' });
            return;
        }

        const existing = await prisma.roomPlayer.findUnique({
            where: { roomId_userId: { roomId: room.id, userId: req.user!.userId } },
        });
        if (!existing) {
            await prisma.roomPlayer.create({
                data: { roomId: room.id, userId: req.user!.userId, ready: false },
            });
        }

        res.json(await buildRoomInfo(room.id));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:code', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const code = req.params.code as string;
        const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }
        res.json(await buildRoomInfo(room.id));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:code/leave', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const code = req.params.code as string;
        const room = await prisma.room.findUnique({ where: { code: code.toUpperCase() } });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        await prisma.roomPlayer.deleteMany({
            where: { roomId: room.id, userId: req.user!.userId },
        });

        const remaining = await prisma.roomPlayer.findMany({ where: { roomId: room.id } });
        if (remaining.length === 0) {
            await prisma.room.delete({ where: { id: room.id } });
            res.json({ ok: true });
            return;
        }

        // Transfer host if the leaver was the host
        if (room.hostId === req.user!.userId) {
            await prisma.room.update({
                where: { id: room.id },
                data: { hostId: remaining[0].userId },
            });
        }

        res.json(await buildRoomInfo(room.id));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
export { buildRoomInfo };
