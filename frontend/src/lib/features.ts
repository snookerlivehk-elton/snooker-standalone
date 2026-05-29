import { useEffect, useMemo, useState } from 'react';

export const FEATURE_CATALOG = [
  { key: 'booking', label: '會員預約', defaultEnabled: true },
  { key: 'qr_session', label: '掃碼起鐘及結算', defaultEnabled: true },
  { key: 'points', label: '消費積分', defaultEnabled: true },
  { key: 'highbreak', label: '單杆統計及排名', defaultEnabled: true },
  { key: 'tournaments', label: '比賽報名入口', defaultEnabled: true },
  { key: 'club_messages', label: '球會訊息', defaultEnabled: true },
  { key: 'club_dashboard', label: '球會主頁（管理）', defaultEnabled: true },
  { key: 'system_portal', label: '系統主頁', defaultEnabled: true },
  { key: 'member_portal', label: '會員主頁', defaultEnabled: true },
  { key: 'scoring', label: '計分', defaultEnabled: true },
  { key: 'live', label: '直播', defaultEnabled: true },
] as const;

export type FeatureKey = typeof FEATURE_CATALOG[number]['key'];

function buildDefaults(): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const f of FEATURE_CATALOG) m[f.key] = f.defaultEnabled;
  return m;
}

let cachedValue: Record<string, boolean> | null = null;
let cachedAt = 0;
let inflight: Promise<Record<string, boolean>> | null = null;

export async function fetchFeatures(apiUrl: string): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (cachedValue && (now - cachedAt) < 10_000) return cachedValue;
  if (inflight) return inflight;
  inflight = (async () => {
    const defaults = buildDefaults();
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/api/features`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json().catch(() => ({}));
      const merged = { ...defaults, ...(json?.features || {}) };
      cachedValue = merged;
      cachedAt = Date.now();
      try {
        localStorage.setItem('featureFlags', JSON.stringify({ at: cachedAt, value: merged }));
      } catch {}
      return merged;
    } catch {
      try {
        const raw = localStorage.getItem('featureFlags');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.value && typeof parsed.value === 'object') {
            const merged = { ...defaults, ...parsed.value };
            cachedValue = merged;
            cachedAt = Date.now();
            return merged;
          }
        }
      } catch {}
      cachedValue = defaults;
      cachedAt = Date.now();
      return defaults;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function clearFeatureCache() {
  cachedValue = null;
  cachedAt = 0;
  inflight = null;
  try {
    localStorage.removeItem('featureFlags');
  } catch {}
}

export function useFeatureEnabled(apiUrl: string, key: FeatureKey) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFeatures(apiUrl).then((m) => {
      if (cancelled) return;
      setEnabled(m[key] !== false);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setEnabled(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [apiUrl, key]);
  return useMemo(() => ({ loading, enabled }), [loading, enabled]);
}

