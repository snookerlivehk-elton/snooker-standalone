import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL } from './config';
import { deleteAdminBreak, listAdminBreaks, patchAdminBreak } from './lib/api';

function normalizeHttpUrl(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

function defaultMonthLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

const AdminBreaks: React.FC = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [month, setMonth] = useState(defaultMonthLocal());
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [clubId, setClubId] = useState('');

  const [editing, setEditing] = useState<Record<string, any>>({});

  const resolveBasePath = useCallback((): string => {
    const rawBase = (import.meta.env.BASE_URL || '/');
    let base = rawBase.replace(/\/+$/, '');
    try {
      const p = window.location.pathname;
      const m = p.match(/^(.*)\/admin(?:\/.*)?$/);
      if (m && m[1] !== '') base = m[1];
    } catch {}
    return base;
  }, []);

  const resolveAdminToken = useCallback((): string => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = typeof window !== 'undefined' ? (localStorage.getItem('adminToken') || '') : '';
    const token = tokenFromUrl || tokenSaved;
    if (tokenFromUrl && typeof window !== 'undefined') localStorage.setItem('adminToken', tokenFromUrl);
    return token;
  }, []);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const load = useCallback(
    async (pageToLoad: number) => {
      setError(null);
      setLoading(true);
      try {
        const tok = resolveAdminToken();
        if (!tok) throw new Error('缺少系統管理員密鑰');
        const data = await listAdminBreaks(API_URL, tok, {
          page: pageToLoad,
          pageSize,
          month: month.trim() || undefined,
          q: q.trim() || undefined,
          includeDeleted,
          memberId: memberId.trim() || undefined,
          clubId: clubId.trim() || undefined,
        });
        setRows(Array.isArray(data.breaks) ? data.breaks : []);
        setTotal(Number(data.total || 0));
        setPage(Number(data.page || pageToLoad));
        setEditing({});
      } catch (e: any) {
        setError(e?.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    },
    [clubId, includeDeleted, memberId, month, pageSize, q, resolveAdminToken]
  );

  useEffect(() => {
    load(1);
  }, []);

  function startEdit(r: any) {
    setEditing((p) => ({
      ...p,
      [r.id]: {
        id: r.id,
        points: r.points,
        recordedAt: r.recorded_at ? String(r.recorded_at).slice(0, 19) : '',
        videoUrl: r.video_url || '',
        note: r.note || '',
      },
    }));
  }

  function cancelEdit(id: string) {
    setEditing((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  }

  async function saveEdit(id: string) {
    const tok = resolveAdminToken();
    if (!tok) {
      setError('缺少系統管理員密鑰');
      return;
    }
    const e = editing[id];
    if (!e) return;
    const points = Number(e.points);
    if (!Number.isFinite(points) || points <= 0) {
      setError('points 無效');
      return;
    }
    const recordedAt = e.recordedAt ? new Date(e.recordedAt).toISOString() : undefined;
    try {
      await patchAdminBreak(API_URL, tok, id, {
        points,
        recordedAt,
        videoUrl: e.videoUrl ? String(e.videoUrl).trim() : null,
        note: e.note ? String(e.note).trim() : null,
      });
      await load(page);
    } catch (e2: any) {
      setError(e2?.message || '更新失敗');
    }
  }

  async function restoreBreak(id: string) {
    const tok = resolveAdminToken();
    if (!tok) {
      setError('缺少系統管理員密鑰');
      return;
    }
    try {
      await patchAdminBreak(API_URL, tok, id, { restore: true });
      await load(page);
    } catch (e: any) {
      setError(e?.message || '復原失敗');
    }
  }

  async function removeBreak(r: any) {
    const tok = resolveAdminToken();
    if (!tok) {
      setError('缺少系統管理員密鑰');
      return;
    }
    const label = `${r.member?.name || '會員'} / ${r.club?.name || '場館'} / ${r.points || 0}`;
    const ok = window.confirm(`確定要刪除單杆紀錄？\n${label}\n此操作會標記為刪除（可復原）。`);
    if (!ok) return;
    const reason = window.prompt('刪除原因（可留空）') || '';
    try {
      await deleteAdminBreak(API_URL, tok, r.id, reason || null);
      await load(page);
    } catch (e: any) {
      setError(e?.message || '刪除失敗');
    }
  }

  return (
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="accent-yellow text-2xl font-bold">管理員：單杆紀錄</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const base = resolveBasePath();
                const tok = resolveAdminToken();
                window.location.href = `${window.location.origin}${base}/admin${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
              }}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              返回主PANEL
            </button>
            <button
              type="button"
              onClick={() => {
                const base = resolveBasePath();
                const tok = resolveAdminToken();
                window.location.href = `${window.location.origin}${base}/admin/overview${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
              }}
              className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              系統概覽
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-black/5">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                {error ? <span className="text-red-600">{error}</span> : <span className="text-emerald-700">後端連線正常</span>}
              </div>
              <div className="text-sm text-slate-600">
                目前頁面：<span className="font-semibold text-slate-900">{page}</span> / {totalPages}（共 {total} 筆）
              </div>
            </div>
          </div>

          <div className="px-4 py-4 space-y-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
              <input
                placeholder="關鍵字（會員名/編號/場館名/備註/影片）"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 lg:col-span-2"
              />
              <input
                placeholder="memberId（可選）"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                placeholder="clubId（可選）"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                顯示已刪除
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => load(1)}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                disabled={loading}
              >
                搜尋
              </button>
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setMemberId('');
                  setClubId('');
                  setMonth(defaultMonthLocal());
                  setIncludeDeleted(false);
                  setTimeout(() => load(1), 0);
                }}
                className="rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                disabled={loading}
              >
                清除
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => load(Math.max(1, page - 1))}
                  className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                  disabled={loading || page <= 1}
                >
                  上一頁
                </button>
                <button
                  type="button"
                  onClick={() => load(Math.min(totalPages, page + 1))}
                  className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                  disabled={loading || page >= totalPages}
                >
                  下一頁
                </button>
              </div>
            </div>

            {loading && <div className="text-sm text-slate-600">載入中...</div>}

            {!loading && (
              <>
                <div className="grid gap-3 md:hidden">
                  {rows.map((r) => {
                    const isEditing = Boolean(editing[r.id]);
                    const e = editing[r.id] || {};
                    const deleted = !!r.deleted_at;
                    const href = normalizeHttpUrl(r.video_url);
                    return (
                      <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-slate-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{String(r.club?.name || '-')}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {String(r.member?.name || '-')}
                              {r.member?.member_code ? `（${r.member.member_code}）` : ''}
                            </div>
                          </div>
                          <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${deleted ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {deleted ? '已刪除' : '正常'}
                          </div>
                        </div>

                        <div className="mt-2 grid gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">時間</div>
                            {isEditing ? (
                              <input
                                value={e.recordedAt || ''}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], recordedAt: ev.target.value } }))}
                                className="h-9 w-[65%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                placeholder="YYYY-MM-DDTHH:mm:ss"
                              />
                            ) : (
                              <div className="font-semibold">{r.recorded_at ? new Date(r.recorded_at).toLocaleString() : '-'}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">分數</div>
                            {isEditing ? (
                              <input
                                value={String(e.points ?? '')}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], points: ev.target.value } }))}
                                className="h-9 w-[65%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold">{r.points}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">影片</div>
                            {isEditing ? (
                              <input
                                value={e.videoUrl || ''}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], videoUrl: ev.target.value } }))}
                                className="h-9 w-[65%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : href ? (
                              <a href={href} target="_blank" rel="noreferrer" className="text-indigo-700 underline font-semibold">
                                觀看
                              </a>
                            ) : (
                              <div className="font-semibold">-</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">備註</div>
                            {isEditing ? (
                              <input
                                value={e.note || ''}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], note: ev.target.value } }))}
                                className="h-9 w-[65%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold truncate max-w-[65%]" title={String(r.note || '')}>{r.note || '-'}</div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {!isEditing && (
                            <button
                              type="button"
                              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                              onClick={() => startEdit(r)}
                              disabled={loading}
                            >
                              編輯
                            </button>
                          )}
                          {isEditing && (
                            <>
                              <button
                                type="button"
                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                                onClick={() => saveEdit(r.id)}
                                disabled={loading}
                              >
                                儲存
                              </button>
                              <button
                                type="button"
                                className="rounded-md bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                                onClick={() => cancelEdit(r.id)}
                                disabled={loading}
                              >
                                取消
                              </button>
                            </>
                          )}
                          {!deleted && (
                            <button
                              type="button"
                              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                              onClick={() => removeBreak(r)}
                              disabled={loading}
                            >
                              刪除
                            </button>
                          )}
                          {deleted && (
                            <button
                              type="button"
                              className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                              onClick={() => restoreBreak(r.id)}
                              disabled={loading}
                            >
                              復原
                            </button>
                          )}
                        </div>

                        <div className="mt-2 text-[10px] font-mono text-slate-400 break-all">{String(r.id)}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: '70vh' }}>
                  <table className="min-w-[1400px] w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">時間</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">場館</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">會員</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">分數</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">影片</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">備註</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">狀態</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isEditing = Boolean(editing[r.id]);
                      const e = editing[r.id] || {};
                      const deleted = !!r.deleted_at;
                      return (
                        <tr key={r.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
                            {isEditing ? (
                              <input
                                value={e.recordedAt || ''}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], recordedAt: ev.target.value } }))}
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                placeholder="YYYY-MM-DDTHH:mm:ss"
                              />
                            ) : (
                              <div className="text-xs">{r.recorded_at ? new Date(r.recorded_at).toLocaleString() : '-'}</div>
                            )}
                            <div className="font-mono text-[10px] text-slate-400 max-w-[220px] truncate" title={r.id}>{r.id}</div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            <div className="font-medium max-w-[220px] truncate" title={String(r.club?.name || '')}>
                              {r.club?.name || '-'}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 max-w-[220px] truncate" title={String(r.club_id || '')}>
                              {r.club_id}
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            <div className="font-medium max-w-[220px] truncate" title={String(r.member?.name || '')}>
                              {r.member?.name || '-'}
                            </div>
                            <div className="text-xs text-slate-600">
                              {r.member?.member_code ? `(${r.member.member_code})` : ''}{' '}
                              <span className="font-mono text-[10px] text-slate-400">{r.member_id}</span>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {isEditing ? (
                              <input
                                value={String(e.points ?? '')}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], points: ev.target.value } }))}
                                className="h-9 w-28 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold">{r.points}</div>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {isEditing ? (
                              <input
                                value={e.videoUrl || ''}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], videoUrl: ev.target.value } }))}
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : normalizeHttpUrl(r.video_url) ? (
                              <a href={normalizeHttpUrl(r.video_url) as string} target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                                觀看
                              </a>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {isEditing ? (
                              <input
                                value={e.note || ''}
                                onChange={(ev) => setEditing((p) => ({ ...p, [r.id]: { ...p[r.id], note: ev.target.value } }))}
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="max-w-[360px] truncate" title={String(r.note || '')}>{r.note || '-'}</div>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {deleted ? (
                              <div className="text-xs text-red-700">
                                已刪除
                                <div className="text-[10px] text-slate-500">{r.delete_reason || ''}</div>
                              </div>
                            ) : (
                              <div className="text-xs text-emerald-700">正常</div>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            <div className="flex flex-wrap gap-2">
                              {!isEditing && (
                                <button
                                  type="button"
                                  className="rounded-md bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                                  onClick={() => startEdit(r)}
                                  disabled={loading}
                                >
                                  編輯
                                </button>
                              )}
                              {isEditing && (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                                    onClick={() => saveEdit(r.id)}
                                    disabled={loading}
                                  >
                                    儲存
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                                    onClick={() => cancelEdit(r.id)}
                                    disabled={loading}
                                  >
                                    取消
                                  </button>
                                </>
                              )}
                              {!deleted && (
                                <button
                                  type="button"
                                  className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                                  onClick={() => removeBreak(r)}
                                  disabled={loading}
                                >
                                  刪除
                                </button>
                              )}
                              {deleted && (
                                <button
                                  type="button"
                                  className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                                  onClick={() => restoreBreak(r.id)}
                                  disabled={loading}
                                >
                                  復原
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBreaks;
