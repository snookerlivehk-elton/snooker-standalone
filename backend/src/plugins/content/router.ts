import express from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';

type ContentRouterOptions = {
  adminAuth: express.RequestHandler;
  runNewsFetchOnce: (prismaClient: typeof prisma, options: any) => Promise<any>;
  requireSupabaseAdmin: () => any;
  supabaseStorageBucket: string;
};

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === '0.0.0.0') return true;
  if (h === '::1') return true;
  if (h.startsWith('127.')) return true;
  if (h.startsWith('10.')) return true;
  if (h.startsWith('192.168.')) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 16 && n <= 31) return true;
  }
  if (h.startsWith('169.254.')) return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  return false;
}

export function createContentRouter(options: ContentRouterOptions) {
  const { adminAuth, runNewsFetchOnce, requireSupabaseAdmin, supabaseStorageBucket } = options;
  const router = express.Router();

  router.get('/api/news/sources', async (_req, res) => {
    try {
      const rows = await prisma.newsSource.findMany({
        where: { enabled: true },
        select: { id: true, name: true, siteUrl: true, language: true, region: true, updatedAt: true },
        orderBy: [{ name: 'asc' }],
      });
      res.json({ sources: rows });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/news', async (req, res) => {
    try {
      const limitRaw = String((req.query as any).limit || '').trim();
      const sourceId = String((req.query as any).sourceId || '').trim();
      let limit = 30;
      if (limitRaw) {
        const n = Number(limitRaw);
        if (Number.isFinite(n)) limit = Math.max(1, Math.min(100, Math.floor(n)));
      }

      const where: any = {};
      if (sourceId) where.sourceId = sourceId;

      const items = await prisma.newsItem.findMany({
        where,
        include: { source: { select: { id: true, name: true, siteUrl: true } } },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });

      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/news/image', async (req, res) => {
    const raw = String((req.query as any).url || '').trim();
    if (!raw) return res.status(400).send('missing url');
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return res.status(400).send('invalid url');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return res.status(400).send('unsupported protocol');
    if (isPrivateOrLocalHost(u.hostname)) return res.status(400).send('blocked host');

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const r = await fetch(u.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'SnookerHKLive-NewsBot/1.0 (+https://www.snookerhk.live)',
          Accept: 'image/*,*/*;q=0.8',
        },
        signal: ctrl.signal,
      });
      if (!r.ok) return res.status(404).send('not found');

      const contentType = String(r.headers.get('content-type') || '').trim();
      if (contentType && !contentType.toLowerCase().startsWith('image/')) {
        return res.status(415).send('not an image');
      }

      const arr = await r.arrayBuffer();
      const buf = Buffer.from(arr);
      const maxBytes = 5 * 1024 * 1024;
      if (buf.length > maxBytes) return res.status(413).send('image too large');

      res.setHeader('Content-Type', contentType || 'image/*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(502).send('fetch failed');
    } finally {
      clearTimeout(t);
    }
  });

  router.get('/api/admin/news/sources', adminAuth, async (_req, res) => {
    try {
      const sources = await prisma.newsSource.findMany({
        orderBy: [{ updatedAt: 'desc' }],
      });
      res.json({ sources });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.post('/api/admin/news/sources', adminAuth, async (req, res) => {
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

  router.put('/api/admin/news/sources/:id', adminAuth, async (req, res) => {
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

  router.delete('/api/admin/news/sources/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id_required' });
      await prisma.newsSource.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.post('/api/admin/news/fetch', adminAuth, async (req, res) => {
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

  router.get('/api/site-ads', async (req, res) => {
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

  router.get('/api/admin/site-ads', adminAuth, async (_req, res) => {
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

  router.post('/api/admin/site-ad-items', adminAuth, async (_req, res) => {
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

  router.put('/api/admin/site-ad-items/:id', adminAuth, async (req, res) => {
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

  router.delete('/api/admin/site-ad-items/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id_required' });
      await prisma.siteAdItem.delete({ where: { id } });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/admin/site-ad-items/:id/image', adminAuth, async (req, res) => {
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

      const up = await supabase.storage.from(supabaseStorageBucket).upload(objectPath, buf, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });
      if (up.error) return res.status(500).json({ error: `upload_failed: ${up.error.message}` });

      const pub = supabase.storage.from(supabaseStorageBucket).getPublicUrl(objectPath);
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

  router.put('/api/admin/site-ad-placements/:placement/items', adminAuth, async (req, res) => {
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

  router.put('/api/admin/site-ads/:id', adminAuth, async (req, res) => {
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

  router.post('/api/admin/site-ads/:id/image', adminAuth, async (req, res) => {
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

      const up = await supabase.storage.from(supabaseStorageBucket).upload(objectPath, buf, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });
      if (up.error) return res.status(500).json({ error: `upload_failed: ${up.error.message}` });

      const pub = supabase.storage.from(supabaseStorageBucket).getPublicUrl(objectPath);
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

  router.get('/api/site/notice', async (_req, res) => {
    try {
      const row = await prisma.siteNotice.findUnique({ where: { id: 'main' } });
      res.json(row || { id: 'main', enabled: true, message: '', youtubeEmbedUrl: null, homeShowLeaderboard: true, homeShowClubList: true });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.put('/api/admin/site/notice', adminAuth, async (req, res) => {
    try {
      const payload = req.body || {};
      const enabled = payload.enabled === undefined ? undefined : !!payload.enabled;
      const message = payload.message === undefined ? undefined : String(payload.message || '');
      const youtubeEmbedUrl =
        payload.youtubeEmbedUrl === undefined
          ? undefined
          : (String(payload.youtubeEmbedUrl || '').trim() || null);
      const homeShowLeaderboard = payload.homeShowLeaderboard === undefined ? undefined : !!payload.homeShowLeaderboard;
      const homeShowClubList = payload.homeShowClubList === undefined ? undefined : !!payload.homeShowClubList;

      const row = await prisma.siteNotice.upsert({
        where: { id: 'main' },
        create: {
          id: 'main',
          enabled: enabled ?? true,
          message: message ?? '',
          youtubeEmbedUrl: youtubeEmbedUrl ?? null,
          homeShowLeaderboard: homeShowLeaderboard ?? true,
          homeShowClubList: homeShowClubList ?? true,
        },
        update: {
          ...(enabled === undefined ? {} : { enabled }),
          ...(message === undefined ? {} : { message }),
          ...(youtubeEmbedUrl === undefined ? {} : { youtubeEmbedUrl }),
          ...(homeShowLeaderboard === undefined ? {} : { homeShowLeaderboard }),
          ...(homeShowClubList === undefined ? {} : { homeShowClubList }),
        },
      });
      res.json(row);
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  return router;
}
