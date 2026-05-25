import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, SOCKET_URL, SOCKET_PATH } from './config';
import { listMembers, updateMember } from './lib/api';

const AdminVenues: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, any>>({});

  const venueMembers = useMemo(() => {
    return (members || []).filter((m) => String(m.role || 'MEMBER') === 'ADMIN');
  }, [members]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token') || '';
        const tokenSaved = localStorage.getItem('adminToken') || '';
        const token = tokenFromUrl || tokenSaved;
        if (tokenFromUrl) localStorage.setItem('adminToken', tokenFromUrl);
        if (!token) throw new Error('缺少系統管理員密鑰');
        const res = await listMembers(API_URL, token);
        if (mounted) setMembers(res.members || []);
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function startEdit(m: any) {
    setEditing((prev) => ({ ...prev, [m.id]: { ...m } }));
  }
  function cancelEdit(id: any) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
  async function saveEdit(id: any) {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = localStorage.getItem('adminToken') || '';
    const adminToken = tokenFromUrl || tokenSaved;
    if (!adminToken) { setError('缺少管理員密鑰'); return; }
    const e = editing[id];
    if (!e) return;
    const payload = {
      is_enabled: e.is_enabled,
      accessExpiresAt: e.access_expires_at || e.accessExpiresAt,
    };
    await updateMember(API_URL, adminToken, id, payload);
    try {
      const res = await listMembers(API_URL, adminToken);
      setMembers(res.members || []);
    } catch {}
    cancelEdit(id);
  }

  return (
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="accent-yellow text-2xl font-bold">管理員：場館限期</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/members"
              className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              返回會員列表
            </Link>
            <button
              onClick={() => {
                const tok = localStorage.getItem('adminToken') || '';
                const url = `${window.location.origin}/admin?apiUrl=${encodeURIComponent(API_URL)}&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}${tok ? `&token=${encodeURIComponent(tok)}` : ''}&v=admin`;
                window.location.href = url;
              }}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Admin Panel
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-black/5">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                {error ? (
                  <span className="text-red-600">後端連線異常</span>
                ) : (
                  <span className="text-emerald-700">後端連線正常</span>
                )}
              </div>
              <div className="text-sm text-slate-600">
                場館用戶：<span className="font-semibold text-slate-900">{venueMembers.length}</span> 位
              </div>
            </div>
          </div>

          <div className="px-4 py-4">
            {loading && <div className="text-sm text-slate-600">載入中...</div>}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

            {!loading && (
              <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: '70vh' }}>
                <table className="min-w-[1100px] w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">ID</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">名稱</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">啟用</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">使用限期</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">建立時間</th>
                      <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venueMembers.map((m) => {
                      const isEditing = Boolean(editing[m.id]);
                      const row = editing[m.id] || m;
                      return (
                        <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border-b border-slate-100 px-3 py-2 align-top font-mono text-xs text-slate-600">
                            <span title={String(m.id)} className="block max-w-[260px] truncate">{m.id}</span>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            <span className="block max-w-[220px] truncate" title={String(m.name || '')}>{m.name || '-'}</span>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            <span className="block max-w-[320px] truncate" title={String(m.email || '')}>{m.email || '-'}</span>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {isEditing ? (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={Boolean(row.is_enabled)}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), is_enabled: e.target.checked } }))}
                                />
                                <span>{Boolean(row.is_enabled) ? '啟用' : '停用'}</span>
                              </label>
                            ) : (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${m.is_enabled === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {m.is_enabled === false ? '停用' : '啟用'}
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {isEditing ? (
                              <input
                                type="date"
                                value={
                                  row.accessExpiresAt ||
                                  row.access_expires_at ||
                                  (m.access_expires_at ? new Date(m.access_expires_at).toISOString().slice(0, 10) : '')
                                }
                                onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), accessExpiresAt: e.target.value } }))}
                                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <span className="whitespace-nowrap">{m.access_expires_at ? new Date(m.access_expires_at).toLocaleDateString() : '-'}</span>
                            )}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
                            <span className="whitespace-nowrap">{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</span>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-2 align-top">
                            {!isEditing ? (
                              <button
                                onClick={() => startEdit(m)}
                                className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                              >
                                編輯
                              </button>
                            ) : (
                              <div className="flex flex-wrap gap-2 whitespace-nowrap">
                                <button
                                  onClick={() => saveEdit(m.id)}
                                  className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                                >
                                  儲存
                                </button>
                                <button
                                  onClick={() => cancelEdit(m.id)}
                                  className="rounded-md bg-slate-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                                >
                                  取消
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVenues;

