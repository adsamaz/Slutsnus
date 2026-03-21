import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { RegisterRequest, LoginRequest } from '@slutsnus/shared';

const router = Router();

const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};

function signToken(userId: string, username: string): string {
    return jwt.sign({ userId, username }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

router.post('/register', async (req, res: Response) => {
    const { username, password } = req.body as RegisterRequest;

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
    }

    try {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            res.status(409).json({ error: 'Username already taken' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, passwordHash },
        });

        const token = signToken(user.id, user.username);
        res.cookie('token', token, COOKIE_OPTIONS);
        res.status(201).json({ user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res: Response) => {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
    }

    try {
        const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = signToken(user.id, user.username);
        res.cookie('token', token, COOKIE_OPTIONS);
        res.json({ user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl } });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (_req, res: Response) => {
    res.clearCookie('token', { path: '/' });
    res.json({ ok: true });
});

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl } });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
