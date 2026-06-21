import React, { useEffect, useState } from 'react';
import { API_URL } from './config';
import { createAdminSiteAdItem, deleteAdminSiteAdItem, getAdminFeatures, getAdminSiteAds, getSiteNotice, setAdminSiteAdPlacementItems, updateAdminFeatures, updateAdminSiteAd, updateAdminSiteAdItem, updateSiteNotice, uploadAdminSiteAdItemImage } from './lib/api';
import { clearFeatureCache } from './lib/features';
import Tabs from './components/Tabs';
import { AdminMembersPanel } from './AdminMembers';
import { AdminModulePanel } from './AdminModules';

type AdminOverviewTab = 'system' | 'venue' | 'member' | 'competition' | 'members';

const AdminOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [noticeLoading, setNoticeLoading] = useState<boolean>(true);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<{ enabled: boolean; message: string; youtubeEmbedUrl: string; homeShowLeaderboard: boolean; homeShowClubList: boolean }>({
    enabled: true,
    message: '',
    youtubeEmbedUrl: '',
    homeShowLeaderboard: true,
    homeShowClubList: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresError, setFeaturesError] = useState<string | null>(null);
  const [featuresDraft, setFeaturesDraft] = useState<Array<{ key: string; label: string; enabled: boolean }>>([]);
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [featuresSaveResult, setFeaturesSaveResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminOverviewTab>('system');
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [adsSaving, setAdsSaving] = useState(false);
  const [adsSaveResult, setAdsSaveResult] = useState<string | null>(null);
  const [adConfigDraft, setAdConfigDraft] = useState<Record<'system' | 'venue' | 'member', { enabled: boolean; displaySeconds: number; minIntervalMinutes: number; maxIntervalMinutes: number; updatedAt?: string }>>({
    system: { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
    venue: { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
    member: { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
  });
  const [adItemsDraft, setAdItemsDraft] = useState<Array<{ id: string; enabled: boolean; imageUrl: string; linkUrl: string; title: string; subtitle: string; ctaLabel: string; updatedAt?: string }>>([]);
  const [placementItemIdsDraft, setPlacementItemIdsDraft] = useState<Record<'system' | 'venue' | 'member', string[]>>({ system: [], venue: [], member: [] });

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

  function resolveToken(): string {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || localStorage.getItem('adminToken') || '';
    } catch {
      return localStorage.getItem('adminToken') || '';
    }
  }

  function resolveTab(): AdminOverviewTab {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      if (t === 'venue' || t === 'member' || t === 'competition' || t === 'members' || t === 'system') return t;
      return (localStorage.getItem('adminOverviewTab') as any) || 'system';
    } catch {
      return 'system';
    }
  }

  function updateTab(t: AdminOverviewTab) {
    setActiveTab(t);
    try {
      localStorage.setItem('adminOverviewTab', t);
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  const featureGroups: Record<string, 'system' | 'venue' | 'member' | 'competition'> = {
    scoring: 'system',
    live: 'system',
    club_dashboard: 'venue',
    booking: 'venue',
    qr_session: 'venue',
    points: 'venue',
    member_portal: 'member',
    club_messages: 'member',
    system_portal: 'member',
    tournaments: 'competition',
    highbreak: 'competition',
  };

  function getFeaturesForTab(t: 'system' | 'venue' | 'member' | 'competition') {
    return featuresDraft.filter((f) => (featureGroups[f.key] || 'system') === t);
  }

  function buildAdminPath(path: string) {
    const base = resolveBasePath();
    const tok = resolveToken();
    return `${window.location.origin}${base}${path}${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
  }

  async function saveFeatures() {
    setFeaturesSaveResult(null);
    setFeaturesSaving(true);
    try {
      const tok = resolveToken();
      const updates = featuresDraft.map((f) => ({ key: f.key, enabled: f.enabled }));
      await updateAdminFeatures(API_URL, tok, updates);
      clearFeatureCache();
      setFeaturesSaveResult('已儲存');
    } catch (e: any) {
      setFeaturesSaveResult(e?.message || '儲存失敗');
    } finally {
      setFeaturesSaving(false);
    }
  }

  async function refreshAds(tok?: string) {
    const t = tok || resolveToken();
    const row = await getAdminSiteAds(API_URL, t);

    const cfgNext: any = {
      system: { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
      venue: { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
      member: { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
    };
    for (const a of Array.isArray((row as any)?.ads) ? (row as any).ads : []) {
      const id = String(a?.id || '').trim();
      if (id !== 'system' && id !== 'venue' && id !== 'member') continue;
      cfgNext[id] = {
        enabled: a?.enabled !== false,
        displaySeconds: Number(a?.displaySeconds ?? 15) || 15,
        minIntervalMinutes: Number(a?.minIntervalMinutes ?? 20) || 20,
        maxIntervalMinutes: Number(a?.maxIntervalMinutes ?? 30) || 30,
        updatedAt: a?.updatedAt ? String(a.updatedAt) : undefined,
      };
    }

    const itemsNext = (Array.isArray((row as any)?.items) ? (row as any).items : []).map((it: any) => ({
      id: String(it?.id || ''),
      enabled: it?.enabled !== false,
      imageUrl: String(it?.imageUrl || ''),
      linkUrl: String(it?.linkUrl || ''),
      title: String(it?.title || ''),
      subtitle: String(it?.subtitle || ''),
      ctaLabel: String(it?.ctaLabel || ''),
      updatedAt: it?.updatedAt ? String(it.updatedAt) : undefined,
    }));

    const pi = (row as any)?.placementItems || {};
    const placementNext: any = { system: [], venue: [], member: [] };
    for (const p of ['system', 'venue', 'member']) {
      const arr = Array.isArray(pi?.[p]) ? pi[p] : [];
      placementNext[p] = arr
        .slice()
        .sort((a: any, b: any) => Number(a?.sort ?? 0) - Number(b?.sort ?? 0))
        .filter((x: any) => x?.enabled !== false)
        .map((x: any) => String(x?.itemId || '').trim())
        .filter((x: any) => !!x);
    }

    setAdConfigDraft(cfgNext);
    setAdItemsDraft(itemsNext);
    setPlacementItemIdsDraft(placementNext);
    return row;
  }

  async function saveAd(placement: 'system' | 'venue' | 'member') {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      const draft = adConfigDraft[placement] || { enabled: true, displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 };
      const displaySeconds = Math.max(3, Math.min(60, Number(draft.displaySeconds || 15) || 15));
      const minIntervalMinutes = Math.max(1, Math.min(24 * 60, Number(draft.minIntervalMinutes || 20) || 20));
      const maxIntervalMinutes = Math.max(1, Math.min(24 * 60, Number(draft.maxIntervalMinutes || 30) || 30));
      await updateAdminSiteAd(API_URL, tok, placement, {
        enabled: !!draft.enabled,
        displaySeconds,
        minIntervalMinutes,
        maxIntervalMinutes,
      });
      await refreshAds(tok);
      setAdsSaveResult('已儲存');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '儲存失敗');
    } finally {
      setAdsSaving(false);
    }
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('讀取圖片失敗'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  async function savePlacementItems(placement: 'system' | 'venue' | 'member') {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      const ids = placementItemIdsDraft[placement] || [];
      await setAdminSiteAdPlacementItems(
        API_URL,
        tok,
        placement,
        ids.map((itemId) => ({ itemId, enabled: true })),
      );
      await refreshAds(tok);
      setAdsSaveResult('已儲存投放設定');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '儲存失敗');
    } finally {
      setAdsSaving(false);
    }
  }

  async function addAdItem() {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      await createAdminSiteAdItem(API_URL, tok);
      await refreshAds(tok);
      setAdsSaveResult('已新增廣告');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '新增失敗');
    } finally {
      setAdsSaving(false);
    }
  }

  async function saveAdItem(id: string) {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      const it = adItemsDraft.find((x) => x.id === id);
      if (!it) throw new Error('item_not_found');
      await updateAdminSiteAdItem(API_URL, tok, id, {
        enabled: it.enabled,
        linkUrl: it.linkUrl ? String(it.linkUrl).trim() : null,
        title: it.title ? String(it.title).trim() : null,
        subtitle: it.subtitle ? String(it.subtitle).trim() : null,
        ctaLabel: it.ctaLabel ? String(it.ctaLabel).trim() : null,
      });
      await refreshAds(tok);
      setAdsSaveResult('已儲存廣告');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '儲存失敗');
    } finally {
      setAdsSaving(false);
    }
  }

  async function removeAdItem(id: string) {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      await deleteAdminSiteAdItem(API_URL, tok, id);
      await refreshAds(tok);
      setAdsSaveResult('已刪除廣告');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '刪除失敗');
    } finally {
      setAdsSaving(false);
    }
  }

  async function uploadAdItemImage(id: string, file: File) {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      const dataUrl = await readFileAsDataUrl(file);
      await uploadAdminSiteAdItemImage(API_URL, tok, id, { filename: file.name, contentType: file.type, dataUrl });
      await refreshAds(tok);
      setAdsSaveResult('已上載圖片');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '上載失敗');
    } finally {
      setAdsSaving(false);
    }
  }

  function togglePlacementItem(placement: 'system' | 'venue' | 'member', itemId: string, checked: boolean) {
    setPlacementItemIdsDraft((s) => {
      const cur = Array.isArray(s[placement]) ? s[placement] : [];
      if (checked) {
        if (cur.includes(itemId)) return s;
        return { ...s, [placement]: [...cur, itemId] };
      }
      return { ...s, [placement]: cur.filter((x) => x !== itemId) };
    });
  }

  function movePlacementItem(placement: 'system' | 'venue' | 'member', itemId: string, dir: -1 | 1) {
    setPlacementItemIdsDraft((s) => {
      const cur = Array.isArray(s[placement]) ? [...s[placement]] : [];
      const idx = cur.indexOf(itemId);
      if (idx < 0) return s;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= cur.length) return s;
      const tmp = cur[idx];
      cur[idx] = cur[nextIdx];
      cur[nextIdx] = tmp;
      return { ...s, [placement]: cur };
    });
  }

  function renderPlacementPicker(placement: 'system' | 'venue' | 'member') {
    const selectedIds = Array.isArray(placementItemIdsDraft[placement]) ? placementItemIdsDraft[placement] : [];
    const selectedItems = selectedIds
      .map((id) => adItemsDraft.find((it) => it.id === id))
      .filter((x) => !!x) as Array<{ id: string; enabled: boolean; imageUrl: string; linkUrl: string; title: string; subtitle: string; ctaLabel: string; updatedAt?: string }>;
    const selectedSet = new Set(selectedItems.map((x) => x.id));
    const unselectedItems = adItemsDraft.filter((it) => !selectedSet.has(it.id));

    return (
      <div className="space-y-2">
        {adItemsDraft.length === 0 && <div className="text-sm cue-muted">請先新增廣告素材</div>}

        {selectedItems.length > 0 && (
          <div className="text-xs cue-muted">已投放（可調整輪播次序）</div>
        )}
        {selectedItems.map((it, idx) => (
          <div key={it.id} className="flex items-center justify-between gap-2 bg-black/30 border border-white/10 rounded px-3 py-2">
            <label className="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                checked
                onChange={(e) => togglePlacementItem(placement, it.id, e.target.checked)}
              />
              <span className="text-sm break-all truncate">{it.title || it.id}</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                disabled={idx === 0}
                onClick={() => movePlacementItem(placement, it.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                disabled={idx === selectedItems.length - 1}
                onClick={() => movePlacementItem(placement, it.id, 1)}
              >
                ↓
              </button>
            </div>
          </div>
        ))}

        {unselectedItems.length > 0 && (
          <div className="text-xs cue-muted mt-2">未投放</div>
        )}
        {unselectedItems.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-2 bg-black/15 border border-white/10 rounded px-3 py-2">
            <label className="flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                checked={false}
                onChange={(e) => togglePlacementItem(placement, it.id, e.target.checked)}
              />
              <span className="text-sm break-all truncate">{it.title || it.id}</span>
            </label>
            <div className="w-[3.5rem]" />
          </div>
        ))}
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchOverview() {
      setLoading(true);
      setError(null);
      const tok = resolveToken();
      try {
        // Prefer query param to avoid CORS preflight when跨網域
        const url = `${API_URL.replace(/\/$/, '')}/admin/overview?token=${encodeURIComponent(tok)}&format=json`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          // Try header-based
          const res2 = await fetch(`${API_URL.replace(/\/$/, '')}/admin/overview`, {
            headers: { 'x-admin-token': tok },
            cache: 'no-store'
          });
          if (!res2.ok) {
            const err = await res2.json().catch(() => ({}));
            throw new Error(err.error || `載入失敗 (${res2.status})`);
          }
          const json2 = await res2.json();
          if (!cancelled) setData(json2);
        } else {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '載入失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        if (!cancelled) {
          setNoticeLoading(true);
          setNoticeError(null);
        }
        const row = await getSiteNotice(API_URL);
        if (!cancelled) {
          setNoticeDraft({
            enabled: row?.enabled !== false,
            message: String(row?.message || ''),
            youtubeEmbedUrl: String(row?.youtubeEmbedUrl || ''),
            homeShowLeaderboard: row?.homeShowLeaderboard !== false,
            homeShowClubList: row?.homeShowClubList !== false,
          });
        }
      } catch (e: any) {
        if (!cancelled) setNoticeError(e?.message || '讀取公告失敗');
      } finally {
        if (!cancelled) setNoticeLoading(false);
      }
      try {
        if (!cancelled) {
          setFeaturesLoading(true);
          setFeaturesError(null);
        }
        const tok = resolveToken();
        const row = await getAdminFeatures(API_URL, tok);
        if (!cancelled) {
          setFeaturesDraft((row?.features || []).map((f) => ({ key: f.key, label: f.label, enabled: f.enabled !== false })));
        }
      } catch (e: any) {
        if (!cancelled) setFeaturesError(e?.message || '讀取功能清單失敗');
      } finally {
        if (!cancelled) setFeaturesLoading(false);
      }

      try {
        if (!cancelled) {
          setAdsLoading(true);
          setAdsError(null);
        }
        const tok = resolveToken();
        await refreshAds(tok);
      } catch (e: any) {
        if (!cancelled) setAdsError(e?.message || '讀取廣告設定失敗');
      } finally {
        if (!cancelled) setAdsLoading(false);
      }
    }
    fetchOverview();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8">載入中...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 md:p-8">錯誤：{error}</div>;
  }

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl mx-auto glass rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold accent-yellow">系統管理（Super Admin）</h1>
            <div className="text-sm cue-muted mt-1">主入口已收口為分頁：系統 / 場館營運 / 會員內容 / 賽事單杆 / 會員列表</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => {
                window.location.href = buildAdminPath('/admin/club-features');
              }}
            >
              場館功能授權
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => {
                window.location.href = buildAdminPath('/admin/news-sources');
              }}
            >
              新聞來源
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => {
                window.location.href = buildAdminPath('/admin/breaks');
              }}
            >
              單杆管理
            </button>
          </div>
        </div>

        <div className="mt-4">
          <Tabs
            items={[
              { key: 'system', label: '系統' },
              { key: 'venue', label: '場館營運' },
              { key: 'member', label: '會員／內容' },
              { key: 'competition', label: '賽事／單杆' },
              { key: 'members', label: '會員列表' },
            ]}
            activeKey={activeTab}
            onChange={(k) => updateTab(k as any)}
          />
        </div>

        {activeTab === 'system' && (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="text-sm text-gray-300/80">狀態</div>
                <div className="text-lg">{data?.status || '-'}</div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="text-sm text-gray-300/80">埠</div>
                <div className="text-lg">{data?.port}</div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="text-sm text-gray-300/80">上線時間（秒）</div>
                <div className="text-lg">{Math.floor(data?.uptime || 0)}</div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="text-sm text-gray-300/80">資料庫會員數</div>
                <div className="text-lg">{data?.db?.members ?? '-'}</div>
              </div>
            </div>

            <details className="bg-black/40 border border-white/10 rounded p-4">
              <summary className="cursor-pointer text-sm font-semibold">CORS Origins</summary>
              <pre className="mt-3 text-xs whitespace-pre-wrap break-all">{JSON.stringify(data?.corsOrigins, null, 2)}</pre>
            </details>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">功能上落架（系統）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={featuresSaving}
                  onClick={saveFeatures}
                >
                  儲存
                </button>
              </div>
              {featuresLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!featuresLoading && featuresError && <div className="text-sm text-red-500 mt-2">{featuresError}</div>}
              {!featuresLoading && !featuresError && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getFeaturesForTab('system').map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{f.label}</div>
                        <div className="text-xs cue-muted break-all">{f.key}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={(e) => setFeaturesDraft((s) => s.map((x) => x.key === f.key ? { ...x, enabled: e.target.checked } : x))}
                      />
                    </label>
                  ))}
                </div>
              )}
              {featuresSaveResult && <div className="text-sm cue-muted mt-2">{featuresSaveResult}</div>}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">首頁輪播素材池（最多 5）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={adsSaving}
                  onClick={addAdItem}
                >
                  新增
                </button>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  {adItemsDraft.length === 0 && (
                    <div className="text-sm cue-muted">未有廣告素材</div>
                  )}
                  {adItemsDraft.map((it) => (
                    <div key={it.id} className="bg-black/30 border border-white/10 rounded p-3 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm font-semibold break-all">{it.id}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={it.enabled !== false}
                              onChange={(e) => setAdItemsDraft((s) => s.map((x) => x.id === it.id ? { ...x, enabled: e.target.checked } : x))}
                            />
                            <span>啟用</span>
                          </label>
                          <button
                            type="button"
                            className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                            disabled={adsSaving}
                            onClick={() => saveAdItem(it.id)}
                          >
                            儲存
                          </button>
                          <button
                            type="button"
                            className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-sm font-semibold text-white"
                            disabled={adsSaving}
                            onClick={() => removeAdItem(it.id)}
                          >
                            刪除
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm cue-muted mb-1">輪播標題</div>
                        <input
                          value={it.title || ''}
                          onChange={(e) => setAdItemsDraft((s) => s.map((x) => x.id === it.id ? { ...x, title: e.target.value } : x))}
                          className="w-full cue-input rounded px-3 py-2 text-sm"
                          placeholder="例如：焦點賽事直播"
                        />
                      </div>

                      <div>
                        <div className="text-sm cue-muted mb-1">輪播副標</div>
                        <textarea
                          value={it.subtitle || ''}
                          onChange={(e) => setAdItemsDraft((s) => s.map((x) => x.id === it.id ? { ...x, subtitle: e.target.value } : x))}
                          className="w-full cue-input rounded px-3 py-2 text-sm"
                          placeholder="例如：展示活動亮點、播放時間或導流說明"
                          rows={3}
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <div className="text-sm cue-muted mb-1">按鈕文字</div>
                          <input
                            value={it.ctaLabel || ''}
                            onChange={(e) => setAdItemsDraft((s) => s.map((x) => x.id === it.id ? { ...x, ctaLabel: e.target.value } : x))}
                            className="w-full cue-input rounded px-3 py-2 text-sm"
                            placeholder="例如：立即查看"
                          />
                        </div>

                        <div>
                          <div className="text-sm cue-muted mb-1">輪播點擊連結</div>
                          <input
                            value={it.linkUrl || ''}
                            onChange={(e) => setAdItemsDraft((s) => s.map((x) => x.id === it.id ? { ...x, linkUrl: e.target.value } : x))}
                            className="w-full cue-input rounded px-3 py-2 text-sm"
                            placeholder="https://..."
                          />
                        </div>
                      </div>

                      <label className="block w-full cue-surface rounded-lg p-2 text-left hover:brightness-95 cursor-pointer">
                        {it.imageUrl ? (
                          <img
                            src={String(it.imageUrl)}
                            alt=""
                            className="w-full rounded object-cover max-h-[30vh]"
                            onError={(e) => {
                              (e.currentTarget as any).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full rounded-lg border border-dashed border-white/20 p-6 text-sm cue-muted text-center">
                            按此上載圖片（JPG/PNG/WebP，最多 3MB）
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={adsSaving}
                          onChange={(e) => {
                            const f = e.currentTarget.files?.[0];
                            e.currentTarget.value = '';
                            if (!f) return;
                            uploadAdItemImage(it.id, f);
                          }}
                        />
                      </label>
                    </div>
                  ))}
                  {adsSaveResult && <div className="text-sm cue-muted">{adsSaveResult}</div>}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-bold">首頁輪播設定（系統）</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    disabled={adsSaving}
                    onClick={() => saveAd('system')}
                  >
                    儲存規則
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    disabled={adsSaving}
                    onClick={() => savePlacementItems('system')}
                  >
                    儲存投放
                  </button>
                </div>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adConfigDraft.system?.enabled !== false}
                      onChange={(e) => setAdConfigDraft((s) => ({ ...s, system: { ...(s.system || {}), enabled: e.target.checked } }))}
                    />
                    <span>啟用首頁輪播（沒有投放素材會自動不顯示）</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm cue-muted mb-1">停留（秒）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.system?.displaySeconds ?? 15)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, system: { ...(s.system || {}), displaySeconds: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={3}
                        max={60}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最短（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.system?.minIntervalMinutes ?? 20)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, system: { ...(s.system || {}), minIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最長（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.system?.maxIntervalMinutes ?? 30)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, system: { ...(s.system || {}), maxIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                  </div>

                  <div>
                      <div className="text-sm cue-muted mb-1">輪播內容（勾選後會在首頁輪播）</div>
                    {renderPlacementPicker('system')}
                  </div>

                  {adsSaveResult && <div className="text-sm cue-muted">{adsSaveResult}</div>}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <AdminModulePanel
                categories={['system']}
                title="系統模組"
                description="集中管理系統入口與主頁模組的全局開關、公開顯示與首頁顯示。"
              />
            </div>
          </div>
        )}

        {activeTab === 'venue' && (
          <div className="mt-5 space-y-6">
            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">功能上落架（場館營運）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={featuresSaving}
                  onClick={saveFeatures}
                >
                  儲存
                </button>
              </div>
              {featuresLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!featuresLoading && featuresError && <div className="text-sm text-red-500 mt-2">{featuresError}</div>}
              {!featuresLoading && !featuresError && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getFeaturesForTab('venue').map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{f.label}</div>
                        <div className="text-xs cue-muted break-all">{f.key}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={(e) => setFeaturesDraft((s) => s.map((x) => x.key === f.key ? { ...x, enabled: e.target.checked } : x))}
                      />
                    </label>
                  ))}
                </div>
              )}
              {featuresSaveResult && <div className="text-sm cue-muted mt-2">{featuresSaveResult}</div>}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-bold">主頁廣告位（場館）</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    disabled={adsSaving}
                    onClick={() => saveAd('venue')}
                  >
                    儲存規則
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    disabled={adsSaving}
                    onClick={() => savePlacementItems('venue')}
                  >
                    儲存投放
                  </button>
                </div>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adConfigDraft.venue?.enabled !== false}
                      onChange={(e) => setAdConfigDraft((s) => ({ ...s, venue: { ...(s.venue || {}), enabled: e.target.checked } }))}
                    />
                    <span>啟用（沒有投放廣告會自動不顯示）</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm cue-muted mb-1">停留（秒）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.venue?.displaySeconds ?? 15)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, venue: { ...(s.venue || {}), displaySeconds: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={3}
                        max={60}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最短（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.venue?.minIntervalMinutes ?? 20)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, venue: { ...(s.venue || {}), minIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最長（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.venue?.maxIntervalMinutes ?? 30)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, venue: { ...(s.venue || {}), maxIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm cue-muted mb-1">投放（勾選後會輪播）</div>
                    {renderPlacementPicker('venue')}
                  </div>
                  {adsSaveResult && <div className="text-sm cue-muted">{adsSaveResult}</div>}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <AdminModulePanel
                categories={['operations', 'payment']}
                title="場館營運模組"
                description="集中管理預約、掃碼起鐘、結算與積分等場館營運模組。"
              />
            </div>
          </div>
        )}

        {activeTab === 'member' && (
          <div className="mt-5 space-y-6">
            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">全站公告</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={saving}
                  onClick={async () => {
                    setSaveResult(null);
                    setSaving(true);
                    try {
                      const tok = resolveToken();
                      await updateSiteNotice(API_URL, tok, {
                        enabled: noticeDraft.enabled,
                        message: noticeDraft.message,
                        youtubeEmbedUrl: noticeDraft.youtubeEmbedUrl.trim() ? noticeDraft.youtubeEmbedUrl.trim() : null,
                        homeShowLeaderboard: noticeDraft.homeShowLeaderboard,
                        homeShowClubList: noticeDraft.homeShowClubList,
                      });
                      setSaveResult('已儲存');
                    } catch (e: any) {
                      setSaveResult(e?.message || '儲存失敗');
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  儲存
                </button>
              </div>
              {noticeLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!noticeLoading && noticeError && <div className="text-sm text-red-500 mt-2">{noticeError}</div>}
              {!noticeLoading && !noticeError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={noticeDraft.enabled}
                      onChange={(e) => setNoticeDraft((s) => ({ ...s, enabled: e.target.checked }))}
                    />
                    <span>啟用公告</span>
                  </label>
                  <div>
                    <div className="text-sm cue-muted mb-1">公告內容</div>
                    <textarea
                      value={noticeDraft.message}
                      onChange={(e) => setNoticeDraft((s) => ({ ...s, message: e.target.value }))}
                      rows={6}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <div className="text-sm cue-muted mb-1">YouTube Embed URL（可選）</div>
                    <input
                      value={noticeDraft.youtubeEmbedUrl}
                      onChange={(e) => setNoticeDraft((s) => ({ ...s, youtubeEmbedUrl: e.target.value }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="例如：https://www.youtube.com/embed/xxxxxxxx"
                    />
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-sm cue-muted mb-2">首頁設定</div>
                    <div className="text-xs cue-muted mb-2">控制首頁主分頁是否顯示「綜合單杆龍虎榜」及「場館列表」。即使這裡已開啟，相關會員 / 場館仍需各自開啟公開設定先會有資料顯示。</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={noticeDraft.homeShowLeaderboard}
                          onChange={(e) => setNoticeDraft((s) => ({ ...s, homeShowLeaderboard: e.target.checked }))}
                        />
                        <span>顯示：綜合單杆龍虎榜</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={noticeDraft.homeShowClubList}
                          onChange={(e) => setNoticeDraft((s) => ({ ...s, homeShowClubList: e.target.checked }))}
                        />
                        <span>顯示：場館列表</span>
                      </label>
                    </div>
                  </div>
                  {saveResult && <div className="text-sm cue-muted">{saveResult}</div>}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-lg font-bold">主頁廣告位（會員）</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    disabled={adsSaving}
                    onClick={() => saveAd('member')}
                  >
                    儲存規則
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    disabled={adsSaving}
                    onClick={() => savePlacementItems('member')}
                  >
                    儲存投放
                  </button>
                </div>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adConfigDraft.member?.enabled !== false}
                      onChange={(e) => setAdConfigDraft((s) => ({ ...s, member: { ...(s.member || {}), enabled: e.target.checked } }))}
                    />
                    <span>啟用（沒有投放廣告會自動不顯示）</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm cue-muted mb-1">停留（秒）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.member?.displaySeconds ?? 15)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, member: { ...(s.member || {}), displaySeconds: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={3}
                        max={60}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最短（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.member?.minIntervalMinutes ?? 20)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, member: { ...(s.member || {}), minIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最長（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adConfigDraft.member?.maxIntervalMinutes ?? 30)}
                        onChange={(e) => setAdConfigDraft((s) => ({ ...s, member: { ...(s.member || {}), maxIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-sm cue-muted mb-1">投放（勾選後會輪播）</div>
                    {renderPlacementPicker('member')}
                  </div>
                  {adsSaveResult && <div className="text-sm cue-muted">{adsSaveResult}</div>}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">功能上落架（會員／內容）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={featuresSaving}
                  onClick={saveFeatures}
                >
                  儲存
                </button>
              </div>
              {featuresLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!featuresLoading && featuresError && <div className="text-sm text-red-500 mt-2">{featuresError}</div>}
              {!featuresLoading && !featuresError && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getFeaturesForTab('member').map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{f.label}</div>
                        <div className="text-xs cue-muted break-all">{f.key}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={(e) => setFeaturesDraft((s) => s.map((x) => x.key === f.key ? { ...x, enabled: e.target.checked } : x))}
                      />
                    </label>
                  ))}
                </div>
              )}
              {featuresSaveResult && <div className="text-sm cue-muted mt-2">{featuresSaveResult}</div>}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <AdminModulePanel
                categories={['membership', 'content']}
                title="會員／內容模組"
                description="集中管理會員系統、直播、球會訊息與內容相關模組設定。"
              />
            </div>
          </div>
        )}

        {activeTab === 'competition' && (
          <div className="mt-5 space-y-6">
            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">功能上落架（賽事／單杆）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={featuresSaving}
                  onClick={saveFeatures}
                >
                  儲存
                </button>
              </div>
              {featuresLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!featuresLoading && featuresError && <div className="text-sm text-red-500 mt-2">{featuresError}</div>}
              {!featuresLoading && !featuresError && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getFeaturesForTab('competition').map((f) => (
                    <label key={f.key} className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{f.label}</div>
                        <div className="text-xs cue-muted break-all">{f.key}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={(e) => setFeaturesDraft((s) => s.map((x) => x.key === f.key ? { ...x, enabled: e.target.checked } : x))}
                      />
                    </label>
                  ))}
                </div>
              )}
              {featuresSaveResult && <div className="text-sm cue-muted mt-2">{featuresSaveResult}</div>}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <AdminModulePanel
                categories={['engagement']}
                title="賽事／單杆模組"
                description="集中管理賽事報名、單杆統計與公開排名相關模組。"
              />
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="mt-5">
            <AdminMembersPanel
              embedded
              title="會員列表"
              description="將原本舊版 PANEL 收口為系統管理內的會員列表分頁，方便集中管理會員與場館戶口。"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;
