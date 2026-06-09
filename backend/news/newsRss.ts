import type { PrismaClient } from '@prisma/client';
import { XMLParser } from 'fast-xml-parser';

export type RssFetchResult = {
  ok: boolean;
  newCount: number;
  error?: string;
  fetchedAt: Date;
};

function textValue(x: any): string {
  if (x == null) return '';
  if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') return String(x);
  if (typeof x === 'object') {
    const candidates = [
      x['#text'],
      x.__cdata,
      x.cdata,
      x.text,
      x.value,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') return String(c);
    }
  }
  return '';
}

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

function isLikelyImageUrl(url: string, contentType?: string | null): boolean {
  const u = String(url || '').trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith('data:')) return false;
  if (contentType && String(contentType).toLowerCase().startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(u);
}

function parseSrcsetUrl(srcset: string): string {
  const s = String(srcset || '').trim();
  if (!s) return '';
  const first = s.split(',')[0];
  if (!first) return '';
  return String(first.trim().split(/\s+/)[0] || '').trim();
}

function firstImageFromHtml(html: string): string {
  const s = String(html || '');

  const og = s.match(/<meta[^>]+property\s*=\s*["']og:image(?::url)?["'][^>]+content\s*=\s*["']([^"']+)["'][^>]*>/i)
    || s.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image(?::url)?["'][^>]*>/i);
  if (og && og[1]) return String(og[1]).trim();

  const tw = s.match(/<meta[^>]+name\s*=\s*["']twitter:image(?::src)?["'][^>]+content\s*=\s*["']([^"']+)["'][^>]*>/i)
    || s.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']twitter:image(?::src)?["'][^>]*>/i);
  if (tw && tw[1]) return String(tw[1]).trim();

  const relImg = s.match(/<link[^>]+rel\s*=\s*["']image_src["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*>/i)
    || s.match(/<link[^>]+href\s*=\s*["']([^"']+)["'][^>]+rel\s*=\s*["']image_src["'][^>]*>/i);
  if (relImg && relImg[1]) return String(relImg[1]).trim();

  const imgTag = s.match(/<img\b[^>]*>/i);
  const tag = imgTag ? String(imgTag[0]) : '';
  if (!tag) return '';

  const attr = (name: string) => {
    const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
    return m && m[1] ? String(m[1]).trim() : '';
  };

  const candidates = [
    attr('data-lazy-src'),
    attr('data-src'),
    attr('data-original'),
    parseSrcsetUrl(attr('data-srcset')),
    parseSrcsetUrl(attr('srcset')),
    attr('src'),
  ].map((x) => String(x || '').trim()).filter(Boolean);

  for (const c of candidates) {
    if (!c) continue;
    if (c.startsWith('data:')) continue;
    return c;
  }
  return '';
}

function extractLinkUrl(it: any): string {
  const link = it?.link;
  if (!link) return '';
  if (typeof link === 'string') return link;
  if (Array.isArray(link)) {
    const objs = link.filter((x) => x && typeof x === 'object');
    const preferred = objs.find((x) => String(x.rel || '').toLowerCase() === 'alternate') || objs.find((x) => !x.rel);
    const href = preferred?.href ?? preferred?.url ?? '';
    return typeof href === 'string' ? href : '';
  }
  if (typeof link === 'object') {
    const href = link.href ?? link.url ?? link['#text'] ?? '';
    return typeof href === 'string' ? href : '';
  }
  return '';
}

function extractImageUrl(it: any, rawHtml: string): string {
  const candidates: Array<{ url: string; type?: string | null }> = [];

  for (const enc of arrayify(it?.enclosure)) {
    if (!enc) continue;
    if (typeof enc === 'string') {
      candidates.push({ url: enc });
      continue;
    }
    if (typeof enc === 'object') candidates.push({ url: String(enc.url || enc.href || ''), type: enc.type ?? enc.mimeType ?? null });
  }

  for (const th of arrayify(it?.thumbnail)) {
    if (!th) continue;
    if (typeof th === 'string') candidates.push({ url: th });
    if (typeof th === 'object') candidates.push({ url: String(th.url || th.href || ''), type: th.type ?? null });
  }

  const img = it?.image;
  if (img) {
    if (typeof img === 'string') candidates.push({ url: img });
    if (typeof img === 'object') candidates.push({ url: String(img.url || img.href || ''), type: img.type ?? null });
  }

  for (const content of arrayify(it?.content)) {
    if (!content || typeof content !== 'object') continue;
    const maybeUrl = String(content.url || content.href || '');
    if (maybeUrl) candidates.push({ url: maybeUrl, type: content.type ?? content.mimeType ?? null });
  }

  for (const l of arrayify(it?.link)) {
    if (!l || typeof l !== 'object') continue;
    const rel = String(l.rel || '').toLowerCase();
    const type = String(l.type || l.mimeType || '').toLowerCase();
    if (rel !== 'enclosure') continue;
    const href = String(l.href || l.url || '').trim();
    if (!href) continue;
    candidates.push({ url: href, type: type || null });
  }

  const imgFromHtml = firstImageFromHtml(rawHtml);
  if (imgFromHtml) candidates.push({ url: imgFromHtml });

  for (const c of candidates) {
    const u = canonicalizeUrl(String(c.url || '').trim());
    if (!u) continue;
    if (!isLikelyImageUrl(u, c.type || null)) continue;
    return u;
  }
  return '';
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
    const titleRaw = String(textValue(it?.title?.['#text'] ?? it?.title) || '').trim();
    const linkRaw = String(extractLinkUrl(it) || '').trim();
    const url = canonicalizeUrl(linkRaw);
    const title = truncate(stripHtml(titleRaw), 180);
    if (!url || !title) continue;

    const pub = safeDate(it?.pubDate ?? it?.published ?? it?.updated);
    const author = String(textValue(it?.creator ?? it?.author?.name ?? it?.author) || '').trim() || null;

    const descRaw = String(textValue(it?.description ?? it?.summary ?? it?.encoded ?? it?.content) || '').trim();
    const summary = descRaw ? truncate(stripHtml(descRaw), summaryMaxLen) : null;

    const rawHtmlForImage = String(textValue(it?.description ?? it?.summary ?? it?.encoded ?? it?.content) || '').trim();
    const imageCandidate = extractImageUrl(it, rawHtmlForImage);
    const imageUrl = imageCandidate ? canonicalizeUrl(imageCandidate) : null;

    const cats = arrayify(it?.category)
      .map((c) => String(textValue(c?.term ?? c?.['#text'] ?? c) || '').trim())
      .filter((x) => !!x);
    const tags = cats.length ? cats.slice(0, 12) : null;

    try {
      const existing = await prisma.newsItem.findUnique({ where: { url }, select: { id: true } });
      if (existing) {
        const data: any = {
          title,
          author,
          summary,
        };
        if (pub) data.publishedAt = pub;
        if (tags) data.tags = tags as any;
        if (imageUrl) data.imageUrl = imageUrl;
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
