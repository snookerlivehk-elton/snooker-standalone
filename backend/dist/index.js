import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startEnvAudit, getEnvHistoryTail } from './envAudit.js';
import { PrismaClient } from '@prisma/client';
import { resolveDistrictCode, DISTRICT_CODE_MAP } from './districtCodes.js';
import { randomUUID, randomBytes, createHash } from 'crypto';
function incrementLetters(letters) {
    const arr = letters.split('');
    for (let i = arr.length - 1; i >= 0; i--) {
        const ch = arr[i];
        if (!ch)
            continue;
        const code = ch.charCodeAt(0);
        if (code < 90) {
            arr[i] = String.fromCharCode(code + 1);
            for (let j = i + 1; j < arr.length; j++)
                arr[j] = 'A';
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
let lastRoomCode = null;
const ROOM_CODE_FILE = path.join(__dirname, 'room-code-state.json');
function loadLastRoomCode() {
    try {
        if (fs.existsSync(ROOM_CODE_FILE)) {
            const data = fs.readFileSync(ROOM_CODE_FILE, 'utf-8');
            const json = JSON.parse(data);
            if (json.lastRoomCode) {
                lastRoomCode = json.lastRoomCode;
            }
        }
    }
    catch (err) {
        console.error('Failed to load room code state:', err);
    }
}
function saveLastRoomCode(code) {
    try {
        fs.writeFileSync(ROOM_CODE_FILE, JSON.stringify({ lastRoomCode: code }));
    }
    catch (err) {
        console.error('Failed to save room code state:', err);
    }
}
// Load state on startup
loadLastRoomCode();
function nextRoomCodeServer() {
    const patternNew = /^[A-Z]{5}\d{4}$/;
    // If no last code loaded from file, try to deduce from current memory rooms (fallback)
    if (!lastRoomCode || !patternNew.test(lastRoomCode)) {
        const existing = rooms
            .map(r => r.code)
            .filter((c) => !!c && patternNew.test(c))
            .sort();
        const lastExisting = existing.length > 0 ? existing[existing.length - 1] : 'AAAAA0000';
        lastRoomCode = lastExisting;
    }
    let base = lastRoomCode || 'AAAAA0000';
    if (!patternNew.test(base)) {
        base = 'AAAAA0000';
    }
    const letters = base.slice(0, 5);
    const digits = base.slice(5);
    let num = parseInt(digits, 10);
    if (isNaN(num)) {
        lastRoomCode = 'AAAAA0000';
        saveLastRoomCode(lastRoomCode);
        return lastRoomCode;
    }
    // Increment logic
    while (true) {
        num += 1;
        if (num > 9999) {
            const inc = incrementLetters(letters);
            lastRoomCode = `${inc}0000`;
        }
        else {
            lastRoomCode = `${letters}${String(num).padStart(4, '0')}`;
        }
        // Double check against current memory rooms to be safe
        if (!rooms.find(r => r.code === lastRoomCode)) {
            saveLastRoomCode(lastRoomCode);
            return lastRoomCode;
        }
    }
}
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const WRITE_TOKEN = process.env.WRITE_TOKEN || '';
const SOCKET_IO_PATH = process.env.SOCKET_IO_PATH || '/socket.io';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// 支援多來源：以逗號分隔，例如 "http://localhost:5173,http://localhost:5174"
const corsOrigins = corsOriginRaw === '*'
    ? '*'
    : corsOriginRaw.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ strict: false }));
app.use((err, _req, res, next) => {
    // Handle JSON parse errors from body-parser
    if (err instanceof SyntaxError && 'body' in err && err.status === 400) {
        console.error('JSON Parse Error:', err.message);
        return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    next(err);
});
// Prisma client for DB connectivity
const prisma = new PrismaClient();
async function resolveMemberIdentifiers(identifiers) {
    const trimmed = Array.from(new Set(identifiers
        .map((v) => String(v ?? '').trim())
        .filter((v) => v.length > 0)));
    if (!trimmed.length)
        return new Map();
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
    const map = new Map();
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
        await prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'ok' });
    }
    catch (err) {
        res.status(500).json({ status: 'error', error: String(err) });
    }
});
// Strict match creation: require valid memberId for both players; if any missing or not found, reject
app.post('/api/matches/strict', writeAuth, async (req, res) => {
    try {
        const { roomId, match, players, timestamps } = req.body || {};
        if (!roomId || !match || !players || !Array.isArray(players) || players.length !== 2) {
            return res.status(400).json({ error: 'invalid payload' });
        }
        const p0 = players[0]?.memberId;
        const p1 = players[1]?.memberId;
        if (!p0 || !p1 || typeof p0 !== 'string' || typeof p1 !== 'string') {
            return res.status(400).json({ error: 'memberId required for both players' });
        }
        const idMap = await resolveMemberIdentifiers([p0, p1]);
        const p0Resolved = idMap.get(p0) || null;
        const p1Resolved = idMap.get(p1) || null;
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
            },
        });
        const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
        await prisma.$transaction([
            prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p0Resolved, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
            prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p1Resolved, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
        ]);
        res.status(201).json({ matchId: created.id });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.post('/api/matches/partial', writeAuth, async (req, res) => {
    try {
        const { roomId, match, players, timestamps } = req.body || {};
        if (!roomId || !match || !players || !Array.isArray(players) || players.length !== 2) {
            return res.status(400).json({ error: 'invalid payload' });
        }
        const candidateIds = [players[0]?.memberId, players[1]?.memberId].filter((x) => typeof x === 'string');
        const idMap = await resolveMemberIdentifiers(candidateIds);
        const acceptedMemberIds = candidateIds.filter(id => idMap.has(id));
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
                started_at: startedAt,
            },
        });
        const defaultsPotByBall = { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 };
        const txOps = [];
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            let memberId = null;
            if (p?.memberId && typeof p.memberId === 'string') {
                const resolved = idMap.get(p.memberId);
                if (resolved) {
                    memberId = resolved;
                }
            }
            else if (!p?.memberId && p?.name) {
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
        if (txOps.length)
            await prisma.$transaction(txOps);
        res.status(201).json({ matchId: created.id, acceptedMemberIds });
    }
    catch (err) {
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
        origin: corsOrigins,
    },
    path: SOCKET_IO_PATH,
});
const rooms = [];
app.get('/api/rooms', (req, res) => {
    res.json(rooms);
});
app.get('/rooms/:roomId/state', (req, res) => {
    const roomId = String(req.params.roomId);
    const room = rooms.find(r => r.id === roomId || r.code === roomId);
    res.json({ roomId, state: room?.gameState ?? null });
});
app.post('/api/rooms', (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ message: 'Room name is required' });
    }
    const code = nextRoomCodeServer();
    // Use a unique ID based on timestamp and random number to avoid collisions on server restart
    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newRoom = { id: newId, name, code, scores: [0, 0] };
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
// Basic write authorization for match write endpoints
function writeAuth(req, res, next) {
    if (!WRITE_TOKEN)
        return next();
    const token = req.headers['x-write-token'] || req.query.token || '';
    if (token !== WRITE_TOKEN) {
        return res.status(401).json({ error: 'unauthorized' });
    }
    next();
}
// Admin overview: basic runtime, DB, sockets, rooms
app.get('/admin/overview', adminAuth, async (req, res) => {
    let dbStatus = 'ok';
    let dbError;
    try {
        await prisma.$queryRaw `SELECT 1`;
    }
    catch (err) {
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
        sockets: { clientsCount: io?.engine?.clientsCount ?? null },
        rooms: { count: rooms.length },
        db: { status: dbStatus, error: dbError }
    };
    // Content negotiation: explicit query param wins; otherwise use Accept header.
    const format = String(req.query.format || '').toLowerCase();
    const wantsHtml = (format === 'html') || (((req.headers['accept'] || '').includes('text/html')) && format !== 'json');
    if (wantsHtml) {
        const corsListHtml = Array.isArray(corsOrigins)
            ? corsOrigins.map(o => `<li><code>${o}</code></li>`).join('')
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
    const byCode = {};
    for (const it of items) {
        if (!byCode[it.code])
            byCode[it.code] = it;
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.get('/api/member/districts', async (req, res) => {
    try {
        const regionCodeRaw = req.query.regionCode || '';
        const regionCode = regionCodeRaw.trim().toUpperCase();
        const where = { active: true };
        if (regionCode)
            where.region_code = regionCode;
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
    }
    catch (err) {
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
          const email = emailEl.value.trim().normalize('NFKC');
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
        const memberIds = [];
        for (const p of players) {
            let memberId = p.memberId ?? null;
            if (memberId && typeof memberId === 'string') {
                // Upsert member by provided id
                const m = await prisma.member.upsert({
                    where: { id: memberId },
                    update: { name: p.name ?? 'Unknown' },
                    create: { id: memberId, name: p.name ?? 'Unknown' },
                });
                memberIds.push(m.id);
            }
            else {
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
        const [p0Id, p1Id] = memberIds;
        await prisma.$transaction([
            prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p0Id, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
            prisma.matchPlayer.create({ data: { match_id: created.id, member_id: p1Id, pot_by_ball: defaultsPotByBall, shot_time_buckets: [0, 0, 0, 0] } }),
        ]);
        res.status(201).json({ matchId: created.id });
    }
    catch (err) {
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
        const startIdx = (maxIdxAgg._max?.idx ?? -1) + 1;
        // Map incoming events to DB rows with sequential idx
        const rows = events.map((e, i) => ({
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
// Finalize a match: persist foul totals, stats, and winner
app.post('/api/matches/:matchId/finalize', writeAuth, async (req, res) => {
    try {
        const matchId = req.params.matchId;
        const { foulTotals, stats, timestamps, winnerMemberId, playersFinal, match: matchMeta } = req.body || {};
        if (!matchId || !foulTotals || !Array.isArray(foulTotals) || foulTotals.length !== 2 || !stats) {
            return res.status(400).json({ error: 'invalid payload' });
        }
        const endedAt = timestamps?.end ? new Date(Number(timestamps.end)) : new Date();
        let winnerMemberIdInternal = null;
        if (winnerMemberId) {
            const winnerMap = await resolveMemberIdentifiers([String(winnerMemberId)]);
            winnerMemberIdInternal = winnerMap.get(String(winnerMemberId)) || null;
        }
        const matchUpdateData = {
            ended_at: endedAt,
            winner_member_id: winnerMemberIdInternal,
        };
        if (Array.isArray(matchMeta?.handicaps)) {
            matchUpdateData.handicap0 = Number(matchMeta.handicaps[0] || 0);
            matchUpdateData.handicap1 = Number(matchMeta.handicaps[1] || 0);
        }
        const ops = [
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
            const perPlayerArray = Array.isArray(stats?.perPlayer) ? stats.perPlayer : [];
            const candidateIds = playersFinal
                .map((pf) => (pf && pf.memberId ? String(pf.memberId) : null))
                .filter((id) => typeof id === 'string');
            const idMap = await resolveMemberIdentifiers(candidateIds);
            for (let i = 0; i < playersFinal.length; i++) {
                const pf = playersFinal[i];
                if (!pf)
                    continue;
                const identifier = pf.memberId ? String(pf.memberId) : null;
                const mid = identifier ? (idMap.get(identifier) || null) : null;
                if (!mid)
                    continue;
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
                        total_points: Number(pf.score || 0),
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
                        total_points: Number(pf.score || 0),
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
                }));
            }
        }
        await prisma.$transaction(ops);
        res.json({ finalized: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
// Create room via simple GET for convenience, return shareable links
app.get('/rooms/new', (req, res) => {
    const name = req.query.name || 'Room';
    const code = nextRoomCodeServer();
    const newId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newRoom = { id: newId, name, code };
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
        rooms.push({ id: roomId, name: 'Room ' + roomId });
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
// Register a new member with district-based sequential member_code (no country prefix for now)
app.post('/api/members/register', async (req, res) => {
    try {
        const payload = (req.body || {});
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
        if (birthDateStr && Number.isNaN(birthDate.getTime())) {
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
    }
    catch (err) {
        const msg = String(err?.message || err);
        const status = msg.includes('email 已存在') ? 409 : 500;
        res.status(status).json({ error: msg });
    }
});
function makeSalt() {
    return randomBytes(16).toString('hex');
}
function generateEmailCode() {
    const buf = randomBytes(3);
    const num = buf.readUIntBE(0, 3) % 1000000;
    return String(num).padStart(6, '0');
}
app.post('/api/members/request-register-code', async (req, res) => {
    try {
        const { email } = (req.body || {});
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
        const ipHeader = req.headers['x-forwarded-for'] || '';
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
                        from: 'no-reply@snookerhk.live',
                        to: em,
                        subject: '會員註冊驗證碼',
                        html: `<p>你的驗證碼為：<strong>${code}</strong></p><p>請在 10 分鐘內於註冊頁面輸入此驗證碼以完成註冊。</p>`,
                    }),
                });
            }
            catch (e) {
                console.warn('Failed to send register code email:', e);
            }
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.post('/api/members/register-with-code', async (req, res) => {
    try {
        const payload = (req.body || {});
        const email = String(payload.email || '').trim().normalize('NFKC');
        const code = String(payload.code || '').trim();
        const name = String(payload.name || '').trim();
        const password = String(payload.password || '');
        const phone = payload.phone ? String(payload.phone).trim() : undefined;
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
        if (birthDateStr && Number.isNaN(birthDate.getTime())) {
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
    }
    catch (err) {
        const msg = String(err?.message || err);
        const status = msg.includes('email 已存在') ? 409 : 500;
        res.status(status).json({ error: msg });
    }
});
// Simple password hashing helpers (SHA-256 with per-user salt)
// Member login (email + password), returns member basic info
app.post('/api/members/login', async (req, res) => {
    try {
        const { email, password } = (req.body || {});
        const em = String(email || '').trim();
        const pw = String(password || '');
        if (!em || !pw) {
            return res.status(400).json({ error: '缺少 email 或 password' });
        }
        const m = await prisma.member.findUnique({ where: { email: em } });
        if (!m)
            return res.status(404).json({ error: '會員不存在' });
        const mh = m.password_hash;
        const ms = m.password_salt;
        if (!mh || !ms) {
            return res.status(400).json({ error: '尚未設定密碼' });
        }
        const h = createHash('sha256');
        h.update(String(ms) + pw);
        const digest = h.digest('hex');
        if (digest !== mh) {
            return res.status(401).json({ error: '帳號或密碼不正確' });
        }
        return res.json({ ok: true, id: m.id, member: { id: m.id, name: m.name, email: m.email, member_code: m.member_code } });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
// Admin: reset member password (requires admin token)
app.post('/api/admin/members/:id/password', adminAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const { newPassword } = (req.body || {});
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
    }
    catch (err) {
        if (err?.code === 'P2025') {
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
async function findMemberByIdOrEmail(identifier) {
    const value = String(identifier || '').trim();
    if (!value)
        return null;
    return prisma.member.findFirst({
        where: {
            OR: [
                { id: value },
                { email: value },
            ],
        },
    });
}
app.get('/api/members/validate', async (req, res) => {
    try {
        const idsParam = req.query.ids || '';
        const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length === 0) {
            return res.status(400).json({ error: 'ids is required (comma-separated)' });
        }
        const exists = {};
        const names = {};
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const rawId of ids) {
            const id = rawId.trim();
            if (!id)
                continue;
            let member = null;
            if (id.includes('@')) {
                member = await prisma.member.findFirst({
                    where: { email: id },
                    select: { name: true },
                });
            }
            else if (uuidPattern.test(id)) {
                member = await prisma.member.findUnique({
                    where: { id },
                    select: { name: true },
                });
            }
            else {
                member = await prisma.member.findFirst({
                    where: { member_code: id },
                    select: { name: true },
                });
            }
            exists[id] = !!member;
            names[id] = member ? member.name : null;
        }
        res.json({ exists, names });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.get('/api/members/:id', async (req, res) => {
    try {
        const idOrEmail = String(req.params.id || '').trim();
        const m = await findMemberByIdOrEmail(idOrEmail);
        if (!m)
            return res.status(404).json({ error: 'not found' });
        res.json(m);
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.post('/api/members/:id/renew', async (req, res) => {
    try {
        const idOrEmail = String(req.params.id || '').trim();
        if (!idOrEmail) {
            return res.status(400).json({ error: '缺少會員 ID' });
        }
        const yearsRaw = req.body?.years;
        const years = Number.isFinite(Number(yearsRaw)) && Number(yearsRaw) > 0 ? Number(yearsRaw) : 3;
        const member = await findMemberByIdOrEmail(idOrEmail);
        if (!member) {
            return res.status(404).json({ error: '會員不存在' });
        }
        const now = new Date();
        const base = member.membership_expires_at && member.membership_expires_at > now
            ? member.membership_expires_at
            : now;
        const next = new Date(base.getTime());
        next.setFullYear(next.getFullYear() + years);
        const updated = await prisma.member.update({
            where: { id: member.id },
            data: { membership_expires_at: next }
        });
        res.json({ member: updated });
    }
    catch (err) {
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.get('/api/admin/member/regions', adminAuth, async (_req, res) => {
    try {
        const regions = await prisma.memberRegion.findMany({
            orderBy: { code3: 'asc' },
        });
        res.json({ regions });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.post('/api/admin/member/regions', adminAuth, async (req, res) => {
    try {
        const { code3, name, active } = (req.body || {});
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.put('/api/admin/member/regions/:code3', adminAuth, async (req, res) => {
    try {
        const codeParam = String(req.params.code3 || '').trim().toUpperCase();
        const { name, active } = (req.body || {});
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.get('/api/admin/member/districts', adminAuth, async (req, res) => {
    try {
        const regionCodeRaw = req.query.regionCode || '';
        const regionCode = regionCodeRaw.trim().toUpperCase();
        const where = {};
        // if (regionCode) where.region_code = regionCode;
        const districts = await prisma.memberDistrict.findMany({
            where,
            orderBy: [{ region_code: 'asc' }, { code3: 'asc' }],
        });
        res.json({ districts });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.post('/api/admin/member/districts', adminAuth, async (req, res) => {
    try {
        const { regionCode, code3, name, active } = (req.body || {});
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
app.put('/api/admin/member/districts/:regionCode/:code3', adminAuth, async (req, res) => {
    try {
        const regionParam = String(req.params.regionCode || '').trim().toUpperCase();
        const codeParam = String(req.params.code3 || '').trim().toUpperCase();
        const { name, active } = (req.body || {});
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
    }
    catch (err) {
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
// Admin: list members (requires admin token)
// Admin: list members (requires admin token)
app.get('/api/admin/members', adminAuth, async (req, res) => {
    try {
        const page = Number(req.query.page || '1');
        const pageSize = Number(req.query.pageSize || '20');
        const take = Math.max(1, Math.min(pageSize, 100));
        const skip = Math.max(0, (page - 1) * take);
        const [total, members] = await prisma.$transaction([
            prisma.member.count(),
            prisma.member.findMany({ skip, take, orderBy: { created_at: 'desc' } }),
        ]);
        res.json({ total, page, pageSize: take, members });
    }
    catch (err) {
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
        const body = (req.body || {});
        const data = {};
        if (body.name !== undefined)
            data.name = String(body.name ?? '').trim();
        if (body.email !== undefined)
            data.email = body.email ? String(body.email).trim() : null;
        if (body.district_code !== undefined)
            data.district_code = body.district_code ? String(body.district_code).trim() : null;
        if (body.member_code !== undefined)
            data.member_code = body.member_code ? String(body.member_code).trim() : null;
        if (body.phone !== undefined)
            data.phone = body.phone ? String(body.phone).trim() : null;
        const bdRaw = body.birthDate ?? body.birth_date;
        if (bdRaw !== undefined) {
            if (!bdRaw) {
                data.birth_date = null;
            }
            else {
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
            }
            else {
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
    }
    catch (err) {
        if (err?.code === 'P2025') {
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
        }
        catch (err) {
            if (err?.code === 'P2025') {
                return res.status(404).json({ error: '會員不存在' });
            }
            if (err?.code === 'P2003') {
                return res.status(400).json({ error: '會員已有比賽紀錄，無法刪除' });
            }
            throw err;
        }
        res.json({ ok: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
// Admin: list matches (requires admin token, optional filter by memberId)
app.get('/api/admin/matches', adminAuth, async (req, res) => {
    try {
        const page = Number(req.query.page || '1');
        const pageSize = Number(req.query.pageSize || '20');
        const take = Math.max(1, Math.min(pageSize, 100));
        const skip = Math.max(0, (page - 1) * take);
        const memberId = String(req.query.memberId || '').trim();
        const where = {};
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
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
//# sourceMappingURL=index.js.map