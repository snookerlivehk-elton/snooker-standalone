import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { getAdminModules, updateAdminModule } from './lib/api';
import { clearFeatureCache } from './lib/features';
import Tabs from './components/Tabs';

type AdminModuleRow = {
  code: string;
  label: string;
  description: string;
  category: string;
  pluginId?: string | null;
  featureFlagKey?: string | null;
  supportsClubAssignment?: boolean;
  supportsPublicRoutes: boolean;
  supportsHomeSection: boolean;
  supportsVenueAdmin: boolean;
  supportsSuperAdmin: boolean;
  enabledGlobally: boolean;
  publicVisible: boolean;
  homeVisible: boolean;
  allowClubEnable: boolean;
  sortOrder: number;
  effectivePublicVisible: boolean;
  effectiveHomeVisible: boolean;
};

type CategoryKey = 'all' | 'content' | 'engagement' | 'operations' | 'payment' | 'membership' | 'system';

function resolveToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || localStorage.getItem('adminToken') || '';
  } catch {
    return localStorage.getItem('adminToken') || '';
  }
}

function resolveBasePath(): string {
  const rawBase = (import.meta.env.BASE_URL || '/');
  let base = rawBase.replace(/\/+$/, '');
  try {
    const p = window.location.pathname;
    const m = p.match(/^(.*)\/admin(?:\/.*)?$/);
    if (m && m[1] !== '') base = m[1];
  } catch {}
  return base;
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: '全部',
  content: '內容',
  engagement: '互動',
  operations: '營運',
  payment: '結算',
  membership: '會員',
  system: '系統',
};

const AdminModules: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<string>('');
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>('all');
  const [rows, setRows] = useState<AdminModuleRow[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const tok = resolveToken();
      const out = await getAdminModules(API_URL, tok);
      setRows(Array.isArray(out?.modules) ? out.modules : []);
    } catch (e: any) {
      setError(e?.message || '讀取模組清單失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleRows = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    if (category === 'all') return list;
    return list.filter((row) => row.category === category);
  }, [category, rows]);

  async function saveModule(code: string, patch: Partial<AdminModuleRow>) {
    setSaveResult(null);
    setSavingCode(code);
    try {
      const tok = resolveToken();
      await updateAdminModule(API_URL, tok, code, patch);
      clearFeatureCache();
      await load();
      setSaveResult(`已更新模組：${code}`);
    } catch (e: any) {
      setSaveResult(e?.message || '更新失敗');
    } finally {
      setSavingCode('');
    }
  }

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6">
      <div className="w-full max-w-6xl mx-auto glass rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold accent-yellow">模組中心（Super Admin）</h1>
            <div className="text-sm cue-muted mt-1">以模組為單位管理全局開關、公開顯示、首頁顯示與場館授權能力。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/admin/overview${resolveToken() ? `?token=${encodeURIComponent(resolveToken())}` : ''}`}
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
            >
              返回總覽
            </Link>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => load()}
              disabled={loading}
            >
              重新整理
            </button>
          </div>
        </div>

        <div className="mt-4">
          <Tabs
            items={(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => ({ key, label: CATEGORY_LABELS[key] }))}
            activeKey={category}
            onChange={(key) => setCategory(key as CategoryKey)}
          />
        </div>

        {saveResult ? <div className="mt-4 text-sm cue-muted">{saveResult}</div> : null}
        {loading ? <div className="mt-4 text-sm cue-muted">讀取中…</div> : null}
        {!loading && error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}

        {!loading && !error ? (
          <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleRows.map((row) => (
              <div key={row.code} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{row.label}</div>
                    <div className="text-xs cue-muted mt-1">{row.code}</div>
                    <div className="text-sm cue-muted mt-2">{row.description}</div>
                  </div>
                  <div className="text-right text-xs cue-muted">
                    <div>{row.category}</div>
                    {row.featureFlagKey ? <div className="mt-1">flag: {row.featureFlagKey}</div> : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="cue-surface-strong rounded px-3 py-2">公開路由：{row.supportsPublicRoutes ? '支援' : '否'}</div>
                  <div className="cue-surface-strong rounded px-3 py-2">首頁區塊：{row.supportsHomeSection ? '支援' : '否'}</div>
                  <div className="cue-surface-strong rounded px-3 py-2">場館授權：{row.supportsClubAssignment ? '支援' : '否'}</div>
                  <div className="cue-surface-strong rounded px-3 py-2">場館後台：{row.supportsVenueAdmin ? '支援' : '否'}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                    <span className="text-sm">全局啟用</span>
                    <input
                      type="checkbox"
                      checked={row.enabledGlobally}
                      disabled={savingCode === row.code}
                      onChange={(e) => saveModule(row.code, { enabledGlobally: e.target.checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                    <span className="text-sm">允許場館授權</span>
                    <input
                      type="checkbox"
                      checked={row.allowClubEnable}
                      disabled={savingCode === row.code || !row.supportsClubAssignment}
                      onChange={(e) => saveModule(row.code, { allowClubEnable: e.target.checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                    <span className="text-sm">公開顯示</span>
                    <input
                      type="checkbox"
                      checked={row.publicVisible}
                      disabled={savingCode === row.code || !row.supportsPublicRoutes}
                      onChange={(e) => saveModule(row.code, { publicVisible: e.target.checked })}
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                    <span className="text-sm">首頁顯示</span>
                    <input
                      type="checkbox"
                      checked={row.homeVisible}
                      disabled={savingCode === row.code || !row.supportsHomeSection}
                      onChange={(e) => saveModule(row.code, { homeVisible: e.target.checked })}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="cue-surface rounded px-3 py-2">實際公開：{row.effectivePublicVisible ? '開啟' : '關閉'}</div>
                  <div className="cue-surface rounded px-3 py-2">實際首頁：{row.effectiveHomeVisible ? '開啟' : '關閉'}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminModules;
