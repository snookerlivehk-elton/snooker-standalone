import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { listMembers, updateMember, deleteMember } from './lib/api';

const AdminMembers: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [purgeCandidate, setPurgeCandidate] = useState<{ id: string; display: string } | null>(null);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (filterName && !String(m.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterEmail && !String(m.email || '').toLowerCase().includes(filterEmail.toLowerCase())) return false;
      if (filterCode && !String(m.member_code || '').toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterRole && String(m.role || 'MEMBER') !== filterRole) return false;
      return true;
    });
  }, [members, filterName, filterEmail, filterCode, filterRole]);

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

        if (mounted) {
          const membersData = await listMembers(API_URL, token);
          setMembers(membersData.members || []);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function resolveAdminToken(): string {
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('token') || '';
      const tokenSaved = localStorage.getItem('adminToken') || '';
      return tokenFromUrl || tokenSaved;
    } catch {
      return localStorage.getItem('adminToken') || '';
    }
  }

  async function refreshMembers(adminToken: string) {
    const res = await listMembers(API_URL, adminToken);
    setMembers(res.members || []);
  }

  async function purgeDelete(id: string, display: string) {
    const adminToken = resolveAdminToken();
    if (!adminToken) {
      setError('缺少管理員密鑰');
      return;
    }
    const ok = window.confirm(`再次確認：確定要永久刪除「${display}」（連同相關資料）？\n\n此操作不可復原。`);
    if (!ok) return;
    await deleteMember(API_URL, adminToken, id, { purge: true });
    await refreshMembers(adminToken);
    setError(null);
    setConfirmDeleteId(null);
    setPurgeCandidate(null);
  }

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
    const e = editing[id];
    if (!e) return;
    const payload = {
      name: e.name,
      email: e.email,
      member_code: e.member_code,
      phone: e.phone,
      birthDate: e.birthDate,
      role: e.role,
      is_enabled: e.is_enabled,
      accessExpiresAt: e.access_expires_at || e.accessExpiresAt,
    };
    if (!adminToken) { setError('缺少管理員密鑰'); return; }
    await updateMember(API_URL, adminToken, id, payload);
    try {
      const res = await listMembers(API_URL, adminToken);
      setMembers(res.members || []);
    } catch {}
    cancelEdit(id);
  }
  async function removeMember(m: any) {
    const id = m.id;
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = localStorage.getItem('adminToken') || '';
    const adminToken = tokenFromUrl || tokenSaved;
    try {
      if (!adminToken) { setError('缺少管理員密鑰'); return; }
      if (confirmDeleteId !== id) {
        setConfirmDeleteId(id);
        return;
      }
      const label = String(m.member_code || '').trim();
      const name = String(m.name || '').trim();
      const display = name || label || id;
      const isClub = String(m.role || '').toUpperCase() === 'ADMIN';
      const ok = window.confirm(
        isClub
          ? `再次確認：確定要永久刪除場館戶口「${display}」？\n\n此操作會一併永久刪除與該場館/帳戶相關的資料（例如：場館資料、桌、預約、訊息、單杆、積分、比賽/房間等）。\n\n此操作不可復原。`
          : `再次確認：確定要永久刪除會員「${display}」？此操作不可復原。`
      );
      if (!ok) return;
      setPurgeCandidate(null);
      await deleteMember(API_URL, adminToken, id, { purge: String(m.role || '').toUpperCase() === 'ADMIN' });
      try {
        const res = await listMembers(API_URL, adminToken);
        setMembers(res.members || []);
      } catch {}
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error('Failed to delete member', err);
      const msg = String(err?.message || '刪除會員失敗');
      const suggestsPurge = msg.includes('purge=1') || msg.includes('永久刪除');
      if (suggestsPurge) {
        const label = String(m.member_code || '').trim();
        const name = String(m.name || '').trim();
        const display = name || label || id;
        setPurgeCandidate({ id: String(id), display });
        const ok = window.confirm(
          `此帳戶已有關聯資料。\n\n是否改用「永久刪除（連同相關資料）」方式刪除「${display}」？\n\n此操作不可復原。`
        );
        if (ok) {
          try {
            await deleteMember(API_URL, adminToken, id, { purge: true });
            try {
              const res = await listMembers(API_URL, adminToken);
              setMembers(res.members || []);
            } catch {}
            setConfirmDeleteId(null);
            setError(null);
            setPurgeCandidate(null);
            return;
          } catch (e2: any) {
            const msg2 = String(e2?.message || '刪除會員失敗');
            setError(msg2);
            setConfirmDeleteId(null);
            return;
          }
        }
      }
      setError(msg);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="accent-yellow text-2xl font-bold">管理員：會員列表</h2>
            <div className="text-sm text-slate-300 mt-1">此列表現已顯示會員的地方與分區資料，可配合首頁龍虎榜與場館列表的分區統計使用。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/members/register"
              className="rounded-md bg-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              會員註冊
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
                目前符合條件：<span className="font-semibold text-slate-900">{filteredMembers.length}</span> / 總共：{members.length} 位
              </div>
            </div>
          </div>

          <div className="px-4 py-4">
            {loading && <div className="text-sm text-slate-600">載入中...</div>}
            {error && (
              <div className="mt-2 space-y-2">
                <div className="text-sm text-red-600">{error}</div>
                {purgeCandidate && (String(error || '').includes('purge=1') || String(error || '').includes('永久刪除')) && (
                  <button
                    type="button"
                    className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                    onClick={() => purgeDelete(purgeCandidate.id, purgeCandidate.display)}
                  >
                    以「永久刪除（含資料）」再試一次
                  </button>
                )}
              </div>
            )}

            {!loading && (
              <>
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <input
                      placeholder="姓名"
                      value={filterName}
                      onChange={e => setFilterName(e.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <input
                      placeholder="Email"
                      value={filterEmail}
                      onChange={e => setFilterEmail(e.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />

                    <input
                      placeholder="會員編碼"
                      value={filterCode}
                      onChange={e => setFilterCode(e.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />

                    <div className="flex gap-2">
                      <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      >
                        <option value="">全部等級</option>
                        <option value="MEMBER">普通會員</option>
                        <option value="ADMIN">場館/球會</option>
                      </select>
                      <button
                        onClick={() => {
                          setFilterName('');
                          setFilterEmail('');
                          setFilterCode('');
                          setFilterRole('');
                        }}
                        className="h-10 shrink-0 rounded-md bg-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:hidden">
                  {filteredMembers.map((m) => {
                    const isEditing = Boolean(editing[m.id]);
                    const row = editing[m.id] || m;
                    const roleLabel = (row.role || m.role) === 'ADMIN' ? '場館/球會' : '普通會員';
                    const enabledLabel = Boolean(row.is_enabled) ? '啟用' : '停用';
                    const enabledCls = Boolean(row.is_enabled) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
                    const accessDate = row.accessExpiresAt || row.access_expires_at || (m.access_expires_at ? new Date(m.access_expires_at).toISOString().slice(0, 10) : '');
                    return (
                      <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-3 text-slate-900">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{String(m.name || '-')}</div>
                            <div className="text-xs text-slate-500 truncate">{String(m.email || '-')}</div>
                          </div>
                          <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${enabledCls}`}>{enabledLabel}</div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">會員編碼</div>
                            {isEditing ? (
                              <input
                                value={row.member_code || ''}
                                onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), member_code: e.target.value } }))}
                                className="h-9 w-[60%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold">{String(m.member_code || '-')}</div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">會員等級</div>
                            {isEditing ? (
                              <select
                                value={row.role || m.role || 'MEMBER'}
                                onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), role: e.target.value } }))}
                                className="h-9 w-[60%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              >
                                <option value="MEMBER">普通會員</option>
                                <option value="ADMIN">場館/球會</option>
                              </select>
                            ) : (
                              <div className="font-semibold">{roleLabel}</div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">電話</div>
                            {isEditing ? (
                              <input
                                value={row.phone || ''}
                                onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), phone: e.target.value } }))}
                                className="h-9 w-[60%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold">{String(m.phone ?? '-')}</div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">場館限期</div>
                            {isEditing ? (
                              <input
                                type="date"
                                disabled={String(row.role || m.role || 'MEMBER') !== 'ADMIN'}
                                value={accessDate}
                                onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), accessExpiresAt: e.target.value } }))}
                                className="h-9 w-[60%] rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:opacity-60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              />
                            ) : (
                              <div className="font-semibold">
                                {m.role === 'ADMIN' && m.access_expires_at ? new Date(m.access_expires_at).toLocaleDateString() : '-'}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-slate-500">啟用</div>
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
                              <div className="font-semibold">{m.is_enabled === false ? '停用' : '啟用'}</div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {!isEditing ? (
                            <>
                              <button
                                onClick={() => startEdit(m)}
                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                              >
                                編輯
                              </button>
                              <button
                                onClick={() => removeMember(m)}
                                className={`${confirmDeleteId === m.id ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'} rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors`}
                              >
                                {confirmDeleteId === m.id ? '再次確認刪除' : '刪除'}
                              </button>
                            </>
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

                        <div className="mt-2 text-xs text-slate-500 font-mono break-all">{String(m.id)}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 hidden md:block overflow-auto rounded-lg border border-slate-200" style={{ maxHeight: '70vh' }}>
                  <table className="min-w-[1280px] w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">ID</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">姓名</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">Email</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">會員編碼</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">會員等級</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">啟用</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">場館限期</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">電話</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">地方</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">分區</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">出生日期</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">建立時間</th>
                        <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m) => {
                        const isEditing = Boolean(editing[m.id]);
                        const row = editing[m.id] || m;
                        return (
                          <tr key={m.id} className="odd:bg-white even:bg-slate-50">
                            <td className="border-b border-slate-100 px-3 py-2 align-top font-mono text-xs text-slate-600">
                              <span title={String(m.id)} className="block max-w-[240px] truncate">{m.id}</span>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <input
                                  value={row.name || ''}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), name: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              ) : (
                                <span className="block max-w-[200px] truncate" title={String(m.name || '')}>{m.name || '-'}</span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <input
                                  value={row.email || ''}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), email: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              ) : (
                                <span className="block max-w-[280px] truncate" title={String(m.email || '')}>{m.email || '-'}</span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <input
                                  value={row.member_code || ''}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), member_code: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              ) : (
                                <span className="block max-w-[160px] truncate" title={String(m.member_code || '')}>{m.member_code || '-'}</span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <select
                                  value={row.role || m.role || 'MEMBER'}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), role: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                  <option value="MEMBER">普通會員</option>
                                  <option value="ADMIN">場館/球會</option>
                                </select>
                              ) : (
                                <span className="whitespace-nowrap">{m.role === 'ADMIN' ? '場館/球會' : '普通會員'}</span>
                              )}
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
                                  disabled={String(row.role || m.role || 'MEMBER') !== 'ADMIN'}
                                  value={
                                    row.accessExpiresAt ||
                                    row.access_expires_at ||
                                    (m.access_expires_at ? new Date(m.access_expires_at).toISOString().slice(0, 10) : '')
                                  }
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), accessExpiresAt: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 disabled:opacity-60 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              ) : (
                                <span className="whitespace-nowrap">
                                  {m.role === 'ADMIN' && m.access_expires_at ? new Date(m.access_expires_at).toLocaleDateString() : '-'}
                                </span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <input
                                  value={row.phone || ''}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), phone: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              ) : (
                                <span className="block max-w-[160px] truncate" title={String(m.phone ?? '')}>{m.phone ?? '-'}</span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <span className="whitespace-nowrap">{String(m.region_code ?? m.regionCode ?? '-') || '-'}</span>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              <span className="whitespace-nowrap">{String(m.district_code ?? m.districtCode ?? '-') || '-'}</span>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {isEditing ? (
                                <input
                                  value={row.birthDate || ''}
                                  onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), birthDate: e.target.value } }))}
                                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                />
                              ) : (
                                <span className="whitespace-nowrap">{m.birthDate ?? m.birth_date ?? '-'}</span>
                              )}
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
                              <span className="whitespace-nowrap">{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</span>
                            </td>
                            <td className="border-b border-slate-100 px-3 py-2 align-top">
                              {!isEditing ? (
                                <div className="flex flex-wrap gap-2 whitespace-nowrap">
                                  <button
                                    onClick={() => startEdit(m)}
                                    className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                                  >
                                    編輯
                                  </button>
                                  <button
                                    onClick={() => removeMember(m)}
                                    className={`${confirmDeleteId === m.id ? 'bg-red-700 hover:bg-red-800' : 'bg-red-600 hover:bg-red-700'} rounded-md px-2.5 py-1.5 text-xs font-semibold text-white transition-colors`}
                                  >
                                    {confirmDeleteId === m.id ? '再次確認刪除' : '刪除'}
                                  </button>
                                </div>
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

export default AdminMembers;
