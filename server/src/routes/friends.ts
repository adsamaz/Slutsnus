import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { FriendInfo, FriendshipStatus, UserPublic } from '@slutsnus/shared';

import { onlineUsers, io } from '../socket/index';

type FriendshipWithUsers = Awaited<ReturnType<typeof prisma.friendship.findFirstOrThrow<{ include: { requester: true; addressee: true } }>>>;

const router = Router();
router.use(authMiddleware);

async function buildFriendList(userId: string): Promise<FriendInfo[]> {
    const friendships = await prisma.friendship.findMany({
        where: {
            OR: [{ requesterId: userId }, { addresseeId: userId }],
            NOT: { status: 'blocked' },
        },
        include: {
            requester: true,
            addressee: true,
        },
    });

    const friends: FriendInfo[] = await Promise.all(
        friendships.map(async (f: FriendshipWithUsers) => {
            const isRequester = f.requesterId === userId;
            const friend = isRequester ? f.addressee : f.requester;
            const friendId = friend.id;

            let currentRoom = null;
            const activeRoom = await prisma.room.findFirst({
                where: {
                    players: { some: { userId: friendId } },
                    status: 'waiting',
                },
            });
            if (activeRoom) {
                currentRoom = { code: activeRoom.code, gameType: activeRoom.gameType as FriendInfo['currentRoom'] extends { gameType: infer G } ? G : never, isHost: activeRoom.hostId === friendId };
            }

            return {
                userId: friendId,
                username: friend.username,
                friendshipStatus: f.status as FriendshipStatus,
                direction: isRequester ? 'outgoing' : ('incoming' as FriendInfo['direction']),
                online: (onlineUsers.get(friendId)?.size ?? 0) > 0,
                currentRoom,
            };
        }),
    );

    return friends;
}

router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
        res.json(await buildFriendList(req.user!.userId));
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/search', async (req: AuthenticatedRequest, res: Response) => {
    const q = (req.query.q as string) ?? '';
    if (!q.trim()) {
        res.json([]);
        return;
    }
    try {
        const users = await prisma.user.findMany({
            where: {
                username: { contains: q, mode: 'insensitive' },
                NOT: { id: req.user!.userId },
            },
            take: 20,
            select: { id: true, username: true },
        });
        const result: UserPublic[] = users.map((u: { id: string; username: string }) => ({ id: u.id, username: u.username }));
        res.json(result);
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/request', async (req: AuthenticatedRequest, res: Response) => {
    const { targetUserId } = req.body as { targetUserId: string };
    if (!targetUserId || targetUserId === req.user!.userId) {
        res.status(400).json({ error: 'Invalid target user' });
        return;
    }
    try {
        const target = await prisma.user.findUnique({ where: { id: targetUserId } });
        if (!target) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const existing = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: req.user!.userId, addresseeId: targetUserId },
                    { requesterId: targetUserId, addresseeId: req.user!.userId },
                ],
            },
        });
        if (existing) {
            res.status(409).json({ error: 'Friendship already exists' });
            return;
        }
        await prisma.friendship.create({
            data: { requesterId: req.user!.userId, addresseeId: targetUserId, status: 'pending' },
        });
        // Notify recipient if online
        const targetSockets = onlineUsers.get(targetUserId);
        if (targetSockets) {
            for (const sid of targetSockets) {
                io.to(sid).emit('friends:update');
            }
        }
        res.status(201).json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/accept', async (req: AuthenticatedRequest, res: Response) => {
    const { requesterId } = req.body as { requesterId: string };
    try {
        const friendship = await prisma.friendship.findFirst({
            where: { requesterId, addresseeId: req.user!.userId, status: 'pending' },
        });
        if (!friendship) {
            res.status(404).json({ error: 'Friend request not found' });
            return;
        }
        await prisma.friendship.update({ where: { id: friendship.id }, data: { status: 'accepted' } });
        // Notify the original requester so their friends list updates
        const requesterSockets = onlineUsers.get(requesterId);
        if (requesterSockets) {
            for (const sid of requesterSockets) {
                io.to(sid).emit('friends:update');
            }
        }
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/decline', async (req: AuthenticatedRequest, res: Response) => {
    const { requesterId } = req.body as { requesterId: string };
    try {
        const friendship = await prisma.friendship.findFirst({
            where: { requesterId, addresseeId: req.user!.userId, status: 'pending' },
        });
        if (!friendship) {
            res.status(404).json({ error: 'Friend request not found' });
            return;
        }
        await prisma.friendship.delete({ where: { id: friendship.id } });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:userId', async (req: AuthenticatedRequest, res: Response) => {
    const otherId = req.params.userId as string;
    try {
        await prisma.friendship.deleteMany({
            where: {
                OR: [
                    { requesterId: req.user!.userId, addresseeId: otherId },
                    { requesterId: otherId, addresseeId: req.user!.userId },
                ],
            },
        });
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
