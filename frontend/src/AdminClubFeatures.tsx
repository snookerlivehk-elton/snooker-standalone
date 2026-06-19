import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { getAdminClubFeatureAssignments, updateAdminClubFeatureAssignment } from './lib/api';

type FeatureKey = 'booking' | 'qr_session' | 'points' | 'tournaments';

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

function resolveFeatureKey(): FeatureKey {
  try {
    const params = new URLSearchParams(window.location.search);
    const k = String(params.get('feature') || '').trim();
    if (k === 'booking') return 'booking';
    if (k === 'qr_session') return 'qr_session';
    if (k === 'points') return 'points';
    if (k === 'tournaments') return 'tournaments';
    const saved = String(localStorage.getItem('adminClubFeatureKey') || '').trim();
    if (saved === 'booking') return 'booking';
    if (saved === 'qr_session') return 'qr_session';
    if (saved === 'points') return 'points';
    if (saved === 'tournaments') return 'tournaments';
    return 'points';
  } catch {
    return 'points';
  }
}

const AdminClubFeatures: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureKey, setFeatureKey] = useState<FeatureKey>(() => resolveFeatureKey());
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [clubs, setClubs] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [busyClubId, setBusyClubId] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  async function refresh(tok: string, fk: FeatureKey) {
    const data = await getAdminClubFeatureAssignments(API_URL, tok, fk);
    setGlobalEnabled(data.globalEnabled !== false);
    setClubs(Array.isArray(data.clubs) ? data.clubs : []);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const tok = resolveAdminToken();
        if (!tok) throw new Error('缺少系統管理員密鑰');
        await refresh(tok, featureKey);
      } catch (err: any) {
        if (mounted) setError(err?.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [featureKey]);

  function updateFeatureKey(next: FeatureKey) {
    setFeatureKey(next);
    try {
      localStorage.setItem('adminClubFeatureKey', next);
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('feature', next);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return clubs;
    return clubs.filter((c: any) => {
      const clubName = String(c?.clubName || '').toLowerCase();
      const adminName = String(c?.adminName || '').toLowerCase();
      const adminEmail = String(c?.adminEmail || '').toLowerCase();
      return clubName.includes(s) || adminName.includes(s) || adminEmail.includes(s);
    });
  }, [clubs, q]);

  async function toggleClub(c: any) {
    const tok = resolveAdminToken();
    if (!tok) {
      setError('缺少管理員密鑰');
      return;
    }
    const clubId = String(c?.clubId || '').trim();
    if (!clubId) return;
    const nextEnabled = !(c?.assignedEnabled === true);
    setResultMsg(null);
    setBusyClubId(clubId);
    try {
      await updateAdminClubFeatureAssignment(API_URL, tok, featureKey, clubId, nextEnabled);
      await refresh(tok, featureKey);
      setResultMsg('已儲存');
    } catch (err: any) {
      setError(err?.message || '儲存失敗');
    } finally {
      setBusyClubId(null);
    }
  }

  const title = featureKey === 'booking'
    ? '訂台預約（booking）'
    : featureKey === 'qr_session'
      ? '掃碼起鐘及結算（qr_session）'
      : featureKey === 'points'
        ? '消費積分（points）'
        : featureKey === 'tournaments'
          ? '賽事報名（tournaments）'
          : featureKey;

  return (
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="accent-yellow text-2xl font-bold">管理員：場館功能授權</h2>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/overview"
              className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              返回系統管理
            </Link>
            <Link
              to="/admin/venues"
              className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              場館限期
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-black/5">
          <div className="border-b border-slate-200 px-4 py-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                {error ? (
                  <span className="text-red-600">後端連線異常</span>
                ) : (
                  <span className="text-emerald-700">後端連線正常</span>
                )}
              </div>
              <div className="text-sm text-slate-600">
                {resultMsg ? <span className="text-emerald-700">{resultMsg}</span> : null}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <div className="text-xs font-semibold text-slate-600 mb-1">功能</div>
                <select
                  value={featureKey}
                  onChange={(e) => updateFeatureKey(e.target.value as FeatureKey)}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="booking">訂台預約（booking）</option>
                  <option value="qr_session">掃碼起鐘（qr_session）</option>
                  <option value="points">消費積分（points）</option>
                  <option value="tournaments">賽事報名（tournaments）</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold text-slate-600 mb-1">搜尋場館/管理員</div>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="輸入 場館名 / 管理員名 / email"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            {!globalEnabled ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                全站 `{featureKey}` 目前為關閉狀態，以下場館授權會先保存，待全站重新開啟後才會生效。
              </div>
            ) : null}
          </div>

          <div className="px-4 py-4">
            {loading && <div className="text-sm text-slate-600">載入中...</div>}
            {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

            {!loading && (
              <>
                <div className="text-sm text-slate-700 mb-3">
                  目前功能：<span className="font-semibold">{title}</span>，顯示：{filtered.length} / 總共：{clubs.length} 個場館
                </div>
                <div className="overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: '70vh' }}>
                  <table className="min-w-[1100px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">場館</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">管理員</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">授權</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">來源</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c: any) => {
                        const clubId = String(c?.clubId || '');
                        const assigned = c?.assignedEnabled === true;
                        const canToggle = !busyClubId || busyClubId === clubId;
                        return (
                          <tr key={clubId} className="odd:bg-white even:bg-slate-50">
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <div className="font-semibold">{c?.clubName || '-'}</div>
                              <div className="font-mono text-xs text-slate-500">{clubId}</div>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <div className="text-slate-900">{c?.adminName || '-'}</div>
                              <div className="text-xs text-slate-500">{c?.adminEmail || '-'}</div>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${assigned ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                {assigned ? '已授權' : '未授權'}
                              </span>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top text-xs text-slate-600">
                              {c?.source === 'legacy' ? '沿用舊資料' : c?.source === 'explicit' ? 'Super Admin 指定' : '預設未授權'}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <button
                                type="button"
                                disabled={!canToggle}
                                onClick={() => toggleClub(c)}
                                className={`rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors ${assigned ? 'bg-slate-700 hover:bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'} ${!canToggle ? 'opacity-50' : ''}`}
                              >
                                {busyClubId === clubId ? '儲存中...' : assigned ? '取消授權' : '授權'}
                              </button>
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

export default AdminClubFeatures;
