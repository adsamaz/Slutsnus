import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { LeaderboardEntry } from '@slutsnus/shared';

const router = Router();
router.use(authMiddleware);

router.get('/:gameType', async (req: AuthenticatedRequest, res: Response) => {
    const { gameType } = req.params;
    try {
        const entries = await prisma.leaderboardEntry.findMany({
            where: { gameType },
            orderBy: { score: 'desc' },
            take: 50,
            include: { user: { select: { username: true } } },
        });

        const result: LeaderboardEntry[] = entries.map((e, i) => ({
            rank: i + 1,
            userId: e.userId,
            username: e.user.username,
            score: e.score,
            recordedAt: e.recordedAt.toISOString(),
        }));

        res.json(result);
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
