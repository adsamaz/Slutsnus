import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../../uploads/avatars');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Allowlist: mime type → safe extension (determined from magic bytes, not client input)
const ALLOWED_TYPES: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
};

// Magic byte signatures for each allowed type
const MAGIC_BYTES: { mime: string; offset: number; bytes: number[] }[] = [
    { mime: 'image/jpeg', offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png',  offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47] },
    { mime: 'image/webp', offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // "WEBP" at byte 8
    { mime: 'image/gif',  offset: 0, bytes: [0x47, 0x49, 0x46] },        // "GIF"
];

function detectMimeFromFile(filePath: string): string | null {
    // Read first 12 bytes — enough for all signatures above
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

// Use memory-temp storage so we can inspect before committing to disk
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    // Temp filename — will be renamed after magic byte check
    filename: (req: AuthenticatedRequest, _file, cb) => {
        cb(null, `${req.user!.userId}.tmp`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter: (_req, file, cb) => {
        // First-pass: reject obviously wrong MIME types before wasting disk I/O
        if (!ALLOWED_TYPES[file.mimetype]) {
            cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
        } else {
            cb(null, true);
        }
    },
});

router.post(
    '/avatar',
    authMiddleware,
    upload.single('avatar'),
    async (req: AuthenticatedRequest, res: Response) => {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const tmpPath = req.file.path;

        // Second-pass: verify magic bytes match an allowed type
        const detectedMime = detectMimeFromFile(tmpPath);
        if (!detectedMime || !ALLOWED_TYPES[detectedMime]) {
            fs.unlinkSync(tmpPath);
            res.status(400).json({ error: 'File content does not match an allowed image type' });
            return;
        }

        // Rename to <userId>.<safe-ext> — never trust the original filename
        const safeExt = ALLOWED_TYPES[detectedMime];
        const finalName = `${req.user!.userId}${safeExt}`;
        const finalPath = path.join(UPLOADS_DIR, finalName);

        // Remove any previously uploaded avatar for this user (different extension)
        for (const ext of Object.values(ALLOWED_TYPES)) {
            const old = path.join(UPLOADS_DIR, `${req.user!.userId}${ext}`);
            if (old !== finalPath && fs.existsSync(old)) fs.unlinkSync(old);
        }

        fs.renameSync(tmpPath, finalPath);

        const avatarUrl = `/uploads/avatars/${finalName}`;

        try {
            await prisma.user.update({
                where: { id: req.user!.userId },
                data: { avatarUrl },
            });
            res.json({ avatarUrl });
        } catch {
            fs.unlinkSync(finalPath);
            res.status(500).json({ error: 'Failed to save avatar' });
        }
    },
);

export default router;
