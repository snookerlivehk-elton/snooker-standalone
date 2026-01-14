import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { listAdminMemberRegions, listAdminMemberDistricts, upsertAdminMemberRegion, upsertAdminMemberDistrict, listMemberRegions, listMemberDistricts } from './lib/api';

const AdminRegions: React.FC = () => {
  const [adminToken, setAdminToken] = useState('');
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [regionCode, setRegionCode] = useState('');
  const [regionName, setRegionName] = useState('');
  const [regionActive, setRegionActive] = useState(true);

  const [districtRegionCode, setDistrictRegionCode] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [districtActive, setDistrictActive] = useState(true);
  const [districtFilterRegion, setDistrictFilterRegion] = useState('');
  const [editingRegionKey, setEditingRegionKey] = useState<string | null>(null);
  const [editingDistrictKey, setEditingDistrictKey] = useState<string | null>(null);

  function resolveAdminToken(): string {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = typeof window !== 'undefined' ? (localStorage.getItem('adminToken') || '') : '';
    const token = tokenFromUrl || tokenSaved || adminToken;
    if (tokenFromUrl && typeof window !== 'undefined') localStorage.setItem('adminToken', tokenFromUrl);
    return token;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const token = resolveAdminToken();
        if (!token) throw new Error('缺少管理員密鑰');
        let regionData;
        let districtData;
        try {
          regionData = await listAdminMemberRegions(API_URL, token);
          districtData = await listAdminMemberDistricts(API_URL, token);
        } catch {
          const publicRegions = await listMemberRegions(API_URL);
          const publicDistricts = await listMemberDistricts(API_URL);
          regionData = { regions: (publicRegions.regions || []).map((r: any) => ({ ...r, active: true })) };
          districtData = {
            districts: (publicDistricts.districts || []).map((d: any) => ({
              region_code: d.regionCode || d.region_code || '',
              code3: d.code3,
              name: d.name,
              active: true,
            })),
          };
          setError('後端尚未啟用管理 API，僅能檢視現有資料，儲存將失敗');
        }
        if (!mounted) return;
        setAdminToken(token);
        setRegions(regionData.regions || []);
        setDistricts(districtData.districts || []);
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmitRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = resolveAdminToken();
    const code = regionCode.trim().toUpperCase();
    const name = regionName.trim();
    if (!token) {
      setError('缺少管理員密鑰');
      return;
    }
    if (!code || !name) {
      setError('請輸入地方代碼與名稱');
      return;
    }
    const exists = regions.some((r) => String(r.code3 || '').toUpperCase() === code);
    const isEditing = (editingRegionKey || '').toUpperCase() === code && !!editingRegionKey;
    if (exists && !isEditing) {
      setError('地方代碼已存在，如需修改請在下方列表點選該地方再儲存');
      return;
    }
    try {
      const res = await upsertAdminMemberRegion(API_URL, token, { code3: code, name, active: regionActive });
      const region = res.region || res;
      setRegions((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((r: any) => String(r.code3).toUpperCase() === String(region.code3).toUpperCase());
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...region };
        } else {
          list.push(region);
        }
        return list.sort((a: any, b: any) => String(a.code3).localeCompare(String(b.code3)));
      });
      setRegionCode(region.code3 || code);
      setRegionName(region.name || name);
      setRegionActive(typeof region.active === 'boolean' ? region.active : regionActive);
      setEditingRegionKey(region.code3 || code);
    } catch (err: any) {
      setError('儲存地方失敗：後端尚未部署管理 API 或請稍後再試');
    }
  };

  const handleSubmitDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = resolveAdminToken();
    const region = districtRegionCode.trim().toUpperCase();
    const code = districtCode.trim().toUpperCase();
    const name = districtName.trim();
    if (!token) {
      setError('缺少管理員密鑰');
      return;
    }
    if (!region || !code || !name) {
      setError('請輸入地方代碼、分區代碼與名稱');
      return;
    }
    const key = `${region}::${code}`;
    const exists = districts.some((d) => `${String(d.region_code || '').toUpperCase()}::${String(d.code3 || '').toUpperCase()}` === key);
    const isEditing = (editingDistrictKey || '').toUpperCase() === key && !!editingDistrictKey;
    if (exists && !isEditing) {
      setError('分區代碼已存在，如需修改請在下方列表點選該分區再儲存');
      return;
    }
    try {
      const res = await upsertAdminMemberDistrict(API_URL, token, { regionCode: region, code3: code, name, active: districtActive });
      const district = res.district || res;
      setDistricts((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((d: any) => String(d.region_code).toUpperCase() === String(district.region_code).toUpperCase() && String(d.code3).toUpperCase() === String(district.code3).toUpperCase());
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...district };
        } else {
          list.push(district);
        }
        return list.sort((a: any, b: any) => {
          const ra = String(a.region_code || '').localeCompare(String(b.region_code || ''));
          if (ra !== 0) return ra;
          return String(a.code3 || '').localeCompare(String(b.code3 || ''));
        });
      });
      setDistrictRegionCode(district.region_code || region);
      setDistrictCode(district.code3 || code);
      setDistrictName(district.name || name);
      setDistrictActive(typeof district.active === 'boolean' ? district.active : districtActive);
      setEditingDistrictKey(key);
    } catch (err: any) {
      setError('儲存分區失敗：後端尚未部署管理 API 或請稍後再試');
    }
  };

  const visibleDistricts = districts.filter((d) => {
    if (!districtFilterRegion) return true;
    return String(d.region_code || '').toUpperCase() === districtFilterRegion.toUpperCase();
  });

  return (
    <div style={{ maxWidth: 840, margin: '40px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>管理員：地方 / 分區管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/members/register"
            style={{
              padding: '6px 12px',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '14px'
            }}
          >
            會員註冊
          </Link>
          <Link
            to={`/admin/members${adminToken ? `?token=${adminToken}` : ''}`}
            style={{
              padding: '6px 12px',
              backgroundColor: '#4b5563',
              color: 'white',
              borderRadius: '4px',
              textDecoration: 'none',
              fontSize: '14px'
            }}
          >
            管理員：會員列表
          </Link>
        </div>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading && <div>載入中...</div>}
      {!loading && (
        <>
          <div style={{ marginBottom: 24, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>地方</h3>
            <form onSubmit={handleSubmitRegion} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <label>
                <span style={{ fontSize: 13 }}>代碼</span>
                <input
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  style={{ marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc', width: 80 }}
                  disabled={!!editingRegionKey}
                  placeholder="NTW"
                />
              </label>
              <label>
                <span style={{ fontSize: 13 }}>名稱</span>
                <input
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  style={{ marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc', minWidth: 160 }}
                  placeholder="新界西"
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={regionActive}
                  onChange={(e) => setRegionActive(e.target.checked)}
                  style={{ marginRight: 4 }}
                  disabled={!!editingRegionKey}
                />
                啟用
              </label>
              {editingRegionKey && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>編輯中：僅可修改名稱</span>
              )}
              {editingRegionKey && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRegionKey(null);
                    setRegionCode('');
                    setRegionName('');
                    setRegionActive(true);
                  }}
                  style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#374151' }}
                >
                  取消編輯
                </button>
              )}
              <button type="submit" style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: '#2563eb', color: '#fff' }}>
                儲存地方
              </button>
            </form>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>代碼</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>名稱</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>啟用</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.code3} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRegionCode(r.code3 || '');
                          setRegionName(r.name || '');
                          setRegionActive(typeof r.active === 'boolean' ? r.active : true);
                          setEditingRegionKey(String(r.code3 || '').toUpperCase());
                        }}
                        style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563eb', cursor: 'pointer' }}
                      >
                        {r.code3}
                      </button>
                    </td>
                    <td style={{ padding: 6 }}>{r.name}</td>
                    <td style={{ padding: 6 }}>{r.active ? '是' : '否'}</td>
                  </tr>
                ))}
                {regions.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: 6, color: '#666' }}>尚未有地方資料</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>分區</h3>
            <form onSubmit={handleSubmitDistrict} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <label>
                <span style={{ fontSize: 13 }}>地方</span>
                <select
                  value={districtRegionCode}
                  onChange={(e) => setDistrictRegionCode(e.target.value)}
                  style={{ marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc', minWidth: 100 }}
                  disabled={!!editingDistrictKey}
                >
                  <option value="">選擇地方</option>
                  {regions.map((r) => (
                    <option key={r.code3} value={r.code3}>
                      {r.code3} — {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span style={{ fontSize: 13 }}>代碼</span>
                <input
                  value={districtCode}
                  onChange={(e) => setDistrictCode(e.target.value)}
                  style={{ marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc', width: 80 }}
                  disabled={!!editingDistrictKey}
                  placeholder="YK"
                />
              </label>
              <label>
                <span style={{ fontSize: 13 }}>名稱</span>
                <input
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  style={{ marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc', minWidth: 160 }}
                  placeholder="元朗"
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={districtActive}
                  onChange={(e) => setDistrictActive(e.target.checked)}
                  style={{ marginRight: 4 }}
                  disabled={!!editingDistrictKey}
                />
                啟用
              </label>
              {editingDistrictKey && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>編輯中：僅可修改名稱</span>
              )}
              {editingDistrictKey && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDistrictKey(null);
                    setDistrictRegionCode('');
                    setDistrictCode('');
                    setDistrictName('');
                    setDistrictActive(true);
                  }}
                  style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#374151' }}
                >
                  取消編輯
                </button>
              )}
              <button type="submit" style={{ padding: '6px 12px', borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff' }}>
                儲存分區
              </button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13 }}>顯示地方</span>
              <select
                value={districtFilterRegion}
                onChange={(e) => setDistrictFilterRegion(e.target.value)}
                style={{ padding: 4, borderRadius: 4, border: '1px solid #ccc', minWidth: 120 }}
              >
                <option value="">全部</option>
                {regions.map((r) => (
                  <option key={r.code3} value={r.code3}>
                    {r.code3} — {r.name}
                  </option>
                ))}
              </select>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>地方</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>代碼</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>名稱</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>啟用</th>
                </tr>
              </thead>
              <tbody>
                {visibleDistricts.map((d) => (
                  <tr key={`${d.region_code}-${d.code3}`} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 6 }}>
                      {d.region_code}
                    </td>
                    <td style={{ padding: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setDistrictRegionCode(d.region_code || '');
                          setDistrictCode(d.code3 || '');
                          setDistrictName(d.name || '');
                          setDistrictActive(typeof d.active === 'boolean' ? d.active : true);
                          setEditingDistrictKey(`${String(d.region_code || '').toUpperCase()}::${String(d.code3 || '').toUpperCase()}`);
                        }}
                        style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563eb', cursor: 'pointer' }}
                      >
                        {d.code3}
                      </button>
                    </td>
                    <td style={{ padding: 6 }}>{d.name}</td>
                    <td style={{ padding: 6 }}>{d.active ? '是' : '否'}</td>
                  </tr>
                ))}
                {visibleDistricts.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 6, color: '#666' }}>尚未有分區資料</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminRegions;
