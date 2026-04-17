import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { LeaderboardEntry } from '@slutsnus/shared';

const router = Router();
router.use(optionalAuthMiddleware);

// Games where lower time = better (show fastest wins)
const TIME_BASED_GAMES = new Set(['snus-farm', 'snus-arena']);
const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

router.get('/:gameType', async (req: AuthenticatedRequest, res: Response) => {
    const gameType = req.params.gameType as string;
    try {
        let result: LeaderboardEntry[];

        if (gameType === 'snusfactory') {
            // Group by userId + difficulty, pick fastest winning run per combination
            const rows = await prisma.leaderboardEntry.groupBy({
                by: ['userId', 'difficulty'],
                where: { gameType, timeTakenMs: { not: null }, difficulty: { not: null } },
                _min: { timeTakenMs: true, recordedAt: true },
                orderBy: { _min: { timeTakenMs: 'asc' } },
            });

            // Sort: difficulty order (easy < medium < hard), then time ascending
            rows.sort((a, b) => {
                const da = DIFFICULTY_ORDER[a.difficulty ?? ''] ?? 99;
                const db = DIFFICULTY_ORDER[b.difficulty ?? ''] ?? 99;
                if (da !== db) return da - db;
                return (a._min?.timeTakenMs ?? 0) - (b._min?.timeTakenMs ?? 0);
            });

            const userIds = [...new Set(rows.map(r => r.userId))];
            const users = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, username: true, avatarUrl: true },
            });
            const userById = new Map(users.map((u: { id: string; username: string; avatarUrl: string | null }) => [u.id, u]));

            // Rank within each difficulty group
            let prevDifficulty: string | null = null;
            let rankInGroup = 0;
            result = rows.map(r => {
                if (r.difficulty !== prevDifficulty) { prevDifficulty = r.difficulty ?? null; rankInGroup = 0; }
                rankInGroup++;
                return {
                    rank: rankInGroup,
                    userId: r.userId,
                    username: userById.get(r.userId)?.username ?? r.userId,
                    avatarUrl: userById.get(r.userId)?.avatarUrl,
                    score: 0,
                    timeTakenMs: r._min?.timeTakenMs ?? undefined,
                    difficulty: r.difficulty,
                    recordedAt: (r._min?.recordedAt ?? new Date()).toISOString(),
                };
            });
        } else if (TIME_BASED_GAMES.has(gameType)) {
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
                select: { id: true, username: true, avatarUrl: true },
            });
            const userById = new Map(users.map((u: { id: string; username: string; avatarUrl: string | null }) => [u.id, u]));

            result = rows.map((r: TimeGroupByRow, i: number) => ({
                rank: i + 1,
                userId: r.userId,
                username: userById.get(r.userId)?.username ?? r.userId,
                avatarUrl: userById.get(r.userId)?.avatarUrl,
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
                select: { id: true, username: true, avatarUrl: true },
            });
            const userById = new Map(users.map((u: { id: string; username: string; avatarUrl: string | null }) => [u.id, u]));

            result = rows.map((r: ScoreGroupByRow, i: number) => ({
                rank: i + 1,
                userId: r.userId,
                username: userById.get(r.userId)?.username ?? r.userId,
                avatarUrl: userById.get(r.userId)?.avatarUrl,
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
