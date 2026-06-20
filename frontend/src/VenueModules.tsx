import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Tabs from './components/Tabs';
import { API_URL } from './config';
import { getVenueModules } from './lib/api';

type VenueModuleRow = {
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
  enabledGlobally: boolean;
  allowClubEnable: boolean;
  publicVisible: boolean;
  homeVisible: boolean;
  effectivePublicVisible: boolean;
  effectiveHomeVisible: boolean;
  explicitEnabled: boolean | null;
  assignedEnabled: boolean;
  assignmentSource: string;
  assignmentUpdatedAt?: string | null;
  effectiveEnabled: boolean;
};

type CategoryKey = 'all' | 'content' | 'engagement' | 'operations' | 'payment' | 'membership' | 'system';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: '全部',
  content: '內容',
  engagement: '互動',
  operations: '營運',
  payment: '結算',
  membership: '會員',
  system: '系統',
};

const VenueModules: React.FC = () => {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<VenueModuleRow[]>([]);
  const [clubId, setClubId] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');

  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);
  const memberId = String((session as any)?.id || '').trim();

  const load = async () => {
    if (!memberId) {
      setError('未登入');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await getVenueModules(API_URL, memberId);
      setClubId(String(out?.clubId || ''));
      setRows(Array.isArray(out?.modules) ? out.modules : []);
    } catch (e: any) {
      setError(e?.message || '讀取場館模組中心失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [memberId]);

  const visibleRows = useMemo(() => {
    if (category === 'all') return rows;
    return rows.filter((row) => row.category === category);
  }, [category, rows]);

  const goManage = (code: string) => {
    nav(`/venue/manage/${encodeURIComponent(code)}`);
  };

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6">
      <div className="w-full max-w-6xl mx-auto glass rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold accent-yellow">模組中心（Venue Admin）</h1>
            <div className="text-sm cue-muted mt-1">查看場館可用模組、生效狀態，並快速跳到現有管理分頁。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/venue/dashboard"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
            >
              返回後台
            </Link>
            {clubId ? (
              <Link
                to={`/club/${encodeURIComponent(clubId)}`}
                className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              >
                前往公開頁
              </Link>
            ) : null}
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
                  <div className={`px-2 py-1 rounded text-xs font-bold ${row.effectiveEnabled ? 'bg-emerald-600/20 text-emerald-300' : 'bg-red-600/20 text-red-300'}`}>
                    {row.effectiveEnabled ? '可使用' : '未啟用'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="cue-surface-strong rounded px-3 py-2">全局：{row.enabledGlobally ? '開啟' : '關閉'}</div>
                  <div className="cue-surface-strong rounded px-3 py-2">場館授權：{row.supportsClubAssignment ? (row.assignedEnabled ? '已授權' : '未授權') : '不適用'}</div>
                  <div className="cue-surface-strong rounded px-3 py-2">公開頁：{row.effectivePublicVisible ? '顯示' : '隱藏'}</div>
                  <div className="cue-surface-strong rounded px-3 py-2">首頁：{row.effectiveHomeVisible ? '顯示' : '隱藏'}</div>
                </div>

                <div className="text-xs cue-muted">
                  {row.supportsClubAssignment
                    ? `授權來源：${row.assignmentSource}${row.explicitEnabled === null ? '' : row.explicitEnabled ? '（明確開啟）' : '（明確關閉）'}`
                    : `授權來源：global_only`}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-button text-sm font-semibold disabled:opacity-50"
                    onClick={() => goManage(row.code)}
                    disabled={!row.effectiveEnabled}
                  >
                    前往管理
                  </button>
                  {clubId && row.effectivePublicVisible ? (
                    <button
                      type="button"
                      className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                      onClick={() => window.open(`/club/${encodeURIComponent(clubId)}`, '_blank')}
                    >
                      查看公開頁
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default VenueModules;
