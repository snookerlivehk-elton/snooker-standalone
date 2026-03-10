import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, SOCKET_URL, SOCKET_PATH } from './config';
import { listMembers, updateMember, deleteMember, listAdminMemberRegions, listAdminMemberDistricts } from './lib/api';

const AdminMembers: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dynamic regions/districts
  const [regions, setRegions] = useState<any[]>([]);
  const [allDistricts, setAllDistricts] = useState<any[]>([]);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // Derived district options based on selected region
  const availableDistricts = useMemo(() => {
    if (!filterRegion) return [];
    return allDistricts.filter(d => 
      String(d.region_code || '').toUpperCase() === String(filterRegion).toUpperCase() ||
      String(d.regionCode || '').toUpperCase() === String(filterRegion).toUpperCase()
    ).sort((a, b) => String(a.code3 || '').localeCompare(String(b.code3 || '')));
  }, [allDistricts, filterRegion]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (filterName && !String(m.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterEmail && !String(m.email || '').toLowerCase().includes(filterEmail.toLowerCase())) return false;
      if (filterCode && !String(m.member_code || '').toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterRole && String(m.role || 'MEMBER') !== filterRole) return false;
      
      const dist = String(m.district_code || m.partition || '').trim();
      
      if (filterRegion) {
        if (!dist) return false;
        // Check if district belongs to the selected region using dynamic data
        const regionDistList = allDistricts.filter(d => 
          String(d.region_code || '').toUpperCase() === String(filterRegion).toUpperCase() ||
          String(d.regionCode || '').toUpperCase() === String(filterRegion).toUpperCase()
        );
        
        const found = regionDistList.find(d => 
          String(d.code3 || '').toUpperCase() === dist.toUpperCase() || 
          d.name === dist
        );
        
        if (!found) {
           // Fallback heuristic: district starts with region code?
           if (!dist.toUpperCase().startsWith(filterRegion.toUpperCase())) return false;
        }
      }
      
      if (filterDistrict && dist !== filterDistrict) return false;

      return true;
    });
  }, [members, filterName, filterEmail, filterRegion, filterDistrict, filterCode, filterRole, allDistricts]);

  // Reset district filter when region changes
  useEffect(() => {
    setFilterDistrict('');
  }, [filterRegion]);

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
        
        // Fetch members, regions, and districts in parallel
        const [membersData, regionsData, districtsData] = await Promise.all([
          listMembers(API_URL, token),
          listAdminMemberRegions(API_URL, token).catch(() => ({ regions: [] })),
          listAdminMemberDistricts(API_URL, token).catch(() => ({ districts: [] }))
        ]);

        if (mounted) {
          setMembers(membersData.members || []);
          setRegions(regionsData.regions || []);
          setAllDistricts(districtsData.districts || []);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const districtIndex = useMemo(() => {
    // Legacy grouping logic removed as per new requirements
    return {};
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
      const ok = window.confirm(`再次確認：確定要永久刪除會員「${display}」？此操作不可復原。`);
      if (!ok) return;
      await deleteMember(API_URL, adminToken, id);
      try {
        const res = await listMembers(API_URL, adminToken);
        setMembers(res.members || []);
      } catch {}
      setConfirmDeleteId(null);
    } catch (err: any) {
      console.error('Failed to delete member', err);
      setError(err?.message || '刪除會員失敗');
      setConfirmDeleteId(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111827', padding: '40px 16px' }}>
      <div className="brand-page text-white" style={{ maxWidth: 840, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 className="accent-yellow">管理員：會員列表</h2>
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

          {/* Filter Bar */}
          <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <input 
                placeholder="姓名" 
                value={filterName} 
                onChange={e => setFilterName(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 14 }}
              />
              <input 
                placeholder="Email" 
                value={filterEmail} 
                onChange={e => setFilterEmail(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 14 }}
              />
              
              <select 
                value={filterRegion} 
                onChange={e => setFilterRegion(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 14, minWidth: 120 }}
              >
                <option value="">全部大區</option>
                {regions.map(r => (
                  <option key={r.code3} value={r.code3}>{r.name} ({r.code3})</option>
                ))}
              </select>
              
              <select 
                value={filterDistrict} 
                onChange={e => setFilterDistrict(e.target.value)} 
                disabled={!filterRegion}
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 14, minWidth: 120, opacity: !filterRegion ? 0.6 : 1 }}
              >
                <option value="">全部地區</option>
                {availableDistricts.map(d => (
                  <option key={d.code3} value={d.code3}>{d.name} ({d.code3})</option>
                ))}
              </select>
              
              <input 
                placeholder="會員編碼" 
                value={filterCode} 
                onChange={e => setFilterCode(e.target.value)} 
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 14 }}
              />
              
              <select 
                value={filterRole} 
                onChange={e => setFilterRole(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #d1d5db', fontSize: 14 }}
              >
                <option value="">全部等級</option>
                <option value="MEMBER">普通會員</option>
                <option value="ADMIN">操作員</option>
              </select>
              
              <button 
                onClick={() => { 
                  setFilterName(''); 
                  setFilterEmail(''); 
                  setFilterRegion(''); 
                  setFilterDistrict(''); 
                  setFilterCode(''); 
                  setFilterRole(''); 
                }}
                style={{ padding: '6px 12px', borderRadius: 4, background: '#e5e7eb', color: '#374151', border: 'none', cursor: 'pointer', fontSize: 14 }}
              >
                清除
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 13, color: '#4b5563' }}>
              目前符合條件：<span style={{ fontWeight: 'bold', color: '#111827' }}>{filteredMembers.length}</span> / 總共：{members.length} 位
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
              {filteredMembers.map((m) => (
                <React.Fragment key={m.id}>
                  <tr>
                    <td colSpan={10} style={{ borderBottom: '1px solid #eee', padding: 6 }}>
                      {!editing[m.id] ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => startEdit(m)} style={{ padding: '4px 8px', borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none' }}>編輯</button>
                          <button onClick={() => removeMember(m)} style={{ padding: '4px 8px', borderRadius: 6, background: '#dc2626', color: '#fff', border: 'none' }}>
                            {confirmDeleteId === m.id ? '再次確認刪除' : '刪除'}
                          </button>
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
                          <option value="ADMIN">場館/球會</option>
                        </select>
                      ) : (
                        (m.role === 'ADMIN' ? '場館/球會' : '普通會員')
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
                </React.Fragment>
              ))}
            </tbody>
          </table>

        </>
      )}
    </div>
  );
};

export default AdminMembers;
