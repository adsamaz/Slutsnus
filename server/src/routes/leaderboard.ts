import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { LeaderboardEntry } from '@slutsnus/shared';

const router = Router();
router.use(authMiddleware);

// Games where lower time = better (show fastest wins)
const TIME_BASED_GAMES = new Set(['snus-farm', 'snus-arena']);

router.get('/:gameType', async (req: AuthenticatedRequest, res: Response) => {
    const gameType = req.params.gameType as string;
    try {
        let result: LeaderboardEntry[];

        if (TIME_BASED_GAMES.has(gameType)) {
            // For time-based games: best = fastest win (lowest timeTakenMs, rank 1 only)
            // Find each user's best (min) timeTakenMs where they won
            const rows = await prisma.leaderboardEntry.groupBy({
                by: ['userId'],
                where: { gameType, timeTakenMs: { not: null } },
                _min: { timeTakenMs: true, recordedAt: true },
                orderBy: { _min: { timeTakenMs: 'asc' } },
                take: 50,
            });

            type TimeGroupByRow = (typeof rows)[number];
            const userIds = rows.map((r: TimeGroupByRow) => r.userId);
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true },
            });
            const usernameById = new Map(users.map((u: { id: string; username: string }) => [u.id, u.username]));

            result = rows.map((r: TimeGroupByRow, i: number) => ({
                rank: i + 1,
                userId: r.userId,
                username: usernameById.get(r.userId) ?? r.userId,
                score: 0,
                timeTakenMs: r._min?.timeTakenMs ?? undefined,
                recordedAt: (r._min?.recordedAt ?? new Date()).toISOString(),
            }));
        } else {
            // For score-based games: best = highest score
            const rows = await prisma.leaderboardEntry.groupBy({
                by: ['userId'],
                where: { gameType },
                _max: { score: true, recordedAt: true },
                orderBy: { _max: { score: 'desc' } },
                take: 50,
            });

            type ScoreGroupByRow = (typeof rows)[number];
            const userIds = rows.map((r: ScoreGroupByRow) => r.userId);
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true },
            });
            const usernameById = new Map(users.map((u: { id: string; username: string }) => [u.id, u.username]));

            result = rows.map((r: ScoreGroupByRow, i: number) => ({
                rank: i + 1,
                userId: r.userId,
                username: usernameById.get(r.userId) ?? r.userId,
                score: r._max?.score ?? 0,
                recordedAt: (r._max?.recordedAt ?? new Date()).toISOString(),
            }));
        }

        res.json({ entries: result });
    } catch (err) {
        console.error('[leaderboard] error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
