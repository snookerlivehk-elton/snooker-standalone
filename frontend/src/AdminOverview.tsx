import React, { useEffect, useRef, useState } from 'react';
import { API_URL } from './config';
import { getAdminFeatures, getAdminSiteAds, getSiteNotice, updateAdminFeatures, updateAdminSiteAd, updateSiteNotice, uploadAdminSiteAdImage } from './lib/api';
import { clearFeatureCache } from './lib/features';
import Tabs from './components/Tabs';

const AdminOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [noticeLoading, setNoticeLoading] = useState<boolean>(true);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<{ enabled: boolean; message: string; youtubeEmbedUrl: string }>({
    enabled: true,
    message: '',
    youtubeEmbedUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresError, setFeaturesError] = useState<string | null>(null);
  const [featuresDraft, setFeaturesDraft] = useState<Array<{ key: string; label: string; enabled: boolean }>>([]);
  const [featuresSaving, setFeaturesSaving] = useState(false);
  const [featuresSaveResult, setFeaturesSaveResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'system' | 'venue' | 'member' | 'competition'>('system');
  const [adsLoading, setAdsLoading] = useState(true);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [adsSaving, setAdsSaving] = useState(false);
  const [adsSaveResult, setAdsSaveResult] = useState<string | null>(null);
  const [adsDraft, setAdsDraft] = useState<Record<string, { enabled: boolean; imageUrl: string; linkUrl: string; displaySeconds: number; minIntervalMinutes: number; maxIntervalMinutes: number; updatedAt?: string }>>({
    system: { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
    venue: { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
    member: { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
  });
  const systemAdFileRef = useRef<HTMLInputElement | null>(null);
  const venueAdFileRef = useRef<HTMLInputElement | null>(null);
  const memberAdFileRef = useRef<HTMLInputElement | null>(null);

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

  function resolveTab(): 'system' | 'venue' | 'member' | 'competition' {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      if (t === 'venue' || t === 'member' || t === 'competition' || t === 'system') return t;
      return (localStorage.getItem('adminOverviewTab') as any) || 'system';
    } catch {
      return 'system';
    }
  }

  function updateTab(t: 'system' | 'venue' | 'member' | 'competition') {
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

  async function saveAd(placement: 'system' | 'venue' | 'member') {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      const draft = adsDraft[placement] || { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 };
      const imageUrl = String(draft.imageUrl || '').trim();
      const linkUrl = String(draft.linkUrl || '').trim();
      const displaySeconds = Math.max(3, Math.min(60, Number(draft.displaySeconds || 15) || 15));
      const minIntervalMinutes = Math.max(1, Math.min(24 * 60, Number(draft.minIntervalMinutes || 20) || 20));
      const maxIntervalMinutes = Math.max(1, Math.min(24 * 60, Number(draft.maxIntervalMinutes || 30) || 30));
      await updateAdminSiteAd(API_URL, tok, placement, {
        enabled: !!draft.enabled,
        imageUrl: imageUrl ? imageUrl : null,
        linkUrl: linkUrl ? linkUrl : null,
        displaySeconds,
        minIntervalMinutes,
        maxIntervalMinutes,
      });
      const row = await getAdminSiteAds(API_URL, tok);
      const next: any = { ...adsDraft };
      for (const a of Array.isArray((row as any)?.ads) ? (row as any).ads : []) {
        const id = String(a?.id || '').trim();
        if (!id) continue;
        next[id] = {
          enabled: a?.enabled !== false,
          imageUrl: String(a?.imageUrl || ''),
          linkUrl: String(a?.linkUrl || ''),
          displaySeconds: Number(a?.displaySeconds ?? 15) || 15,
          minIntervalMinutes: Number(a?.minIntervalMinutes ?? 20) || 20,
          maxIntervalMinutes: Number(a?.maxIntervalMinutes ?? 30) || 30,
          updatedAt: a?.updatedAt ? String(a.updatedAt) : undefined,
        };
      }
      setAdsDraft(next);
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

  async function uploadAdImage(placement: 'system' | 'venue' | 'member', file: File) {
    setAdsSaveResult(null);
    setAdsSaving(true);
    try {
      const tok = resolveToken();
      const dataUrl = await readFileAsDataUrl(file);
      const res = await uploadAdminSiteAdImage(API_URL, tok, placement, {
        filename: file.name,
        contentType: file.type,
        dataUrl,
      });
      const ad = (res as any)?.ad;
      if (ad?.imageUrl) {
        setAdsDraft((s) => ({
          ...s,
          [placement]: {
            ...(s[placement] || { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 }),
            imageUrl: String(ad.imageUrl || ''),
            updatedAt: ad?.updatedAt ? String(ad.updatedAt) : (s[placement] as any)?.updatedAt,
          },
        }));
      }
      setAdsSaveResult('已上載圖片');
    } catch (e: any) {
      setAdsSaveResult(e?.message || '上載失敗');
    } finally {
      setAdsSaving(false);
    }
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
        const row = await getAdminSiteAds(API_URL, tok);
        const next: any = {
          system: { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
          venue: { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
          member: { enabled: true, imageUrl: '', linkUrl: '', displaySeconds: 15, minIntervalMinutes: 20, maxIntervalMinutes: 30 },
        };
        for (const a of Array.isArray((row as any)?.ads) ? (row as any).ads : []) {
          const id = String(a?.id || '').trim();
          if (!id) continue;
          next[id] = {
            enabled: a?.enabled !== false,
            imageUrl: String(a?.imageUrl || ''),
            linkUrl: String(a?.linkUrl || ''),
            displaySeconds: Number(a?.displaySeconds ?? 15) || 15,
            minIntervalMinutes: Number(a?.minIntervalMinutes ?? 20) || 20,
            maxIntervalMinutes: Number(a?.maxIntervalMinutes ?? 30) || 30,
            updatedAt: a?.updatedAt ? String(a.updatedAt) : undefined,
          };
        }
        if (!cancelled) setAdsDraft(next);
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
            <div className="text-sm cue-muted mt-1">手機可用分頁：系統 / 場館 / 會員內容 / 賽事與單杆</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => {
                const base = resolveBasePath();
                const tok = resolveToken();
                window.location.href = `${window.location.origin}${base}/admin/legacy${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
              }}
            >
              舊版PANEL
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => {
                const base = resolveBasePath();
                const tok = resolveToken();
                window.location.href = `${window.location.origin}${base}/admin/breaks${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
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
                <div className="text-lg font-bold">主頁廣告位（系統）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={adsSaving}
                  onClick={() => saveAd('system')}
                >
                  儲存
                </button>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adsDraft.system?.enabled !== false}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, system: { ...(s.system || {}), enabled: e.target.checked } }))}
                    />
                    <span>啟用（沒有圖或沒有連結會自動不顯示）</span>
                  </label>
                  <div>
                    <div className="text-sm cue-muted mb-1">圖片 URL</div>
                    <input
                      value={adsDraft.system?.imageUrl || ''}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, system: { ...(s.system || {}), imageUrl: e.target.value } }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="https://.../banner.jpg"
                    />
                    <input
                      ref={systemAdFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={adsSaving}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = '';
                        if (!f) return;
                        uploadAdImage('system', f);
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm cue-muted mb-1">跳轉連結</div>
                    <input
                      value={adsDraft.system?.linkUrl || ''}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, system: { ...(s.system || {}), linkUrl: e.target.value } }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm cue-muted mb-1">停留（秒）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.system?.displaySeconds ?? 15)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, system: { ...(s.system || {}), displaySeconds: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={3}
                        max={60}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最短（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.system?.minIntervalMinutes ?? 20)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, system: { ...(s.system || {}), minIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最長（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.system?.maxIntervalMinutes ?? 30)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, system: { ...(s.system || {}), maxIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full cue-surface rounded-lg p-2 text-left hover:brightness-95"
                    disabled={adsSaving}
                    onClick={() => systemAdFileRef.current?.click()}
                  >
                    {adsDraft.system?.imageUrl ? (
                      <img
                        src={String(adsDraft.system.imageUrl)}
                        alt=""
                        className="w-full rounded object-cover max-h-[30vh]"
                        onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full rounded-lg border border-dashed border-white/20 p-6 text-sm cue-muted text-center">
                        按此上載圖片（JPG/PNG/WebP，最多 3MB）
                      </div>
                    )}
                  </button>
                  {adsSaveResult && <div className="text-sm cue-muted">{adsSaveResult}</div>}
                </div>
              )}
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
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">主頁廣告位（場館）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={adsSaving}
                  onClick={() => saveAd('venue')}
                >
                  儲存
                </button>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adsDraft.venue?.enabled !== false}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, venue: { ...(s.venue || {}), enabled: e.target.checked } }))}
                    />
                    <span>啟用（沒有圖或沒有連結會自動不顯示）</span>
                  </label>
                  <div>
                    <div className="text-sm cue-muted mb-1">圖片 URL</div>
                    <input
                      value={adsDraft.venue?.imageUrl || ''}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, venue: { ...(s.venue || {}), imageUrl: e.target.value } }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="https://.../banner.jpg"
                    />
                    <input
                      ref={venueAdFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={adsSaving}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = '';
                        if (!f) return;
                        uploadAdImage('venue', f);
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm cue-muted mb-1">跳轉連結</div>
                    <input
                      value={adsDraft.venue?.linkUrl || ''}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, venue: { ...(s.venue || {}), linkUrl: e.target.value } }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm cue-muted mb-1">停留（秒）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.venue?.displaySeconds ?? 15)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, venue: { ...(s.venue || {}), displaySeconds: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={3}
                        max={60}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最短（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.venue?.minIntervalMinutes ?? 20)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, venue: { ...(s.venue || {}), minIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最長（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.venue?.maxIntervalMinutes ?? 30)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, venue: { ...(s.venue || {}), maxIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full cue-surface rounded-lg p-2 text-left hover:brightness-95"
                    disabled={adsSaving}
                    onClick={() => venueAdFileRef.current?.click()}
                  >
                    {adsDraft.venue?.imageUrl ? (
                      <img
                        src={String(adsDraft.venue.imageUrl)}
                        alt=""
                        className="w-full rounded object-cover max-h-[30vh]"
                        onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full rounded-lg border border-dashed border-white/20 p-6 text-sm cue-muted text-center">
                        按此上載圖片（JPG/PNG/WebP，最多 3MB）
                      </div>
                    )}
                  </button>
                  {adsSaveResult && <div className="text-sm cue-muted">{adsSaveResult}</div>}
                </div>
              )}
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
                  {saveResult && <div className="text-sm cue-muted">{saveResult}</div>}
                </div>
              )}
            </div>

            <div className="bg-black/40 border border-white/10 rounded p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">主頁廣告位（會員）</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={adsSaving}
                  onClick={() => saveAd('member')}
                >
                  儲存
                </button>
              </div>
              {adsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
              {!adsLoading && adsError && <div className="text-sm text-red-500 mt-2">{adsError}</div>}
              {!adsLoading && !adsError && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={adsDraft.member?.enabled !== false}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, member: { ...(s.member || {}), enabled: e.target.checked } }))}
                    />
                    <span>啟用（沒有圖或沒有連結會自動不顯示）</span>
                  </label>
                  <div>
                    <div className="text-sm cue-muted mb-1">圖片 URL</div>
                    <input
                      value={adsDraft.member?.imageUrl || ''}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, member: { ...(s.member || {}), imageUrl: e.target.value } }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="https://.../banner.jpg"
                    />
                    <input
                      ref={memberAdFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={adsSaving}
                      onChange={(e) => {
                        const f = e.currentTarget.files?.[0];
                        e.currentTarget.value = '';
                        if (!f) return;
                        uploadAdImage('member', f);
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm cue-muted mb-1">跳轉連結</div>
                    <input
                      value={adsDraft.member?.linkUrl || ''}
                      onChange={(e) => setAdsDraft((s) => ({ ...s, member: { ...(s.member || {}), linkUrl: e.target.value } }))}
                      className="w-full cue-input rounded px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <div className="text-sm cue-muted mb-1">停留（秒）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.member?.displaySeconds ?? 15)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, member: { ...(s.member || {}), displaySeconds: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={3}
                        max={60}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最短（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.member?.minIntervalMinutes ?? 20)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, member: { ...(s.member || {}), minIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                    <div>
                      <div className="text-sm cue-muted mb-1">最長（分鐘）</div>
                      <input
                        type="number"
                        value={Number(adsDraft.member?.maxIntervalMinutes ?? 30)}
                        onChange={(e) => setAdsDraft((s) => ({ ...s, member: { ...(s.member || {}), maxIntervalMinutes: Number(e.target.value || 0) } }))}
                        className="w-full cue-input rounded px-3 py-2 text-sm"
                        min={1}
                        max={1440}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full cue-surface rounded-lg p-2 text-left hover:brightness-95"
                    disabled={adsSaving}
                    onClick={() => memberAdFileRef.current?.click()}
                  >
                    {adsDraft.member?.imageUrl ? (
                      <img
                        src={String(adsDraft.member.imageUrl)}
                        alt=""
                        className="w-full rounded object-cover max-h-[30vh]"
                        onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full rounded-lg border border-dashed border-white/20 p-6 text-sm cue-muted text-center">
                        按此上載圖片（JPG/PNG/WebP，最多 3MB）
                      </div>
                    )}
                  </button>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOverview;
