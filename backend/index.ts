
import 'dotenv/config';
// Backend API for Snooker Standalone
// Force backend redeploy
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startEnvAudit, getEnvHistoryTail } from './envAudit.js';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import { resolveDistrictCode, DISTRICT_CODE_MAP } from './districtCodes.js';
import { randomUUID, randomBytes, createHash } from 'crypto';
import clubRouter from './routes/club.js';

export interface Room {
  id: string;
  name: string;
  code?: string | undefined;
  scores: [number, number];
  gameState?: any;
  operatorId?: string | undefined;
}

function incrementLetters(letters: string): string {
  const arr = letters.split('');
  for (let i = arr.length - 1; i >= 0; i--) {
    const ch = arr[i];
    if (!ch) continue;
    const code = ch.charCodeAt(0);
    if (code < 90) {
      arr[i] = String.fromCharCode(code + 1);
      for (let j = i + 1; j < arr.length; j++) arr[j] = 'A';
      return arr.join('');
    }
  }
  return 'A'.repeat(letters.length || 5);
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function nextRoomCodeServer(): Promise<string> {
  try {
    const seq = await prisma.roomCodeSequence.findUnique({ where: { id: 1 } });
    let last = seq?.last_code || 'AAAAA0000';

    const patternNew = /^[A-Z]{5}\d{4}$/;
    if (!patternNew.test(last)) {
      last = 'AAAAA0000';
    }

    const letters = last.slice(0, 5);
    const digits = last.slice(5);
    let num = parseInt(digits, 10);
    if (isNaN(num)) num = 0;

    let nextCode = '';
    num += 1;
    if (num > 9999) {
      const inc = incrementLetters(letters);
      nextCode = `${inc}0000`;
    } else {
      nextCode = `${letters}${String(num).padStart(4, '0')}`;
    }

    await prisma.roomCodeSequence.upsert({
      where: { id: 1 },
      update: { last_code: nextCode },
      create: { id: 1, last_code: nextCode },
    });
    return nextCode;
  } catch (err) {
    console.error('Failed to generate room code from DB:', err);
    // Fallback to random if DB fails
    return 'ERR' + Math.floor(Math.random() * 10000);
  }
}

const app = express();
console.log(`Starting Snooker Backend v1.0.1...`);
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const WRITE_TOKEN = process.env.WRITE_TOKEN || '';
const SOCKET_IO_PATH = process.env.SOCKET_IO_PATH || '/socket.io';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'no-reply@snookerhk.live';
// 支援多來源：以逗號分隔，例如 "http://localhost:5173,http://localhost:5174"
const corsOrigins = corsOriginRaw === '*'
  ? '*'
  : corsOriginRaw.split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({ origin: corsOrigins as any }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ strict: false }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle JSON parse errors from body-parser
  if (err instanceof SyntaxError && 'body' in err && (err as any).status === 400) {
    console.error('JSON Parse Error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

// Prisma client for DB connectivity
const prisma = new PrismaClient();

// Mount Club Router
app.use('/api/club', clubRouter);

async function resolveMemberIdentifiers(identifiers: string[]): Promise<Map<string, string>> {
  const trimmed = Array.from(
    new Set(
      identifiers
        .map((v) => String(v ?? '').trim())
        .filter((v) => v.length > 0),
    ),
  );
  if (!trimmed.length) return new Map();

  const members = await prisma.member.findMany({
    where: {
      OR: [
        { id: { in: trimmed } },
        { email: { in: trimmed } },
        { member_code: { in: trimmed } },
      ],
    },
    select: { id: true, email: true, member_code: true },
  });

  const map = new Map<string, string>();
  for (const m of members) {
    if (m.id && trimmed.includes(m.id)) {
      map.set(m.id, m.id);
    }
    if (m.email && trimmed.includes(m.email)) {
      map.set(m.email, m.id);
    }
    if (m.member_code && trimmed.includes(m.member_code)) {
      map.set(m.member_code, m.id);
    }
  }
  return map;
}

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

// Strict match creation: require valid memberId for both players; if any missing or not found, reject
app.post('/api/matches/strict', writeAuth, async (req, res) => {
  try {
    const { roomId, match, players, timestamps, operatorId } = req.body || {};
    if (!roomId || !match || !players || !Array.isArray(players) || players.length !== 2) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    const p0 = players[0]?.memberId;
    const p1 = players[1]?.memberId;
    if (!p0 || !p1 || typeof p0 !== 'string' || typeof p1 !== 'string') {
      return res.status(400).json({ error: 'memberId required for both players' });
    }
    const idMap = await resolveMemberIdentifiers([p0, p1, operatorId].filter(Boolean));
    const p0Resolved = idMap.get(p0) || null;
    const p1Resolved = idMap.get(p1) || null;
    const opResolved = operatorId ? (idMap.get(operatorId) || null) : null;
    
    if (!p0Resolved || !p1Resolved) {
      return res.status(404).json({ error: 'memberId not found' });
    }
    const startedAt = timestamps?.start ? new Date(Number(timestamps.start)) : null;
    const created = await prisma.match.create({
      data: {
        room_id: String(roomId),
        name: String(match.name || 'Snooker Match'),
        name_part: match.namePart ? String(match.namePart) : null,
        match_key_normalized: match.matchKeyNormalized ? String(match.matchKeyNormalized) : null,
        match_code: match.matchCode ? String(match.matchCode) : null,
        frames_required: Number(match.framesRequired || 1),
        red_balls: Number(match.redBalls || 15),
        handicap0: Array.isArray(match.handicaps) ? Number(match.handicaps[0] || 0) : 0,
        handicap1: Array.isArray(match.handicaps) ? Number(match.handicaps[1] || 0) : 0,
        started_at: startedAt,
        operator_id: opResolved,
      },
    });
    const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
    await prisma.$transaction([
      prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p0Resolved, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
      prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p1Resolved, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
    ]);
    res.status(201).json({ matchId: created.id });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/matches/partial', writeAuth, async (req, res) => {
  try {
    const { roomId, match, players, timestamps, operatorId } = req.body || {};
    if (!roomId || !match || !players || !Array.isArray(players) || players.length !== 2) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    const candidateIds = [players[0]?.memberId, players[1]?.memberId, operatorId].filter((x: any) => typeof x === 'string') as string[];
    const idMap = await resolveMemberIdentifiers(candidateIds);
    const acceptedMemberIds = candidateIds.filter(id => idMap.has(id));
    const startedAt = timestamps?.start ? new Date(Number(timestamps.start)) : null;
    const opResolved = operatorId ? (idMap.get(operatorId) || null) : null;

    const created = await prisma.match.create({
      data: {
        room_id: String(roomId),
        name: String(match.name || 'Snooker Match'),
        name_part: match.namePart ? String(match.namePart) : null,
        match_key_normalized: match.matchKeyNormalized ? String(match.matchKeyNormalized) : null,
        match_code: match.matchCode ? String(match.matchCode) : null,
        frames_required: Number(match.framesRequired || 1),
        red_balls: Number(match.redBalls || 15),
        started_at: startedAt,
        operator_id: opResolved,
      },
    });
    const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
    const txOps: any[] = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      let memberId: string | null = null;
      if (p?.memberId && typeof p.memberId === 'string') {
        const resolved = idMap.get(p.memberId);
        if (resolved) {
          memberId = resolved;
        }
      } else if (!p?.memberId && p?.name) {
        // const guest = await prisma.member.create({ data: { name: String(p.name), is_guest: true } });
        const guest = await prisma.member.create({ data: { name: String(p.name) } });
        memberId = guest.id;
      }
      if (memberId) {
        txOps.push(prisma.matchPlayer.create({
          data: { match_id: created.id, member_id: memberId, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] },
        }));
      }
    }
    if (txOps.length) await prisma.$transaction(txOps);
    res.status(201).json({ matchId: created.id, acceptedMemberIds });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
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
  },
  path: SOCKET_IO_PATH,
});

const rooms: Room[] = [];

// Initialize rooms from DB (async)
(async () => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // Cleanup old rooms
    try {
      await prisma.room.deleteMany({ where: { created_at: { lt: sevenDaysAgo } } });
      console.log('Cleaned up old rooms');
    } catch (e) {
      console.log('Cleanup skipped (table might not exist or permission denied)');
    }
    
    // Load active
    const active = await prisma.room.findMany({
      where: { created_at: { gte: sevenDaysAgo } }
    });
    active.forEach(r => {
      rooms.push({
        id: r.id,
        name: r.name || 'Unnamed',
        code: r.code || r.id,
        scores: (r.scores as any) || [0, 0],
        gameState: r.gameState || undefined,
        operatorId: r.operator_id || undefined
      });
    });
    console.log(`Loaded ${rooms.length} active rooms from DB.`);
  } catch (e) {
    console.error('Failed to load rooms:', e);
  }
})();

app.get('/api/rooms', (req, res) => {
  res.json(rooms);
});

app.get('/rooms/:roomId/state', async (req, res) => {
  const roomId = String(req.params.roomId);
  const room = rooms.find(r => r.id === roomId || r.code === roomId);
  let operator: any = null;
  if (room?.operatorId) {
      try {
          const op = await prisma.member.findUnique({ where: { id: room.operatorId }, select: { id: true, name: true, email: true } });
          if (op) operator = op;
      } catch (e) {
          // ignore
      }
  }
  res.json({ roomId, state: room?.gameState ?? null, operator });
});

app.post('/rooms/:roomId/reset', async (req, res) => {
  const { roomId } = req.params;
  const room = rooms.find(r => r.id === roomId || r.code === roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  
  // Reset memory
  room.gameState = undefined;
  room.scores = [0, 0];
  
  // Reset DB
  try {
      await prisma.room.update({
          where: { id: room.id },
          data: { gameState: {}, scores: [0, 0] }
      });
  } catch (e) {
      console.error('Failed to reset room in DB:', e);
  }
  
  io.emit('rooms', rooms);
  res.json({ message: 'Room reset' });
});

app.post('/api/rooms', async (req, res) => {
  const { name, operatorId } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Room name is required' });
  }
  const code = await nextRoomCodeServer();
  // Use a unique ID based on timestamp and random number to avoid collisions on server restart
  const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const newRoom: Room = { id: newId, name, code, scores: [0, 0], operatorId };
  
  rooms.push(newRoom);
  
  // Persist
  try {
      await prisma.room.create({
          data: {
              id: newId,
              name,
              code,
              operator_id: operatorId || null,
              scores: [0, 0],
              gameState: {}
          }
      });
  } catch(e) {
      console.error('Failed to persist room:', e);
  }

  io.emit('rooms', rooms);
  res.status(201).json(newRoom);
});

app.delete('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  const index = rooms.findIndex(room => room.id === roomId);
  if (index !== -1) {
    rooms.splice(index, 1);
    // Delete from DB
    try {
        await prisma.room.delete({ where: { id: roomId } });
    } catch(e) {
        console.error('Failed to delete room from DB:', e);
    }
    io.emit('rooms', rooms); // Notify clients
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// Verification endpoints
app.post('/api/match-verification-code', async (req, res) => {
    const { email, purpose } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    
    // Check if member exists
    const member = await prisma.member.findFirst({ where: { email } });
    if (!member) return res.status(404).json({ error: 'Email not registered' });
    
    // Generate code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    
    await prisma.emailVerification.create({
        data: {
            id: randomUUID(),
            email,
            code,
            purpose: purpose || 'match',
            expires_at: expiresAt
        }
    });
    
    // Send email
    if (process.env.RESEND_API_KEY) {
        try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const fromEmail = RESEND_FROM_EMAIL;
            console.log(`[Email] Sending verification code to ${email} from ${fromEmail}`);
            await resend.emails.send({
                from: fromEmail,
                to: email,
                subject: '比賽驗證碼',
                html: `<p>你的驗證碼為：<strong>${code}</strong></p><p>請在 10 分鐘內輸入此驗證碼。</p>`
            });
            res.json({ message: 'Code sent' });
        } catch (e: any) {
            console.error('Email failed:', e);
            const isDomainError = e?.message?.includes('domain') || e?.message?.includes('verified');
            res.status(500).json({ 
                error: isDomainError 
                    ? 'Failed to send email: Domain not verified. Please configure RESEND_FROM_EMAIL with a verified domain or use the registered email for testing.' 
                    : 'Failed to send verification email. Please check server logs.' 
            });
        }
    } else {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
        res.json({ message: 'Code sent (Dev mode)' });
    }
});

app.post('/api/matches/start', async (req, res) => {
    const { p1_email, p1_code, p2_email, p2_code, room_id, operator_id, frames_required, red_balls, handicap0, handicap1 } = req.body;
    
    console.log(`[StartMatch] P1: ${p1_email} (code: ${p1_code}), P2: ${p2_email} (code: ${p2_code}), Room: ${room_id}`);

    let p1_member_id: string | null = null;
    let p2_member_id: string | null = null;
    
    // Verify P1
    if (p1_email && p1_code) {
        const ver = await prisma.emailVerification.findFirst({
            where: { email: p1_email, code: p1_code, used_at: null, expires_at: { gt: new Date() } }
        });
        if (ver) {
            const m = await prisma.member.findFirst({ where: { email: p1_email } });
            if (m) {
                p1_member_id = m.id;
                await prisma.emailVerification.update({ where: { id: ver.id }, data: { used_at: new Date() } });
            } else {
                return res.status(400).json({ error: `Email ${p1_email} is not registered.` });
            }
        } else {
            return res.status(400).json({ error: `Invalid or expired verification code for ${p1_email}.` });
        }
    } else if (p1_email && !p1_code) {
        // Email provided but no code - if we want to enforce verification for provided emails
        // return res.status(400).json({ error: `Verification code required for ${p1_email}.` });
        // Assuming current requirement allows implicit guest if no code provided? 
        // User said: "只有在滿足上傳條件...才建立 Match"
        // Let's enforce code if email is non-empty to prevent accidental guest mode when user intended to log in.
        // Actually, user said: "可否輸入Email後發比賽驗證碼並在setup頁填寫, 防止他人盜用"
        // This implies if email is entered, it MUST be verified.
        return res.status(400).json({ error: `Verification code required for Player 1 (${p1_email}).` });
    }
    
    // Verify P2
    if (p2_email && p2_code) {
        const ver = await prisma.emailVerification.findFirst({
            where: { email: p2_email, code: p2_code, used_at: null, expires_at: { gt: new Date() } }
        });
        if (ver) {
             const m = await prisma.member.findFirst({ where: { email: p2_email } });
             if (m) {
                 p2_member_id = m.id;
                 await prisma.emailVerification.update({ where: { id: ver.id }, data: { used_at: new Date() } });
             } else {
                 return res.status(400).json({ error: `Email ${p2_email} is not registered.` });
             }
        } else {
             return res.status(400).json({ error: `Invalid or expired verification code for ${p2_email}.` });
        }
    } else if (p2_email && !p2_code) {
        return res.status(400).json({ error: `Verification code required for Player 2 (${p2_email}).` });
    }
    
    if (!p1_member_id && !p2_member_id) {
        return res.json({ mode: 'guest', message: 'Both players are guests' });
    }
    
    // Resolve operator_id (support ID or Email) and ensure existence
    let opResolved: string | null = null;
    if (operator_id) {
        const opMember = await prisma.member.findFirst({
            where: {
                OR: [
                    { id: operator_id },
                    { email: operator_id }
                ]
            },
            select: { id: true }
        });
        opResolved = opMember ? opMember.id : null;
    }

    try {
        const match = await prisma.match.create({
            data: {
                room_id: String(room_id),
                name: 'Match ' + new Date().toLocaleTimeString(),
                frames_required: Number(frames_required || 1),
                red_balls: Number(red_balls || 15),
                handicap0: Number(handicap0 || 0),
                handicap1: Number(handicap1 || 0),
                started_at: new Date(),
                operator_id: opResolved || null
            }
        });
        
        const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
        // Create MatchPlayers
        if (p1_member_id) {
             await prisma.matchPlayer.create({
                 data: { match_id: match.id, member_id: p1_member_id, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0,0,0,0] }
             });
        }
        if (p2_member_id) {
             await prisma.matchPlayer.create({
                 data: { match_id: match.id, member_id: p2_member_id, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0,0,0,0] }
             });
        }
        
        res.json({ 
            mode: 'ranked', 
            matchId: match.id,
            p1MemberId: p1_member_id,
            p2MemberId: p2_member_id
        });
    } catch(e) {
        res.status(500).json({ error: String(e) });
    }
});

// Admin auth middleware (optional: enabled only when ADMIN_TOKEN is set)
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_TOKEN) return next();
  const token = (req.headers['x-admin-token'] as string) || (req.query.token as string) || '';
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Basic write authorization for match write endpoints
function writeAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!WRITE_TOKEN) return next();
  const token = (req.headers['x-write-token'] as string) || (req.query.token as string) || '';
  if (token !== WRITE_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Admin overview: basic runtime, DB, sockets, rooms
app.get('/admin/overview', adminAuth, async (req, res) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'error';
    dbError = String(err);
  }

  const payload = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    port: PORT,
    corsOrigins,
    socketPath: SOCKET_IO_PATH,
    sockets: { clientsCount: (io as any)?.engine?.clientsCount ?? null },
    rooms: { count: rooms.length },
    db: { status: dbStatus, error: dbError }
  };

  // Content negotiation: explicit query param wins; otherwise use Accept header.
  const format = String(req.query.format || '').toLowerCase();
  const wantsHtml = (format === 'html') || (((req.headers['accept'] || '').includes('text/html')) && format !== 'json');
  if (wantsHtml) {
    const corsListHtml = Array.isArray(corsOrigins)
      ? (corsOrigins as string[]).map(o => `<li><code>${o}</code></li>`).join('')
      : `<li><code>*</code></li>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Admin Overview</title>
        <style>
          :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; color-scheme: light dark; }
          body { margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
          .wrap { max-width: 960px; margin: 0 auto; }
          .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
          h1 { font-size: 20px; margin: 0 0 12px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 12px; }
          .kv { background:#0b1220; border:1px solid #1f2937; border-radius:8px; padding:12px; }
          .kv h3 { margin:0 0 6px; font-size:13px; color:#9ca3af; }
          .kv .v { font-size:16px; }
          code { background: #0b1220; padding: 2px 4px; border: 1px solid #1f2937; border-radius: 4px; }
          a.btn { display:inline-block; padding:8px 12px; border:1px solid #1f2937; border-radius:6px; text-decoration:none; color:#e2e8f0; }
          .muted { color:#9ca3af; font-size:12px; }
          ul { margin:8px 0 0; padding-left: 18px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>Admin 概覽</h1>
          <p class="muted">此頁為同源管理介面；若需要純 JSON，請使用 <code>/admin/overview?format=json</code>。</p>

          <div class="grid">
            <div class="kv"><h3>狀態</h3><div class="v">${payload.status}</div></div>
            <div class="kv"><h3>Uptime</h3><div class="v">${Math.round(payload.uptime)}s</div></div>
            <div class="kv"><h3>埠號</h3><div class="v">${payload.port}</div></div>
            <div class="kv"><h3>Sockets</h3><div class="v">${payload.sockets.clientsCount ?? 0}</div></div>
            <div class="kv"><h3>Rooms</h3><div class="v">${payload.rooms.count}</div></div>
            <div class="kv"><h3>DB</h3><div class="v">${payload.db.status}${payload.db.error ? ' (' + payload.db.error + ')' : ''}</div></div>
          </div>

          <div class="card">
            <h2 style="margin:0 0 8px; font-size:18px;">CORS Origins</h2>
            <ul>${corsListHtml}</ul>
            <p class="muted">Socket Path: <code>${payload.socketPath}</code></p>
          </div>

          <div class="card">
            <a class="btn" href="/admin/overview?format=json${req.query.token ? '&token=' + encodeURIComponent(String(req.query.token)) : ''}" target="_blank">查看 JSON</a>
            <a class="btn" href="/health" target="_blank" style="margin-left:8px;">健康檢查</a>
            <a class="btn" href="/health/db" target="_blank" style="margin-left:8px;">資料庫檢查</a>
          </div>
        </div>
      </body>
    </html>`);
    return;
  }

  res.json(payload);
});

// Admin Login (same-origin) — eliminate CORS by serving from backend
app.get('/admin/login', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Admin Login – Same-Origin</title>
      <style>
        :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; }
        body { margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
        .card { max-width: 860px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        label { font-size: 12px; color: #9ca3af; display:block; }
        input { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #374151; background: #0b1220; color: #e5e7eb; }
        input::placeholder { color: #6b7280; }
        .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        button { padding: 10px 14px; border: 1px solid #1f2937; border-radius: 8px; background: #1f2937; color: #e5e7eb; cursor: pointer; }
        button.primary { background: #2563eb; border-color: #1d4ed8; }
        .kbd { font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #0b1220; border: 1px solid #1f2937; border-radius: 6px; padding: 1px 6px; }
        .log { background: #0b1220; border: 1px solid #1f2937; border-radius: 12px; padding: 12px; white-space: pre-wrap; overflow: auto; max-height: 300px; }
        .ok { color: #10b981; }
        .err { color: #ef4444; }
        .muted { color: #94a3b8; }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/socket.io-client@4/dist/socket.io.min.js"></script>
    </head>
    <body>
      <div class="card">
        <h1>Admin Login（同源）</h1>
        <p class="muted">此頁由後端直接提供，所有請求為同源，無需 CORS。</p>
        <div class="row">
          <label>Admin Token（x-admin-token）<input id="token" placeholder="wwww5678" value="wwww5678" /></label>
        </div>
        <div class="row">
          <button id="btnHealth">Health</button>
          <button id="btnDb">Health DB</button>
          <button id="btnOverview" class="primary">Admin Overview</button>
          <button id="btnSocket">Connect Socket</button>
          <button id="btnClear">Clear Log</button>
        </div>
        <div style="height:12px"></div>
        <div class="log" id="log"></div>
      </div>

      <script>
        const logEl = document.getElementById('log');
        function log(msg, cls) {
          const time = new Date().toLocaleTimeString();
          const line = document.createElement('div');
          line.className = cls || '';
          line.textContent = '[' + time + '] ' + msg;
          logEl.appendChild(line);
          logEl.scrollTop = logEl.scrollHeight;
        }
        function logJson(title, obj, cls) {
          const time = new Date().toLocaleTimeString();
          const pre = document.createElement('pre');
          pre.className = cls || '';
          pre.textContent = '[' + time + '] ' + title + ':\n' + JSON.stringify(obj, null, 2);
          logEl.appendChild(pre);
          logEl.scrollTop = logEl.scrollHeight;
        }
        async function xfetch(path, opts = {}) {
          const url = path;
          log('Fetch ' + url);
          try {
            const res = await fetch(url, opts);
            log('Status ' + res.status, res.ok ? 'ok' : 'err');
            const ct = res.headers.get('content-type') || '';
            let body;
            if (ct.includes('application/json')) { body = await res.json(); } else { body = await res.text(); }
            logJson('Response', body, res.ok ? 'ok' : 'err');
          } catch (e) {
            log('Fetch error: ' + (e && e.message ? e.message : String(e)), 'err');
          }
        }
        document.getElementById('btnHealth').onclick = () => xfetch('/health');
        document.getElementById('btnDb').onclick = () => xfetch('/health/db');
        document.getElementById('btnOverview').onclick = () => {
          const token = document.getElementById('token').value.trim();
          xfetch('/admin/overview', { headers: { 'x-admin-token': token } });
        };
        document.getElementById('btnClear').onclick = () => { logEl.textContent = ''; };
        let socket;
        document.getElementById('btnSocket').onclick = () => {
          try {
            socket = io(window.location.origin, { path: ${JSON.stringify(SOCKET_IO_PATH)}, transports: ['websocket','polling'] });
            socket.on('connect', () => log('Socket connected id=' + socket.id, 'ok'));
            socket.on('connect_error', (err) => log('Socket connect_error: ' + err.message, 'err'));
            socket.on('error', (err) => log('Socket error: ' + (err && err.message ? err.message : String(err)), 'err'));
            socket.on('disconnect', (reason) => log('Socket disconnected: ' + reason));
          } catch (e) {
            log('Socket init error: ' + (e && e.message ? e.message : String(e)), 'err');
          }
        };
  </script>
  </body>
  </html>`);
});

app.get('/api/district-codes', (_req, res) => {
  const items = Object.entries(DISTRICT_CODE_MAP).map(([name, code]) => ({ name, code }));
  const byCode: Record<string, { code: string; name: string }> = {};
  for (const it of items) {
    if (!byCode[it.code]) byCode[it.code] = it;
  }
  res.json({ districts: Object.values(byCode) });
});

app.get('/api/member/regions', async (_req, res) => {
  try {
    const regions = await prisma.memberRegion.findMany({
      where: { active: true },
      orderBy: { code3: 'asc' },
    });
    res.json({
      regions: regions.map((r) => ({
        code3: r.code3,
        name: r.name,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/member/districts', async (req, res) => {
  try {
    const regionCodeRaw = (req.query.regionCode as string) || '';
    const regionCode = regionCodeRaw.trim().toUpperCase();
    const where: any = { active: true };
    if (regionCode) where.region_code = regionCode;
    const districts = await prisma.memberDistrict.findMany({
      where,
      orderBy: { code3: 'asc' },
    });
    res.json({
      districts: districts.map((d) => ({
        code3: d.code3,
        name: d.name,
        // regionCode: d.region_code,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Same-origin Member Registration page (mobile-friendly)
app.get('/admin/register', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      <title>Member Registration – Fixed</title>
      <style>
        :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; color-scheme: light dark; }
        body { margin: 0; background: #0f172a; color: #e2e8f0; }
        .wrap { max-width: 520px; margin: 0 auto; padding: 16px; }
        .card { background:#111827; border:1px solid #1f2937; border-radius:12px; padding:16px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        .row { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
        label { font-size:12px; color:#9ca3af; }
        input, select { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #374151; background: #0b1220; color: #e5e7eb; }
        input::placeholder { color:#6b7280; }
        button { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #1f2937; background: #2563eb; color: #e5e7eb; cursor: pointer; font-weight: 600; }
        .muted { color:#94a3b8; font-size:12px; }
        .log { background:#0b1220; border:1px solid #1f2937; border-radius:12px; padding:12px; white-space:pre-wrap; overflow:auto; max-height:240px; }
        .ok { color:#10b981; }
        .err { color:#ef4444; }
        .grid-2 { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (max-width: 480px) { .grid-2 { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <h1>會員註冊（已修復）</h1>
          <p class="muted">此頁由後端提供，所有請求為同源，適配手機排版。</p>

          <div class="row">
            <label>Email（必填）</label>
            <input id="email" type="email" placeholder="example@domain.com" />
          </div>
          <div class="row">
            <label>姓名（必填）</label>
            <input id="name" type="text" placeholder="您的姓名" />
          </div>
          <div class="row">
            <label>地區（必填，香港區份代碼）</label>
            <select id="district"></select>
            <p class="muted">示例：元朗區 → NYL</p>
          </div>
          <div class="grid-2">
            <div class="row">
              <label>電話（選填）</label>
              <input id="phone" type="tel" placeholder="9123 4567" />
            </div>
            <div class="row">
              <label>出生日期（選填）</label>
              <input id="birthDate" type="date" />
            </div>
          </div>

          <div class="row">
            <button id="btnRegister">提交註冊</button>
          </div>

          <div class="row">
            <div id="log" class="log"></div>
          </div>
        </div>
      </div>

      <script>
        const logEl = document.getElementById('log');
        function log(msg, cls) {
          const time = new Date().toLocaleTimeString();
          const div = document.createElement('div');
          div.className = cls || '';
          div.textContent = '[' + time + '] ' + msg;
          logEl.appendChild(div);
          logEl.scrollTop = logEl.scrollHeight;
        }

        async function loadDistricts() {
          try {
            const res = await fetch('/api/district-codes');
            const data = await res.json();
            const sel = document.getElementById('district');
            sel.innerHTML = '';
            for (const d of data.districts) {
              const opt = document.createElement('option');
              opt.value = d.code; opt.textContent = d.code + ' — ' + d.name;
              sel.appendChild(opt);
            }
          } catch (err) {
            log('載入地區失敗：' + (err?.message || err), 'err');
          }
        }

        async function register() {
          const emailEl = document.getElementById('email');
          const email = emailEl.value.trim().normalize('NFKC').toLowerCase();
          // 將規範化後的值回寫，避免 checkValidity() 基於未規範化的原值誤判
          if (emailEl && typeof emailEl.value === 'string') {
            emailEl.value = email;
          }
          const name = document.getElementById('name').value.trim();
          const districtCode = document.getElementById('district').value.trim();
          const phone = document.getElementById('phone').value.trim();
          const birthDate = document.getElementById('birthDate').value.trim();

          if (!email || !name || !districtCode) {
            log('請填寫 email、姓名與地區。', 'err');
            return;
          }
          if (emailEl && typeof emailEl.checkValidity === 'function' && !emailEl.checkValidity()) {
            emailEl.reportValidity?.();
            log('email 格式不正確。', 'err');
            return;
          }

          try {
            const res = await fetch('/api/members/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ email, name, districtCode, phone: phone || undefined, birthDate: birthDate || undefined })
            });
            const ct = res.headers.get('content-type') || '';
            const isJson = ct.toLowerCase().includes('application/json');
            const data = isJson ? await res.json() : { errorText: await res.text() };
            if (!res.ok) {
              const msg = (data && (data.error || data.errorText)) ? (data.error || data.errorText) : res.statusText;
              log('註冊失敗：' + msg, 'err');
              return;
            }
            log('註冊成功！會員號：' + data.memberCode, 'ok');
          } catch (err) {
            log('註冊異常：' + (err?.message || err), 'err');
          }
        }

        document.getElementById('btnRegister').addEventListener('click', register);
        loadDistricts();
      </script>
    </body>
  </html>`);
});

// Admin env history tail
app.get('/admin/env-history', adminAuth, (req, res) => {
  const linesRaw = (req.query.lines as string) || '100';
  const lines = Math.max(1, Math.min(500, Number(linesRaw) || 100));
  const tail = getEnvHistoryTail(lines).map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return { raw: s };
    }
  });
  res.json({ lines, tail });
});

// Temporary online multi-device test page, served from allowed origin
app.get('/test', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Snooker Multi-Device Room Test</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 24px; }
        input, button { padding: 8px; font-size: 14px; }
        .row { margin-bottom: 12px; }
        #log { border: 1px solid #ccc; padding: 12px; height: 180px; overflow: auto; }
        code { background: #f5f5f5; padding: 2px 4px; }
      </style>
      <script src="https://cdn.socket.io/4.7.5/socket.io.min.js" integrity="sha384-iZp3tHf7fWnWv0t21fCk3wJb3wHnHnQK+eVYVb6eTjvYQvC8fK5bQ7zvQkK1kH7V" crossorigin="anonymous"></script>
    </head>
    <body>
      <h2>Snooker Multi-Device Room Test</h2>
      <div class="row">
        <label>Room ID: <input id="roomId" placeholder="e.g. demo-1" /></label>
        <button id="joinBtn">Join Room</button>
        <button id="leaveBtn">Leave Room</button>
      </div>
      <div class="row">
        <label>Game State JSON:</label><br />
        <textarea id="state" rows="4" cols="60">{"scoreA":0,"scoreB":0}</textarea><br />
        <button id="broadcastBtn">Broadcast State</button>
      </div>
      <div class="row">
        <strong>Socket:</strong> <code id="socketInfo"></code>
      </div>
      <div id="log"></div>

      <script>
        const path = ${JSON.stringify(SOCKET_IO_PATH)};
        const socket = io(window.location.origin, { path, transports: ['websocket', 'polling'] });
        const logEl = document.getElementById('log');
        const sockEl = document.getElementById('socketInfo');
        const roomInput = document.getElementById('roomId');
        const stateInput = document.getElementById('state');

        function log(msg) {
          const time = new Date().toISOString();
          logEl.innerHTML += '[' + time + '] ' + msg + '<br />';
          logEl.scrollTop = logEl.scrollHeight;
        }

        socket.on('connect', () => {
          sockEl.textContent = 'connected (' + socket.id + ')';
          log('connected: ' + socket.id);
        });
        socket.on('disconnect', () => { log('disconnected'); });
        socket.on('gameState updated', (st) => { log('received state: ' + JSON.stringify(st)); });

        document.getElementById('joinBtn').onclick = () => {
          const room = roomInput.value.trim();
          if (!room) return alert('Room ID required');
          socket.emit('join room', room);
          log('joined room: ' + room);
        };
        document.getElementById('leaveBtn').onclick = () => {
          const room = roomInput.value.trim();
          if (!room) return alert('Room ID required');
          socket.emit('leave room', room);
          log('left room: ' + room);
        };
        document.getElementById('broadcastBtn').onclick = () => {
          const room = roomInput.value.trim();
          if (!room) return alert('Room ID required');
          let parsed;
          try { parsed = JSON.parse(stateInput.value); } catch { return alert('Invalid JSON'); }
          socket.emit('update gameState', { roomId: room, newState: parsed });
          log('broadcast state: ' + JSON.stringify(parsed));
        };
      </script>
    </body>
  </html>`);
});

// Match write endpoints (create, events append, finalize)
app.post('/api/matches', writeAuth, async (req, res) => {
  try {
    const { roomId, match, players, timestamps } = req.body || {};
    if (!roomId || !match || !players || !Array.isArray(players) || players.length !== 2) {
      return res.status(400).json({ error: 'invalid payload' });
    }

    const startedAt = timestamps?.start ? new Date(Number(timestamps.start)) : null;

    // Ensure members exist (create placeholder if memberId is null)
    const memberIds: string[] = [];
    for (const p of players) {
      let memberId: string | null = p.memberId ?? null;
      if (memberId && typeof memberId === 'string') {
        // Upsert member by provided id
        const m = await prisma.member.upsert({
          where: { id: memberId },
          update: { name: p.name ?? 'Unknown' },
          create: { id: memberId, name: p.name ?? 'Unknown' },
        });
        memberIds.push(m.id);
      } else {
        const m = await prisma.member.create({ data: { id: randomUUID(), name: p.name ?? 'Unknown' } });
        memberIds.push(m.id);
      }
    }

    // Create match
    const created = await prisma.match.create({
      data: {
        room_id: String(roomId),
        name: String(match.name || 'Snooker Match'),
        // Optional normalized fields from frontend
        name_part: match.namePart ? String(match.namePart) : null,
        match_key_normalized: match.matchKeyNormalized ? String(match.matchKeyNormalized) : null,
        match_code: match.matchCode ? String(match.matchCode) : null,
        frames_required: Number(match.framesRequired || 1),
        red_balls: Number(match.redBalls || 15),
        started_at: startedAt,
      },
    });

    // Create match players
    const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
    const [p0Id, p1Id] = memberIds as [string, string];
    await prisma.$transaction([
      prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p0Id, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
      prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p1Id, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
    ]);

    res.status(201).json({ matchId: created.id });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Append events to a match (batch)
app.post('/api/matches/:matchId/events', writeAuth, async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const { events } = req.body || {};
    if (!matchId || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'invalid payload' });
    }

    const maxIdxAgg = await prisma.event.aggregate({ where: { match_id: matchId }, _max: { idx: true } });
    const startIdx = ((maxIdxAgg._max?.idx ?? -1) as number) + 1;

    // Map incoming events to DB rows with sequential idx
    const rows = events.map((e: any, i: number) => ({
      match_id: matchId,
      idx: startIdx + i,
      type: e.type,
      player_index: Number(e.playerIndex),
      player_member_id: String(e.playerMemberId),
      ball_name: e.ballName ?? null,
      points: e.points == null ? null : Number(e.points),
      timestamp: e.timestamp == null ? null : BigInt(e.timestamp),
      shot_time_ms: e.shotTimeMs == null ? null : Number(e.shotTimeMs),
    }));

    // Use transaction with createMany for better performance
    const result = await prisma.event.createMany({ data: rows });
    res.json({ accepted: result.count });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Finalize a match: persist foul totals, stats, and winner
app.post('/api/matches/:matchId/finalize', writeAuth, async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const { foulTotals, stats, timestamps, winnerMemberId, playersFinal, match: matchMeta } = req.body || {};
    console.log(`[finalizeMatch] matchId=${matchId}`);
    if (stats && stats.perPlayer) {
        console.log('[finalizeMatch] perPlayer stats sample:', JSON.stringify(stats.perPlayer[0]));
    }
    if (!matchId || !foulTotals || !Array.isArray(foulTotals) || foulTotals.length !== 2 || !stats) {
      return res.status(400).json({ error: 'invalid payload' });
    }

    const endedAt = timestamps?.end ? new Date(Number(timestamps.end)) : new Date();

    let winnerMemberIdInternal: string | null = null;
    if (winnerMemberId) {
      const winnerMap = await resolveMemberIdentifiers([String(winnerMemberId)]);
      winnerMemberIdInternal = winnerMap.get(String(winnerMemberId)) || null;
    }

    const matchUpdateData: any = {
      ended_at: endedAt,
      winner_member_id: winnerMemberIdInternal,
    };
    if (Array.isArray(matchMeta?.handicaps)) {
      matchUpdateData.handicap0 = Number(matchMeta.handicaps[0] || 0);
      matchUpdateData.handicap1 = Number(matchMeta.handicaps[1] || 0);
    }

    const ops: any[] = [
      prisma.foulTotals.upsert({
        where: { match_id: matchId },
        update: { player0_total: Number(foulTotals[0] || 0), player1_total: Number(foulTotals[1] || 0) },
        create: { match_id: matchId, player0_total: Number(foulTotals[0] || 0), player1_total: Number(foulTotals[1] || 0) },
      }),
      prisma.matchStats.upsert({
        where: { match_id: matchId },
        update: { events_count: Number(stats.eventsCount || 0), per_player: stats.perPlayer },
        create: { match_id: matchId, events_count: Number(stats.eventsCount || 0), per_player: stats.perPlayer },
      }),
      prisma.match.update({
        where: { id: matchId },
        data: matchUpdateData,
      }),
    ];
    if (Array.isArray(playersFinal)) {
      const perPlayerArray: any[] = Array.isArray(stats?.perPlayer) ? stats.perPlayer : [];
      const candidateIds = playersFinal
        .map((pf: any) => (pf && pf.memberId ? String(pf.memberId) : null))
        .filter((id: any) => typeof id === 'string') as string[];
      const idMap = await resolveMemberIdentifiers(candidateIds);
      for (let i = 0; i < playersFinal.length; i++) {
        const pf: any = playersFinal[i];
        if (!pf) continue;
        const identifier = pf.memberId ? String(pf.memberId) : null;
        const mid = identifier ? (idMap.get(identifier) || null) : null;
        if (!mid) continue;
        const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
        const perPlayerStats = perPlayerArray[pf.index ?? i] || null;
        const avgShotTimeMs = perPlayerStats && typeof perPlayerStats.avgShotTimeMs === 'number'
          ? Math.round(perPlayerStats.avgShotTimeMs)
          : 0;
        const avgBreakTimeMs = perPlayerStats && typeof perPlayerStats.avgBreakTimeMs === 'number'
          ? Math.round(perPlayerStats.avgBreakTimeMs)
          : 0;
        const maxBreakTimeMs = perPlayerStats && typeof perPlayerStats.maxBreakTimeMs === 'number'
          ? Math.round(perPlayerStats.maxBreakTimeMs)
          : 0;
        const breakCount = perPlayerStats && typeof perPlayerStats.breakCount === 'number'
          ? perPlayerStats.breakCount
          : 0;
        ops.push(prisma.matchPlayer.upsert({
          where: { match_id_member_id: { match_id: matchId, member_id: mid } },
          update: {
            frames_won: Number(pf.framesWon || 0),
            total_points: perPlayerStats && typeof perPlayerStats.totalPoints === 'number' ? perPlayerStats.totalPoints : Number(pf.score || 0),
            avg_shot_time_ms: avgShotTimeMs,
            avg_break_time_ms: avgBreakTimeMs,
            max_break_time_ms: maxBreakTimeMs,
            break_count: breakCount,
            max_break_points: perPlayerStats && typeof perPlayerStats.maxBreakPoints === 'number'
              ? perPlayerStats.maxBreakPoints
              : undefined,
            foul_count: perPlayerStats && typeof perPlayerStats.foulCount === 'number'
              ? perPlayerStats.foulCount
              : undefined,
            quick_shot_rate: perPlayerStats && typeof perPlayerStats.quickShotRate === 'number'
              ? perPlayerStats.quickShotRate
              : undefined,
            safe_success_rate: perPlayerStats && typeof perPlayerStats.safeSuccessRate === 'number'
              ? perPlayerStats.safeSuccessRate
              : undefined,
            pot_by_ball: perPlayerStats && perPlayerStats.potByBall ? perPlayerStats.potByBall : defaultsPotByBall,
            shot_time_buckets: perPlayerStats && Array.isArray(perPlayerStats.shotTimeBuckets)
              ? perPlayerStats.shotTimeBuckets
              : [0, 0, 0, 0],
          },
          create: {
            match_id: matchId,
            member_id: mid,
            frames_won: Number(pf.framesWon || 0),
            total_points: perPlayerStats && typeof perPlayerStats.totalPoints === 'number' ? perPlayerStats.totalPoints : Number(pf.score || 0),
            pot_by_ball: perPlayerStats && perPlayerStats.potByBall ? perPlayerStats.potByBall : defaultsPotByBall,
            shot_time_buckets: perPlayerStats && Array.isArray(perPlayerStats.shotTimeBuckets)
              ? perPlayerStats.shotTimeBuckets
              : [0, 0, 0, 0],
            avg_shot_time_ms: avgShotTimeMs,
            avg_break_time_ms: avgBreakTimeMs,
            max_break_time_ms: maxBreakTimeMs,
            break_count: breakCount,
            max_break_points: perPlayerStats && typeof perPlayerStats.maxBreakPoints === 'number'
              ? perPlayerStats.maxBreakPoints
              : 0,
            foul_count: perPlayerStats && typeof perPlayerStats.foulCount === 'number'
              ? perPlayerStats.foulCount
              : 0,
            quick_shot_rate: perPlayerStats && typeof perPlayerStats.quickShotRate === 'number'
              ? perPlayerStats.quickShotRate
              : 0,
            safe_success_rate: perPlayerStats && typeof perPlayerStats.safeSuccessRate === 'number'
              ? perPlayerStats.safeSuccessRate
              : 0,
          },
        } as any));
      }
    }
    await prisma.$transaction(ops);

    res.json({ finalized: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Create room via simple GET for convenience, return shareable links

app.get('/rooms/new', (req, res) => {
  const name = (req.query.name as string) || 'Room';
  const code = nextRoomCodeServer();
  const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  const newRoom: any = { id: newId, name, code };
  rooms.push(newRoom);
  io.emit('rooms', rooms);
  const origin = (req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']) : req.protocol) + '://' + req.get('host');
  const viewerLink = origin + '/room/' + code;
  const hostLink = viewerLink + '?host=1';
  res.json({ id: newRoom.id, name: newRoom.name, code, viewerLink, hostLink });
});

// Same-origin room page with simple scoreboard and shareable links
app.get('/room/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const isHost = String(req.query.host || '') === '1';
  // Ensure room exists for immediate use
  if (!rooms.find(r => r.id === roomId)) {
    rooms.push({ id: roomId, name: 'Room ' + roomId } as any);
    io.emit('rooms', rooms);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Snooker Score Room ${roomId}</title>
      <style>
        :root { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; }
        body { margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
        .wrap { max-width: 920px; margin: 0 auto; }
        .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; }
        h1 { font-size: 20px; margin: 0 0 12px; }
        .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .score { display:flex; gap:16px; align-items:center; font-size:28px; }
        .score .team { background:#0b1220; padding:10px 14px; border-radius:10px; border:1px solid #374151; }
        button { padding: 10px 14px; border: 1px solid #1f2937; border-radius: 8px; background: #1f2937; color: #e5e7eb; cursor: pointer; }
        button.primary { background: #2563eb; border-color: #1d4ed8; }
        input { padding:10px; border-radius:8px; border:1px solid #374151; background:#0b1220; color:#e5e7eb; }
        .kbd { font: 12px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #0b1220; border: 1px solid #1f2937; border-radius: 6px; padding: 1px 6px; }
        .muted { color:#94a3b8; }
        .log { background: #0b1220; border: 1px solid #1f2937; border-radius: 12px; padding: 12px; white-space: pre-wrap; overflow: auto; max-height: 240px; }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/socket.io-client@4/dist/socket.io.min.js"></script>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <h1>Score Room #${roomId} ${isHost ? '(Host)' : '(Viewer)'} </h1>
          <p class="muted">同源頁面，免跨域。分享連結：
            <span class="kbd" id="viewerLink"></span>
            <button id="copyViewer">複製 Viewer 連結</button>
            <span style="margin-left:12px"></span>
            <span class="kbd" id="hostLink"></span>
            <button id="copyHost">複製 Host 連結</button>
          </p>
          <div class="score">
            <div class="team">A: <span id="scoreA">0</span></div>
            <div class="team">B: <span id="scoreB">0</span></div>
          </div>
          <div class="row" id="hostControls" style="margin-top:12px; display:${isHost ? 'flex' : 'none'}">
            <button id="aPlus" class="primary">A +1</button>
            <button id="aMinus">A -1</button>
            <button id="bPlus" class="primary">B +1</button>
            <button id="bMinus">B -1</button>
            <button id="reset">重設 0:0</button>
          </div>
          <div class="row" style="margin-top:12px">
            <strong>Socket:</strong>
            <span class="kbd" id="sock"></span>
          </div>
          <div class="log" id="log"></div>
        </div>
      </div>

      <script>
        var roomId = ${JSON.stringify(roomId)};
        var isHost = ${JSON.stringify(isHost)};
        var sockEl = document.getElementById('sock');
        var logEl = document.getElementById('log');
        var aEl = document.getElementById('scoreA');
        var bEl = document.getElementById('scoreB');
        var viewerLinkEl = document.getElementById('viewerLink');
        var hostLinkEl = document.getElementById('hostLink');
        var viewerLink = window.location.origin + '/room/' + roomId;
        var hostLink = viewerLink + '?host=1';
        viewerLinkEl.textContent = viewerLink;
        hostLinkEl.textContent = hostLink;
        document.getElementById('copyViewer').onclick = function(){ navigator.clipboard.writeText(viewerLink); };
        document.getElementById('copyHost').onclick = function(){ navigator.clipboard.writeText(hostLink); };

        function log(msg){ var t = new Date().toLocaleTimeString(); var div = document.createElement('div'); div.textContent = '[' + t + '] ' + msg; logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight; }
        function setScores(a,b){ aEl.textContent = String(a); bEl.textContent = String(b); }

        var path = ${JSON.stringify(SOCKET_IO_PATH)};
        var socket = io(window.location.origin, { path: path, transports: ['websocket','polling'] });
        socket.on('connect', function(){ sockEl.textContent = 'connected (' + socket.id + ')'; log('connected: ' + socket.id); socket.emit('join room', roomId); });
        socket.on('disconnect', function(){ log('disconnected'); });
        socket.on('gameState updated', function(st){ if (st && typeof st.scoreA === 'number' && typeof st.scoreB === 'number') { setScores(st.scoreA, st.scoreB); } log('state: ' + JSON.stringify(st)); });

        function broadcast(a,b){ var st = { scoreA: a, scoreB: b }; socket.emit('update gameState', { roomId: roomId, newState: st }); }
        var a = 0, b = 0; setScores(a,b);
        if (isHost) {
          document.getElementById('aPlus').onclick = function(){ a++; setScores(a,b); broadcast(a,b); };
          document.getElementById('aMinus').onclick = function(){ a = Math.max(0, a-1); setScores(a,b); broadcast(a,b); };
          document.getElementById('bPlus').onclick = function(){ b++; setScores(a,b); broadcast(a,b); };
          document.getElementById('bMinus').onclick = function(){ b = Math.max(0, b-1); setScores(a,b); broadcast(a,b); };
          document.getElementById('reset').onclick = function(){ a = 0; b = 0; setScores(a,b); broadcast(a,b); };
        }
      </script>
    </body>
  </html>`);
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join room', (roomId) => {
    socket.join(roomId);
    console.log(`a user joined room ${roomId}`);
    const room = rooms.find(r => r.id === roomId || r.code === roomId);
    if (room && room.gameState) {
      socket.emit('gameState updated', room.gameState);
    }
  });

  socket.on('update gameState', ({ roomId, newState }) => {
    const room = rooms.find(r => r.id === roomId || r.code === roomId);
    if (room) {
      room.gameState = newState;
    }
    // Broadcast to entire room (include sender) to ensure OBS/browser sources receive updates
    io.to(roomId).emit('gameState updated', newState);
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
// Members: registration and admin list
// Request password reset code
app.post('/api/members/request-password-reset-code', async (req, res) => {
  try {
    const { email } = (req.body || {}) as { email?: string };
    const em = String(email || '').trim().normalize('NFKC');
    if (!em) {
      return res.status(400).json({ error: 'email 為必填' });
    }
    const member = await prisma.member.findFirst({ where: { email: em } });
    if (!member) {
      // For security, do not reveal if email exists, just return success or generic message
      // But for better UX in this app context, we might return error if not found?
      // User requested "Forgot Password", usually implies they expect to know if they typed wrong email.
      return res.status(404).json({ error: '找不到此 Email 的會員帳號' });
    }

    const recent = await prisma.emailVerification.findFirst({
      where: {
        email: em,
        purpose: 'reset-password',
        created_at: { gt: new Date(Date.now() - 60_000) },
        used_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    if (recent) {
      return res.status(429).json({ error: '請稍後再試' });
    }

    const code = generateEmailCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const ipHeader = (req.headers['x-forwarded-for'] as string) || '';
    const ip = (req.ip || ipHeader || '').toString().slice(0, 255) || null;

    await prisma.emailVerification.create({
      data: {
        email: em,
        code,
        purpose: 'reset-password',
        expires_at: expiresAt,
        ip: ip,
      },
    });

    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: em,
            subject: '重設密碼驗證碼',
            html: `<p>你的重設密碼驗證碼為：<strong>${code}</strong></p><p>請在 10 分鐘內輸入此驗證碼以重設密碼。</p>`,
          }),
        });
      } catch (e) {
        console.warn('Failed to send reset code email:', e);
      }
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Reset password with code
app.post('/api/members/reset-password-with-code', async (req, res) => {
  try {
    const { email, code, newPassword } = (req.body || {}) as { email?: string; code?: string; newPassword?: string };
    const em = String(email || '').trim().normalize('NFKC');
    const c = String(code || '').trim();
    const pw = String(newPassword || '');

    if (!em || !c || !pw) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    const member = await prisma.member.findFirst({ where: { email: em } });
    if (!member) {
      return res.status(404).json({ error: '會員不存在' });
    }

    const now = new Date();
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email: em,
        purpose: 'reset-password',
      },
      orderBy: { created_at: 'desc' },
    });

    if (!verification || verification.used_at || verification.expires_at < now || verification.attempts >= 5) {
      return res.status(400).json({ error: '驗證碼錯誤或已過期，請重新取得' });
    }

    if (verification.code !== c) {
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({ error: '驗證碼不正確' });
    }

    // Password complexity check
    const pwLenOk = pw.length >= 8;
    const pwHasNum = /\d/.test(pw);
    const pwHasAlpha = /[A-Za-z]/.test(pw);
    if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
      return res.status(400).json({ error: '密碼不符合規則（至少8字元，需含英文字母與數字）' });
    }

    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { used_at: now },
    });

    const salt = makeSalt();
    const h = createHash('sha256');
    h.update(salt + pw);
    const digest = h.digest('hex');

    await prisma.member.update({
      where: { id: member.id },
      data: {
        password_salt: salt,
        password_hash: digest,
        password_updated_at: now,
      },
    });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Get member's match history
app.get('/api/members/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Resolve member ID if it's an email
    let targetId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findFirst({ where: { email: id } });
      if (m) targetId = m.id;
    }

    const matches = await prisma.match.findMany({
      where: {
        players: {
          some: {
            member_id: targetId
          }
        }
      },
      include: {
        operator: {
          select: { name: true, club_name: true }
        },
        winner_member: {
          select: { id: true, name: true }
        },
        players: {
          include: {
            member: {
              select: { id: true, name: true }
            }
          }
        },
        stats: true,
      },
      orderBy: {
        started_at: 'desc'
      }
    });

    const result = matches.map(m => {
      const p0 = m.players[0]; // Note: Order is not guaranteed to match handicap0/1 without player_index
      const p1 = m.players[1];
      const playerUser = m.players.find(p => p.member_id === targetId);
      
      // Calculate duration
      let durationSeconds = 0;
      if (m.started_at && m.ended_at) {
        durationSeconds = Math.floor((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 1000);
      }

      return {
        id: m.id,
        date: m.started_at,
        matchName: m.name,
        matchLevel: m.name_part || '一般', // Assuming name_part stores level or just use default
        operatorName: m.operator?.name || '-',
        operatorClub: m.operator?.club_name || '-',
        // Return raw players and handicaps, frontend will try to display
        players: m.players.map(p => ({
          id: p.member_id, // Add member_id for identification
          member: {
            id: p.member.id,
            name: p.member.name
          },
          name: p.member.name,
          framesWon: p.frames_won,
          maxBreak: p.max_break_points,
        })),
        handicaps: [m.handicap0, m.handicap1],
        framesRequired: m.frames_required,
        totalFrames: (p0?.frames_won || 0) + (p1?.frames_won || 0),
        finalScore: `${p0?.frames_won || 0}-${p1?.frames_won || 0}`, // Order might be mixed
        winnerName: m.winner_member?.name,
        isWinner: m.winner_member_id === targetId,
        userMaxBreak: playerUser?.max_break_points || 0,
        durationSeconds,
      };
    });

    res.json({ matches: result });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Register a new member with district-based sequential member_code (no country prefix for now)
app.post('/api/members/register', async (req, res) => {
  try {
    const payload = (req.body || {}) as {
      email?: string;
      name?: string;
      regionCode?: string;
      districtCode?: string;
      districtName?: string;
      phone?: string;
      birthDate?: string;
    };

    const email = String(payload.email || '').trim().normalize('NFKC');
    const name = String(payload.name || '').trim();
    const phone = payload.phone ? String(payload.phone).trim() : undefined;
    const birthDateStr = payload.birthDate ? String(payload.birthDate).trim() : undefined;

    if (!email || !name) {
      return res.status(400).json({ error: 'email 與 name 為必填' });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: 'email 格式不正確' });
    }

    const regionRaw = String(payload.regionCode || '').trim().toUpperCase();
    const districtRaw = String(payload.districtCode || payload.districtName || '').trim().toUpperCase();

    const birthDate = birthDateStr ? new Date(birthDateStr) : undefined;
    if (birthDateStr && Number.isNaN(birthDate!.getTime())) {
      return res.status(400).json({ error: '出生日期格式無效，請使用 ISO 格式，如 1990-01-31' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existsEmail = await tx.member.findFirst({ where: { email } });
      if (existsEmail) {
        throw new Error('email 已存在');
      }

      let regionCode = regionRaw;
      let districtCode = districtRaw;

      if (!regionCode && districtCode) {
        regionCode = 'HKG';
      }

      if (!regionCode || !districtCode) {
        throw new Error('regionCode 與 districtCode 為必填');
      }

      const region = await tx.memberRegion.findUnique({ where: { code3: regionCode } });
      if (!region || region.active === false) {
        throw new Error('無效的地方編號');
      }

      const district = await tx.memberDistrict.findFirst({
        where: { region_code: regionCode, code3: districtCode, active: true },
      });
      if (!district) {
        throw new Error('無效的分區編號');
      }

      const seq = await tx.memberCodeSequence.upsert({
        where: { region_code_district_code: { region_code: regionCode, district_code: districtCode } },
        update: { next_seq: { increment: 1 } },
        create: { region_code: regionCode, district_code: districtCode, next_seq: 2 },
        select: { next_seq: true },
      });
      const current = seq.next_seq - 1;
      const memberCode = `${regionCode}${districtCode}${String(current).padStart(7, '0')}`;

      // const token = Buffer.from(randomBytes(24)).toString('hex');
      // const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const now = new Date();
      const membershipExpires = new Date(now.getTime());
      membershipExpires.setFullYear(membershipExpires.getFullYear() + 3);

      const created = await tx.member.create({
        data: {
          id: randomUUID(),
          name,
          email,
          // region_code: regionCode,
          district_code: districtCode,
          phone: phone ?? null,
          birth_date: birthDate ?? null,
          member_code: memberCode,
          // email_verification_token: token,
          // email_verification_expires_at: expiresAt,
          membership_expires_at: membershipExpires,
        },
      });
      return { id: created.id, memberCode, token: '' }; // token empty
    });

    // 寄送驗證信（若已配置郵件供應商）
    if (RESEND_API_KEY) {
      /*
      const verifyUrl = `${req.protocol}://${req.get('host')}/verify-email?token=${encodeURIComponent(result.token!)}`;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'no-reply@snookerhk.live',
            to: email,
            subject: '驗證你的電子郵件',
            html: `<p>您好 ${name}，請點擊以下連結完成驗證：</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>連結 24 小時內有效。</p>`
          })
        });
      } catch (e) {
        // 不阻斷流程，僅記錄
        console.warn('Failed to send verification email:', e);
      }
      */
    }

    res.status(201).json({ id: result.id, memberCode: result.memberCode });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg.includes('email 已存在') ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

function makeSalt(): string {
  return randomBytes(16).toString('hex');
}

function generateEmailCode(): string {
  const buf = randomBytes(3);
  const num = buf.readUIntBE(0, 3) % 1000000;
  return String(num).padStart(6, '0');
}

app.post('/api/members/request-register-code', async (req, res) => {
  try {
    const { email } = (req.body || {}) as { email?: string };
    const em = String(email || '').trim().normalize('NFKC');
    if (!em) {
      return res.status(400).json({ error: 'email 為必填' });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
    if (!emailOk) {
      return res.status(400).json({ error: 'email 格式不正確' });
    }
    const exists = await prisma.member.findFirst({ where: { email: em } });
    if (exists) {
      return res.status(409).json({ error: '此 email 已註冊' });
    }
    const recent = await prisma.emailVerification.findFirst({
      where: {
        email: em,
        purpose: 'register',
        created_at: { gt: new Date(Date.now() - 60_000) },
        used_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    if (recent) {
      return res.status(429).json({ error: '請稍後再試' });
    }
    const code = generateEmailCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const ipHeader = (req.headers['x-forwarded-for'] as string) || '';
    const ip = (req.ip || ipHeader || '').toString().slice(0, 255) || null;
    await prisma.emailVerification.create({
      data: {
        email: em,
        code,
        purpose: 'register',
        expires_at: expiresAt,
        ip: ip,
      },
    });
    if (RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_FROM_EMAIL,
            to: em,
            subject: '會員註冊驗證碼',
            html: `<p>你的驗證碼為：<strong>${code}</strong></p><p>請在 10 分鐘內於註冊頁面輸入此驗證碼以完成註冊。</p>`,
          }),
        });
      } catch (e) {
        console.warn('Failed to send register code email:', e);
      }
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/members/register-with-code', async (req, res) => {
  try {
    const payload = (req.body || {}) as {
      email?: string;
      code?: string;
      name?: string;
      password?: string;
      regionCode?: string;
      districtCode?: string;
      districtName?: string;
      phone?: string;
      birthDate?: string;
      clubName?: string;
    };
    const email = String(payload.email || '').trim().normalize('NFKC');
    const code = String(payload.code || '').trim();
    const name = String(payload.name || '').trim();
    const password = String(payload.password || '');
    const phone = payload.phone ? String(payload.phone).trim() : undefined;
    const clubName = payload.clubName ? String(payload.clubName).trim() : undefined;
    const birthDateStr = payload.birthDate ? String(payload.birthDate).trim() : undefined;
    if (!email || !name || !code || !password) {
      return res.status(400).json({ error: 'email、name、驗證碼與密碼為必填' });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ error: 'email 格式不正確' });
    }
    const pwLenOk = password.length >= 8;
    const pwHasNum = /\d/.test(password);
    const pwHasAlpha = /[A-Za-z]/.test(password);
    if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
      return res.status(400).json({ error: '密碼不符合規則（至少8字元，需含英文字母與數字）' });
    }
    const birthDate = birthDateStr ? new Date(birthDateStr) : undefined;
    if (birthDateStr && Number.isNaN(birthDate!.getTime())) {
      return res.status(400).json({ error: '出生日期格式無效，請使用 ISO 格式，如 1990-01-31' });
    }
    const existing = await prisma.member.findFirst({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'email 已存在' });
    }
    const now = new Date();
    const verification = await prisma.emailVerification.findFirst({
      where: {
        email,
        purpose: 'register',
      },
      orderBy: { created_at: 'desc' },
    });
    if (!verification || verification.used_at || verification.expires_at < now || verification.attempts >= 5) {
      return res.status(400).json({ error: '驗證碼錯誤或已過期，請重新取得' });
    }
    if (verification.code !== code) {
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({ error: '驗證碼不正確' });
    }
    await prisma.emailVerification.update({
      where: { id: verification.id },
      data: { used_at: now },
    });
    const regionRaw = String(payload.regionCode || '').trim().toUpperCase();
    const districtRaw = String(payload.districtCode || payload.districtName || '').trim().toUpperCase();
    const result = await prisma.$transaction(async (tx) => {
      const existsEmail = await tx.member.findFirst({ where: { email } });
      if (existsEmail) {
        throw new Error('email 已存在');
      }
      let regionCode = regionRaw;
      let districtCode = districtRaw;
      if (!regionCode && districtCode) {
        regionCode = 'HKG';
      }
      if (!regionCode || !districtCode) {
        throw new Error('regionCode 與 districtCode 為必填');
      }
      const region = await tx.memberRegion.findUnique({ where: { code3: regionCode } });
      if (!region || region.active === false) {
        throw new Error('無效的地方編號');
      }
      const district = await tx.memberDistrict.findFirst({
        where: { region_code: regionCode, code3: districtCode, active: true },
      });
      if (!district) {
        throw new Error('無效的分區編號');
      }
      const seq = await tx.memberCodeSequence.upsert({
        where: { region_code_district_code: { region_code: regionCode, district_code: districtCode } },
        update: { next_seq: { increment: 1 } },
        create: { region_code: regionCode, district_code: districtCode, next_seq: 2 },
        select: { next_seq: true },
      });
      const current = seq.next_seq - 1;
      const memberCode = `${regionCode}${districtCode}${String(current).padStart(7, '0')}`;
      const membershipExpires = new Date(now.getTime());
      membershipExpires.setFullYear(membershipExpires.getFullYear() + 3);
      const salt = makeSalt();
      const h = createHash('sha256');
      h.update(salt + password);
      const digest = h.digest('hex');
      const created = await tx.member.create({
        data: {
          id: randomUUID(),
          name,
          email,
          district_code: districtCode,
          phone: phone ?? null,
          club_name: clubName ?? null,
          birth_date: birthDate ?? null,
          member_code: memberCode,
          membership_expires_at: membershipExpires,
          password_salt: salt,
          password_hash: digest,
          password_updated_at: now,
          email_verified_at: now,
        },
      });
      return { id: created.id, memberCode };
    });
    res.status(201).json({ id: result.id, memberCode: result.memberCode });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg.includes('email 已存在') ? 409 : 500;
    res.status(status).json({ error: msg });
  }
});

// Operator: Get match history
app.get('/api/operators/:id/matches', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing operator ID' });
    
    // Resolve ID if email
    let opId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findUnique({ where: { email: id }, select: { id: true } });
      if (!m) return res.status(404).json({ error: 'Operator not found' });
      opId = m.id;
    }

    const matches = await prisma.match.findMany({
      where: { operator_id: opId },
      orderBy: { started_at: 'desc' },
      include: {
        players: {
          include: {
            member: { select: { name: true } }
          }
        },
        operator: { select: { name: true, club_name: true } }
      }
    });

    const result = matches.map(m => {
      const p0 = m.players[0];
      const p1 = m.players[1];
      const p0Name = p0?.member?.name || 'Unknown';
      const p1Name = p1?.member?.name || 'Unknown';
      const p0Score = p0?.frames_won || 0;
      const p1Score = p1?.frames_won || 0;
      
      return {
        id: m.id,
        startedAt: m.started_at,
        endedAt: m.ended_at,
        operator: m.operator ? { name: m.operator.name, clubName: m.operator.club_name } : null,
        matchName: m.name,
        matchCode: m.match_code,
        framesRequired: m.frames_required,
        p0: { name: p0Name, score: p0Score, handicap: m.handicap0, maxBreak: p0?.max_break_points },
        p1: { name: p1Name, score: p1Score, handicap: m.handicap1, maxBreak: p1?.max_break_points },
        result: m.winner_member_id ? (m.winner_member_id === p0?.member_id ? `${p0Name} Win` : `${p1Name} Win`) : 'In Progress',
        durationSeconds: m.started_at && m.ended_at ? Math.floor((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 1000) : null,
      };
    });

    res.json({ matches: result });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Operator: Create Room (Limit 5 active rooms)
app.post('/api/operators/:id/rooms', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing operator ID' });

    // Resolve ID if email
    let opId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findUnique({ where: { email: id }, select: { id: true } });
      if (!m) return res.status(404).json({ error: 'Operator not found' });
      opId = m.id;
    }

    // Check active in-memory rooms for this operator
    // We count the rooms currently in the system associated with this operator
    const activeCount = rooms.filter(r => r.operatorId === opId).length;

    if (activeCount >= 5) {
      return res.status(403).json({ error: '已達到房間數量上限 (5)' });
    }

    const code = await nextRoomCodeServer();
    // Create in-memory room immediately so it appears in the active list
    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newRoom: Room = { 
      id: newId, 
      name: `Room ${code}`, 
      code, 
      scores: [0, 0],
      operatorId: opId 
    };
    rooms.push(newRoom);
    
    // Persist to DB
    try {
        await prisma.room.create({
            data: {
                id: newId,
                name: `Room ${code}`,
                code,
                operator_id: opId,
                scores: [0, 0],
                gameState: {}
            }
        });
    } catch(e) {
        console.error('Failed to persist operator room:', e);
    }

    io.emit('rooms', rooms);

    res.json({ roomCode: code, roomId: newId });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/operators/:id/active-rooms', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing operator ID' });
    
    // Resolve ID if email
    let opId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findUnique({ where: { email: id }, select: { id: true } });
      if (!m) return res.status(404).json({ error: 'Operator not found' });
      opId = m.id;
    }

    const active = rooms.filter(r => r.operatorId === opId);
    res.json({ rooms: active });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Simple password hashing helpers (SHA-256 with per-user salt)
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '216977203711-pm37tm2vr3h178qgdnaj8v4n72k5hps9.apps.googleusercontent.com');

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || '216977203711-pm37tm2vr3h178qgdnaj8v4n72k5hps9.apps.googleusercontent.com',
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid token' });

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;

    let member = await prisma.member.findUnique({ where: { email } });

    if (member) {
      // Logic for google_id update removed due to DB permission issues.
      // Matching by email only for now.
      
      return res.json({ 
        ok: true, 
        id: member.id, 
        member: { 
          id: member.id, 
          name: member.name, 
          email: member.email, 
          member_code: member.member_code,
          role: member.role 
        } 
      });
    } else {
       return res.status(404).json({ error: 'Google 帳號未連結或未註冊，請先註冊會員' });
    }

  } catch (err: any) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Member login (email + password), returns member basic info
app.post('/api/members/login', async (req, res) => {
  try {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    const em = String(email || '').trim();
    const pw = String(password || '');
    if (!em || !pw) {
      return res.status(400).json({ error: '缺少 email 或 password' });
    }
    const m = await prisma.member.findUnique({ where: { email: em } });
    if (!m) return res.status(404).json({ error: '會員不存在' });
    const mh = (m as any).password_hash as string | undefined;
    const ms = (m as any).password_salt as string | undefined;
    if (!mh || !ms) {
      return res.status(400).json({ error: '尚未設定密碼' });
    }
    const h = createHash('sha256');
    h.update(String(ms) + pw);
    const digest = h.digest('hex');
    if (digest !== mh) {
      return res.status(401).json({ error: '帳號或密碼不正確' });
    }
    return res.json({ 
      ok: true, 
      id: m.id, 
      member: { 
        id: m.id, 
        name: m.name, 
        email: m.email, 
        member_code: m.member_code,
        role: m.role 
      } 
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Admin: reset member password (requires admin token)
app.post('/api/admin/members/:id/password', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const { newPassword } = (req.body || {}) as { newPassword?: string };
    const pw = String(newPassword || '');
    if (!id || !pw) {
      return res.status(400).json({ error: '缺少會員 ID 或新密碼' });
    }
    const salt = randomBytes(16).toString('hex');
    const h = createHash('sha256');
    h.update(salt + pw);
    const digest = h.digest('hex');
    const updated = await prisma.member.update({
      where: { id },
      data: { password_salt: salt, password_hash: digest, password_updated_at: new Date() },
      select: { id: true },
    });
    res.json({ ok: true, id: updated.id });
  } catch (err: any) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: '會員不存在' });
    }
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Verify email by token
app.get('/verify-email', async (req, res) => {
  // Temporary disabled due to schema changes
  res.status(501).send('Email verification is temporarily disabled.');
  /*
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(400).send('missing token');
    
    const member = await prisma.member.findFirst({
      where: { email_verification_token: token }
    });
    
    // const member = null;
    if (!member) return res.status(404).send('invalid token');
    if (member.email_verification_expires_at && new Date(member.email_verification_expires_at).getTime() < Date.now()) {
    // if (false) {
      return res.status(410).send('token expired');
    }
    await prisma.member.update({
      where: { id: member.id },
      data: { email_verified_at: new Date(), email_verification_token: null, email_verification_expires_at: null }
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Email Verified</title></head><body style="font-family:system-ui"><h2>電子郵件驗證成功</h2><p>你可以關閉此頁面。</p></body></html>`);
  } catch (e: any) {
    res.status(500).send(String(e?.message || e));
  }
  */
});

async function findMemberByIdOrEmail(identifier: string) {
  const value = String(identifier || '').trim();
  if (!value) return null;
  return prisma.member.findFirst({
    where: {
      OR: [
        { id: value },
        { email: value },
      ],
    },
  });
}

app.post('/api/members/validate', async (req, res) => {
  try {
    const { identifiers } = (req.body || {}) as { identifiers?: string[] };
    const ids = Array.isArray(identifiers) ? identifiers.map(s => String(s).trim()).filter(Boolean) : [];
    
    if (ids.length === 0) {
      return res.status(400).json({ error: 'identifiers is required (array of strings)' });
    }

    const exists: Record<string, boolean> = {};
    const names: Record<string, string | null> = {};

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const rawId of ids) {
      const id = rawId.trim();
      if (!id) continue;

      let member = null;
      if (id.includes('@')) {
        member = await prisma.member.findFirst({
          where: { email: id },
          select: { name: true },
        });
      } else if (uuidPattern.test(id)) {
        member = await prisma.member.findUnique({
          where: { id },
          select: { name: true },
        });
      } else {
        member = await prisma.member.findFirst({
          where: { member_code: id },
          select: { name: true },
        });
      }

      exists[id] = !!member;
      names[id] = member ? member.name : null;
    }

    res.json({ exists, names });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/members/:id', async (req, res) => {
  try {
    const idOrEmail = String(req.params.id || '').trim();
    const m = await findMemberByIdOrEmail(idOrEmail);
    if (!m) return res.status(404).json({ error: 'not found' });
    res.json(m);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/members/:id/renew', async (req, res) => {
  try {
    const idOrEmail = String(req.params.id || '').trim();
    if (!idOrEmail) {
      return res.status(400).json({ error: '缺少會員 ID' });
    }
    const yearsRaw = (req.body as any)?.years;
    const years = Number.isFinite(Number(yearsRaw)) && Number(yearsRaw) > 0 ? Number(yearsRaw) : 3;
    const member = await findMemberByIdOrEmail(idOrEmail);
    if (!member) {
      return res.status(404).json({ error: '會員不存在' });
    }
    const now = new Date();
    const base =
      (member as any).membership_expires_at && (member as any).membership_expires_at > now
        ? (member as any).membership_expires_at
        : now;
    const next = new Date(base.getTime());
    next.setFullYear(next.getFullYear() + years);
    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { membership_expires_at: next }
    });
    res.json({ member: updated });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/admin/wipe-test-data', adminAuth, async (_req, res) => {
  try {
    await prisma.$transaction([
      prisma.event.deleteMany({}),
      prisma.foulTotals.deleteMany({}),
      prisma.matchStats.deleteMany({}),
      prisma.matchPlayer.deleteMany({}),
      prisma.match.deleteMany({}),
      prisma.memberCodeSequence.deleteMany({}),
      prisma.memberSequence.deleteMany({}),
      prisma.member.deleteMany({}),
    ]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/admin/member/regions', adminAuth, async (_req, res) => {
  try {
    const regions = await prisma.memberRegion.findMany({
      orderBy: { code3: 'asc' },
    });
    res.json({ regions });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/admin/member/regions', adminAuth, async (req, res) => {
  try {
    const { code3, name, active } = (req.body || {}) as { code3?: string; name?: string; active?: boolean };
    const code = String(code3 || '').trim().toUpperCase();
    const nm = String(name || '').trim();
    if (!code || !nm) {
      return res.status(400).json({ error: 'code3 與 name 為必填' });
    }
    const existing = await prisma.memberRegion.findUnique({
      where: { code3: code },
    });
    if (existing) {
      return res.status(409).json({ error: '地方代碼已存在' });
    }
    const region = await prisma.memberRegion.create({
      data: { code3: code, name: nm, active: typeof active === 'boolean' ? active : true },
    });
    res.json({ region });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/admin/member/regions/:code3', adminAuth, async (req, res) => {
  try {
    const codeParam = String(req.params.code3 || '').trim().toUpperCase();
    const { name, active } = (req.body || {}) as { name?: string; active?: boolean };
    const nm = String(name || '').trim();
    if (!codeParam || !nm) {
      return res.status(400).json({ error: 'code3 與 name 為必填' });
    }
    const existing = await prisma.memberRegion.findUnique({
      where: { code3: codeParam },
    });
    if (!existing) {
      return res.status(404).json({ error: '地方不存在' });
    }
    const region = await prisma.memberRegion.update({
      where: { code3: codeParam },
      data: {
        name: nm,
        ...(typeof active === 'boolean' ? { active } : {}),
      },
    });
    res.json({ region });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/admin/member/districts', adminAuth, async (req, res) => {
  try {
    const regionCodeRaw = (req.query.regionCode as string) || '';
    const regionCode = regionCodeRaw.trim().toUpperCase();
    const where: any = {};
    // if (regionCode) where.region_code = regionCode;
    const districts = await prisma.memberDistrict.findMany({
      where,
      orderBy: [{ region_code: 'asc' }, { code3: 'asc' }],
    });
    res.json({ districts });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/admin/member/districts', adminAuth, async (req, res) => {
  try {
    const { regionCode, code3, name, active } = (req.body || {}) as {
      regionCode?: string;
      code3?: string;
      name?: string;
      active?: boolean;
    };
    const region = String(regionCode || '').trim().toUpperCase();
    const code = String(code3 || '').trim().toUpperCase();
    const nm = String(name || '').trim();
    if (!region || !code || !nm) {
      return res.status(400).json({ error: 'regionCode、code3 與 name 為必填' });
    }
    const existing = await prisma.memberDistrict.findUnique({
      where: { region_code_code3: { region_code: region, code3: code } },
    });
    if (existing) {
      return res.status(409).json({ error: '分區代碼已存在' });
    }
    const district = await prisma.memberDistrict.create({
      data: { region_code: region, code3: code, name: nm, active: typeof active === 'boolean' ? active : true },
    });
    res.json({ district });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/admin/member/districts/:regionCode/:code3', adminAuth, async (req, res) => {
  try {
    const regionParam = String(req.params.regionCode || '').trim().toUpperCase();
    const codeParam = String(req.params.code3 || '').trim().toUpperCase();
    const { name, active } = (req.body || {}) as { name?: string; active?: boolean };
    const nm = String(name || '').trim();
    if (!regionParam || !codeParam || !nm) {
      return res.status(400).json({ error: 'regionCode、code3 與 name 為必填' });
    }
    const existing = await prisma.memberDistrict.findUnique({
      where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
    });
    if (!existing) {
      return res.status(404).json({ error: '分區不存在' });
    }
    const district = await prisma.memberDistrict.update({
      where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
      data: {
        name: nm,
        ...(typeof active === 'boolean' ? { active } : {}),
      },
    });
    res.json({ district });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.delete('/api/admin/member/districts/:regionCode/:code3', adminAuth, async (req, res) => {
  try {
    const regionParam = String(req.params.regionCode || '').trim().toUpperCase();
    const codeParam = String(req.params.code3 || '').trim().toUpperCase();
    if (!regionParam || !codeParam) {
      return res.status(400).json({ error: 'regionCode 與 code3 為必填' });
    }
    const existing = await prisma.memberDistrict.findUnique({
      where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
    });
    if (!existing) {
      return res.status(404).json({ error: '分區不存在' });
    }
    await prisma.memberDistrict.delete({
      where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Admin: list members (requires admin token)
// Admin: list members (requires admin token)
app.get('/api/admin/members', adminAuth, async (req, res) => {
  try {
    const page = Number((req.query.page as string) || '1');
    const pageSize = Number((req.query.pageSize as string) || '20');
    const take = Math.max(1, Math.min(pageSize, 100));
    const skip = Math.max(0, (page - 1) * take);

    const [total, members] = await prisma.$transaction([
      prisma.member.count(),
      prisma.member.findMany({ skip, take, orderBy: { created_at: 'desc' } }),
    ]);

    res.json({ total, page, pageSize: take, members });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Admin: update member (requires admin token)
app.put('/api/admin/members/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: '缺少會員 ID' });
    }
    const body = (req.body || {}) as {
      name?: string;
      email?: string | null;
      district_code?: string | null;
      member_code?: string | null;
      phone?: string | null;
      birthDate?: string | null;
      birth_date?: string | null;
      role?: string | null;
      membershipExpiresAt?: string | null;
      membership_expires_at?: string | null;
      club_name?: string | null;
      clubName?: string | null;
    };

    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name ?? '').trim();
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;
    if (body.district_code !== undefined) data.district_code = body.district_code ? String(body.district_code).trim() : null;
    if (body.member_code !== undefined) data.member_code = body.member_code ? String(body.member_code).trim() : null;
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.club_name !== undefined) data.club_name = body.club_name ? String(body.club_name).trim() : null;
    if (body.clubName !== undefined) data.club_name = body.clubName ? String(body.clubName).trim() : null;

    const bdRaw = body.birthDate ?? body.birth_date;
    if (bdRaw !== undefined) {
      if (!bdRaw) {
        data.birth_date = null;
      } else {
        const d = new Date(bdRaw);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: '出生日期格式不正確' });
        }
        data.birth_date = d;
      }
    }

    const membershipRaw = body.membershipExpiresAt ?? body.membership_expires_at;
    if (membershipRaw !== undefined) {
      const s = String(membershipRaw || '').trim();
      if (!s) {
        data.membership_expires_at = null;
      } else {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: '會員有效期格式不正確' });
        }
        data.membership_expires_at = d;
      }
    }
    if (body.role !== undefined) {
      const r = String(body.role || 'MEMBER').toUpperCase();
      data.role = r === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    }
    const member = await prisma.member.update({
      where: { id },
      data,
    });
    res.json({ member });
  } catch (err: any) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: '會員不存在' });
    }
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Member: self-update (no admin token required, but allows limited fields)
app.put('/api/members/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: '缺少會員 ID' });
    
    // In a real app, we would verify the session/token here to ensure the user is updating themselves.
    // For this standalone version, we assume the client is behaving (or we trust the ID flow).

    const body = (req.body || {}) as {
      phone?: string;
      birthDate?: string;
      birth_date?: string;
      clubName?: string;
      club_name?: string;
      password?: string;
    };

    const data: any = {};
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.club_name !== undefined) data.club_name = body.club_name ? String(body.club_name).trim() : null;
    if (body.clubName !== undefined) data.club_name = body.clubName ? String(body.clubName).trim() : null;

    const bdRaw = body.birthDate ?? body.birth_date;
    if (bdRaw !== undefined) {
      if (!bdRaw) {
        data.birth_date = null;
      } else {
        const d = new Date(bdRaw);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: '出生日期格式不正確' });
        }
        data.birth_date = d;
      }
    }

    if (body.password) {
      const pw = String(body.password);
      const salt = randomBytes(16).toString('hex');
      const hash = createHash('sha256').update(pw + salt).digest('hex');
      data.password_hash = hash;
      data.password_salt = salt;
      data.password_updated_at = new Date();
    }

    // Only update if member exists
    const member = await prisma.member.update({
      where: { id },
      data,
    });
    res.json({ member });
  } catch (err: any) {
    if ((err as any)?.code === 'P2025') {
      return res.status(404).json({ error: '會員不存在' });
    }
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Admin: delete member (requires admin token)
app.delete('/api/admin/members/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: '缺少會員 ID' });
    }
    try {
      await prisma.member.delete({ where: { id } });
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') {
        return res.status(404).json({ error: '會員不存在' });
      }
      if ((err as any)?.code === 'P2003') {
        return res.status(400).json({ error: '會員已有比賽紀錄，無法刪除' });
      }
      throw err;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});
// Admin: list matches (requires admin token, optional filter by memberId)
app.get('/api/admin/matches', adminAuth, async (req, res) => {
  try {
    const page = Number((req.query.page as string) || '1');
    const pageSize = Number((req.query.pageSize as string) || '20');
    const take = Math.max(1, Math.min(pageSize, 100));
    const skip = Math.max(0, (page - 1) * take);
    const memberId = String((req.query.memberId as string) || '').trim();

    const where: any = {};
    if (memberId) {
      where.players = { some: { member_id: memberId } };
    }

    const [total, matches] = await prisma.$transaction([
      prisma.match.count({ where }),
      prisma.match.findMany({
        where,
        orderBy: { started_at: 'desc' },
        skip,
        take,
        include: {
          players: {
            include: {
              member: {
                select: { id: true, name: true, member_code: true },
              },
            },
          },
          winner_member: {
            select: { id: true, name: true, member_code: true },
          },
        },
      }),
    ]);

    res.json({ total, page, pageSize: take, matches });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});
