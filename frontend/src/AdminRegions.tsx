import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { listAdminMemberRegions, listAdminMemberDistricts, upsertAdminMemberRegion, upsertAdminMemberDistrict, listMemberRegions, listMemberDistricts, deleteAdminMemberDistrict } from './lib/api';

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
  const [confirmDeleteDistrictKey, setConfirmDeleteDistrictKey] = useState<string | null>(null);

  const resolveAdminToken = useCallback((): string => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = typeof window !== 'undefined' ? (localStorage.getItem('adminToken') || '') : '';
    const token = tokenFromUrl || tokenSaved;
    if (tokenFromUrl && typeof window !== 'undefined') localStorage.setItem('adminToken', tokenFromUrl);
    return token;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const token = resolveAdminToken();
        if (!token) throw new Error('缺少系統管理員密鑰');
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
  }, [resolveAdminToken]);

  const handleSubmitRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const token = resolveAdminToken();
    const code = regionCode.trim().toUpperCase();
    const name = regionName.trim();
    if (!token) {
      setError('缺少系統管理員密鑰');
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

  const handleDeleteDistrict = async (d: any) => {
    const region = String(d.region_code || '').trim().toUpperCase();
    const code = String(d.code3 || '').trim().toUpperCase();
    if (!region || !code) return;
    const key = `${region}::${code}`;
    const token = resolveAdminToken();
    if (!token) {
      setError('缺少管理員密鑰');
      return;
    }
    if (confirmDeleteDistrictKey !== key) {
      setConfirmDeleteDistrictKey(key);
      return;
    }
    const label = `${region}-${code}`;
    const ok = window.confirm(`再次確認：確定要永久刪除分區「${label}」？此操作不可復原。`);
    if (!ok) {
      setConfirmDeleteDistrictKey(null);
      return;
    }
    try {
      await deleteAdminMemberDistrict(API_URL, token, region, code);
      setDistricts((prev) =>
        prev.filter(
          (x: any) =>
            !(String(x.region_code || '').toUpperCase() === region && String(x.code3 || '').toUpperCase() === code),
        ),
      );
      if (editingDistrictKey === key) {
        setEditingDistrictKey(null);
        setDistrictRegionCode('');
        setDistrictCode('');
        setDistrictName('');
        setDistrictActive(true);
      }
      setConfirmDeleteDistrictKey(null);
    } catch (err: any) {
      setError(err?.message || '刪除分區失敗');
      setConfirmDeleteDistrictKey(null);
    }
  };

  return (
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
        <div className="glass rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="accent-yellow text-xl font-bold">管理員：地方 / 分區管理</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/members/register" className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm">
              會員註冊
            </Link>
            <Link to={`/admin/members${adminToken ? `?token=${adminToken}` : ''}`} className="px-3 py-2 rounded cue-button text-sm">
              管理員：會員列表
            </Link>
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
        {loading && <div className="glass rounded-xl p-4 cue-muted">載入中...</div>}

        {!loading && (
          <>
            <div className="glass rounded-xl p-4">
              <div className="font-semibold text-lg mb-3">地方</div>
              <form onSubmit={handleSubmitRegion} className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
                <label className="grid gap-1">
                  <div className="text-xs cue-muted">代碼</div>
                  <input
                    value={regionCode}
                    onChange={(e) => setRegionCode(e.target.value)}
                    disabled={!!editingRegionKey}
                    placeholder="NTW"
                    className="w-full sm:w-28 px-3 py-2 rounded cue-input text-sm disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-1 sm:flex-1">
                  <div className="text-xs cue-muted">名稱</div>
                  <input
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    placeholder="新界西"
                    className="w-full px-3 py-2 rounded cue-input text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm cue-muted">
                  <input type="checkbox" checked={regionActive} onChange={(e) => setRegionActive(e.target.checked)} disabled={!!editingRegionKey} />
                  啟用
                </label>
                {editingRegionKey && <div className="text-xs cue-muted">編輯中：僅可修改名稱</div>}
                {editingRegionKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRegionKey(null);
                      setRegionCode('');
                      setRegionName('');
                      setRegionActive(true);
                    }}
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  >
                    取消編輯
                  </button>
                )}
                <button type="submit" className="px-4 py-2 rounded cue-button font-semibold">
                  儲存地方
                </button>
              </form>

              <div className="mt-3 grid gap-2 md:hidden">
                {regions.map((r) => (
                  <button
                    key={r.code3}
                    type="button"
                    onClick={() => {
                      setRegionCode(r.code3 || '');
                      setRegionName(r.name || '');
                      setRegionActive(typeof r.active === 'boolean' ? r.active : true);
                      setEditingRegionKey(String(r.code3 || '').toUpperCase());
                    }}
                    className="text-left rounded-lg cue-surface p-3 hover:brightness-95"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{String(r.code3 || '-')}</div>
                      <div className={`text-xs font-semibold ${r.active ? 'text-emerald-300' : 'text-red-300'}`}>{r.active ? '啟用' : '停用'}</div>
                    </div>
                    <div className="text-sm cue-muted mt-1">{String(r.name || '')}</div>
                  </button>
                ))}
                {regions.length === 0 && <div className="text-sm cue-muted">尚未有地方資料</div>}
              </div>

              <div className="mt-3 hidden md:block overflow-auto rounded-lg border cue-border">
                <table className="min-w-[520px] w-full border-collapse text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">代碼</th>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">名稱</th>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">啟用</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map((r) => (
                      <tr key={r.code3} className="border-b cue-border">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRegionCode(r.code3 || '');
                              setRegionName(r.name || '');
                              setRegionActive(typeof r.active === 'boolean' ? r.active : true);
                              setEditingRegionKey(String(r.code3 || '').toUpperCase());
                            }}
                            className="accent-yellow underline"
                          >
                            {r.code3}
                          </button>
                        </td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2">{r.active ? '是' : '否'}</td>
                      </tr>
                    ))}
                    {regions.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-2 cue-muted">尚未有地方資料</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass rounded-xl p-4">
              <div className="font-semibold text-lg mb-3">分區</div>
              <form onSubmit={handleSubmitDistrict} className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
                <label className="grid gap-1">
                  <div className="text-xs cue-muted">地方</div>
                  <select
                    value={districtRegionCode}
                    onChange={(e) => setDistrictRegionCode(e.target.value)}
                    disabled={!!editingDistrictKey}
                    className="w-full sm:w-44 px-3 py-2 rounded cue-input text-sm disabled:opacity-60"
                  >
                    <option value="">選擇地方</option>
                    {regions.map((r) => (
                      <option key={r.code3} value={r.code3}>
                        {r.code3} — {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <div className="text-xs cue-muted">代碼</div>
                  <input
                    value={districtCode}
                    onChange={(e) => setDistrictCode(e.target.value)}
                    disabled={!!editingDistrictKey}
                    placeholder="YK"
                    className="w-full sm:w-28 px-3 py-2 rounded cue-input text-sm disabled:opacity-60"
                  />
                </label>
                <label className="grid gap-1 sm:flex-1">
                  <div className="text-xs cue-muted">名稱</div>
                  <input
                    value={districtName}
                    onChange={(e) => setDistrictName(e.target.value)}
                    placeholder="元朗"
                    className="w-full px-3 py-2 rounded cue-input text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm cue-muted">
                  <input type="checkbox" checked={districtActive} onChange={(e) => setDistrictActive(e.target.checked)} disabled={!!editingDistrictKey} />
                  啟用
                </label>
                {editingDistrictKey && <div className="text-xs cue-muted">編輯中：僅可修改名稱</div>}
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
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  >
                    取消編輯
                  </button>
                )}
                <button type="submit" className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">
                  儲存分區
                </button>
              </form>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm cue-muted">篩選地方</div>
                <select
                  value={districtFilterRegion}
                  onChange={(e) => setDistrictFilterRegion(e.target.value)}
                  className="w-full sm:w-56 px-3 py-2 rounded cue-input text-sm"
                >
                  <option value="">全部</option>
                  {regions.map((r) => (
                    <option key={r.code3} value={r.code3}>
                      {r.code3} — {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 grid gap-2 md:hidden">
                {visibleDistricts.map((d) => {
                  const region = String(d.region_code || '').trim().toUpperCase();
                  const code = String(d.code3 || '').trim().toUpperCase();
                  const key = `${region}::${code}`;
                  return (
                    <div key={`${d.region_code}-${d.code3}`} className="rounded-lg cue-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">{region}-{code}</div>
                          <div className="text-sm cue-muted truncate">{String(d.name || '')}</div>
                        </div>
                        <div className={`text-xs font-semibold ${d.active ? 'text-emerald-300' : 'text-red-300'}`}>{d.active ? '啟用' : '停用'}</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDistrictRegionCode(d.region_code || '');
                            setDistrictCode(d.code3 || '');
                            setDistrictName(d.name || '');
                            setDistrictActive(typeof d.active === 'boolean' ? d.active : true);
                            setEditingDistrictKey(key);
                          }}
                          className="px-3 py-2 rounded cue-button text-sm font-semibold"
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDistrict(d)}
                          className="px-3 py-2 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
                        >
                          {confirmDeleteDistrictKey === key ? '再次確認刪除' : '刪除'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {visibleDistricts.length === 0 && <div className="text-sm cue-muted">尚未有分區資料</div>}
              </div>

              <div className="mt-3 hidden md:block overflow-auto rounded-lg border cue-border">
                <table className="min-w-[720px] w-full border-collapse text-sm">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">地方</th>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">代碼</th>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">名稱</th>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">啟用</th>
                      <th className="px-3 py-2 text-left font-semibold cue-muted border-b cue-border">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDistricts.map((d) => {
                      const region = String(d.region_code || '').trim().toUpperCase();
                      const code = String(d.code3 || '').trim().toUpperCase();
                      const key = `${region}::${code}`;
                      return (
                        <tr key={`${d.region_code}-${d.code3}`} className="border-b cue-border">
                          <td className="px-3 py-2">{d.region_code}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDistrictRegionCode(d.region_code || '');
                                setDistrictCode(d.code3 || '');
                                setDistrictName(d.name || '');
                                setDistrictActive(typeof d.active === 'boolean' ? d.active : true);
                                setEditingDistrictKey(key);
                              }}
                              className="accent-yellow underline"
                            >
                              {d.code3}
                            </button>
                          </td>
                          <td className="px-3 py-2">{d.name}</td>
                          <td className="px-3 py-2">{d.active ? '是' : '否'}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteDistrict(d)}
                              className="px-2.5 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-semibold"
                            >
                              {confirmDeleteDistrictKey === key ? '再次確認刪除' : '刪除'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleDistricts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-2 cue-muted">尚未有分區資料</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminRegions;
