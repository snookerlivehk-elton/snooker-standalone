import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startEnvAudit } from './envAudit.js';
import { PrismaClient } from '@prisma/client';

export interface Room {
  id: string;
  name: string;
  gameState?: any; // Or a more specific type for your game state
}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
// 支援多來源：以逗號分隔，例如 "http://localhost:5173,http://localhost:5174"
const corsOrigins = corsOriginRaw === '*'
  ? '*'
  : corsOriginRaw.split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigins as any }));
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
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch (err: any) {
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
    origin: corsOrigins as any,
  }
});

const rooms: Room[] = [];

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
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
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
    io.to(roomId).emit('gameState updated', newState);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});