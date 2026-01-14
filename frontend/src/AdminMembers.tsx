import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, SOCKET_URL, SOCKET_PATH } from './config';
import { listMembers, updateMember, deleteMember, regenerateMemberCode, resendVerificationEmail } from './lib/api';
import { DISTRICT_TABLE } from './districts';

const AdminMembers: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [codeSearch, setCodeSearch] = useState<string>('');
  const [localMembers, setLocalMembers] = useState<any[]>([]);
  const [editing, setEditing] = useState<Record<string, any>>({});

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
        if (!token) throw new Error('缺少管理員密鑰');
        const data = await listMembers(API_URL, token);
        if (mounted) setMembers(data.members || []);
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const districtIndex = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const source = members || [];
    for (const m of source) {
      const dist = String((m.district_code ?? m.partition ?? '') || '').trim();
      const code = String(m.member_code ?? '').trim();
      if (!dist || !code) continue;
      if (!map[dist]) map[dist] = new Set<string>();
      map[dist].add(code);
    }
    const obj: Record<string, string[]> = {};
    Object.keys(map).forEach((d) => obj[d] = Array.from(map[d]).sort());
    return obj;
  }, [members, localMembers, error]);

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
      district_code: e.district_code,
      member_code: e.member_code,
      phone: e.phone,
      birthDate: e.birthDate,
      role: e.role,
      membershipExpiresAt: e.membership_expires_at || e.membershipExpiresAt,
    };
    if (!adminToken) { setError('缺少管理員密鑰'); return; }
    await updateMember(API_URL, adminToken, id, payload);
    try {
      const res = await listMembers(API_URL, adminToken);
      setMembers(res.members || []);
    } catch {}
    cancelEdit(id);
  }
  async function removeMember(id: any) {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = localStorage.getItem('adminToken') || '';
    const adminToken = tokenFromUrl || tokenSaved;
    try {
      if (!adminToken) { setError('缺少管理員密鑰'); return; }
      const ok = window.confirm('確定要刪除此會員？此操作不可復原。');
      if (!ok) return;
      await deleteMember(API_URL, adminToken, id);
      try {
        const res = await listMembers(API_URL, adminToken);
        setMembers(res.members || []);
      } catch {}
    } catch (err: any) {
      console.error('Failed to delete member', err);
      setError(err?.message || '刪除會員失敗');
    }
  }
  async function regenerateCodeFor(m: any) {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = localStorage.getItem('adminToken') || '';
    const adminToken = tokenFromUrl || tokenSaved;
    const dist = String(editing[m.id]?.district_code ?? m.district_code ?? '').trim();
    const localCode = `${dist || 'X'}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
    if (!error && adminToken) {
      try {
        const res = await regenerateMemberCode(API_URL, adminToken, m.id, dist);
        const code = res?.member_code || localCode;
        setEditing((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || m), member_code: code } }));
        setMembers((prev) => prev.map((row) => (row.id === m.id ? { ...row, member_code: code } : row)));
        return;
      } catch {}
    }
    setEditing((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] || m), member_code: localCode } }));
    setLocalMembers((prev) => prev.map((row) => (row.id === m.id ? { ...row, member_code: localCode } : row)));
  }
  async function resendEmail(m: any) {
    if (!m.email) return;
    try { await resendVerificationEmail(API_URL, String(m.email)); } catch {}
  }

  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2>管理員：會員列表</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/members/register"
            style={{ padding: '6px 10px', borderRadius: 6, background: '#6b7280', color: '#fff', textDecoration: 'none' }}
          >
            會員註冊
          </Link>
          <button
            onClick={() => {
              const tok = localStorage.getItem('adminToken') || '';
              const url = `${window.location.origin}/admin?apiUrl=${encodeURIComponent(API_URL)}&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}${tok ? `&token=${encodeURIComponent(tok)}` : ''}&v=admin`;
              window.location.href = url;
            }}
            style={{ padding: '6px 10px', borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none' }}
          >
            Admin Panel
          </button>
        </div>
      </div>
      {loading && <div>載入中...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {!loading && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#666' }}>
              {error ? '後端連線異常' : '後端連線正常'}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>姓名</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>Email</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>分區</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>會員編碼</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>會員等級</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>電話</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>出生日期</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>有效期</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 8 }}>建立時間</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <>
                  <tr>
                    <td colSpan={10} style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {!editing[m.id] ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startEdit(m)} style={{ padding: '4px 8px', borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none' }}>編輯</button>
                          <button onClick={() => removeMember(m.id)} style={{ padding: '4px 8px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none' }}>刪除</button>
                          <button onClick={() => regenerateCodeFor(m)} style={{ padding: '4px 8px', borderRadius: 6, background: '#9333ea', color: '#fff', border: 'none' }}>重生編碼</button>
                          <button onClick={() => resendEmail(m)} style={{ padding: '4px 8px', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none' }} disabled={!m.email}>重寄驗證信</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => saveEdit(m.id)} style={{ padding: '4px 8px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none' }}>儲存</button>
                          <button onClick={() => cancelEdit(m.id)} style={{ padding: '4px 8px', borderRadius: 6, background: '#6b7280', color: '#fff', border: 'none' }}>取消</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  <tr key={m.id}>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.id}</td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input value={editing[m.id].name || ''} onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), name: e.target.value } }))} style={{ width: '100%' }} />
                      ) : (m.name)}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input value={editing[m.id].email || ''} onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), email: e.target.value } }))} style={{ width: '100%' }} />
                      ) : (m.email || '-')}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input value={editing[m.id].district_code || ''} onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), district_code: e.target.value } }))} style={{ width: '100%' }} />
                      ) : (m.district_code ?? m.partition ?? '-')}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input value={editing[m.id].member_code || ''} onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), member_code: e.target.value } }))} style={{ width: '100%' }} />
                      ) : (m.member_code || '-')}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <select
                          value={editing[m.id].role || m.role || 'MEMBER'}
                          onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), role: e.target.value } }))}
                          style={{ width: '100%' }}
                        >
                          <option value="MEMBER">普通會員</option>
                          <option value="ADMIN">管理者</option>
                        </select>
                      ) : (
                        (m.role === 'ADMIN' ? '管理者' : '普通會員')
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input value={editing[m.id].phone || ''} onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), phone: e.target.value } }))} style={{ width: '100%' }} />
                      ) : (m.phone ?? '-')}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input value={editing[m.id].birthDate || ''} onChange={(e) => setEditing((p) => ({ ...p, [m.id]: { ...(p[m.id] || m), birthDate: e.target.value } }))} style={{ width: '100%' }} />
                      ) : (m.birthDate ?? m.birth_date ?? '-')}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {editing[m.id] ? (
                        <input
                          type="date"
                          value={
                            editing[m.id].membershipExpiresAt ||
                            editing[m.id].membership_expires_at ||
                            (m.membership_expires_at
                              ? new Date(m.membership_expires_at).toISOString().slice(0, 10)
                              : '')
                          }
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [m.id]: {
                                ...(p[m.id] || m),
                                membershipExpiresAt: e.target.value,
                              },
                            }))
                          }
                          style={{ width: '100%' }}
                        />
                      ) : (
                        m.membership_expires_at
                          ? new Date(m.membership_expires_at).toLocaleDateString()
                          : '-'
                      )}
                    </td>
                    <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.created_at ? new Date(m.created_at).toLocaleString() : '-'}</td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 20 }}>
            <h3>區分編碼列表</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
              <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} style={{ padding: '6px 10px' }}>
                <option value="">選擇大區域</option>
                <option value="H">香港島 (H)</option>
                <option value="K">九龍 (K)</option>
                <option value="N">新界 (N)</option>
                <option value="I">離島 (I)</option>
              </select>
              <input
                value={codeSearch}
                onChange={(e) => setCodeSearch(e.target.value)}
                placeholder="搜尋編碼"
                style={{ padding: '6px 10px', flex: 1 }}
              />
            </div>
            {selectedDistrict && (
              <div style={{ background: '#111827', color: '#e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ marginBottom: 8 }}>大區域：{selectedDistrict}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                  {(Object.values(DISTRICT_TABLE).flat() as any[])
                    .filter((d: any) => String(d.code || '').startsWith(String(selectedDistrict)))
                    .filter((c) => !codeSearch || c.toLowerCase().includes(codeSearch.toLowerCase()))
                    .map((d: any) => (
                      <div key={d.code} style={{ background: '#1f2937', padding: '6px 8px', borderRadius: 6 }}>
                        {d.code} — {d.name}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMembers;
