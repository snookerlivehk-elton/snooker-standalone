
import 'dotenv/config';
// Backend API for Snooker Standalone
// Force backend redeploy
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { startEnvAudit, getEnvHistoryTail } from './envAudit.js';
import { Prisma, PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { Resend } from 'resend';
import { resolveDistrictCode, DISTRICT_CODE_MAP } from './districtCodes.js';
import { randomUUID, randomBytes, createHash } from 'crypto';
import clubRouter from './routes/club.js';
import { createClubTables } from './scripts/create_club_tables.js';
import { getClubFeatureAssignment, getClubFeatureAssignments, isClubScopedFeatureKey } from './clubFeatureAccess.js';

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
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'site-ads';
// 支援多來源：以逗號分隔，例如 "http://localhost:5173,http://localhost:5174"
const corsOrigins = corsOriginRaw === '*'
  ? ['*']
  : corsOriginRaw.split(',').map(s => s.trim()).filter(Boolean);

const allowedSuffixes = [
  '.up.railway.app',
  '.snookerlive.hk',
  '.snookerhk.live',
];

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes('*')) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    if (allowedSuffixes.some(s => origin.endsWith(s))) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-member-id', 'x-write-token', 'x-admin-token', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ strict: false, limit: '50mb' }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle JSON parse errors from body-parser
  if (err && (err as any).type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload_too_large' });
  }
  if (err instanceof SyntaxError && 'body' in err && (err as any).status === 400) {
    console.error('JSON Parse Error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  next(err);
});

// Prisma client for DB connectivity
const prisma = new PrismaClient();
createClubTables(prisma).catch(e => console.error('Failed to init club tables', e));

const FEATURE_CATALOG = [
  { key: 'booking', label: '會員預約', defaultEnabled: true },
  { key: 'qr_session', label: '掃碼起鐘及結算', defaultEnabled: true },
  { key: 'points', label: '消費積分', defaultEnabled: true },
  { key: 'highbreak', label: '單杆統計及排名', defaultEnabled: true },
  { key: 'tournaments', label: '比賽報名入口', defaultEnabled: true },
  { key: 'club_messages', label: '球會訊息', defaultEnabled: true },
  { key: 'club_dashboard', label: '球會主頁（管理）', defaultEnabled: true },
  { key: 'system_portal', label: '系統主頁', defaultEnabled: true },
  { key: 'member_portal', label: '會員主頁', defaultEnabled: true },
  { key: 'scoring', label: '計分', defaultEnabled: true },
  { key: 'live', label: '直播', defaultEnabled: true },
] as const;

type FeatureKey = typeof FEATURE_CATALOG[number]['key'];

let featureCache: { at: number; map: Record<string, boolean> } | null = null;

async function getFeatureMap(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (featureCache && (now - featureCache.at) < 10_000) return featureCache.map;
  const defaults: Record<string, boolean> = {};
  for (const f of FEATURE_CATALOG) defaults[f.key] = f.defaultEnabled;
  let rows: Array<{ key: string; enabled: boolean }> = [];
  try {
    rows = await prisma.featureFlag.findMany({
      where: { key: { in: FEATURE_CATALOG.map(f => f.key) as any } },
      select: { key: true, enabled: true },
    });
  } catch {}
  const map: Record<string, boolean> = { ...defaults };
  for (const r of rows) map[r.key] = r.enabled;
  featureCache = { at: now, map };
  return map;
}

function requireFeature(key: FeatureKey) {
  return async (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const map = await getFeatureMap();
      if (map[key] === false) return res.status(403).json({ error: 'feature_disabled', feature: key });
    } catch {}
    next();
  };
}

async function resolveAdminClubIdFromHeader(req: express.Request) {
  const memberId = String(req.headers['x-member-id'] || '').trim();
  if (!memberId) return null;
  try {
    const row = await prisma.clubProfile.findUnique({ where: { memberId }, select: { id: true } });
    return row?.id || null;
  } catch {
    return null;
  }
}

async function requireClubAdminForClubApi(req: express.Request, res: express.Response) {
  const memberId = String(req.headers['x-member-id'] || '').trim();
  if (!memberId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, is_enabled: true, access_expires_at: true },
  });
  if (!member) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (member.is_enabled === false) {
    res.status(403).json({ error: 'Disabled' });
    return null;
  }
  if (String(member.role || '').toUpperCase() !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  if (member.access_expires_at && new Date(member.access_expires_at).getTime() < Date.now()) {
    res.status(403).json({ error: 'Expired' });
    return null;
  }
  return member;
}

app.get('/api/club/features/access', async (req, res) => {
  const member = await requireClubAdminForClubApi(req, res);
  if (!member) return;
  const clubId = await resolveAdminClubIdFromHeader(req);
  if (!clubId) return res.status(404).json({ error: 'Club not found' });
  try {
    const map = await getFeatureMap();
    const [pointsAssignment, tournamentsAssignment] = await Promise.all([
      getClubFeatureAssignment(prisma, clubId, 'points'),
      getClubFeatureAssignment(prisma, clubId, 'tournaments'),
    ]);
    res.json({
      clubId,
      features: {
        points: {
          globalEnabled: map.points !== false,
          assignedEnabled: pointsAssignment.assignedEnabled,
          effectiveEnabled: map.points !== false && pointsAssignment.assignedEnabled,
          explicitEnabled: pointsAssignment.explicitEnabled,
          source: pointsAssignment.source,
          updatedAt: pointsAssignment.updatedAt,
        },
        tournaments: {
          globalEnabled: map.tournaments !== false,
          assignedEnabled: tournamentsAssignment.assignedEnabled,
          effectiveEnabled: map.tournaments !== false && tournamentsAssignment.assignedEnabled,
          explicitEnabled: tournamentsAssignment.explicitEnabled,
          source: tournamentsAssignment.source,
          updatedAt: tournamentsAssignment.updatedAt,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/club/:clubId/features/public', async (req, res) => {
  const clubId = String(req.params.clubId || '').trim();
  if (!clubId) return res.status(400).json({ error: 'clubId required' });
  try {
    const map = await getFeatureMap();
    const [pointsAssignment, tournamentsAssignment] = await Promise.all([
      getClubFeatureAssignment(prisma, clubId, 'points'),
      getClubFeatureAssignment(prisma, clubId, 'tournaments'),
    ]);
    res.json({
      clubId,
      features: {
        points: {
          globalEnabled: map.points !== false,
          assignedEnabled: pointsAssignment.assignedEnabled,
          effectiveEnabled: map.points !== false && pointsAssignment.assignedEnabled,
          explicitEnabled: pointsAssignment.explicitEnabled,
          source: pointsAssignment.source,
          updatedAt: pointsAssignment.updatedAt,
        },
        tournaments: {
          globalEnabled: map.tournaments !== false,
          assignedEnabled: tournamentsAssignment.assignedEnabled,
          effectiveEnabled: map.tournaments !== false && tournamentsAssignment.assignedEnabled,
          explicitEnabled: tournamentsAssignment.explicitEnabled,
          source: tournamentsAssignment.source,
          updatedAt: tournamentsAssignment.updatedAt,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.use('/api/club', async (req, res, next) => {
  const p = String(req.path || '');
  if (!p.includes('/tournaments')) return next();
  try {
    const map = await getFeatureMap();
    if (map.tournaments === false) return res.status(403).json({ error: 'feature_disabled', feature: 'tournaments' });

    let clubId: string | null = null;
    const m = p.match(/^\/([^/]+)\/tournaments(?:\/|$)/);
    if (m && m[1]) clubId = String(m[1]).trim();
    if (!clubId && p.startsWith('/tournaments')) {
      clubId = await resolveAdminClubIdFromHeader(req);
    }
    if (!clubId) return next();

    const assignment = await getClubFeatureAssignment(prisma, clubId, 'tournaments');
    if (!assignment.assignedEnabled) {
      return res.status(403).json({ error: 'feature_disabled', feature: 'tournaments', scope: 'club', clubId });
    }
  } catch {}
  next();
});

// Mount Club Router
app.use('/api/club', clubRouter);

async function requireActiveMember(req: express.Request, res: express.Response) {
  const memberId = String(req.headers['x-member-id'] || '').trim();
  if (!memberId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, is_enabled: true }
  });
  if (!member) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (member.is_enabled === false) {
    res.status(403).json({ error: 'Disabled' });
    return null;
  }
  return member;
}

function ceilDiv(a: number, b: number) {
  if (b <= 0) return a;
  return Math.floor((a + b - 1) / b);
}

function calcBilledMinutes(startAt: Date, endAt: Date, cfg: any) {
  const diffMs = endAt.getTime() - startAt.getTime();
  const rawMinutes = Math.max(0, Math.ceil(diffMs / 60000));
  const roundingMinutes = Math.max(1, Math.floor(Number(cfg?.roundingMinutes ?? 15)));
  const minBillableMinutes = Math.max(0, Math.floor(Number(cfg?.minBillableMinutes ?? 0)));
  const rounded = ceilDiv(rawMinutes, roundingMinutes) * roundingMinutes;
  return Math.max(rounded, minBillableMinutes);
}

function calcChargedAmount(basePrice: any, billedMinutes: number) {
  if (basePrice == null) return null;
  const perHour = Number(String(basePrice));
  if (!Number.isFinite(perHour) || perHour <= 0) return null;
  const amt = perHour * (billedMinutes / 60);
  return Number.isFinite(amt) ? amt : null;
}

function calcChargedPoints(amount: number | null, cfg: any) {
  if (amount == null) return 0;
  const ppc = Number(String(cfg?.pointsPerCurrency ?? 1));
  if (!Number.isFinite(ppc) || ppc <= 0) return 0;
  const pts = Math.round(amount * ppc);
  return Number.isFinite(pts) && pts > 0 ? pts : 0;
}

app.get('/api/qr/table/info', requireFeature('qr_session'), async (req, res) => {
  try {
    const member = await requireActiveMember(req, res);
    if (!member) return;
    const token = String((req.query as any).token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    const qr = await prisma.tableQrToken.findUnique({
      where: { token },
      include: { club: { select: { id: true, name: true, logoUrl: true } }, table: { select: { id: true, name: true, basePrice: true, active: true } } }
    });
    if (!qr || qr.active === false) return res.status(404).json({ error: 'Not found' });
    if (qr.table.active === false) return res.status(409).json({ error: 'Table disabled' });
    const session = await prisma.tableSession.findFirst({
      where: { tableId: qr.tableId, status: 'ACTIVE', startedByMemberId: member.id },
      orderBy: [{ startAt: 'desc' }],
    });
    res.json({ club: qr.club, table: qr.table, session });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/qr/table/start-init', requireFeature('qr_session'), async (req, res) => {
  try {
    const member = await requireActiveMember(req, res);
    if (!member) return;
    const token = String((req.body || {}).token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    const qr = await prisma.tableQrToken.findUnique({
      where: { token },
      include: { club: { select: { id: true, name: true, logoUrl: true } }, table: { select: { id: true, name: true, basePrice: true, active: true } } }
    });
    if (!qr || qr.active === false) return res.status(404).json({ error: 'Not found' });
    if (qr.table.active === false) return res.status(409).json({ error: 'Table disabled' });
    const active = await prisma.tableSession.findFirst({ where: { tableId: qr.tableId, status: 'ACTIVE' }, select: { id: true } });
    if (active) return res.status(409).json({ error: 'already_active' });
    const cfg = await prisma.clubPointsConfig.findUnique({ where: { clubId: qr.clubId } });
    const pointsAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'points');
    const pointsEnabled = (await getFeatureMap()).points !== false && pointsAssignment.assignedEnabled;
    const confirmId = randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    await prisma.tableSessionConfirm.create({
      data: {
        id: confirmId,
        action: 'START',
        token,
        clubId: qr.clubId,
        tableId: qr.tableId,
        memberId: member.id,
        expiresAt,
      }
    });
    res.json({
      confirmId,
      expiresAt,
      club: qr.club,
      table: qr.table,
      pointsConfig: pointsEnabled && cfg ? { currencyCode: cfg.currencyCode, pointsPerCurrency: String(cfg.pointsPerCurrency), roundingMinutes: cfg.roundingMinutes, minBillableMinutes: cfg.minBillableMinutes } : null,
    });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/qr/table/start-confirm', requireFeature('qr_session'), async (req, res) => {
  try {
    const member = await requireActiveMember(req, res);
    if (!member) return;
    const confirmId = String((req.body || {}).confirmId || '').trim();
    if (!confirmId) return res.status(400).json({ error: 'confirmId required' });
    const now = new Date();
    const out = await prisma.$transaction(async (tx) => {
      const c = await tx.tableSessionConfirm.findUnique({ where: { id: confirmId } });
      if (!c) throw new Error('confirm_not_found');
      if (c.memberId !== member.id) throw new Error('forbidden');
      if (c.action !== 'START') throw new Error('invalid_action');
      if (c.consumedAt) throw new Error('already_consumed');
      if (new Date(c.expiresAt).getTime() < now.getTime()) throw new Error('expired');
      const qr = await tx.tableQrToken.findUnique({
        where: { token: c.token },
        include: { table: { select: { id: true, active: true } } }
      });
      if (!qr || qr.active === false) throw new Error('not_found');
      if (qr.table.active === false) throw new Error('table_disabled');
      const active = await tx.tableSession.findFirst({ where: { tableId: qr.tableId, status: 'ACTIVE' }, select: { id: true } });
      if (active) throw new Error('already_active');
      await tx.tableSessionConfirm.update({ where: { id: c.id }, data: { consumedAt: now } });
      const s = await tx.tableSession.create({
        data: { id: randomUUID(), clubId: qr.clubId, tableId: qr.tableId, startedByMemberId: member.id, startAt: now, status: 'ACTIVE' }
      });
      return s;
    });
    res.json(out);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const code = msg === 'already_active' ? 409 : msg === 'expired' ? 410 : msg === 'forbidden' ? 403 : 400;
    res.status(code).json({ error: msg });
  }
});

app.post('/api/qr/table/end-init', requireFeature('qr_session'), async (req, res) => {
  try {
    const member = await requireActiveMember(req, res);
    if (!member) return;
    const token = String((req.body || {}).token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    const qr = await prisma.tableQrToken.findUnique({
      where: { token },
      include: { club: { select: { id: true, name: true, logoUrl: true } }, table: { select: { id: true, name: true, basePrice: true, active: true } } }
    });
    if (!qr || qr.active === false) return res.status(404).json({ error: 'Not found' });
    const session = await prisma.tableSession.findFirst({
      where: { tableId: qr.tableId, status: 'ACTIVE', startedByMemberId: member.id },
      orderBy: [{ startAt: 'desc' }],
    });
    if (!session) return res.status(404).json({ error: 'no_active_session' });
    const cfg = await prisma.clubPointsConfig.findUnique({ where: { clubId: qr.clubId } });
    const pointsAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'points');
    const pointsEnabled = (await getFeatureMap()).points !== false && pointsAssignment.assignedEnabled;
    const now = new Date();
    const billedMinutes = calcBilledMinutes(session.startAt, now, cfg);
    const amount = calcChargedAmount(qr.table.basePrice, billedMinutes);
    const chargedPoints = pointsEnabled ? calcChargedPoints(amount, cfg) : 0;
    const confirmId = randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    await prisma.tableSessionConfirm.create({
      data: {
        id: confirmId,
        action: 'END',
        token,
        clubId: qr.clubId,
        tableId: qr.tableId,
        memberId: member.id,
        sessionId: session.id,
        expiresAt,
      }
    });
    res.json({
      confirmId,
      expiresAt,
      club: qr.club,
      table: qr.table,
      session,
      preview: {
        billedMinutes,
        chargedAmount: amount,
        chargedCurrency: String(cfg?.currencyCode || 'HKD'),
        chargedPoints,
      }
    });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/qr/table/end-confirm', requireFeature('qr_session'), async (req, res) => {
  try {
    const member = await requireActiveMember(req, res);
    if (!member) return;
    const confirmId = String((req.body || {}).confirmId || '').trim();
    if (!confirmId) return res.status(400).json({ error: 'confirmId required' });
    const now = new Date();
    const featureMap = await getFeatureMap();
    const out = await prisma.$transaction(async (tx) => {
      const c = await tx.tableSessionConfirm.findUnique({ where: { id: confirmId } });
      if (!c) throw new Error('confirm_not_found');
      if (c.memberId !== member.id) throw new Error('forbidden');
      if (c.action !== 'END') throw new Error('invalid_action');
      if (c.consumedAt) throw new Error('already_consumed');
      if (new Date(c.expiresAt).getTime() < now.getTime()) throw new Error('expired');
      if (!c.sessionId) throw new Error('invalid_session');
      const s = await tx.tableSession.findUnique({
        where: { id: c.sessionId },
        include: { table: { select: { id: true, name: true, basePrice: true } } }
      });
      if (!s) throw new Error('not_found');
      if (s.status !== 'ACTIVE') throw new Error('not_active');
      if (s.startedByMemberId !== member.id) throw new Error('forbidden');
      const pointsAssignment = await getClubFeatureAssignment(tx, s.clubId, 'points');
      const enablePoints = featureMap.points !== false && pointsAssignment.assignedEnabled;
      const cfg = await tx.clubPointsConfig.findUnique({ where: { clubId: s.clubId } });
      const billedMinutes = calcBilledMinutes(s.startAt, now, cfg);
      const amount = calcChargedAmount(s.table.basePrice, billedMinutes);
      const currency = String(cfg?.currencyCode || 'HKD');
      const chargedPoints = enablePoints ? calcChargedPoints(amount, cfg) : 0;

      await tx.tableSessionConfirm.update({ where: { id: c.id }, data: { consumedAt: now } });

      let pointsLedgerId: string | null = null;
      if (enablePoints && chargedPoints > 0) {
        pointsLedgerId = randomUUID();
        await tx.pointsLedger.create({
          data: {
            id: pointsLedgerId,
            clubId: s.clubId,
            memberId: member.id,
            deltaPoints: -chargedPoints,
            reason: `台費抵扣（${s.table.name}）`,
            refType: 'TABLE_SESSION',
            refId: s.id,
            createdByMemberId: member.id,
            createdAt: now,
          }
        });
        await tx.pointsBalance.upsert({
          where: { clubId_memberId: { clubId: s.clubId, memberId: member.id } },
          update: { balance: { increment: -chargedPoints } },
          create: { id: randomUUID(), clubId: s.clubId, memberId: member.id, balance: -chargedPoints },
        });
      }

      return tx.tableSession.update({
        where: { id: s.id },
        data: {
          status: 'ENDED',
          endAt: now,
          endedByMemberId: member.id,
          endSource: 'MEMBER',
          billedMinutes,
          chargedAmount: amount == null ? null : String(amount),
          chargedCurrency: currency,
          chargedPoints: chargedPoints || null,
          pointsLedgerId,
        }
      });
    });
    res.json(out);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const code = msg === 'expired' ? 410 : msg === 'forbidden' ? 403 : 400;
    res.status(code).json({ error: msg });
  }
});

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

app.get('/api/features', async (_req, res) => {
  const map = await getFeatureMap();
  res.json({
    features: map,
    catalog: FEATURE_CATALOG,
  });
});

// Strict match creation: require valid memberId for both players; if any missing or not found, reject
app.post('/api/matches/strict', requireFeature('scoring'), writeAuth, async (req, res) => {
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

app.post('/api/matches/partial', requireFeature('scoring'), writeAuth, async (req, res) => {
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

app.get('/api/rooms', requireFeature('scoring'), (req, res) => {
  res.json(rooms);
});

app.get('/rooms/:roomId/state', requireFeature('scoring'), async (req, res) => {
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

app.post('/rooms/:roomId/reset', requireFeature('scoring'), async (req, res) => {
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

app.post('/api/rooms', requireFeature('scoring'), async (req, res) => {
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

app.delete('/api/rooms/:roomId', requireFeature('scoring'), async (req, res) => {
  const roomId = String(req.params.roomId || '');
  if (!roomId) return res.status(400).json({ error: 'roomId required' });
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
app.post('/api/match-verification-code', requireFeature('scoring'), async (req, res) => {
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

app.post('/api/matches/start', requireFeature('scoring'), async (req, res) => {
    const { p1_email, p2_email, room_id, operator_id, frames_required, red_balls, handicap0, handicap1 } = req.body;
    
    console.log(`[StartMatch] P1: ${p1_email}, P2: ${p2_email}, Room: ${room_id}`);

    let p1_member_id: string | null = null;
    let p2_member_id: string | null = null;
    
    if (p1_email) {
        const email = String(p1_email).trim();
        const m = await prisma.member.findFirst({ where: { email }, select: { id: true } });
        if (!m) return res.status(404).json({ error: `Email ${email} is not registered.` });
        p1_member_id = m.id;
    }
    
    if (p2_email) {
        const email = String(p2_email).trim();
        const m = await prisma.member.findFirst({ where: { email }, select: { id: true } });
        if (!m) return res.status(404).json({ error: `Email ${email} is not registered.` });
        p2_member_id = m.id;
    }
    
    if (!p1_member_id && !p2_member_id) {
        return res.status(400).json({ error: '必須至少輸入一位已註冊會員的 Email 才可建立比賽。' });
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

// Create match invites for specific member emails (operator triggers from Setup page)
app.post('/api/matches/invite', requireFeature('scoring'), async (req, res) => {
  try {
    const { room_id, operator_id, emails } = req.body || {};
    if (!room_id || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'missing room_id or emails' });
    }
    const requesterId = String(req.headers['x-member-id'] || '').trim();
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });
    const requester = await prisma.member.findUnique({ where: { id: requesterId }, select: { id: true, role: true } });
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });
    if (requester.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    // Resolve operator id (id or email acceptable)
    let opResolved = requesterId;
    if (operator_id) {
      const opMember = await prisma.member.findFirst({
        where: { OR: [{ id: String(operator_id) }, { email: String(operator_id) }] },
        select: { id: true }
      });
      if (!opMember) return res.status(404).json({ error: 'Operator not found' });
      if (opMember.id !== requesterId) return res.status(403).json({ error: 'operator mismatch' });
      opResolved = opMember.id;
    }
    // Lookup members by email
    const uniq = Array.from(new Set(emails.map((e: any) => String(e || '').trim()).filter(Boolean)));
    if (uniq.length === 0) return res.status(400).json({ error: 'no valid emails' });
    const foundMembers = await prisma.member.findMany({
      where: { OR: uniq.map((em) => ({ email: { equals: em, mode: 'insensitive' } })) },
      select: { id: true, email: true, name: true }
    });
    const foundByEmailLower = new Map(foundMembers.map(m => [String(m.email || '').toLowerCase(), m]));
    const invited: any[] = [];
    const notFound: string[] = [];
    for (const em of uniq) {
      const m = foundByEmailLower.get(String(em).toLowerCase());
      if (!m) { notFound.push(em); continue; }
      const token = randomBytes(16).toString('hex');
      const id = randomUUID();
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "MatchInvite"("id","roomId","operatorId","memberId","token","status","createdAt") VALUES ($1,$2,$3,$4,$5,'PENDING',CURRENT_TIMESTAMP)`,
          id, String(room_id), opResolved, m.id, token
        );
        invited.push({ email: m.email, memberId: m.id, token });
      } catch (e: any) {
        // Ignore duplicates by token; retry with another
      }
    }
    res.json({ invited, notFound });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// List my invites (member inbox-style)
app.get('/api/matches/invites/my', requireFeature('scoring'), async (req, res) => {
  const memberId = req.headers['x-member-id'] as string;
  if (!memberId) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id","roomId","operatorId","memberId","token","status","createdAt","acceptedAt" FROM "MatchInvite" WHERE "memberId"=$1 ORDER BY "createdAt" DESC`,
      memberId
    );
    // Enrich with operator and room info
    const roomIds = Array.from(new Set(rows.map(r => String(r.roomId))));
    const opIds = Array.from(new Set(rows.map(r => r.operatorId).filter(Boolean)));
    const ops = opIds.length ? await prisma.member.findMany({ where: { id: { in: opIds as string[] } }, select: { id: true, name: true, email: true, club_name: true } }) : [];
    const opMap = new Map(ops.map(o => [o.id, o]));
    const enriched = rows.map(r => ({
      ...r,
      operator: r.operatorId ? opMap.get(r.operatorId) || null : null
    }));
    res.json({ invites: enriched });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Accept invite (member confirms to join match)
app.post('/api/matches/invites/accept', requireFeature('scoring'), async (req, res) => {
  try {
    const memberId = req.headers['x-member-id'] as string | undefined;
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'missing token' });
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id","roomId","operatorId","memberId","status" FROM "MatchInvite" WHERE "token"=$1 LIMIT 1`,
      String(token)
    );
    if (!rows.length) return res.status(404).json({ error: 'invite not found' });
    const inv = rows[0];
    if (inv.status !== 'PENDING') return res.status(400).json({ error: 'invite already processed' });
    if (memberId && String(inv.memberId) !== String(memberId)) {
      return res.status(403).json({ error: 'member mismatch' });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "MatchInvite" SET "status"='ACCEPTED',"acceptedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
      inv.id
    );
    res.json({ ok: true, roomId: inv.roomId });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Room-level: list invites (for Setup page to auto-fill accepted players)
app.get('/rooms/:roomId/invites', async (req, res) => {
  const roomId = String(req.params.roomId);
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id","memberId","status","createdAt","acceptedAt" FROM "MatchInvite" WHERE "roomId"=$1 ORDER BY "createdAt" DESC`,
      roomId
    );
    const memberIds = Array.from(new Set(rows.map(r => r.memberId)));
    const members = memberIds.length ? await prisma.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, email: true }
    }) : [];
    const mMap = new Map(members.map(m => [m.id, m]));
    res.json({
      invites: rows.map(r => ({
        ...r,
        member: mMap.get(r.memberId) || null
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Admin auth middleware (optional: enabled only when ADMIN_TOKEN is set)
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'admin_token_not_configured' });
  }
  const token = (req.headers['x-admin-token'] as string) || (req.query.token as string) || '';
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function requireSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，未能啟用後台上載功能');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { transport: ws as any },
  });
}

app.get('/api/admin/features', adminAuth, async (_req, res) => {
  const map = await getFeatureMap();
  const rows = FEATURE_CATALOG.map((f) => ({
    key: f.key,
    label: f.label,
    enabled: map[f.key],
    defaultEnabled: f.defaultEnabled,
  }));
  res.json({ features: rows });
});

app.put('/api/admin/features', adminAuth, async (req, res) => {
  const updates = (req.body || {}).updates;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates_required' });
  const allowed = new Set(FEATURE_CATALOG.map((f) => f.key));
  const normalized = updates
    .map((u: any) => ({ key: String(u?.key || '').trim(), enabled: !!u?.enabled }))
    .filter((u: any) => allowed.has(u.key as any));
  const unique = new Map<string, boolean>();
  for (const u of normalized) unique.set(u.key, u.enabled);
  const items = Array.from(unique.entries());
  await prisma.$transaction(items.map(([key, enabled]) => prisma.featureFlag.upsert({
    where: { key },
    update: { enabled },
    create: { key, enabled },
  })));
  featureCache = null;
  const map = await getFeatureMap();
  res.json({ ok: true, features: map });
});

app.get('/api/admin/club-features/:featureKey', adminAuth, async (req, res) => {
  try {
    const featureKey = String(req.params.featureKey || '').trim();
    if (!isClubScopedFeatureKey(featureKey)) {
      return res.status(400).json({ error: 'unsupported_feature_key' });
    }
    const globalMap = await getFeatureMap();
    const clubs = await prisma.clubProfile.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        updatedAt: true,
        memberId: true,
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            is_enabled: true,
            access_expires_at: true,
            created_at: true,
          },
        },
      },
    });
    const assignments = await getClubFeatureAssignments(prisma, clubs.map((club) => club.id), featureKey);
    res.json({
      featureKey,
      globalEnabled: globalMap[featureKey] !== false,
      clubs: clubs.map((club) => {
        const assignment = assignments[club.id];
        return {
          clubId: club.id,
          clubName: String(club.name || club.member?.name || '').trim(),
          adminMemberId: club.memberId,
          adminName: club.member?.name || '',
          adminEmail: club.member?.email || '',
          adminEnabled: club.member?.is_enabled !== false,
          accessExpiresAt: club.member?.access_expires_at ?? null,
          createdAt: club.member?.created_at ?? null,
          updatedAt: club.updatedAt,
          explicitEnabled: assignment?.explicitEnabled ?? null,
          assignedEnabled: assignment?.assignedEnabled ?? false,
          effectiveEnabled: globalMap[featureKey] !== false && (assignment?.assignedEnabled ?? false),
          source: assignment?.source ?? 'default_off',
          assignmentUpdatedAt: assignment?.updatedAt ?? null,
        };
      }),
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/admin/club-features/:featureKey/:clubId', adminAuth, async (req, res) => {
  try {
    const featureKey = String(req.params.featureKey || '').trim();
    const clubId = String(req.params.clubId || '').trim();
    if (!isClubScopedFeatureKey(featureKey)) {
      return res.status(400).json({ error: 'unsupported_feature_key' });
    }
    if (!clubId) return res.status(400).json({ error: 'clubId_required' });
    if (typeof (req.body || {}).enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled_required' });
    }
    const club = await prisma.clubProfile.findUnique({ where: { id: clubId }, select: { id: true } });
    if (!club) return res.status(404).json({ error: 'club_not_found' });
    const enabled = Boolean((req.body || {}).enabled);
    const row = await prisma.clubFeatureAccess.upsert({
      where: { clubId_featureKey: { clubId, featureKey } },
      update: { enabled },
      create: { id: randomUUID(), clubId, featureKey, enabled },
      select: { clubId: true, featureKey: true, enabled: true, updatedAt: true },
    });
    const globalMap = await getFeatureMap();
    res.json({
      ok: true,
      featureKey,
      clubId,
      explicitEnabled: row.enabled,
      assignedEnabled: row.enabled,
      effectiveEnabled: globalMap[featureKey] !== false && row.enabled,
      updatedAt: row.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/site-ads', async (req, res) => {
  try {
    const placement = String((req.query.placement as string) || '').trim().toLowerCase();
    const placements = ['system', 'venue', 'member'];
    const id = placement && placements.includes(placement) ? placement : 'system';
    const cfg = await prisma.siteAd.findUnique({ where: { id } });
    if (!cfg) return res.json({ placement: id, config: null, items: [], ads: [], versionUpdatedAt: null });

    const links = await prisma.siteAdPlacementItem.findMany({
      where: { placement: id, enabled: true },
      orderBy: { sort: 'asc' },
      include: { item: true },
    });

    const baseCfg = {
      enabled: cfg.enabled,
      displaySeconds: (cfg as any).displaySeconds ?? 15,
      minIntervalMinutes: (cfg as any).minIntervalMinutes ?? 20,
      maxIntervalMinutes: (cfg as any).maxIntervalMinutes ?? 30,
      updatedAt: cfg.updatedAt,
    };

    const validItems = links
      .map((x) => ({
        id: x.itemId,
        enabled: x.enabled && (x.item as any)?.enabled !== false,
        imageUrl: (x.item as any)?.imageUrl ?? null,
        linkUrl: (x.item as any)?.linkUrl ?? null,
        updatedAt: (x.item as any)?.updatedAt ?? null,
        sort: x.sort,
      }))
      .filter((it) => it.enabled && it.imageUrl && it.linkUrl);

    const fallbackLegacy =
      validItems.length === 0 && cfg.enabled && cfg.imageUrl && cfg.linkUrl
        ? [
            {
              id: `${id}-legacy`,
              enabled: true,
              imageUrl: cfg.imageUrl,
              linkUrl: cfg.linkUrl,
              updatedAt: cfg.updatedAt,
              sort: 0,
            },
          ]
        : [];

    const items = validItems.length > 0 ? validItems : fallbackLegacy;
    const versionUpdatedAt = new Date(
      Math.max(
        new Date(baseCfg.updatedAt).getTime(),
        ...items.map((x) => new Date(x.updatedAt || 0).getTime()),
      ),
    ).toISOString();

    const out = items.map((it) => ({
      ...it,
      placement: id,
      displaySeconds: baseCfg.displaySeconds,
      minIntervalMinutes: baseCfg.minIntervalMinutes,
      maxIntervalMinutes: baseCfg.maxIntervalMinutes,
      updatedAt: versionUpdatedAt,
    }));

    res.json({ placement: id, config: baseCfg, items: out, ads: out, versionUpdatedAt });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/admin/site-ads', adminAuth, async (_req, res) => {
  try {
    const placements = ['system', 'venue', 'member'];
    await prisma.$transaction(
      placements.map((id) =>
        prisma.siteAd.upsert({
          where: { id },
          update: {},
          create: { id, enabled: true, imageUrl: null, linkUrl: null, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 } as any,
        }),
      ),
    );
    const ads = await prisma.siteAd.findMany({ orderBy: { id: 'asc' } });

    let links = await prisma.siteAdPlacementItem.findMany({
      where: { placement: { in: placements } },
      orderBy: [{ placement: 'asc' }, { sort: 'asc' }],
    });

    const linkPlacements = new Set(links.map((x) => String((x as any)?.placement || '')));
    const legacy = ads
      .filter((a) => placements.includes(a.id))
      .filter((a) => !linkPlacements.has(a.id) && a.enabled && a.imageUrl && a.linkUrl)
      .map((a) => ({ placement: a.id, imageUrl: String(a.imageUrl), linkUrl: String(a.linkUrl), enabled: a.enabled }));

    if (legacy.length) {
      const count = await prisma.siteAdItem.count();
      const capacity = Math.max(0, 5 - count);
      const take = legacy.slice(0, capacity);
      if (take.length) {
        await prisma.$transaction(
          take.flatMap((x, idx) => {
            const itemId = randomUUID();
            return [
              prisma.siteAdItem.create({ data: { id: itemId, enabled: true, imageUrl: x.imageUrl, linkUrl: x.linkUrl } }),
              prisma.siteAdPlacementItem.create({ data: { id: randomUUID(), placement: x.placement, itemId, enabled: true, sort: idx } }),
            ];
          }),
        );
        links = await prisma.siteAdPlacementItem.findMany({
          where: { placement: { in: placements } },
          orderBy: [{ placement: 'asc' }, { sort: 'asc' }],
        });
      }
    }
    const placementItems: Record<string, any[]> = { system: [], venue: [], member: [] };
    for (const x of links) {
      const k = String((x as any)?.placement || '').trim();
      if (!k) continue;
      if (!placementItems[k]) placementItems[k] = [];
      (placementItems[k] as any[]).push({ id: x.id, placement: x.placement, itemId: x.itemId, enabled: x.enabled, sort: x.sort });
    }


    const items = await prisma.siteAdItem.findMany({ orderBy: { updatedAt: 'desc' } });
    res.json({ ads, items, placementItems });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/admin/site-ad-items', adminAuth, async (_req, res) => {
  try {
    const count = await prisma.siteAdItem.count();
    if (count >= 5) return res.status(400).json({ error: 'max_items_reached' });
    const id = randomUUID();
    const item = await prisma.siteAdItem.create({ data: { id, enabled: true, imageUrl: null, linkUrl: null } });
    res.json({ item });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/admin/site-ad-items/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });
    const body = (req.body || {}) as { enabled?: boolean; linkUrl?: string | null };
    const enabled = body.enabled === undefined ? undefined : Boolean(body.enabled);
    const linkUrl = body.linkUrl === undefined ? undefined : (body.linkUrl ? String(body.linkUrl).trim() : null);
    const item = await prisma.siteAdItem.update({
      where: { id },
      data: { ...(enabled !== undefined ? { enabled } : {}), ...(linkUrl !== undefined ? { linkUrl } : {}) } as any,
    });
    res.json({ item });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.delete('/api/admin/site-ad-items/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });
    await prisma.siteAdItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/admin/site-ad-items/:id/image', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });

    const body = (req.body || {}) as { filename?: string; contentType?: string; base64?: string; dataUrl?: string };
    let contentType = String(body.contentType || '').trim().toLowerCase();
    let base64 = String(body.base64 || '').trim();
    const filename = String(body.filename || '').trim();
    const dataUrl = String(body.dataUrl || '').trim();

    if (dataUrl) {
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'data_url_invalid' });
      contentType = String(m[1] || '').trim().toLowerCase();
      base64 = String(m[2] || '').trim();
    }

    if (!base64) return res.status(400).json({ error: 'base64_required' });

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(contentType)) return res.status(400).json({ error: 'image_type_not_allowed' });

    const buf = Buffer.from(base64, 'base64');
    if (!buf || buf.length === 0) return res.status(400).json({ error: 'image_decode_failed' });
    const maxBytes = 3 * 1024 * 1024;
    if (buf.length > maxBytes) return res.status(413).json({ error: 'image_too_large' });

    let ext = '';
    if (contentType === 'image/jpeg') ext = 'jpg';
    if (contentType === 'image/png') ext = 'png';
    if (contentType === 'image/webp') ext = 'webp';
    if (!ext && filename) {
      const lower = filename.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ext = 'jpg';
      else if (lower.endsWith('.png')) ext = 'png';
      else if (lower.endsWith('.webp')) ext = 'webp';
    }
    if (!ext) return res.status(400).json({ error: 'image_ext_unknown' });

    const supabase = requireSupabaseAdmin();
    const objectPath = `site-ads/items/${id}/${Date.now()}-${randomUUID()}.${ext}`;

    const up = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(objectPath, buf, {
      contentType,
      upsert: false,
      cacheControl: '31536000',
    });
    if (up.error) return res.status(500).json({ error: `upload_failed: ${up.error.message}` });

    const pub = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
    const imageUrl = String((pub as any)?.data?.publicUrl || '').trim();
    if (!imageUrl) return res.status(500).json({ error: 'public_url_failed' });

    const item = await prisma.siteAdItem.update({ where: { id }, data: { imageUrl } });
    res.json({ item });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg.includes('SUPABASE_URL') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

app.put('/api/admin/site-ad-placements/:placement/items', adminAuth, async (req, res) => {
  try {
    const placement = String(req.params.placement || '').trim().toLowerCase();
    if (!['system', 'venue', 'member'].includes(placement)) return res.status(400).json({ error: 'placement_invalid' });
    const body = (req.body || {}) as { items?: Array<{ itemId: string; enabled?: boolean }> };
    const items = Array.isArray(body.items) ? body.items : [];
    const normalized = items
      .map((x) => ({ itemId: String(x?.itemId || '').trim(), enabled: x?.enabled === undefined ? true : !!x.enabled }))
      .filter((x) => !!x.itemId);
    const uniq = new Map<string, boolean>();
    for (const it of normalized) uniq.set(it.itemId, it.enabled);
    const list = Array.from(uniq.entries()).map(([itemId, enabled], idx) => ({ itemId, enabled, sort: idx }));
    await prisma.$transaction([
      prisma.siteAdPlacementItem.deleteMany({ where: { placement } }),
      ...(list.length
        ? [
            prisma.siteAdPlacementItem.createMany({
              data: list.map((x) => ({ id: randomUUID(), placement, itemId: x.itemId, enabled: x.enabled, sort: x.sort })),
            }),
          ]
        : []),
    ]);
    const rows = await prisma.siteAdPlacementItem.findMany({ where: { placement }, orderBy: { sort: 'asc' } });
    res.json({ placement, items: rows });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/admin/site-ads/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ error: 'placement_required' });
    if (!['system', 'venue', 'member'].includes(id)) return res.status(400).json({ error: 'placement_invalid' });
    const body = (req.body || {}) as { enabled?: boolean; imageUrl?: string | null; linkUrl?: string | null; displaySeconds?: number; minIntervalMinutes?: number; maxIntervalMinutes?: number };
    const enabled = body.enabled === undefined ? undefined : Boolean(body.enabled);
    const imageUrl = body.imageUrl === undefined ? undefined : (body.imageUrl ? String(body.imageUrl).trim() : null);
    const linkUrl = body.linkUrl === undefined ? undefined : (body.linkUrl ? String(body.linkUrl).trim() : null);

    const dsRaw = (body as any).displaySeconds;
    const minRaw = (body as any).minIntervalMinutes;
    const maxRaw = (body as any).maxIntervalMinutes;
    const ds = dsRaw === undefined ? undefined : Math.max(3, Math.min(60, Number(dsRaw)));
    const minM = minRaw === undefined ? undefined : Math.max(1, Math.min(24 * 60, Number(minRaw)));
    const maxM = maxRaw === undefined ? undefined : Math.max(1, Math.min(24 * 60, Number(maxRaw)));
    if ((dsRaw !== undefined && !Number.isFinite(ds!)) || (minRaw !== undefined && !Number.isFinite(minM!)) || (maxRaw !== undefined && !Number.isFinite(maxM!))) {
      return res.status(400).json({ error: 'invalid_schedule' });
    }
    const fixedMin = minM !== undefined && maxM !== undefined ? Math.min(minM, maxM) : minM;
    const fixedMax = minM !== undefined && maxM !== undefined ? Math.max(minM, maxM) : maxM;

    const ad = await prisma.siteAd.upsert({
      where: { id },
      update: {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(linkUrl !== undefined ? { linkUrl } : {}),
        ...(ds !== undefined ? { displaySeconds: ds } : {}),
        ...(fixedMin !== undefined ? { minIntervalMinutes: fixedMin } : {}),
        ...(fixedMax !== undefined ? { maxIntervalMinutes: fixedMax } : {}),
      } as any,
      create: { id, enabled: enabled ?? true, imageUrl: imageUrl ?? null, linkUrl: linkUrl ?? null, displaySeconds: ds ?? 15, minIntervalMinutes: fixedMin ?? 20, maxIntervalMinutes: fixedMax ?? 30 } as any,
    });
    res.json({ ad });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/admin/site-ads/:id/image', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim().toLowerCase();
    if (!id) return res.status(400).json({ error: 'placement_required' });
    if (!['system', 'venue', 'member'].includes(id)) return res.status(400).json({ error: 'placement_invalid' });

    const body = (req.body || {}) as { filename?: string; contentType?: string; base64?: string; dataUrl?: string };
    let contentType = String(body.contentType || '').trim().toLowerCase();
    let base64 = String(body.base64 || '').trim();
    const filename = String(body.filename || '').trim();
    const dataUrl = String(body.dataUrl || '').trim();

    if (dataUrl) {
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return res.status(400).json({ error: 'data_url_invalid' });
      contentType = String(m[1] || '').trim().toLowerCase();
      base64 = String(m[2] || '').trim();
    }

    if (!base64) return res.status(400).json({ error: 'base64_required' });

    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(contentType)) return res.status(400).json({ error: 'image_type_not_allowed' });

    const buf = Buffer.from(base64, 'base64');
    if (!buf || buf.length === 0) return res.status(400).json({ error: 'image_decode_failed' });
    const maxBytes = 3 * 1024 * 1024;
    if (buf.length > maxBytes) return res.status(413).json({ error: 'image_too_large' });

    let ext = '';
    if (contentType === 'image/jpeg') ext = 'jpg';
    if (contentType === 'image/png') ext = 'png';
    if (contentType === 'image/webp') ext = 'webp';
    if (!ext && filename) {
      const lower = filename.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ext = 'jpg';
      else if (lower.endsWith('.png')) ext = 'png';
      else if (lower.endsWith('.webp')) ext = 'webp';
    }
    if (!ext) return res.status(400).json({ error: 'image_ext_unknown' });

    const supabase = requireSupabaseAdmin();
    const objectPath = `site-ads/${id}/${Date.now()}-${randomUUID()}.${ext}`;

    const up = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).upload(objectPath, buf, {
      contentType,
      upsert: false,
      cacheControl: '31536000',
    });
    if (up.error) return res.status(500).json({ error: `upload_failed: ${up.error.message}` });

    const pub = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
    const imageUrl = String((pub as any)?.data?.publicUrl || '').trim();
    if (!imageUrl) return res.status(500).json({ error: 'public_url_failed' });

    const ad = await prisma.siteAd.upsert({
      where: { id },
      update: { imageUrl },
      create: { id, enabled: true, imageUrl, linkUrl: null },
    });
    res.json({ ad });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg.includes('SUPABASE_URL') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

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
        regionCode: d.region_code,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

async function normalizeAndValidateRegionDistrict(input: {
  regionCode?: string | null;
  districtCode?: string | null;
}): Promise<{ regionCode: string | null; districtCode: string | null }> {
  const region = String(input.regionCode ?? '').trim().toUpperCase();
  const district = String(input.districtCode ?? '').trim().toUpperCase();
  if (!region && !district) return { regionCode: null, districtCode: null };
  if (!region || !district) throw new Error('請同時選擇地方及分區');
  const r = await prisma.memberRegion.findUnique({ where: { code3: region }, select: { active: true } });
  if (!r || r.active === false) throw new Error('地方無效');
  const d = await prisma.memberDistrict.findUnique({
    where: { region_code_code3: { region_code: region, code3: district } },
    select: { active: true },
  });
  if (!d || d.active === false) throw new Error('分區無效');
  return { regionCode: region, districtCode: district };
}

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
app.post('/api/matches', requireFeature('scoring'), writeAuth, async (req, res) => {
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
app.post('/api/matches/:matchId/events', requireFeature('scoring'), writeAuth, async (req, res) => {
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
app.post('/api/matches/:matchId/finalize', requireFeature('scoring'), writeAuth, async (req, res) => {
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

app.get('/api/me/breaks', async (req, res) => {
  try {
    const memberId = String(req.headers['x-member-id'] || '').trim();
    if (!memberId) return res.status(401).json({ error: 'Unauthorized' });
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, is_enabled: true } });
    if (!member) return res.status(401).json({ error: 'Unauthorized' });
    if (member.is_enabled === false) return res.status(403).json({ error: 'Disabled' });

    const parseMonthRange = (month: string) => {
      const m = String(month || '').trim();
      const match = /^(\d{4})-(\d{2})$/.exec(m);
      if (!match) return null;
      const year = Number(match[1]);
      const mon = Number(match[2]);
      if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) return null;
      const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0));
      return { start, end };
    };

    const clubId = req.query.clubId ? String(req.query.clubId).trim() : '';
    const month = req.query.month ? String(req.query.month).trim() : '';

    const where: any = { member_id: memberId, deleted_at: null };
    if (clubId) where.club_id = clubId;
    if (month) {
      const range = parseMonthRange(month);
      if (!range) return res.status(400).json({ error: 'month invalid' });
      where.recorded_at = { gte: range.start, lt: range.end };
    }

    const rows = await prisma.breakRecord.findMany({
      where,
      orderBy: [{ recorded_at: 'desc' }],
      include: {
        club: { select: { id: true, name: true, logoUrl: true } },
      },
    });
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post('/api/members/register', async (req, res) => {
  try {
    const payload = (req.body || {}) as {
      email?: string;
      name?: string;
      password?: string;
      phone?: string;
      phoneCountry?: string;
      phoneNumber?: string;
      birthDate?: string;
      clubName?: string;
      regionCode?: string;
      districtCode?: string;
    };

    const email = String(payload.email || '').trim().normalize('NFKC');
    const name = String(payload.name || '').trim();
    const password = String(payload.password || '');
    const phone = payload.phone ? String(payload.phone).trim() : undefined;
    const phoneE164 = normalizePhoneE164({
      ...(payload.phoneCountry ? { country: String(payload.phoneCountry).trim() } : {}),
      ...(payload.phoneNumber ? { number: String(payload.phoneNumber).trim() } : {}),
    });
    const clubName = payload.clubName ? String(payload.clubName).trim() : undefined;
    const birthDateStr = payload.birthDate ? String(payload.birthDate).trim() : undefined;
    const regionDistrict = await normalizeAndValidateRegionDistrict({
      regionCode: (payload as any).regionCode ?? (payload as any).region_code ?? null,
      districtCode: (payload as any).districtCode ?? (payload as any).district_code ?? null,
    });

    if (!name) {
      return res.status(400).json({ error: 'name 為必填' });
    }
    const emailOk = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : false;
    if (email && !emailOk) {
      return res.status(400).json({ error: 'email 格式不正確' });
    }
    if (!email && !phoneE164) {
      return res.status(400).json({ error: '請輸入 email 或 手機號碼' });
    }

    const hasPassword = password.length > 0;
    if (hasPassword) {
      const pwLenOk = password.length >= 8;
      const pwHasNum = /\d/.test(password);
      const pwHasAlpha = /[A-Za-z]/.test(password);
      if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
        return res.status(400).json({ error: '密碼不符合規則（至少8字元，需含英文字母與數字）' });
      }
    }

    const birthDate = birthDateStr ? new Date(birthDateStr) : undefined;
    if (birthDateStr && Number.isNaN(birthDate!.getTime())) {
      return res.status(400).json({ error: '出生日期格式無效，請使用 ISO 格式，如 1990-01-31' });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (email) {
        const existsEmail = await tx.member.findFirst({ where: { email } });
        if (existsEmail) {
          throw new Error('email 已存在');
        }
      }
      if (phoneE164) {
        const existsPhone = await tx.member.findFirst({ where: { phone_e164: phoneE164 } });
        if (existsPhone) {
          throw new Error('手機號碼已存在');
        }
      }

      let memberCode: string | null = null;
      for (let i = 0; i < 5; i++) {
        const code = `M${randomBytes(6).toString('hex').toUpperCase()}`;
        const exists = await tx.member.findFirst({ where: { member_code: code } });
        if (!exists) {
          memberCode = code;
          break;
        }
      }

      const salt = hasPassword ? makeSalt() : null;
      const digest = hasPassword
        ? (() => {
            const h = createHash('sha256');
            h.update(String(salt) + password);
            return h.digest('hex');
          })()
        : null;

      const created = await tx.member.create({
        data: {
          id: randomUUID(),
          name,
          email: email || null,
          region_code: regionDistrict.regionCode,
          district_code: regionDistrict.districtCode,
          phone: phone ?? null,
          phone_country: payload.phoneCountry ? String(payload.phoneCountry).trim() : null,
          phone_number: payload.phoneNumber ? String(payload.phoneNumber).trim() : null,
          phone_e164: phoneE164 || null,
          club_name: clubName ?? null,
          birth_date: birthDate ?? null,
          member_code: memberCode,
          membership_expires_at: null,
          password_salt: salt,
          password_hash: digest,
          password_updated_at: hasPassword ? new Date() : null,
        },
      });
      return { id: created.id, memberCode }; // token empty
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
    const status =
      msg.includes('已存在') ? 409 :
      (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 :
      500;
    res.status(status).json({ error: msg });
  }
});

function makeSalt(): string {
  return randomBytes(16).toString('hex');
}

function normalizePhoneE164(input: { country?: string; number?: string } | string): string {
  const raw = typeof input === 'string' ? input : `${String(input.country || '')}${String(input.number || '')}`;
  const s0 = String(raw || '').trim();
  if (!s0) return '';
  let s = s0.replace(/[()\s\-\.]/g, '');
  s = s.replace(/^00/, '+');
  if (!s.startsWith('+')) {
    s = `+${s}`;
  }
  if (!/^\+\d{6,20}$/.test(s)) return '';
  return s;
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
      phone?: string;
      birthDate?: string;
      clubName?: string;
      regionCode?: string;
      districtCode?: string;
    };
    const email = String(payload.email || '').trim().normalize('NFKC');
    const code = String(payload.code || '').trim();
    const name = String(payload.name || '').trim();
    const password = String(payload.password || '');
    const phone = payload.phone ? String(payload.phone).trim() : undefined;
    const clubName = payload.clubName ? String(payload.clubName).trim() : undefined;
    const birthDateStr = payload.birthDate ? String(payload.birthDate).trim() : undefined;
    const regionDistrict = await normalizeAndValidateRegionDistrict({
      regionCode: (payload as any).regionCode ?? (payload as any).region_code ?? null,
      districtCode: (payload as any).districtCode ?? (payload as any).district_code ?? null,
    });
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
    const result = await prisma.$transaction(async (tx) => {
      const existsEmail = await tx.member.findFirst({ where: { email } });
      if (existsEmail) {
        throw new Error('email 已存在');
      }
      let memberCode: string | null = null;
      for (let i = 0; i < 5; i++) {
        const code = `M${randomBytes(6).toString('hex').toUpperCase()}`;
        const exists = await tx.member.findFirst({ where: { member_code: code } });
        if (!exists) {
          memberCode = code;
          break;
        }
      }
      const salt = makeSalt();
      const h = createHash('sha256');
      h.update(salt + password);
      const digest = h.digest('hex');
      const created = await tx.member.create({
        data: {
          id: randomUUID(),
          name,
          email,
          region_code: regionDistrict.regionCode,
          district_code: regionDistrict.districtCode,
          phone: phone ?? null,
          club_name: clubName ?? null,
          birth_date: birthDate ?? null,
          member_code: memberCode,
          membership_expires_at: null,
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
    const status =
      msg.includes('email 已存在') ? 409 :
      (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 :
      500;
    res.status(status).json({ error: msg });
  }
});

// Operator: Get match history
app.get('/api/operators/:id/matches', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Missing operator ID' });

    const requesterId = String(req.headers['x-member-id'] || '').trim();
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });
    const requester = await prisma.member.findUnique({ where: { id: requesterId }, select: { id: true, role: true } });
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });
    if (requester.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    
    // Resolve ID if email
    let opId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findUnique({ where: { email: id }, select: { id: true } });
      if (!m) return res.status(404).json({ error: 'Operator not found' });
      opId = m.id;
    }
    if (opId !== requesterId) return res.status(403).json({ error: 'operator mismatch' });

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

    const requesterId = String(req.headers['x-member-id'] || '').trim();
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });
    const requester = await prisma.member.findUnique({ where: { id: requesterId }, select: { id: true, role: true } });
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });
    if (requester.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

    // Resolve ID if email
    let opId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findUnique({ where: { email: id }, select: { id: true } });
      if (!m) return res.status(404).json({ error: 'Operator not found' });
      opId = m.id;
    }
    if (opId !== requesterId) return res.status(403).json({ error: 'operator mismatch' });

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

    const requesterId = String(req.headers['x-member-id'] || '').trim();
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' });
    const requester = await prisma.member.findUnique({ where: { id: requesterId }, select: { id: true, role: true } });
    if (!requester) return res.status(401).json({ error: 'Unauthorized' });
    if (requester.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    
    // Resolve ID if email
    let opId = id;
    if (id.includes('@')) {
      const m = await prisma.member.findUnique({ where: { email: id }, select: { id: true } });
      if (!m) return res.status(404).json({ error: 'Operator not found' });
      opId = m.id;
    }
    if (opId !== requesterId) return res.status(403).json({ error: 'operator mismatch' });

    const active = rooms.filter(r => r.operatorId === opId);
    res.json({ rooms: active });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

// Simple password hashing helpers (SHA-256 with per-user salt)
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '277887232996-5lfubeh4be5pnrd458buc489uq0h0e1g.apps.googleusercontent.com');

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || '277887232996-5lfubeh4be5pnrd458buc489uq0h0e1g.apps.googleusercontent.com',
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid token' });

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const displayName = String(payload.name || payload.given_name || '').trim() || (email.split('@')[0] || email);
    const emailVerified = Boolean((payload as any).email_verified);

    let member = await prisma.member.findUnique({ where: { email } });

    if (member) {
      // Logic for google_id update removed due to DB permission issues.
      // Matching by email only for now.
      if ((member as any).is_enabled === false) {
        return res.status(403).json({ error: '此帳號已被停用' });
      }
      
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
      if (!emailVerified) {
        return res.status(400).json({ error: 'Google Email 尚未驗證，無法註冊' });
      }

      const created = await prisma.$transaction(async (tx) => {
        let memberCode: string | null = null;
        for (let i = 0; i < 5; i++) {
          const code = `M${randomBytes(6).toString('hex').toUpperCase()}`;
          const exists = await tx.member.findFirst({ where: { member_code: code } });
          if (!exists) {
            memberCode = code;
            break;
          }
        }

        const m = await tx.member.create({
          data: {
            id: randomUUID(),
            name: displayName,
            email,
            district_code: null,
            phone: null,
            club_name: null,
            birth_date: null,
            member_code: memberCode,
            membership_expires_at: null,
            is_enabled: true,
          },
        });
        return m;
      });

      return res.status(201).json({
        ok: true,
        id: created.id,
        member: {
          id: created.id,
          name: created.name,
          email: created.email,
          member_code: created.member_code,
          role: created.role,
        },
      });
    }

  } catch (err: any) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Member login (email + password), returns member basic info
app.post('/api/members/login', async (req, res) => {
  try {
    const body = (req.body || {}) as { email?: string; identifier?: string; phoneE164?: string; phoneCountry?: string; phoneNumber?: string; password?: string };
    const idRaw = String((body.identifier || body.email || '') || '').trim().normalize('NFKC');
    const pw = String(body.password || '');
    if (!idRaw || !pw) {
      return res.status(400).json({ error: '缺少帳號或密碼' });
    }
    const isEmail = idRaw.includes('@');
    const email = isEmail ? idRaw.toLowerCase() : '';
    const phoneE164 = !isEmail
      ? (() => {
          if (body.phoneE164) return normalizePhoneE164(String(body.phoneE164));
          if (body.phoneCountry || body.phoneNumber) {
            return normalizePhoneE164({
              ...(body.phoneCountry ? { country: String(body.phoneCountry) } : {}),
              ...(body.phoneNumber ? { number: String(body.phoneNumber) } : {}),
            });
          }
          return normalizePhoneE164(idRaw);
        })()
      : '';
    if (!isEmail && !phoneE164) {
      return res.status(400).json({ error: '手機號碼格式不正確' });
    }
    const m = isEmail
      ? await prisma.member.findUnique({ where: { email } })
      : await prisma.member.findUnique({ where: { phone_e164: phoneE164 } });
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
      region_code?: string | null;
      regionCode?: string | null;
      district_code?: string | null;
      districtCode?: string | null;
      member_code?: string | null;
      phone?: string | null;
      birthDate?: string | null;
      birth_date?: string | null;
      role?: string | null;
      membershipExpiresAt?: string | null;
      membership_expires_at?: string | null;
      club_name?: string | null;
      clubName?: string | null;
      is_enabled?: boolean | null;
      isEnabled?: boolean | null;
      access_expires_at?: string | null;
      accessExpiresAt?: string | null;
    };

    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name ?? '').trim();
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;
    const regionRaw = body.regionCode ?? body.region_code;
    const districtRaw = body.districtCode ?? body.district_code;
    if (regionRaw !== undefined || districtRaw !== undefined) {
      const pair = await normalizeAndValidateRegionDistrict({ regionCode: regionRaw ?? null, districtCode: districtRaw ?? null });
      data.region_code = pair.regionCode;
      data.district_code = pair.districtCode;
    }
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

    const enabledRaw = body.is_enabled ?? body.isEnabled;
    if (enabledRaw !== undefined) {
      data.is_enabled = Boolean(enabledRaw);
    }

    const accessRaw = body.access_expires_at ?? body.accessExpiresAt;
    if (accessRaw !== undefined) {
      const s = String(accessRaw || '').trim();
      if (!s) {
        data.access_expires_at = null;
      } else {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: '場館限期格式不正確' });
        }
        data.access_expires_at = d;
      }
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
    const msg = String(err?.message || err);
    const status = (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 : 500;
    res.status(status).json({ error: msg });
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
      regionCode?: string | null;
      region_code?: string | null;
      districtCode?: string | null;
      district_code?: string | null;
    };

    const data: any = {};
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
    if (body.club_name !== undefined) data.club_name = body.club_name ? String(body.club_name).trim() : null;
    if (body.clubName !== undefined) data.club_name = body.clubName ? String(body.clubName).trim() : null;

    const regionRaw = (body as any).regionCode ?? (body as any).region_code;
    const districtRaw = (body as any).districtCode ?? (body as any).district_code;
    if (regionRaw !== undefined || districtRaw !== undefined) {
      const pair = await normalizeAndValidateRegionDistrict({ regionCode: regionRaw ?? null, districtCode: districtRaw ?? null });
      data.region_code = pair.regionCode;
      data.district_code = pair.districtCode;
    }

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
    const msg = String(err?.message || err);
    const status = (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

// Admin: delete member (requires admin token)
app.delete('/api/admin/members/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ error: '缺少會員 ID' });
    }
    const purge = String((req.query as any)?.purge || '').trim() === '1';
    try {
      if (purge) {
        const club = await prisma.clubProfile.findUnique({
          where: { memberId: id },
          select: { id: true },
        });
        const clubId = club?.id || null;

        const rooms = await prisma.room.findMany({
          where: { operator_id: id },
          select: { id: true },
        });
        const roomIds = rooms.map((r) => r.id);

        const matchPlayers = await prisma.matchPlayer.findMany({
          where: { member_id: id },
          select: { match_id: true },
        });
        const matchIdsFromPlayers = matchPlayers.map((r) => r.match_id);

        const matchesDirect = await prisma.match.findMany({
          where: {
            OR: [
              { operator_id: id },
              { winner_member_id: id },
              ...(roomIds.length ? [{ room_id: { in: roomIds } }] : []),
            ],
          },
          select: { id: true },
        });
        const matchIdsDirect = matchesDirect.map((m) => m.id);

        const matchIds = Array.from(new Set([...matchIdsFromPlayers, ...matchIdsDirect]));

        await prisma.$transaction(async (tx) => {
          if (clubId) {
            await tx.$executeRaw(
              Prisma.sql`DELETE FROM "ClubMessageRead" WHERE "messageId" IN (SELECT "id" FROM "ClubMessage" WHERE "clubId" = ${clubId})`
            );
            await tx.tableSessionConfirm.deleteMany({ where: { clubId } });
            await tx.tournamentSignup.deleteMany({ where: { tournament: { clubId } } });
            await tx.tournament.deleteMany({ where: { clubId } });
            await tx.liveAnnouncement.deleteMany({ where: { clubId } });
            await tx.clubMessage.deleteMany({ where: { clubId } });
            await tx.breakRecord.deleteMany({ where: { club_id: clubId } });
            await tx.clubFeatureAccess.deleteMany({ where: { clubId } });
            await tx.pointsLedger.deleteMany({ where: { clubId } });
            await tx.pointsBalance.deleteMany({ where: { clubId } });
            await tx.clubPointsConfig.deleteMany({ where: { clubId } });
            await tx.tableSession.deleteMany({ where: { clubId } });
            await tx.tableQrToken.deleteMany({ where: { clubId } });
            await tx.tableReservation.deleteMany({ where: { clubId } });
            await tx.tablePricingScheme.deleteMany({ where: { clubId } });
            await tx.clubTable.deleteMany({ where: { clubId } });
            await tx.clubMember.deleteMany({ where: { clubId } });
            await tx.clubProfile.deleteMany({ where: { id: clubId } });
          }

          await tx.$executeRaw(Prisma.sql`DELETE FROM "ClubMessageRead" WHERE "memberId" = ${id}`);
          await tx.$executeRaw(Prisma.sql`DELETE FROM "MatchInvite" WHERE "memberId" = ${id} OR "operatorId" = ${id}`);
          if (roomIds.length) {
            await tx.$executeRaw(
              Prisma.sql`DELETE FROM "MatchInvite" WHERE "roomId" IN (${Prisma.join(roomIds)})`
            );
          }

          await tx.clubMember.deleteMany({ where: { memberId: id } });
          await tx.tournamentSignup.deleteMany({ where: { memberId: id } });
          await tx.liveAnnouncement.deleteMany({ where: { createdByMemberId: id } });
          await tx.tableSessionConfirm.deleteMany({ where: { memberId: id } });
          await tx.tableReservation.deleteMany({ where: { memberId: id } });
          await tx.pointsLedger.deleteMany({ where: { memberId: id } });
          await tx.pointsLedger.deleteMany({ where: { createdByMemberId: id } });
          await tx.pointsBalance.deleteMany({ where: { memberId: id } });
          await tx.tableSession.deleteMany({ where: { startedByMemberId: id } });
          await tx.tableSession.deleteMany({ where: { endedByMemberId: id } });
          await tx.tableSession.deleteMany({ where: { endedByOperatorId: id } });
          await tx.breakRecord.deleteMany({ where: { member_id: id } });
          await tx.breakRecord.deleteMany({ where: { created_by_member_id: id } });
          await tx.event.deleteMany({ where: { player_member_id: id } });

          if (matchIds.length) {
            await tx.match.deleteMany({ where: { id: { in: matchIds } } });
          }

          if (roomIds.length) {
            await tx.room.deleteMany({ where: { id: { in: roomIds } } });
          }

          await tx.member.delete({ where: { id } });
        });
      } else {
        await prisma.member.delete({ where: { id } });
      }
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') {
        return res.status(404).json({ error: '會員不存在' });
      }
      if ((err as any)?.code === 'P2003') {
        if (purge) {
          const meta = (err as any)?.meta;
          const field = meta?.field_name ? String(meta.field_name) : '';
          return res.status(400).json({ error: `永久刪除失敗：仍有外鍵關聯未清理${field ? `（${field}）` : ''}` });
        }
        return res.status(400).json({ error: '會員已有關聯資料（例如比賽/場館/預約），無法直接刪除。若要連同相關資料永久刪除，請使用 purge=1' });
      }
      throw err;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/admin/breaks', adminAuth, async (req, res) => {
  try {
    const page = Number((req.query.page as string) || '1');
    const pageSize = Number((req.query.pageSize as string) || '50');
    const take = Math.max(1, Math.min(Number.isFinite(pageSize) ? Math.floor(pageSize) : 50, 200));
    const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const skip = Math.max(0, (safePage - 1) * take);

    const memberId = String((req.query.memberId as string) || '').trim();
    const clubId = String((req.query.clubId as string) || '').trim();
    const month = String((req.query.month as string) || '').trim();
    const q = String((req.query.q as string) || '').trim();
    const includeDeleted = String((req.query.includeDeleted as string) || '').trim() === '1';

    const where: any = {};
    if (!includeDeleted) where.deleted_at = null;
    if (memberId) where.member_id = memberId;
    if (clubId) where.club_id = clubId;
    if (month) {
      const range = parseMonthRangeUtc(month);
      if (!range) return res.status(400).json({ error: 'month invalid' });
      where.recorded_at = { gte: range.start, lt: range.end };
    }
    if (q) {
      where.OR = [
        { note: { contains: q, mode: 'insensitive' } },
        { video_url: { contains: q, mode: 'insensitive' } },
        { member: { name: { contains: q, mode: 'insensitive' } } },
        { member: { member_code: { contains: q, mode: 'insensitive' } } },
        { club: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await prisma.$transaction([
      prisma.breakRecord.count({ where }),
      prisma.breakRecord.findMany({
        where,
        orderBy: [{ recorded_at: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: {
          member: { select: { id: true, name: true, member_code: true } },
          club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
        },
      }),
    ]);

    const breaks = rows.map((r: any) => ({
      ...r,
      club: r.club
        ? {
            ...r.club,
            name: r.club.name || r.club.member?.name || '',
          }
        : null,
    }));

    res.json({ total, page: safePage, pageSize: take, breaks });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.patch('/api/admin/breaks/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: '缺少 break ID' });

    const body = (req.body || {}) as {
      points?: number;
      recordedAt?: string;
      videoUrl?: string | null;
      note?: string | null;
      restore?: boolean;
    };

    const data: any = {
      updated_at: new Date(),
      updated_by_admin: 'super_admin',
    };

    if (body.points !== undefined) {
      const p = Number(body.points);
      if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ error: 'points invalid' });
      data.points = Math.floor(p);
    }
    if (body.recordedAt !== undefined) {
      const d = new Date(String(body.recordedAt || ''));
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });
      data.recorded_at = d;
    }
    if (body.videoUrl !== undefined) data.video_url = body.videoUrl ? String(body.videoUrl).trim() : null;
    if (body.note !== undefined) data.note = body.note ? String(body.note).trim() : null;
    if (body.restore) {
      data.deleted_at = null;
      data.deleted_by_admin = null;
      data.delete_reason = null;
    }

    const row = await prisma.breakRecord.update({
      where: { id },
      data,
    });
    res.json(row);
  } catch (err: any) {
    if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'break 不存在' });
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.get('/api/site/notice', async (_req, res) => {
  try {
    const row = await prisma.siteNotice.findUnique({ where: { id: 'main' } });
    res.json(row || { id: 'main', enabled: true, message: '', youtubeEmbedUrl: null });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

function parseMonthRangeUtc(month: string) {
  const m = String(month || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(m);
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) return null;
  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0));
  return { start, end };
}

function parseLimit(raw: any, fallback: number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(200, Math.floor(n)));
}

app.get('/api/leaderboard/members/highest', async (req, res) => {
  try {
    const take = parseLimit(req.query.limit, 10);
    const rows = await prisma.breakRecord.groupBy({
      by: ['member_id'],
      where: { deleted_at: null },
      _max: { points: true },
      orderBy: [{ _max: { points: 'desc' } }, { member_id: 'asc' }],
      take,
    });
    const ids = rows.map((r) => r.member_id);
    const members = await prisma.member.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, member_code: true },
    });
    const memberMap = new Map(members.map((m) => [m.id, m]));
    res.json(
      rows.map((r) => ({
        memberId: r.member_id,
        member: memberMap.get(r.member_id) || null,
        points: r._max.points || 0,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/leaderboard/members/monthly', async (req, res) => {
  try {
    const take = parseLimit(req.query.limit, 10);
    const month = String(req.query.month || '').trim();
    const range = parseMonthRangeUtc(month);
    if (!range) return res.status(400).json({ error: 'month invalid' });

    const rows = await prisma.breakRecord.groupBy({
      by: ['member_id'],
      where: { deleted_at: null, recorded_at: { gte: range.start, lt: range.end } },
      _sum: { points: true },
      orderBy: [{ _sum: { points: 'desc' } }, { member_id: 'asc' }],
      take,
    });
    const ids = rows.map((r) => r.member_id);
    const members = await prisma.member.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, member_code: true },
    });
    const memberMap = new Map(members.map((m) => [m.id, m]));
    res.json(
      rows.map((r) => ({
        memberId: r.member_id,
        member: memberMap.get(r.member_id) || null,
        points: r._sum.points || 0,
      }))
    );
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/leaderboard/clubs/highest', async (req, res) => {
  try {
    const take = parseLimit(req.query.limit, 10);
    const rows = await prisma.breakRecord.groupBy({
      by: ['club_id'],
      where: { deleted_at: null },
      _max: { points: true },
      orderBy: [{ _max: { points: 'desc' } }, { club_id: 'asc' }],
      take,
    });
    const ids = rows.map((r) => r.club_id);
    const clubs = await prisma.clubProfile.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } },
    });
    const clubMap = new Map(clubs.map((c) => [c.id, c]));
    res.json(
      rows.map((r) => {
        const club = clubMap.get(r.club_id);
        return {
          clubId: r.club_id,
          club: club ? { ...club, name: club.name || club.member?.name || '' } : null,
          points: r._max.points || 0,
        };
      })
    );
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/leaderboard/clubs/monthly', async (req, res) => {
  try {
    const take = parseLimit(req.query.limit, 10);
    const month = String(req.query.month || '').trim();
    const range = parseMonthRangeUtc(month);
    if (!range) return res.status(400).json({ error: 'month invalid' });

    const rows = await prisma.breakRecord.groupBy({
      by: ['club_id'],
      where: { deleted_at: null, recorded_at: { gte: range.start, lt: range.end } },
      _sum: { points: true },
      orderBy: [{ _sum: { points: 'desc' } }, { club_id: 'asc' }],
      take,
    });
    const ids = rows.map((r) => r.club_id);
    const clubs = await prisma.clubProfile.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } },
    });
    const clubMap = new Map(clubs.map((c) => [c.id, c]));
    res.json(
      rows.map((r) => {
        const club = clubMap.get(r.club_id);
        return {
          clubId: r.club_id,
          club: club ? { ...club, name: club.name || club.member?.name || '' } : null,
          points: r._sum.points || 0,
        };
      })
    );
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/site/notice', adminAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    const enabled = payload.enabled === undefined ? undefined : !!payload.enabled;
    const message = payload.message === undefined ? undefined : String(payload.message || '');
    const youtubeEmbedUrl =
      payload.youtubeEmbedUrl === undefined
        ? undefined
        : (String(payload.youtubeEmbedUrl || '').trim() || null);

    const row = await prisma.siteNotice.upsert({
      where: { id: 'main' },
      create: { id: 'main', enabled: enabled ?? true, message: message ?? '', youtubeEmbedUrl: youtubeEmbedUrl ?? null },
      update: {
        ...(enabled === undefined ? {} : { enabled }),
        ...(message === undefined ? {} : { message }),
        ...(youtubeEmbedUrl === undefined ? {} : { youtubeEmbedUrl }),
      },
    });
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete('/api/admin/breaks/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: '缺少 break ID' });
    const reasonRaw = (req.body || {}).reason;
    const reason = reasonRaw == null ? null : String(reasonRaw).trim() || null;

    const row = await prisma.breakRecord.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by_admin: 'super_admin',
        delete_reason: reason,
        updated_at: new Date(),
        updated_by_admin: 'super_admin',
      },
    });
    res.json(row);
  } catch (err: any) {
    if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'break 不存在' });
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
