import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import {
  getAdminClubFeatureAssignments,
  listMembers,
  updateAdminClubFeatureAssignment,
  updateMember,
} from './lib/api';

function getAdminToken() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get('token') || '';
  const tokenSaved = localStorage.getItem('adminToken') || '';
  const token = tokenFromUrl || tokenSaved;
  if (tokenFromUrl) localStorage.setItem('adminToken', tokenFromUrl);
  return token;
}

const AdminVenues: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [pointsByAdminId, setPointsByAdminId] = useState<Record<string, any>>({});
  const [pointsGlobalEnabled, setPointsGlobalEnabled] = useState(true);

  const venueMembers = useMemo(() => {
    return (members || [])
      .filter((m) => String(m.role || 'MEMBER') === 'ADMIN')
      .map((m) => ({ ...m, clubFeature: pointsByAdminId[m.id] || null }));
  }, [members, pointsByAdminId]);

  async function loadAll(adminToken: string) {
    const [membersRes, pointsRes] = await Promise.all([
      listMembers(API_URL, adminToken),
      getAdminClubFeatureAssignments(API_URL, adminToken, 'points'),
    ]);
    setMembers(membersRes.members || []);
    setPointsGlobalEnabled(pointsRes.globalEnabled !== false);
    const next: Record<string, any> = {};
    for (const row of Array.isArray(pointsRes.clubs) ? pointsRes.clubs : []) {
      const adminMemberId = String((row as any)?.adminMemberId || '').trim();
      if (adminMemberId) next[adminMemberId] = row;
    }
    setPointsByAdminId(next);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const token = getAdminToken();
        if (!token) throw new Error('缺少系統管理員密鑰');
        await loadAll(token);
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function startEdit(m: any) {
    const feature = pointsByAdminId[m.id] || null;
    setEditing((prev) => ({
      ...prev,
      [m.id]: {
        ...m,
        clubId: feature?.clubId || '',
        pointsAssignedEnabled: Boolean(feature?.assignedEnabled),
      },
    }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveEdit(id: string) {
    const adminToken = getAdminToken();
    if (!adminToken) {
      setError('缺少管理員密鑰');
      return;
    }
    const e = editing[id];
    if (!e) return;
    const currentFeature = pointsByAdminId[id] || null;
    const payload = {
      is_enabled: e.is_enabled,
      accessExpiresAt: e.access_expires_at || e.accessExpiresAt,
    };
    try {
      await updateMember(API_URL, adminToken, id, payload);
      if (e.clubId && Boolean(e.pointsAssignedEnabled) !== Boolean(currentFeature?.assignedEnabled)) {
        await updateAdminClubFeatureAssignment(API_URL, adminToken, 'points', String(e.clubId), Boolean(e.pointsAssignedEnabled));
      }
      await loadAll(adminToken);
      cancelEdit(id);
    } catch (err: any) {
      setError(err.message || '儲存失敗');
    }
  }

  return (
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="accent-yellow text-2xl font-bold">管理員：場館限期 / 積分授權</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/members"
              className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              返回會員列表
            </Link>
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
            {!pointsGlobalEnabled ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                全站 `points` 目前為關閉狀態，以下場館授權會先保存，待全站重新開啟後才會生效。
              </div>
            ) : null}
          </div>

          <div className="px-4 py-4">
            {loading && <div className="text-sm text-slate-600">載入中...</div>}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

            {!loading && (
              <>
                <div className="grid gap-3 md:hidden">
                  {venueMembers.map((m) => {
                    const isEditing = Boolean(editing[m.id]);
                    const row = editing[m.id] || m;
                    const feature = m.clubFeature || null;
                    const enabled = row.is_enabled !== false;
                    const enabledCls = enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
                    const pointsAssigned = isEditing ? row.pointsAssignedEnabled === true : feature?.assignedEnabled === true;
                    const pointsCls = pointsAssigned ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600';
                    const accessDate =
                      row.accessExpiresAt ||
                      row.access_expires_at ||
                      (m.access_expires_at ? new Date(m.access_expires_at).toISOString().slice(0, 10) : '');
                    return (
                      <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-3 text-slate-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{String(feature?.clubName || m.name || '-')}</div>
                            <div className="text-xs text-slate-500 truncate">{String(m.email || '-')}</div>
                          </div>
                          <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${enabledCls}`}>{enabled ? '啟用' : '停用'}</div>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">使用限期</div>
                            {isEditing ? (
                              <input
                                type="date"
                                value={accessDate}
                                onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), accessExpiresAt: e.target.value } }))}
                                className="h-9 w-[60%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold">{m.access_expires_at ? new Date(m.access_expires_at).toLocaleDateString() : '-'}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">啟用</div>
                            {isEditing ? (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), is_enabled: e.target.checked } }))}
                                />
                                <span>{enabled ? '啟用' : '停用'}</span>
                              </label>
                            ) : (
                              <div className="font-semibold">{m.is_enabled === false ? '停用' : '啟用'}</div>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">積分授權</div>
                            {isEditing ? (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={pointsAssigned}
                                  disabled={!row.clubId}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), pointsAssignedEnabled: e.target.checked } }))}
                                />
                                <span>{pointsAssigned ? '已授權' : '未授權'}</span>
                              </label>
                            ) : (
                              <div className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pointsCls}`}>
                                {pointsAssigned ? '已授權' : '未授權'}
                              </div>
                            )}
                          </div>
                          {!isEditing && feature?.source ? (
                            <div className="text-xs text-slate-500">
                              狀態來源：{feature.source === 'legacy' ? '沿用舊積分資料' : feature.source === 'explicit' ? 'Super Admin 指定' : '預設未授權'}
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-3 flex gap-2">
                          {!isEditing ? (
                            <button
                              onClick={() => startEdit(m)}
                              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                            >
                              編輯
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => saveEdit(m.id)}
                                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                              >
                                儲存
                              </button>
                              <button
                                onClick={() => cancelEdit(m.id)}
                                className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
                              >
                                取消
                              </button>
                            </>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-slate-500 font-mono break-all">{String(feature?.clubId || m.id)}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: '70vh' }}>
                  <table className="min-w-[1320px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">場館 / ID</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">管理員</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">啟用</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">積分授權</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">使用限期</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">建立時間</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venueMembers.map((m) => {
                        const isEditing = Boolean(editing[m.id]);
                        const row = editing[m.id] || m;
                        const feature = m.clubFeature || null;
                        const enabled = row.is_enabled !== false;
                        const pointsAssigned = row.pointsAssignedEnabled === true;
                        return (
                          <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <div className="font-semibold">{feature?.clubName || m.name || '-'}</div>
                              <div className="font-mono text-xs text-slate-500">{feature?.clubId || '-'}</div>
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
                                    checked={enabled}
                                    onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), is_enabled: e.target.checked } }))}
                                  />
                                  <span>{enabled ? '啟用' : '停用'}</span>
                                </label>
                              ) : (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${m.is_enabled === false ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {m.is_enabled === false ? '停用' : '啟用'}
                                </span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={pointsAssigned}
                                    disabled={!row.clubId}
                                    onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), pointsAssignedEnabled: e.target.checked } }))}
                                  />
                                  <span>{pointsAssigned ? '已授權' : '未授權'}</span>
                                </label>
                              ) : (
                                <div className="space-y-1">
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${feature?.assignedEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                    {feature?.assignedEnabled ? '已授權' : '未授權'}
                                  </span>
                                  <div className="text-xs text-slate-500">
                                    {feature?.source === 'legacy' ? '沿用舊積分資料' : feature?.source === 'explicit' ? 'Super Admin 指定' : '預設未授權'}
                                  </div>
                                </div>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminVenues;
