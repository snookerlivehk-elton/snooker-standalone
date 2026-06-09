import type { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';

export type RssFetchResult = {
  ok: boolean;
  newCount: number;
  error?: string;
  fetchedAt: Date;
};

function canonicalizeUrl(input: string): string {
  const s = String(input || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const params = new URLSearchParams(u.search);
    const kept = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (/^utm_/i.test(k)) continue;
      kept.set(k, v);
    }
    u.search = kept.toString() ? `?${kept.toString()}` : '';
    u.hash = '';
    return u.toString();
  } catch {
    return s;
  }
}

function stripHtml(input: string): string {
  const s = String(input || '');
  const noTags = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
  const collapsed = noTags.replace(/\s+/g, ' ').trim();
  return decodeHtmlEntities(collapsed);
}

function decodeHtmlEntities(input: string): string {
  const s = String(input || '');
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return s
    .replace(/&([a-zA-Z]+);/g, (_, k: string) => (named[k] ? named[k] : `&${k};`))
    .replace(/&#(\d+);/g, (_, n: string) => {
      const v = Number(n);
      if (!Number.isFinite(v) || v < 0) return '';
      try {
        return String.fromCodePoint(v);
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hx: string) => {
      const v = parseInt(hx, 16);
      if (!Number.isFinite(v) || v < 0) return '';
      try {
        return String.fromCodePoint(v);
      } catch {
        return '';
      }
    });
}

function truncate(input: string, maxLen: number): string {
  const s = String(input || '').trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

function safeDate(input: any): Date | null {
  const s = String(input || '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function arrayify<T>(x: T | T[] | undefined | null): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export async function fetchAndUpsertRssSource(
  prisma: PrismaClient,
  source: {
    id: string;
    name: string;
    feedUrl: string;
  },
  opts?: { maxItems?: number; summaryMaxLen?: number },
): Promise<RssFetchResult> {
  const fetchedAt = new Date();
  const maxItems = Math.max(1, Math.min(200, Number(opts?.maxItems ?? 50)));
  const summaryMaxLen = Math.max(60, Math.min(600, Number(opts?.summaryMaxLen ?? 220)));
  const feedUrl = String(source.feedUrl || '').trim();
  if (!feedUrl) return { ok: false, newCount: 0, error: 'feedUrl missing', fetchedAt };

  let xml = '';
  try {
    const res = await fetch(feedUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'SnookerHKLive-NewsBot/1.0 (+https://www.snookerhk.live)' },
    });
    if (!res.ok) {
      return { ok: false, newCount: 0, error: `fetch_failed status=${res.status}`, fetchedAt };
    }
    xml = await res.text();
  } catch (e: any) {
    return { ok: false, newCount: 0, error: String(e?.message || e), fetchedAt };
  }

  let parsed: any = null;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      removeNSPrefix: true,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
    });
    parsed = parser.parse(xml);
  } catch (e: any) {
    return { ok: false, newCount: 0, error: `parse_failed: ${String(e?.message || e)}`, fetchedAt };
  }

  const channel = parsed?.rss?.channel || parsed?.feed || null;
  const items = arrayify(channel?.item || channel?.entry).slice(0, maxItems);
  if (!items.length) {
    return { ok: true, newCount: 0, fetchedAt };
  }

  let newCount = 0;
  for (const it of items) {
    const titleRaw = String(it?.title?.['#text'] ?? it?.title ?? '').trim();
    const linkRaw = String(it?.link?.href ?? it?.link ?? '').trim();
    const url = canonicalizeUrl(linkRaw);
    const title = truncate(stripHtml(titleRaw), 180);
    if (!url || !title) continue;

    const pub = safeDate(it?.pubDate ?? it?.published ?? it?.updated);
    const author = String(it?.creator ?? it?.author?.name ?? it?.author ?? '').trim() || null;

    const descRaw = String(it?.description ?? it?.summary ?? it?.content ?? '').trim();
    const summary = descRaw ? truncate(stripHtml(descRaw), summaryMaxLen) : null;

    const thumbUrl = String(it?.thumbnail?.url ?? it?.enclosure?.url ?? it?.image?.url ?? it?.content?.url ?? it?.media?.thumbnail?.url ?? '').trim();
    const imageUrl = thumbUrl ? canonicalizeUrl(thumbUrl) : null;

    const cats = arrayify(it?.category).map((c) => String(c?.['#text'] ?? c ?? '').trim()).filter((x) => !!x);
    const tags = cats.length ? cats.slice(0, 12) : null;

    try {
      const existing = await prisma.newsItem.findUnique({ where: { url }, select: { id: true } });
      if (existing) {
        const data: any = {
          title,
          author,
          summary,
          imageUrl,
        };
        if (pub) data.publishedAt = pub;
        if (tags) data.tags = tags as any;
        await prisma.newsItem.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.newsItem.create({
          data: {
            sourceId: source.id,
            title,
            url,
            publishedAt: pub,
            author,
            summary,
            imageUrl,
            tags: tags ? (tags as any) : null,
          },
        });
        newCount += 1;
      }
    } catch {
      continue;
    }
  }

  return { ok: true, newCount, fetchedAt };
}
