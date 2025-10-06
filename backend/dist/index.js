import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startEnvAudit, getEnvHistoryTail } from './envAudit.js';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const WRITE_TOKEN = process.env.WRITE_TOKEN || '';
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
        const { foulTotals, stats, timestamps, winnerMemberId } = req.body || {};
        if (!matchId || !foulTotals || !Array.isArray(foulTotals) || foulTotals.length !== 2 || !stats) {
            return res.status(400).json({ error: 'invalid payload' });
        }
        const endedAt = timestamps?.end ? new Date(Number(timestamps.end)) : new Date();
        await prisma.$transaction([
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
                data: { ended_at: endedAt, winner_member_id: winnerMemberId ?? null },
            }),
        ]);
        res.json({ finalized: true });
    }
    catch (err) {
        res.status(500).json({ error: String(err?.message || err) });
    }
});
// Create room via simple GET for convenience, return shareable links
app.get('/rooms/new', (req, res) => {
    const name = req.query.name || 'Room';
    const newRoom = { id: (rooms.length + 1).toString(), name };
    rooms.push(newRoom);
    io.emit('rooms', rooms);
    const origin = (req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']) : req.protocol) + '://' + req.get('host');
    const viewerLink = origin + '/room/' + newRoom.id;
    const hostLink = viewerLink + '?host=1';
    res.json({ id: newRoom.id, name: newRoom.name, viewerLink, hostLink });
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