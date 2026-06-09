import React, { useEffect, useMemo, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import { API_URL } from './config';
import { getNewsItems, getNewsSources } from './lib/api';

type Source = { id: string; name: string; siteUrl?: string | null };

const NewsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [sourceId, setSourceId] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, n] = await Promise.all([
          getNewsSources(API_URL),
          getNewsItems(API_URL, { limit: 50 }),
        ]);
        if (!mounted) return;
        setSources(Array.isArray(s.sources) ? s.sources : []);
        setItems(Array.isArray(n.items) ? n.items : []);
      } catch (e: any) {
        if (mounted) setError(e?.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const n = await getNewsItems(API_URL, { limit: 50, sourceId: sourceId || undefined });
        if (!mounted) return;
        setItems(Array.isArray(n.items) ? n.items : []);
      } catch (e: any) {
        if (mounted) setError(e?.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [sourceId]);

  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const content = (
    <main className="flex-1 px-4 pt-4 pb-10 flex items-start justify-center">
      <div className="w-full max-w-2xl space-y-3">
        <div className="glass rounded-xl p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm cue-muted">每 3 天自動更新；點擊標題會跳去原文</div>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="h-10 rounded px-2 cue-surface-strong text-sm news-source-select"
            >
              <option value="">全部來源</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="glass rounded-xl p-4">載入中...</div>
        )}

        {!loading && error && (
          <div className="glass rounded-xl p-4 text-red-200">錯誤：{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="glass rounded-xl p-4">暫時未有新聞</div>
        )}

        {!loading && !error && items.map((it: any) => {
          const src = it?.source || (it?.sourceId ? sourceMap.get(String(it.sourceId)) : null);
          const dt = it?.publishedAt ? new Date(String(it.publishedAt)) : null;
          const dtStr = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString('zh-HK') : '';
          const img = it?.imageUrl ? String(it.imageUrl) : '';
          const imgProxy = img ? `${API_URL.replace(/\/+$/, '')}/api/news/image?url=${encodeURIComponent(img)}` : '';
          return (
            <a
              key={String(it?.id || it?.url)}
              href={String(it?.url || '#')}
              target="_blank"
              rel="noreferrer"
              className="block glass rounded-xl p-4 hover:brightness-95"
            >
              <div className="flex gap-3">
                {imgProxy ? (
                  <img
                    src={imgProxy}
                    alt=""
                    loading="lazy"
                    className="w-16 h-16 sm:w-24 sm:h-24 rounded-lg object-cover shrink-0 bg-black/20"
                    onError={(e) => { try { (e.currentTarget as HTMLImageElement).style.display = 'none'; } catch {} }}
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="text-base font-extrabold cue-zh-title">{String(it?.title || '')}</div>
                  <div className="mt-1 text-xs cue-muted flex flex-wrap gap-x-2 gap-y-1">
                    <span>{src?.name ? `來源：${src.name}` : '來源：—'}</span>
                    {dtStr ? <span>{dtStr}</span> : null}
                  </div>
                  {it?.summary ? (
                    <div className="mt-2 text-sm cue-muted">{String(it.summary)}</div>
                  ) : null}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </main>
  );

  if (embedded) {
    return (
      <div className="flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="Snooker 新聞" />
      {content}
    </div>
  );
};

export default NewsPage;
