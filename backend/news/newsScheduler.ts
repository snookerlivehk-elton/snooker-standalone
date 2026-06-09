import type { PrismaClient } from '@prisma/client';
import { fetchAndUpsertRssSource } from './newsRss.js';

type AcquireLockResult = { ok: boolean; acquired: boolean };

async function acquireLock(prisma: PrismaClient, key: string, ttlMs: number, lockedBy: string): Promise<AcquireLockResult> {
  const now = new Date();
  const until = new Date(now.getTime() + ttlMs);
  try {
    const updated = await prisma.appLock.updateMany({
      where: {
        key,
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      data: { lockedUntil: until, lockedBy },
    });
    if (updated.count > 0) return { ok: true, acquired: true };
    const existing = await prisma.appLock.findUnique({ where: { key }, select: { key: true } });
    if (!existing) {
      await prisma.appLock.create({ data: { key, lockedUntil: until, lockedBy } });
      return { ok: true, acquired: true };
    }
    return { ok: true, acquired: false };
  } catch {
    return { ok: false, acquired: false };
  }
}

async function releaseLock(prisma: PrismaClient, key: string, lockedBy: string) {
  try {
    await prisma.appLock.updateMany({
      where: { key, lockedBy },
      data: { lockedUntil: null },
    });
  } catch {}
}

export async function ensureDefaultNewsSources(prisma: PrismaClient) {
  const defaults = [
    {
      id: 'sportsroad_snooker',
      name: '體路 Sportsroad（Snooker）',
      feedUrl: 'https://www.sportsroad.hk/archives/tag/snooker-2/feed/',
      siteUrl: 'https://www.sportsroad.hk/archives/tag/snooker-2/',
      language: 'zh-HK',
      region: 'HK',
    },
    {
      id: 'wpbsa',
      name: 'WPBSA',
      feedUrl: 'https://wpbsa.com/feed/',
      siteUrl: 'https://wpbsa.com/',
      language: 'en',
      region: 'INTL',
    },
    {
      id: 'bbc_snooker',
      name: 'BBC Sport（Snooker）',
      feedUrl: 'https://feeds.bbci.co.uk/sport/snooker/rss.xml',
      siteUrl: 'https://www.bbc.co.uk/sport/snooker',
      language: 'en',
      region: 'INTL',
    },
    {
      id: 'snookerhq',
      name: 'SnookerHQ',
      feedUrl: 'https://snookerhq.com/feed/',
      siteUrl: 'https://snookerhq.com/',
      language: 'en',
      region: 'INTL',
    },
  ];

  for (const s of defaults) {
    try {
      await prisma.newsSource.upsert({
        where: { id: s.id },
        update: {
          name: s.name,
          feedUrl: s.feedUrl,
          siteUrl: s.siteUrl,
          language: s.language,
          region: s.region,
        },
        create: {
          id: s.id,
          name: s.name,
          feedUrl: s.feedUrl,
          siteUrl: s.siteUrl,
          language: s.language,
          region: s.region,
          enabled: true,
          fetchEveryHours: 72,
        },
      });
    } catch {}
  }
}

export async function runNewsFetchOnce(prisma: PrismaClient, opts?: { force?: boolean; sourceId?: string }) {
  const now = new Date();
  const lockKey = 'news_fetch_v1';
  const lockedBy = `pid:${process.pid}`;
  const lock = await acquireLock(prisma, lockKey, 20 * 60 * 1000, lockedBy);
  if (!lock.ok || !lock.acquired) return { ok: true, skipped: true };

  try {
    const where: any = { enabled: true };
    if (opts?.sourceId) where.id = String(opts.sourceId);
    const sources = await prisma.newsSource.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
    });

    for (const s of sources) {
      const due = opts?.force
        ? true
        : !s.lastFetchedAt || now.getTime() - new Date(s.lastFetchedAt).getTime() >= Number(s.fetchEveryHours || 72) * 3600 * 1000;
      if (!due) continue;

      const log = await prisma.newsFetchLog.create({
        data: {
          sourceId: s.id,
          startedAt: new Date(),
          ok: false,
          newCount: 0,
        },
      });

      await prisma.newsSource.update({
        where: { id: s.id },
        data: { lastFetchAttemptAt: new Date(), lastError: null },
      });

      const res = await fetchAndUpsertRssSource(prisma, { id: s.id, name: s.name, feedUrl: s.feedUrl }, { maxItems: 50, summaryMaxLen: 220 });

      await prisma.newsFetchLog.update({
        where: { id: log.id },
        data: {
          finishedAt: new Date(),
          ok: res.ok,
          newCount: res.newCount,
          error: res.ok ? null : (res.error || 'unknown'),
        },
      });

      await prisma.newsSource.update({
        where: { id: s.id },
        data: {
          lastFetchedAt: res.ok ? res.fetchedAt : s.lastFetchedAt,
          lastError: res.ok ? null : (res.error || 'unknown'),
        },
      });
    }
  } finally {
    await releaseLock(prisma, lockKey, lockedBy);
  }

  return { ok: true, skipped: false };
}

export function startNewsScheduler(prisma: PrismaClient) {
  const enabled = process.env.NEWS_AUTO_FETCH_ENABLED !== 'false';
  if (!enabled) return;

  const checkEveryMs = 60 * 60 * 1000;
  const jitterMs = 45 * 1000;
  const run = async () => {
    try {
      await ensureDefaultNewsSources(prisma);
      await runNewsFetchOnce(prisma, { force: false });
    } catch {}
  };

  setTimeout(run, Math.floor(Math.random() * jitterMs));
  setInterval(run, checkEveryMs);
}

