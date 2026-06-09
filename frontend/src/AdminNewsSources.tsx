import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { adminFetchNewsNow, createAdminNewsSource, deleteAdminNewsSource, getAdminNewsSources, updateAdminNewsSource } from './lib/api';

function resolveAdminToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = localStorage.getItem('adminToken') || '';
    const token = tokenFromUrl || tokenSaved;
    if (tokenFromUrl) localStorage.setItem('adminToken', tokenFromUrl);
    return token;
  } catch {
    return localStorage.getItem('adminToken') || '';
  }
}

const AdminNewsSources: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    id: '',
    name: '',
    feedUrl: '',
    siteUrl: '',
    language: '',
    region: 'HK',
    fetchEveryHours: 72,
    enabled: true,
  });

  async function refresh(tok: string) {
    const res = await getAdminNewsSources(API_URL, tok);
    setSources(Array.isArray((res as any).sources) ? (res as any).sources : []);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const tok = resolveAdminToken();
        if (!tok) throw new Error('缺少系統管理員密鑰');
        await refresh(tok);
      } catch (e: any) {
        if (mounted) setError(e?.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return sources;
    return sources.filter((x: any) => {
      const t = `${x?.id || ''} ${x?.name || ''} ${x?.feedUrl || ''} ${x?.siteUrl || ''}`.toLowerCase();
      return t.includes(s);
    });
  }, [sources, q]);

  async function saveNew() {
    const tok = resolveAdminToken();
    if (!tok) {
      setError('缺少系統管理員密鑰');
      return;
    }
    setMsg(null);
    setError(null);
    setBusyId('new');
    try {
      await createAdminNewsSource(API_URL, tok, {
        id: draft.id || undefined,
        name: draft.name,
        feedUrl: draft.feedUrl,
        siteUrl: draft.siteUrl || undefined,
        language: draft.language || undefined,
        region: draft.region || undefined,
        fetchEveryHours: Number(draft.fetchEveryHours || 72),
        enabled: Boolean(draft.enabled),
      });
      await refresh(tok);
      setDraft({ id: '', name: '', feedUrl: '', siteUrl: '', language: '', region: 'HK', fetchEveryHours: 72, enabled: true });
      setMsg('已新增');
    } catch (e: any) {
      setError(e?.message || '新增失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEnabled(row: any) {
    const tok = resolveAdminToken();
    if (!tok) return;
    const id = String(row?.id || '').trim();
    if (!id) return;
    setBusyId(id);
    setMsg(null);
    setError(null);
    try {
      await updateAdminNewsSource(API_URL, tok, id, { enabled: !(row?.enabled === true) });
      await refresh(tok);
      setMsg('已儲存');
    } catch (e: any) {
      setError(e?.message || '儲存失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function fetchNow(row: any) {
    const tok = resolveAdminToken();
    if (!tok) return;
    const id = String(row?.id || '').trim();
    if (!id) return;
    setBusyId(`fetch:${id}`);
    setMsg(null);
    setError(null);
    try {
      await adminFetchNewsNow(API_URL, tok, id);
      await refresh(tok);
      setMsg('已拉取');
    } catch (e: any) {
      setError(e?.message || '拉取失敗');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: any) {
    const tok = resolveAdminToken();
    if (!tok) return;
    const id = String(row?.id || '').trim();
    if (!id) return;
    setBusyId(`del:${id}`);
    setMsg(null);
    setError(null);
    try {
      await deleteAdminNewsSource(API_URL, tok, id);
      await refresh(tok);
      setMsg('已刪除');
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <div className="min-h-screen brand-page p-6">載入中...</div>;
  }

  if (error) {
    return <div className="min-h-screen brand-page p-6">錯誤：{error}</div>;
  }

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl mx-auto glass rounded-xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-bold accent-yellow">新聞來源（RSS）</div>
            <div className="text-sm cue-muted mt-1">自動更新：每 3 天（fetchEveryHours=72）</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/overview" className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold">
              返回
            </Link>
          </div>
        </div>

        {msg ? <div className="text-sm text-emerald-200">{msg}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-black/40 border border-white/10 rounded p-4 space-y-2">
            <div className="text-sm font-semibold">新增來源</div>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="名稱" className="w-full h-10 rounded px-3 cue-input" />
            <input value={draft.feedUrl} onChange={(e) => setDraft((d) => ({ ...d, feedUrl: e.target.value }))} placeholder="RSS URL" className="w-full h-10 rounded px-3 cue-input" />
            <input value={draft.siteUrl} onChange={(e) => setDraft((d) => ({ ...d, siteUrl: e.target.value }))} placeholder="網站（可選）" className="w-full h-10 rounded px-3 cue-input" />
            <div className="grid grid-cols-2 gap-2">
              <input value={draft.language} onChange={(e) => setDraft((d) => ({ ...d, language: e.target.value }))} placeholder="語言（可選）" className="w-full h-10 rounded px-3 cue-input" />
              <input value={draft.region} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} placeholder="地區（可選）" className="w-full h-10 rounded px-3 cue-input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={String(draft.fetchEveryHours)}
                onChange={(e) => setDraft((d) => ({ ...d, fetchEveryHours: Number(e.target.value || 72) }))}
                placeholder="更新小時"
                className="w-full h-10 rounded px-3 cue-input"
                inputMode="numeric"
              />
              <label className="h-10 flex items-center gap-2 px-3 rounded cue-surface-strong text-sm">
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))} />
                啟用
              </label>
            </div>
            <button
              type="button"
              className="w-full h-10 rounded cue-button font-extrabold"
              onClick={saveNew}
              disabled={busyId === 'new'}
            >
              {busyId === 'new' ? '儲存中…' : '新增'}
            </button>
          </div>

          <div className="bg-black/40 border border-white/10 rounded p-4 space-y-2">
            <div className="text-sm font-semibold">搜尋</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名稱 / URL" className="w-full h-10 rounded px-3 cue-input" />
            <div className="text-xs cue-muted">共 {filtered.length} 個來源</div>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((row: any) => (
            <div key={String(row.id)} className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="font-extrabold cue-zh-title break-words">{String(row.name || row.id)}</div>
                  <div className="mt-1 text-xs cue-muted break-words">{String(row.feedUrl || '')}</div>
                  {row.siteUrl ? <div className="mt-1 text-xs cue-muted break-words">{String(row.siteUrl)}</div> : null}
                  <div className="mt-1 text-xs cue-muted">
                    更新小時：{Number(row.fetchEveryHours || 72)}　最後拉取：{row.lastFetchedAt ? String(row.lastFetchedAt) : '—'}
                  </div>
                  {row.lastError ? <div className="mt-1 text-xs text-amber-200 break-words">上次錯誤：{String(row.lastError)}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => toggleEnabled(row)}
                    disabled={busyId === String(row.id)}
                  >
                    {row.enabled ? '停用' : '啟用'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => fetchNow(row)}
                    disabled={busyId === `fetch:${String(row.id)}`}
                  >
                    {busyId === `fetch:${String(row.id)}` ? '拉取中…' : '立即拉取'}
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded bg-red-600/70 hover:brightness-95 text-sm font-semibold"
                    onClick={() => remove(row)}
                    disabled={busyId === `del:${String(row.id)}`}
                  >
                    刪除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminNewsSources;

