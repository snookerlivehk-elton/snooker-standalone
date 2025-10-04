import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startEnvAudit, getEnvHistoryTail } from './envAudit.js';
import { PrismaClient } from '@prisma/client';
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SOCKET_IO_PATH = process.env.SOCKET_IO_PATH || '/socket.io';
// 支援多來源：以逗號分隔，例如 "http://localhost:5173,http://localhost:5174"
const corsOrigins = corsOriginRaw === '*'
    ? '*'
    : corsOriginRaw.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins }));
app.use(express.json());
// Prisma client for DB connectivity
const prisma = new PrismaClient();
// Health check for cloud deployments
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
    });
});
// Database health check
app.get('/health/db', async (_req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'ok' });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: String(err) });
    }
});
// Start environment audit logging to record every update and snapshot (can be disabled)
if (process.env.ENV_AUDIT_ENABLED !== 'false') {
    startEnvAudit();
}
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: corsOrigins,
    },
    path: SOCKET_IO_PATH,
});
const rooms = [];
app.get('/api/rooms', (req, res) => {
    res.json(rooms);
});
app.post('/api/rooms', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Room name is required' });
    }
    const newRoom = { id: (rooms.length + 1).toString(), name, scores: [0, 0] };
    rooms.push(newRoom);
    io.emit('rooms', rooms);
    res.status(201).json(newRoom);
});
app.delete('/api/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    const index = rooms.findIndex(room => room.id === roomId);
    if (index !== -1) {
        rooms.splice(index, 1);
        res.status(204).send();
    }
    else {
        res.status(404).json({ error: 'Room not found' });
    }
});
// Admin auth middleware (optional: enabled only when ADMIN_TOKEN is set)
function adminAuth(req, res, next) {
    if (!ADMIN_TOKEN)
        return next();
    const token = req.headers['x-admin-token'] || req.query.token || '';
    if (token !== ADMIN_TOKEN) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    next();
}
// Admin overview: basic runtime, DB, sockets, rooms
app.get('/admin/overview', adminAuth, async (_req, res) => {
    let dbStatus = 'ok';
    let dbError;
    try {
        await prisma.$queryRaw `SELECT 1`;
    }
    catch (err) {
        dbStatus = 'error';
        dbError = String(err);
    }
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        port: PORT,
        corsOrigins,
        socketPath: SOCKET_IO_PATH,
        sockets: { clientsCount: io?.engine?.clientsCount ?? null },
        rooms: { count: rooms.length },
        db: { status: dbStatus, error: dbError }
    });
});
// Admin env history tail
app.get('/admin/env-history', adminAuth, (req, res) => {
    const linesRaw = req.query.lines || '100';
    const lines = Math.max(1, Math.min(500, Number(linesRaw) || 100));
    const tail = getEnvHistoryTail(lines).map((s) => {
        try {
            return JSON.parse(s);
        }
        catch {
            return { raw: s };
        }
    });
    res.json({ lines, tail });
});
io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('join room', (roomId) => {
        socket.join(roomId);
        console.log(`a user joined room ${roomId}`);
        const room = rooms.find(r => r.id === roomId);
        if (room && room.gameState) {
            socket.emit('gameState updated', room.gameState);
        }
    });
    socket.on('update gameState', ({ roomId, newState }) => {
        const room = rooms.find(r => r.id === roomId);
        if (room) {
            room.gameState = newState;
        }
        // Avoid echoing back to the sender to preserve local history (UNDO)
        // Broadcast to other clients in the room only
        socket.broadcast.to(roomId).emit('gameState updated', newState);
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});
server.listen(PORT, '0.0.0.0', () => {
    console.log(`listening on 0.0.0.0:${PORT}`);
});
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map