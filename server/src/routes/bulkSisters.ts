import { Router } from 'express';

const router = Router();

router.get('/community', async (_req, res) => {
    try {
        const upstream = await fetch('https://jeppenator.com/api/bulk/community');
        if (!upstream.ok) {
            res.status(502).json({ error: 'Upstream error' });
            return;
        }
        const data = await upstream.json();
        res.json(data);
    } catch {
        res.status(502).json({ error: 'Failed to fetch community data' });
    }
});

export default router;
