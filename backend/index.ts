
import 'dotenv/config';
// Backend API for Snooker Standalone
// Force backend redeploy
import express from 'express';
import cors from 'cors';
import { startEnvAudit, getEnvHistoryTail } from './envAudit.js';
import { Prisma } from '@prisma/client';
import { resolveDistrictCode, DISTRICT_CODE_MAP } from './districtCodes.js';
import { randomUUID } from 'crypto';
import clubRouter from './routes/club.js';
import { createClubTables } from './scripts/create_club_tables.js';
import { getClubFeatureAssignment } from './clubFeatureAccess.js';
import { startNewsScheduler, runNewsFetchOnce } from './news/newsScheduler.js';
import { prisma } from './src/core/db/prisma.js';
import { createAdminAuth, createRequireSupabaseAdmin } from './src/core/auth/adminAuth.js';
import { parseMonthRangeUtc } from './src/core/utils/query.js';
import { createAdminFeatureRouter } from './src/plugins/admin-system/featureRouter.js';
import { createAdminMemberRouter } from './src/plugins/admin-system/memberRouter.js';
import { createContentRouter } from './src/plugins/content/router.js';
import { createSystemHighbreakRouter } from './src/plugins/highbreak/router.js';
import { createMemberRouter } from './src/plugins/members/router.js';
import { createMemberQrSessionRouter } from './src/plugins/qr-session/memberRouter.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
console.log(`Starting Snooker Backend v1.0.1...`);
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const corsOriginRaw = process.env.CORS_ORIGIN || '*';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
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
  allowedHeaders: ['Content-Type', 'x-member-id', 'x-admin-token', 'Authorization'],
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

startNewsScheduler(prisma);
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
    const [pointsAssignment, tournamentsAssignment, bookingAssignment, qrSessionAssignment] = await Promise.all([
      getClubFeatureAssignment(prisma, clubId, 'points'),
      getClubFeatureAssignment(prisma, clubId, 'tournaments'),
      getClubFeatureAssignment(prisma, clubId, 'booking'),
      getClubFeatureAssignment(prisma, clubId, 'qr_session'),
    ]);
    res.json({
      clubId,
      features: {
        booking: {
          globalEnabled: map.booking !== false,
          assignedEnabled: bookingAssignment.assignedEnabled,
          effectiveEnabled: map.booking !== false && bookingAssignment.assignedEnabled,
          explicitEnabled: bookingAssignment.explicitEnabled,
          source: bookingAssignment.source,
          updatedAt: bookingAssignment.updatedAt,
        },
        qr_session: {
          globalEnabled: map.qr_session !== false,
          assignedEnabled: qrSessionAssignment.assignedEnabled,
          effectiveEnabled: map.qr_session !== false && qrSessionAssignment.assignedEnabled,
          explicitEnabled: qrSessionAssignment.explicitEnabled,
          source: qrSessionAssignment.source,
          updatedAt: qrSessionAssignment.updatedAt,
        },
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
    const [pointsAssignment, tournamentsAssignment, bookingAssignment, qrSessionAssignment] = await Promise.all([
      getClubFeatureAssignment(prisma, clubId, 'points'),
      getClubFeatureAssignment(prisma, clubId, 'tournaments'),
      getClubFeatureAssignment(prisma, clubId, 'booking'),
      getClubFeatureAssignment(prisma, clubId, 'qr_session'),
    ]);
    res.json({
      clubId,
      features: {
        booking: {
          globalEnabled: map.booking !== false,
          assignedEnabled: bookingAssignment.assignedEnabled,
          effectiveEnabled: map.booking !== false && bookingAssignment.assignedEnabled,
          explicitEnabled: bookingAssignment.explicitEnabled,
          source: bookingAssignment.source,
          updatedAt: bookingAssignment.updatedAt,
        },
        qr_session: {
          globalEnabled: map.qr_session !== false,
          assignedEnabled: qrSessionAssignment.assignedEnabled,
          effectiveEnabled: map.qr_session !== false && qrSessionAssignment.assignedEnabled,
          explicitEnabled: qrSessionAssignment.explicitEnabled,
          source: qrSessionAssignment.source,
          updatedAt: qrSessionAssignment.updatedAt,
        },
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
  if (p.startsWith('/features/')) return next();
  if (p.includes('/features/public')) return next();

  const isBookingAdmin =
    p.startsWith('/tables') ||
    p.startsWith('/pricing') ||
    p.startsWith('/reservations') ||
    p.startsWith('/availability');

  const isBookingPublic =
    /^\/[^/]+\/tables(?:\/|$)/.test(p) ||
    /^\/[^/]+\/pricing(?:\/|$)/.test(p) ||
    /^\/[^/]+\/availability(?:\/|$)/.test(p) ||
    /^\/[^/]+\/reservations(?:\/|$)/.test(p);

  const isQrTableSubpath = p.startsWith('/tables') && p.includes('/qr/');
  const shouldGate = (isBookingAdmin || isBookingPublic) && !isQrTableSubpath;
  if (!shouldGate) return next();

  try {
    const map = await getFeatureMap();
    if (map.booking === false) return res.status(403).json({ error: 'feature_disabled', feature: 'booking' });

    let clubId: string | null = null;
    if (isBookingPublic) {
      const m = p.match(/^\/([^/]+)\/(?:tables|pricing|availability|reservations)(?:\/|$)/);
      if (m && m[1]) clubId = String(m[1]).trim();
    } else {
      clubId = await resolveAdminClubIdFromHeader(req);
    }
    if (!clubId) return next();

    const assignment = await getClubFeatureAssignment(prisma, clubId, 'booking');
    if (!assignment.assignedEnabled) {
      return res.status(403).json({ error: 'feature_disabled', feature: 'booking', scope: 'club', clubId });
    }
  } catch {}
  next();
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

app.use('/api/club', async (req, res, next) => {
  const p = String(req.path || '');
  const isQrAdmin = p.startsWith('/sessions') || (p.startsWith('/tables') && p.includes('/qr/'));
  if (!isQrAdmin) return next();
  try {
    const map = await getFeatureMap();
    if (map.qr_session === false) return res.status(403).json({ error: 'feature_disabled', feature: 'qr_session' });
    const clubId = await resolveAdminClubIdFromHeader(req);
    if (!clubId) return next();
    const assignment = await getClubFeatureAssignment(prisma, clubId, 'qr_session');
    if (!assignment.assignedEnabled) {
      return res.status(403).json({ error: 'feature_disabled', feature: 'qr_session', scope: 'club', clubId });
    }
  } catch {}
  next();
});

app.use('/api/club', async (req, res, next) => {
  try {
    const p = String(req.path || '');

    if (p === '/live-announcements/public') {
      const limitRaw = (req.query as any)?.limit == null ? '' : String((req.query as any)?.limit);
      const limit = Math.min(50, Math.max(1, Number(limitRaw || 20) || 20));
      const now = new Date();
      const clubIds = (await prisma.clubProfile.findMany({
        where: { publicEnabled: true, publicShowLive: true },
        select: { id: true },
      })).map((r) => r.id);
      if (clubIds.length === 0) return res.json([]);
      const rows = await prisma.liveAnnouncement.findMany({
        where: { deletedAt: null, clubId: { in: clubIds }, startsAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
        orderBy: [{ startsAt: 'asc' }],
        take: limit,
        include: { club: { select: { id: true, name: true, logoUrl: true } } }
      });
      return res.json(rows);
    }

    const mLive = p.match(/^\/([^/]+)\/live-announcements\/public(?:\/|$)/);
    if (mLive && mLive[1]) {
      const clubId = String(mLive[1] || '').trim();
      const club = await prisma.clubProfile.findUnique({ where: { id: clubId }, select: { publicEnabled: true, publicShowLive: true } });
      if (!club || club.publicEnabled !== true || club.publicShowLive !== true) return res.json([]);
      return next();
    }

    const mTour = p.match(/^\/([^/]+)\/tournaments\/public(?:\/|$)/);
    const mTourDetail = p.match(/^\/([^/]+)\/tournaments\/[^/]+\/public(?:\/|$)/);
    if ((mTour || mTourDetail) && (mTour?.[1] || mTourDetail?.[1])) {
      const clubId = String((mTour?.[1] || mTourDetail?.[1] || '')).trim();
      const club = await prisma.clubProfile.findUnique({ where: { id: clubId }, select: { publicEnabled: true, publicShowTournaments: true } });
      if (!club || club.publicEnabled !== true || club.publicShowTournaments !== true) return res.json([]);
      return next();
    }

    const mLb = p.match(/^\/([^/]+)\/leaderboard\/(highest|monthly)(?:\/|$)/);
    if (mLb && mLb[1]) {
      const clubId = String(mLb[1] || '').trim();
      const club = await prisma.clubProfile.findUnique({ where: { id: clubId }, select: { publicEnabled: true, publicShowHighbreak: true } });
      if (!club || club.publicEnabled !== true || club.publicShowHighbreak !== true) return res.json([]);
      return next();
    }
  } catch {}
  next();
});

// Mount Club Router
app.use('/api/club', clubRouter);
app.use(createMemberQrSessionRouter({
  getFeatureMap,
  requireFeature,
}));

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

// Start environment audit logging to record every update and snapshot (can be disabled)
if (process.env.ENV_AUDIT_ENABLED !== 'false') {
  startEnvAudit();
}
const adminAuth = createAdminAuth(ADMIN_TOKEN);
const requireSupabaseAdmin = createRequireSupabaseAdmin({
  supabaseUrl: SUPABASE_URL,
  supabaseServiceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
});
app.use(createContentRouter({
  adminAuth,
  runNewsFetchOnce,
  requireSupabaseAdmin,
  supabaseStorageBucket: SUPABASE_STORAGE_BUCKET,
}));
app.use(createAdminFeatureRouter({
  adminAuth,
  featureCatalog: FEATURE_CATALOG,
  getFeatureMap,
  invalidateFeatureCache: () => {
    featureCache = null;
  },
}));
app.use(createAdminMemberRouter({
  adminAuth,
}));
app.use(createSystemHighbreakRouter(adminAuth));
app.use(createMemberRouter({
  resendApiKey: RESEND_API_KEY,
  resendFromEmail: RESEND_FROM_EMAIL,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '277887232996-5lfubeh4be5pnrd458buc489uq0h0e1g.apps.googleusercontent.com',
}));

app.get('/api/admin/news/sources', adminAuth, async (_req, res) => {
  try {
    const sources = await prisma.newsSource.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
    res.json({ sources });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/admin/news/sources', adminAuth, async (req, res) => {
  try {
    const body = (req.body || {}) as any;
    const id = String(body.id || randomUUID()).trim();
    const name = String(body.name || '').trim();
    const feedUrl = String(body.feedUrl || '').trim();
    const siteUrl = String(body.siteUrl || '').trim() || null;
    const language = String(body.language || '').trim() || null;
    const region = String(body.region || '').trim() || null;
    const enabled = typeof body.enabled === 'boolean' ? Boolean(body.enabled) : true;
    const fetchEveryHours = Number.isFinite(Number(body.fetchEveryHours)) ? Math.max(1, Math.min(24 * 30, Math.floor(Number(body.fetchEveryHours)))) : 72;
    if (!name) return res.status(400).json({ error: 'name_required' });
    if (!feedUrl) return res.status(400).json({ error: 'feedUrl_required' });
    const row = await prisma.newsSource.create({
      data: { id, name, feedUrl, siteUrl, language, region, enabled, fetchEveryHours },
    });
    res.json({ ok: true, source: row });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put('/api/admin/news/sources/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });
    const body = (req.body || {}) as any;
    const patch: any = {};
    if (typeof body.name === 'string') patch.name = String(body.name).trim();
    if (typeof body.feedUrl === 'string') patch.feedUrl = String(body.feedUrl).trim();
    if (typeof body.siteUrl === 'string') patch.siteUrl = String(body.siteUrl).trim() || null;
    if (typeof body.language === 'string') patch.language = String(body.language).trim() || null;
    if (typeof body.region === 'string') patch.region = String(body.region).trim() || null;
    if (typeof body.enabled === 'boolean') patch.enabled = Boolean(body.enabled);
    if (Number.isFinite(Number(body.fetchEveryHours))) patch.fetchEveryHours = Math.max(1, Math.min(24 * 30, Math.floor(Number(body.fetchEveryHours))));
    const row = await prisma.newsSource.update({ where: { id }, data: patch });
    res.json({ ok: true, source: row });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete('/api/admin/news/sources/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });
    await prisma.newsSource.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post('/api/admin/news/fetch', adminAuth, async (req, res) => {
  try {
    const sourceId = String((req.body || {}).sourceId || '').trim();
    const opt: any = { force: true };
    if (sourceId) opt.sourceId = sourceId;
    const out = await runNewsFetchOnce(prisma, opt);
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
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
        title: (x.item as any)?.title ?? null,
        subtitle: (x.item as any)?.subtitle ?? null,
        ctaLabel: (x.item as any)?.ctaLabel ?? null,
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
              title: null,
              subtitle: null,
              ctaLabel: null,
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
              prisma.siteAdItem.create({ data: { id: itemId, enabled: true, imageUrl: x.imageUrl, linkUrl: x.linkUrl, title: null, subtitle: null, ctaLabel: null } }),
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
    const item = await prisma.siteAdItem.create({ data: { id, enabled: true, imageUrl: null, linkUrl: null, title: null, subtitle: null, ctaLabel: null } });
    res.json({ item });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put('/api/admin/site-ad-items/:id', adminAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id_required' });
    const body = (req.body || {}) as {
      enabled?: boolean;
      linkUrl?: string | null;
      title?: string | null;
      subtitle?: string | null;
      ctaLabel?: string | null;
    };
    const enabled = body.enabled === undefined ? undefined : Boolean(body.enabled);
    const linkUrl = body.linkUrl === undefined ? undefined : (body.linkUrl ? String(body.linkUrl).trim() : null);
    const title = body.title === undefined ? undefined : (body.title ? String(body.title).trim() : null);
    const subtitle = body.subtitle === undefined ? undefined : (body.subtitle ? String(body.subtitle).trim() : null);
    const ctaLabel = body.ctaLabel === undefined ? undefined : (body.ctaLabel ? String(body.ctaLabel).trim() : null);
    const item = await prisma.siteAdItem.update({
      where: { id },
      data: {
        ...(enabled !== undefined ? { enabled } : {}),
        ...(linkUrl !== undefined ? { linkUrl } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(subtitle !== undefined ? { subtitle } : {}),
        ...(ctaLabel !== undefined ? { ctaLabel } : {}),
      } as any,
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

// Admin overview: basic runtime and DB
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
            <div class="kv"><h3>DB</h3><div class="v">${payload.db.status}${payload.db.error ? ' (' + payload.db.error + ')' : ''}</div></div>
          </div>

          <div class="card">
            <h2 style="margin:0 0 8px; font-size:18px;">CORS Origins</h2>
            <ul>${corsListHtml}</ul>
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`listening on 0.0.0.0:${PORT}`);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
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

