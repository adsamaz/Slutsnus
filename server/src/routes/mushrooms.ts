import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, optionalAuthMiddleware, AuthenticatedRequest } from '../middleware/auth';
import {
    MushroomEntryData,
    MushroomAreaData,
    MushroomAreaVertex,
    MushroomVisibility,
    isValidMushroomSpeciesId,
    isValidMushroomVisibility,
    resolveMushroomDisplay,
    computePolygonCentroid,
    HEX_COLOR_RE,
} from '@slutsnus/shared';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_WEIGHT_GRAMS = 100_000;
const MAX_POLYGON_VERTICES = 500;

function toDateOnly(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

// ─── Visibility helpers ─────────────────────────────────────────────────────

async function getFriendIds(viewerId: string): Promise<Set<string>> {
    const friendships = await prisma.friendship.findMany({
        where: {
            status: 'accepted',
            OR: [{ requesterId: viewerId }, { addresseeId: viewerId }],
        },
        select: { requesterId: true, addresseeId: true },
    });
    return new Set(friendships.map((f) => (f.requesterId === viewerId ? f.addresseeId : f.requesterId)));
}

async function isFriendOf(viewerId: string, ownerId: string): Promise<boolean> {
    if (viewerId === ownerId) return true;
    const f = await prisma.friendship.findFirst({
        where: {
            status: 'accepted',
            OR: [
                { requesterId: viewerId, addresseeId: ownerId },
                { requesterId: ownerId, addresseeId: viewerId },
            ],
        },
    });
    return !!f;
}

// Shared by both entries and areas: a 'friends'-visibility row is only visible to
// the specific friends its owner picked (visibleToUserIds), not every friend.
function buildVisibilityWhere(viewerId: string | undefined, friendIds: Set<string>) {
    if (!viewerId) return { visibility: 'public' };
    return {
        OR: [
            { userId: viewerId },
            { visibility: 'public' },
            {
                visibility: 'friends',
                userId: { in: Array.from(friendIds) },
                visibleToUserIds: { has: viewerId },
            },
        ],
    };
}

function canSeeRow(
    row: { userId: string; visibility: string; visibleToUserIds: string[] },
    viewerId: string | undefined,
    friendIds: Set<string>,
): boolean {
    if (row.visibility === 'public') return true;
    if (!viewerId) return false;
    if (row.userId === viewerId) return true;
    return row.visibility === 'friends' && friendIds.has(row.userId) && row.visibleToUserIds.includes(viewerId);
}

function canSeeOptionalAreaRef(
    row: { userId: string; visibility: string; visibleToUserIds: string[] } | null | undefined,
    viewerId: string | undefined,
    friendIds: Set<string>,
): boolean {
    if (!row) return true; // no area attached — nothing to hide
    return canSeeRow(row, viewerId, friendIds);
}

// ─── DTO mappers ────────────────────────────────────────────────────────────

type EntryRow = {
    id: string;
    userId: string;
    areaId: string | null;
    speciesId: string | null;
    customLabel: string | null;
    customColor: string | null;
    weightGrams: number;
    foundDate: Date;
    lat: number;
    lng: number;
    notes: string | null;
    visibility: string;
    visibleToUserIds: string[];
    createdAt: Date;
    user: { username: string; avatarUrl: string | null };
    area: { id: string; userId: string; visibility: string; visibleToUserIds: string[] } | null;
};

function toEntryData(entry: EntryRow, viewerId: string | undefined, friendIds: Set<string>): MushroomEntryData {
    const display = resolveMushroomDisplay(entry);
    const areaVisible = canSeeOptionalAreaRef(entry.area, viewerId, friendIds);
    const isMine = entry.userId === viewerId;
    return {
        id: entry.id,
        userId: entry.userId,
        username: entry.user.username,
        avatarUrl: entry.user.avatarUrl,
        speciesId: entry.speciesId,
        customLabel: entry.customLabel,
        customColor: entry.customColor,
        displayLabel: display.label,
        displayIcon: display.icon,
        displayColor: display.color,
        weightGrams: entry.weightGrams,
        foundDate: entry.foundDate.toISOString().slice(0, 10),
        lat: entry.lat,
        lng: entry.lng,
        notes: entry.notes,
        areaId: areaVisible ? entry.areaId : null,
        visibility: entry.visibility as MushroomVisibility,
        visibleToUserIds: isMine ? entry.visibleToUserIds : [],
        createdAt: entry.createdAt.toISOString(),
        isMine,
    };
}

type AreaRow = {
    id: string;
    userId: string;
    name: string;
    polygonJson: string;
    centerLat: number;
    centerLng: number;
    notes: string | null;
    visibility: string;
    visibleToUserIds: string[];
    createdAt: Date;
    user: { username: string; avatarUrl: string | null };
};

function toAreaData(area: AreaRow, viewerId: string | undefined): MushroomAreaData {
    const isMine = area.userId === viewerId;
    return {
        id: area.id,
        userId: area.userId,
        username: area.user.username,
        avatarUrl: area.user.avatarUrl,
        name: area.name,
        polygon: JSON.parse(area.polygonJson) as MushroomAreaVertex[],
        centerLat: area.centerLat,
        centerLng: area.centerLng,
        notes: area.notes,
        visibility: area.visibility as MushroomVisibility,
        visibleToUserIds: isMine ? area.visibleToUserIds : [],
        createdAt: area.createdAt.toISOString(),
        isMine,
    };
}

const ENTRY_INCLUDE = {
    user: { select: { username: true, avatarUrl: true } },
    area: { select: { id: true, userId: true, visibility: true, visibleToUserIds: true } },
} as const;

const AREA_INCLUDE = {
    user: { select: { username: true, avatarUrl: true } },
} as const;

// ─── Entries ────────────────────────────────────────────────────────────────

// GET /api/mushrooms/entries — visibility-filtered list, optionally scoped to an area/user/date-range
router.get('/entries', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const areaId = req.query.areaId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
        res.status(400).json({ error: 'from/to must be YYYY-MM-DD' });
        return;
    }

    try {
        const viewerId = req.user?.userId;
        const friendIds = viewerId ? await getFriendIds(viewerId) : new Set<string>();

        if (areaId) {
            const area = await prisma.mushroomArea.findUnique({ where: { id: areaId } });
            if (!area || !canSeeRow(area, viewerId, friendIds)) {
                res.status(404).json({ error: 'Area not found' });
                return;
            }
        }

        const entries = await prisma.mushroomEntry.findMany({
            where: {
                AND: [
                    buildVisibilityWhere(viewerId, friendIds),
                    areaId ? { areaId } : {},
                    userId ? { userId } : {},
                    from ? { foundDate: { gte: toDateOnly(from) } } : {},
                    to ? { foundDate: { lte: toDateOnly(to) } } : {},
                ],
            },
            include: ENTRY_INCLUDE,
            orderBy: { foundDate: 'desc' },
            take: 1000,
        });

        res.json(entries.map((e) => toEntryData(e, viewerId, friendIds)));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/mushrooms/entries/:id
router.get('/entries/:id', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const viewerId = req.user?.userId;
        const entry = await prisma.mushroomEntry.findUnique({
            where: { id: req.params.id as string },
            include: ENTRY_INCLUDE,
        });
        if (!entry) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        // entry.area.userId always equals entry.userId (areaId is only assignable to an
        // owned area — see POST/PUT below), so one isFriendOf check covers both rows.
        const friendIds = viewerId && (await isFriendOf(viewerId, entry.userId))
            ? new Set([entry.userId])
            : new Set<string>();
        if (!canSeeRow(entry, viewerId, friendIds)) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        res.json(toEntryData(entry, viewerId, friendIds));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

interface ValidatedEntry {
    speciesId: string | null;
    customLabel: string | null;
    customColor: string | null;
    weightGrams: number;
    foundDate: string;
    lat: number;
    lng: number;
    notes: string | null;
    areaId: string | null;
    visibility: MushroomVisibility;
    visibleToUserIds: string[];
}

function validateEntryBody(body: unknown): ValidatedEntry | { error: string } {
    const b = body as Record<string, unknown>;

    if (!isFiniteInRange(b.weightGrams, 1, MAX_WEIGHT_GRAMS) || !Number.isInteger(b.weightGrams)) {
        return { error: 'weightGrams must be an integer between 1 and 100000' };
    }
    const foundDate = typeof b.foundDate === 'string' ? b.foundDate : '';
    if (!DATE_RE.test(foundDate)) {
        return { error: 'foundDate must be YYYY-MM-DD' };
    }
    if (toDateOnly(foundDate).getTime() > Date.now()) {
        return { error: 'foundDate cannot be in the future' };
    }
    if (!isFiniteInRange(b.lat, -90, 90) || !isFiniteInRange(b.lng, -180, 180)) {
        return { error: 'lat/lng out of range' };
    }

    let speciesId: string | null = null;
    let customLabel: string | null = null;
    let customColor: string | null = null;
    if (typeof b.speciesId === 'string' && b.speciesId) {
        if (!isValidMushroomSpeciesId(b.speciesId)) {
            return { error: 'Invalid speciesId' };
        }
        speciesId = b.speciesId;
    } else {
        const label = typeof b.customLabel === 'string' ? b.customLabel.trim().slice(0, 40) : '';
        const color = typeof b.customColor === 'string' ? b.customColor : '';
        if (!label) {
            return { error: 'customLabel is required when speciesId is not set' };
        }
        if (!HEX_COLOR_RE.test(color)) {
            return { error: 'customColor must be a hex color like #8b5e3c' };
        }
        customLabel = label;
        customColor = color;
    }

    const notes = typeof b.notes === 'string' ? (b.notes.trim().slice(0, 500) || null) : null;

    let visibility: MushroomVisibility = 'private';
    if (typeof b.visibility === 'string' && b.visibility) {
        if (!isValidMushroomVisibility(b.visibility)) {
            return { error: 'Invalid visibility' };
        }
        visibility = b.visibility;
    }

    const areaId = typeof b.areaId === 'string' && b.areaId ? b.areaId : null;

    const visibleToUserIds = Array.isArray(b.visibleToUserIds)
        ? b.visibleToUserIds.filter((id): id is string => typeof id === 'string')
        : [];

    return {
        speciesId,
        customLabel,
        customColor,
        weightGrams: b.weightGrams as number,
        foundDate,
        lat: b.lat as number,
        lng: b.lng as number,
        notes,
        areaId,
        visibility,
        visibleToUserIds,
    };
}

// POST /api/mushrooms/entries
router.post('/entries', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const validated = validateEntryBody(req.body);
    if ('error' in validated) {
        res.status(400).json({ error: validated.error });
        return;
    }

    try {
        if (validated.areaId) {
            const area = await prisma.mushroomArea.findUnique({ where: { id: validated.areaId } });
            if (!area || area.userId !== req.user!.userId) {
                res.status(400).json({ error: 'Invalid areaId' });
                return;
            }
        }

        const friendIds = await getFriendIds(req.user!.userId);
        const visibleToUserIds = validated.visibility === 'friends'
            ? validated.visibleToUserIds.filter((id) => friendIds.has(id))
            : [];

        const entry = await prisma.mushroomEntry.create({
            data: {
                userId: req.user!.userId,
                areaId: validated.areaId,
                speciesId: validated.speciesId,
                customLabel: validated.customLabel,
                customColor: validated.customColor,
                weightGrams: validated.weightGrams,
                foundDate: toDateOnly(validated.foundDate),
                lat: validated.lat,
                lng: validated.lng,
                notes: validated.notes,
                visibility: validated.visibility,
                visibleToUserIds,
            },
            include: ENTRY_INCLUDE,
        });
        res.status(201).json(toEntryData(entry, req.user!.userId, friendIds));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/mushrooms/entries/:id
router.put('/entries/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const validated = validateEntryBody(req.body);
    if ('error' in validated) {
        res.status(400).json({ error: validated.error });
        return;
    }

    try {
        const existing = await prisma.mushroomEntry.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ error: 'Not your entry' });
            return;
        }
        if (validated.areaId) {
            const area = await prisma.mushroomArea.findUnique({ where: { id: validated.areaId } });
            if (!area || area.userId !== req.user!.userId) {
                res.status(400).json({ error: 'Invalid areaId' });
                return;
            }
        }

        const friendIds = await getFriendIds(req.user!.userId);
        const visibleToUserIds = validated.visibility === 'friends'
            ? validated.visibleToUserIds.filter((id) => friendIds.has(id))
            : [];

        const entry = await prisma.mushroomEntry.update({
            where: { id: existing.id },
            data: {
                areaId: validated.areaId,
                speciesId: validated.speciesId,
                customLabel: validated.customLabel,
                customColor: validated.customColor,
                weightGrams: validated.weightGrams,
                foundDate: toDateOnly(validated.foundDate),
                lat: validated.lat,
                lng: validated.lng,
                notes: validated.notes,
                visibility: validated.visibility,
                visibleToUserIds,
            },
            include: ENTRY_INCLUDE,
        });
        res.json(toEntryData(entry, req.user!.userId, friendIds));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/mushrooms/entries/:id
router.delete('/entries/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const existing = await prisma.mushroomEntry.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Entry not found' });
            return;
        }
        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ error: 'Not your entry' });
            return;
        }
        await prisma.mushroomEntry.delete({ where: { id: existing.id } });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Areas ──────────────────────────────────────────────────────────────────

// GET /api/mushrooms/areas
router.get('/areas', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.query.userId as string | undefined;
    try {
        const viewerId = req.user?.userId;
        const friendIds = viewerId ? await getFriendIds(viewerId) : new Set<string>();

        const areas = await prisma.mushroomArea.findMany({
            where: {
                AND: [buildVisibilityWhere(viewerId, friendIds), userId ? { userId } : {}],
            },
            include: AREA_INCLUDE,
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });

        res.json(areas.map((a) => toAreaData(a, viewerId)));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/mushrooms/areas/:id
router.get('/areas/:id', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const viewerId = req.user?.userId;
        const area = await prisma.mushroomArea.findUnique({
            where: { id: req.params.id as string },
            include: AREA_INCLUDE,
        });
        if (!area) {
            res.status(404).json({ error: 'Area not found' });
            return;
        }
        const friendIds = viewerId && (await isFriendOf(viewerId, area.userId))
            ? new Set([area.userId])
            : new Set<string>();
        if (!canSeeRow(area, viewerId, friendIds)) {
            res.status(404).json({ error: 'Area not found' });
            return;
        }
        res.json(toAreaData(area, viewerId));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

interface ValidatedArea {
    name: string;
    polygon: MushroomAreaVertex[];
    notes: string | null;
    visibility: MushroomVisibility;
    visibleToUserIds: string[];
}

function validateAreaBody(body: unknown): ValidatedArea | { error: string } {
    const b = body as Record<string, unknown>;

    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
    if (!name) {
        return { error: 'name is required' };
    }

    if (!Array.isArray(b.polygon) || b.polygon.length < 3 || b.polygon.length > MAX_POLYGON_VERTICES) {
        return { error: `polygon must have between 3 and ${MAX_POLYGON_VERTICES} vertices` };
    }
    const polygon: MushroomAreaVertex[] = [];
    for (const v of b.polygon as unknown[]) {
        const vertex = v as Record<string, unknown>;
        if (!isFiniteInRange(vertex.lat, -90, 90) || !isFiniteInRange(vertex.lng, -180, 180)) {
            return { error: 'Invalid polygon vertex' };
        }
        polygon.push({ lat: vertex.lat as number, lng: vertex.lng as number });
    }

    const notes = typeof b.notes === 'string' ? (b.notes.trim().slice(0, 500) || null) : null;

    let visibility: MushroomVisibility = 'private';
    if (typeof b.visibility === 'string' && b.visibility) {
        if (!isValidMushroomVisibility(b.visibility)) {
            return { error: 'Invalid visibility' };
        }
        visibility = b.visibility;
    }

    const visibleToUserIds = Array.isArray(b.visibleToUserIds)
        ? b.visibleToUserIds.filter((id): id is string => typeof id === 'string')
        : [];

    return { name, polygon, notes, visibility, visibleToUserIds };
}

// POST /api/mushrooms/areas
router.post('/areas', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const validated = validateAreaBody(req.body);
    if ('error' in validated) {
        res.status(400).json({ error: validated.error });
        return;
    }

    try {
        const friendIds = await getFriendIds(req.user!.userId);
        const visibleToUserIds = validated.visibility === 'friends'
            ? validated.visibleToUserIds.filter((id) => friendIds.has(id))
            : [];

        const { lat: centerLat, lng: centerLng } = computePolygonCentroid(validated.polygon);
        const area = await prisma.mushroomArea.create({
            data: {
                userId: req.user!.userId,
                name: validated.name,
                polygonJson: JSON.stringify(validated.polygon),
                centerLat,
                centerLng,
                notes: validated.notes,
                visibility: validated.visibility,
                visibleToUserIds,
            },
            include: AREA_INCLUDE,
        });
        res.status(201).json(toAreaData(area, req.user!.userId));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/mushrooms/areas/:id
router.put('/areas/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const validated = validateAreaBody(req.body);
    if ('error' in validated) {
        res.status(400).json({ error: validated.error });
        return;
    }

    try {
        const existing = await prisma.mushroomArea.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Area not found' });
            return;
        }
        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ error: 'Not your area' });
            return;
        }

        const friendIds = await getFriendIds(req.user!.userId);
        const visibleToUserIds = validated.visibility === 'friends'
            ? validated.visibleToUserIds.filter((id) => friendIds.has(id))
            : [];

        const { lat: centerLat, lng: centerLng } = computePolygonCentroid(validated.polygon);
        const area = await prisma.mushroomArea.update({
            where: { id: existing.id },
            data: {
                name: validated.name,
                polygonJson: JSON.stringify(validated.polygon),
                centerLat,
                centerLng,
                notes: validated.notes,
                visibility: validated.visibility,
                visibleToUserIds,
            },
            include: AREA_INCLUDE,
        });
        res.json(toAreaData(area, req.user!.userId));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/mushrooms/areas/:id — entries lose their areaId via ON DELETE SET NULL
router.delete('/areas/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const existing = await prisma.mushroomArea.findUnique({ where: { id: req.params.id as string } });
        if (!existing) {
            res.status(404).json({ error: 'Area not found' });
            return;
        }
        if (existing.userId !== req.user!.userId) {
            res.status(403).json({ error: 'Not your area' });
            return;
        }
        await prisma.mushroomArea.delete({ where: { id: existing.id } });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
