import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { LeaderboardEntry } from '@slutsnus/shared';
import { Prisma } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

router.get('/:gameType', async (req: AuthenticatedRequest, res: Response) => {
    const gameType = req.params.gameType as string;
    try {
        const rows = await prisma.leaderboardEntry.groupBy({
            by: ['userId'],
            where: { gameType },
            _max: { score: true, recordedAt: true },
            orderBy: { _max: { score: 'desc' } },
            take: 50,
        });

        type GroupByRow = (typeof rows)[number];
        const userIds = rows.map((r: GroupByRow) => r.userId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true },
        });
        const usernameById = new Map(users.map((u: { id: string; username: string }) => [u.id, u.username]));

        const result: LeaderboardEntry[] = rows.map((r: GroupByRow, i: number) => ({
            rank: i + 1,
            userId: r.userId,
            username: usernameById.get(r.userId) ?? r.userId,
            score: r._max?.score ?? 0,
            recordedAt: (r._max?.recordedAt ?? new Date()).toISOString(),
        }));

        res.json({ entries: result });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
