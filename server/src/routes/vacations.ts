import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { VacationEntryData, VacationUserOption, isValidVacationIcon } from '@slutsnus/shared';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnly(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
}

function toEntryData(
    entry: { id: string; userId: string; startDate: Date; endDate: Date; icon: string; title: string | null; createdAt: Date; user: { username: string; avatarUrl: string | null } },
    viewerId: string | undefined,
): VacationEntryData {
    return {
        id: entry.id,
        userId: entry.userId,
        username: entry.user.username,
        avatarUrl: entry.user.avatarUrl,
        startDate: entry.startDate.toISOString().slice(0, 10),
        endDate: entry.endDate.toISOString().slice(0, 10),
        icon: entry.icon as VacationEntryData['icon'],
        title: entry.title,
        createdAt: entry.createdAt.toISOString(),
        isMine: entry.userId === viewerId,
    };
}

// GET /api/vacations — list entries overlapping [start, end], filtered by the viewer's hidden users
router.get('/', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const start = req.query.start as string;
    const end = req.query.end as string;
    if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
        res.status(400).json({ error: 'start and end query params (YYYY-MM-DD) are required' });
        return;
    }

    try {
        const viewerId = req.user?.userId;
        let hiddenIds: string[] = [];
        if (viewerId) {
            const hidden = await prisma.vacationHiddenUser.findMany({
                where: { viewerId },
                select: { hiddenUserId: true },
            });
            hiddenIds = hidden.map((h) => h.hiddenUserId);
        }

        const entries = await prisma.vacationEntry.findMany({
            where: {
                startDate: { lte: toDateOnly(end) },
                endDate: { gte: toDateOnly(start) },
                ...(hiddenIds.length > 0 ? { userId: { notIn: hiddenIds } } : {}),
            },
            include: { user: { select: { username: true, avatarUrl: true } } },
            orderBy: { startDate: 'asc' },
        });

        res.json(entries.map((e) => toEntryData(e, viewerId)));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/vacations/users — every other user + this viewer's current hide-state
router.get('/users', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const viewerId = req.user!.userId;
        const [users, hidden] = await Promise.all([
            prisma.user.findMany({
                where: { NOT: { id: viewerId } },
                select: { id: true, username: true, avatarUrl: true },
                orderBy: { username: 'asc' },
            }),
            prisma.vacationHiddenUser.findMany({
                where: { viewerId },
                select: { hiddenUserId: true },
            }),
        ]);
        const hiddenSet = new Set(hidden.map((h) => h.hiddenUserId));

        const result: VacationUserOption[] = users.map((u) => ({
            id: u.id,
            username: u.username,
            avatarUrl: u.avatarUrl,
            hidden: hiddenSet.has(u.id),
        }));
        res.json(result);
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/vacations/hidden-users/:userId — hide a user's entries from the current viewer
router.post('/hidden-users/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const viewerId = req.user!.userId;
    const targetId = req.params.userId as string;
    if (targetId === viewerId) {
        res.status(400).json({ error: 'Cannot hide yourself' });
        return;
    }

    try {
        const target = await prisma.user.findUnique({ where: { id: targetId } });
        if (!target) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await prisma.vacationHiddenUser.upsert({
            where: { viewerId_hiddenUserId: { viewerId, hiddenUserId: targetId } },
            create: { viewerId, hiddenUserId: targetId },
            update: {},
        });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/vacations/hidden-users/:userId — unhide a user
router.delete('/hidden-users/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.vacationHiddenUser.deleteMany({
            where: { viewerId: req.user!.userId, hiddenUserId: req.params.userId as string },
        });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

function validateEntryBody(body: unknown): { startDate: string; endDate: string; icon: string; title: string | null } | { error: string } {
    const b = body as Record<string, unknown>;
    const startDate = typeof b.startDate === 'string' ? b.startDate : '';
    const endDate = typeof b.endDate === 'string' ? b.endDate : '';
    const icon = typeof b.icon === 'string' ? b.icon : '';

    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
        return { error: 'startDate and endDate must be YYYY-MM-DD' };
    }
    if (toDateOnly(startDate).getTime() > toDateOnly(endDate).getTime()) {
        return { error: 'Start date must be before or equal to end date' };
    }
    if (!isValidVacationIcon(icon)) {
        return { error: 'Invalid icon' };
    }
    const title = typeof b.title === 'string' ? (b.title.trim().slice(0, 60) || null) : null;

    return { startDate, endDate, icon, title };
}

// POST /api/vacations — create a new entry owned by the current user
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const validated = validateEntryBody(req.body);
    if ('error' in validated) {
        res.status(400).json({ error: validated.error });
        return;
    }

    try {
        const entry = await prisma.vacationEntry.create({
            data: {
                userId: req.user!.userId,
                startDate: toDateOnly(validated.startDate),
                endDate: toDateOnly(validated.endDate),
                icon: validated.icon,
                title: validated.title,
            },
            include: { user: { select: { username: true, avatarUrl: true } } },
        });
        res.status(201).json(toEntryData(entry, req.user!.userId));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/vacations/:id — update own entry
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const validated = validateEntryBody(req.body);
    if ('error' in validated) {
        res.status(400).json({ error: validated.error });
        return;
    }

    try {
        const existing = await prisma.vacationEntry.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ error: 'Not your entry' });
            return;
        }

        const entry = await prisma.vacationEntry.update({
            where: { id: existing.id },
            data: {
                startDate: toDateOnly(validated.startDate),
                endDate: toDateOnly(validated.endDate),
                icon: validated.icon,
                title: validated.title,
            },
            include: { user: { select: { username: true, avatarUrl: true } } },
        });
        res.json(toEntryData(entry, req.user!.userId));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/vacations/:id — delete own entry
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const existing = await prisma.vacationEntry.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ error: 'Not your entry' });
            return;
        }

        await prisma.vacationEntry.delete({ where: { id: existing.id } });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
