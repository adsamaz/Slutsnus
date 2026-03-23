import { Router, Response, NextFunction, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { FredagPostType } from '../../../shared/src/types';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../../uploads/fredag');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB

// Max posts per user per type per day
const MAX_POSTS_PER_TYPE_PER_DAY = 3;

const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
};

const MAGIC_BYTES: { mime: string; offset: number; bytes: number[] }[] = [
    { mime: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png',  offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
    { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    { mime: 'image/gif',  offset: 0, bytes: [0x47, 0x49, 0x46] },
];

function detectMimeFromFile(filePath: string): string | null {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    for (const sig of MAGIC_BYTES) {
        const slice = [...buf.slice(sig.offset, sig.offset + sig.bytes.length)];
        if (sig.bytes.every((b, i) => b === slice[i])) return sig.mime;
    }
    return null;
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (req: AuthenticatedRequest, _file, cb) => {
        cb(null, `${req.user!.userId}-${Date.now()}.tmp`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (!ALLOWED_TYPES[file.mimetype]) {
            cb(new Error('Only JPEG, PNG, WebP and GIF are allowed'));
        } else {
            cb(null, true);
        }
    },
});

// Multer error handler — translates multer errors to clean JSON responses
function handleMulterError(err: unknown, _req: Request, res: Response, next: NextFunction) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024} MB.` });
            return;
        }
        res.status(400).json({ error: err.message });
        return;
    }
    if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
    }
    next(err);
}

const VALID_TYPES: FredagPostType[] = ['bild', 'lat', 'ol'];

// GET /api/fredag — list all posts with reaction summaries
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const posts = await prisma.fredagPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
            user: { select: { username: true, avatarUrl: true } },
            reactions: true,
        },
    });

    const result = posts.map(post => {
        const emojiMap = new Map<string, { count: number; reactedByMe: boolean }>();
        for (const r of post.reactions) {
            const entry = emojiMap.get(r.emoji) ?? { count: 0, reactedByMe: false };
            entry.count += 1;
            if (r.userId === userId) entry.reactedByMe = true;
            emojiMap.set(r.emoji, entry);
        }
        const reactions = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            reactedByMe: data.reactedByMe,
        }));

        return {
            id: post.id,
            type: post.type,
            fileUrl: post.fileUrl,
            caption: post.caption,
            createdAt: post.createdAt.toISOString(),
            userId: post.userId,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
            reactions,
        };
    });

    res.json(result);
});

const SPOTIFY_URL_RE = /^https:\/\/open\.spotify\.com\/(track|album|playlist)\/[A-Za-z0-9]+(\?.*)?$/;

// POST /api/fredag — upload a new post (or submit a Spotify URL for 'lat')
router.post(
    '/',
    authMiddleware,
    (req: Request, res: Response, next: NextFunction) => {
        // Skip multer for JSON posts (lat/Spotify URL)
        if (req.headers['content-type']?.startsWith('application/json')) {
            return next();
        }
        upload.single('file')(req, res, next);
    },
    handleMulterError,
    async (req: AuthenticatedRequest, res: Response) => {
        const type = req.body.type as string;
        if (!VALID_TYPES.includes(type as FredagPostType)) {
            if (req.file) fs.unlinkSync(req.file.path);
            res.status(400).json({ error: 'Invalid post type' });
            return;
        }

        // Rate-limit: max N posts per type per user per calendar day
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayCount = await prisma.fredagPost.count({
            where: {
                userId: req.user!.userId,
                type,
                createdAt: { gte: startOfDay },
            },
        });
        if (todayCount >= MAX_POSTS_PER_TYPE_PER_DAY) {
            if (req.file) fs.unlinkSync(req.file.path);
            res.status(429).json({ error: `Max ${MAX_POSTS_PER_TYPE_PER_DAY} posts per day for this category.` });
            return;
        }

        let fileUrl: string;
        if (type === 'lat') {
            // Accept Spotify URL — no file needed
            const spotifyUrl = typeof req.body.spotifyUrl === 'string' ? req.body.spotifyUrl.trim() : '';
            if (!SPOTIFY_URL_RE.test(spotifyUrl)) {
                res.status(400).json({ error: 'Please enter a valid Spotify link (track, album or playlist)' });
                return;
            }
            fileUrl = spotifyUrl;
        } else {
            if (!req.file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            const tmpPath = req.file.path;
            const detectedMime = detectMimeFromFile(tmpPath);
            if (!detectedMime || !ALLOWED_TYPES[detectedMime]) {
                fs.unlinkSync(tmpPath);
                res.status(400).json({ error: 'File content does not match an allowed image type' });
                return;
            }

            const safeExt = ALLOWED_TYPES[detectedMime];
            const finalName = `${req.user!.userId}-${Date.now()}${safeExt}`;
            const finalPath = path.join(UPLOADS_DIR, finalName);
            fs.renameSync(tmpPath, finalPath);
            fileUrl = `/uploads/fredag/${finalName}`;
        }

        const caption = typeof req.body.caption === 'string'
            ? req.body.caption.trim().slice(0, 200) || null
            : null;

        const post = await prisma.fredagPost.create({
            data: { userId: req.user!.userId, type, fileUrl, caption },
            include: { user: { select: { username: true, avatarUrl: true } } },
        });

        res.json({
            id: post.id,
            type: post.type,
            fileUrl: post.fileUrl,
            caption: post.caption,
            createdAt: post.createdAt.toISOString(),
            userId: post.userId,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
            reactions: [],
        });
    },
);

// POST /api/fredag/:postId/react — toggle an emoji reaction
router.post('/:postId/react', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { postId } = req.params;
    const userId = req.user!.userId;
    const emoji = req.body.emoji as string;

    // Only accept single grapheme-cluster emoji from the known quick-emoji set
    if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
        res.status(400).json({ error: 'Invalid emoji' });
        return;
    }

    const post = await prisma.fredagPost.findUnique({ where: { id: postId } });
    if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
    }

    // One reaction per user per post: toggle off if same emoji, swap if different
    const existing = await prisma.fredagReaction.findUnique({
        where: { postId_userId: { postId, userId } },
    });

    if (existing) {
        if (existing.emoji === emoji) {
            await prisma.fredagReaction.delete({ where: { id: existing.id } });
        } else {
            await prisma.fredagReaction.update({ where: { id: existing.id }, data: { emoji } });
        }
    } else {
        await prisma.fredagReaction.create({ data: { postId, userId, emoji } });
    }

    const reactions = await prisma.fredagReaction.findMany({ where: { postId } });
    const emojiMap = new Map<string, { count: number; reactedByMe: boolean }>();
    for (const r of reactions) {
        const entry = emojiMap.get(r.emoji) ?? { count: 0, reactedByMe: false };
        entry.count += 1;
        if (r.userId === userId) entry.reactedByMe = true;
        emojiMap.set(r.emoji, entry);
    }
    const summary = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        reactedByMe: data.reactedByMe,
    }));

    res.json({ reactions: summary });
});

export default router;
