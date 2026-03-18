import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { initSocket } from './socket/index';
import authRouter from './routes/auth';
import roomsRouter from './routes/rooms';
import friendsRouter from './routes/friends';
import leaderboardRouter from './routes/leaderboard';

const app = express();
const httpServer = http.createServer(app);

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true,
    }),
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/leaderboard', leaderboardRouter);

initSocket(httpServer);

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = Number(process.env.PORT) || 4000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
