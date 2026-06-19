import { useEffect, useMemo, useState } from 'react';

export const FEATURE_CATALOG = [
  { key: 'booking', label: '會員預約', defaultEnabled: true },
  { key: 'qr_session', label: '掃碼起鐘及結算', defaultEnabled: true },
  { key: 'points', label: '消費積分', defaultEnabled: true },
  { key: 'highbreak', label: '單杆統計及排名', defaultEnabled: true },
  { key: 'tournaments', label: '比賽報名入口', defaultEnabled: false },
  { key: 'club_messages', label: '球會訊息', defaultEnabled: true },
  { key: 'club_dashboard', label: '球會主頁（管理）', defaultEnabled: true },
  { key: 'system_portal', label: '系統主頁', defaultEnabled: true },
  { key: 'member_portal', label: '會員主頁', defaultEnabled: true },
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

type ClubFeatureAccessMap = Record<string, { effectiveEnabled?: boolean; assignedEnabled?: boolean; globalEnabled?: boolean }>;
type ClubFeatureAccessResponse = { clubId: string; features: ClubFeatureAccessMap };

let cachedClubAccessKey: string | null = null;
let cachedClubAccessValue: ClubFeatureAccessResponse | null = null;
let cachedClubAccessAt = 0;
let inflightClubAccess: Promise<ClubFeatureAccessResponse | null> | null = null;

function tryParseMemberSession(): { id?: string; role?: string } {
  try {
    return JSON.parse(localStorage.getItem('memberSession') || '{}') || {};
  } catch {
    return {};
  }
}

function detectClubIdFromPath(): string | null {
  try {
    const p = String(window.location.pathname || '');
    const m = p.match(/\/club\/([^/?#]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function detectVenueDashboard(): boolean {
  try {
    const p = String(window.location.pathname || '');
    return p.includes('/venue/dashboard');
  } catch {
    return false;
  }
}

async function fetchClubScopedAccess(apiUrl: string): Promise<ClubFeatureAccessResponse | null> {
  if (typeof window === 'undefined') return null;
  const now = Date.now();
  const base = apiUrl.replace(/\/$/, '');

  const session = tryParseMemberSession();
  const memberId = String(session?.id || '').trim();
  const role = String(session?.role || '').toUpperCase();

  const clubIdFromPath = detectClubIdFromPath();
  const isVenue = detectVenueDashboard();

  let cacheKey: string | null = null;
  let url: string | null = null;
  let headers: Record<string, string> | undefined;

  if (isVenue && memberId && role === 'ADMIN') {
    cacheKey = `admin:${memberId}`;
    url = `${base}/api/club/features/access`;
    headers = { 'x-member-id': memberId };
  } else if (clubIdFromPath) {
    cacheKey = `public:${clubIdFromPath}`;
    url = `${base}/api/club/${encodeURIComponent(clubIdFromPath)}/features/public`;
    headers = undefined;
  } else {
    return null;
  }

  if (
    cachedClubAccessValue &&
    cachedClubAccessKey === cacheKey &&
    (now - cachedClubAccessAt) < 10_000
  ) {
    return cachedClubAccessValue;
  }
  if (inflightClubAccess) return inflightClubAccess;

  inflightClubAccess = (async () => {
    try {
      const res = await fetch(url!, { headers, cache: 'no-store' });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== 'object') return null;
      const clubId = String((json as any).clubId || '').trim();
      const features = (json as any).features;
      if (!clubId || !features || typeof features !== 'object') return null;
      const value: ClubFeatureAccessResponse = { clubId, features };
      cachedClubAccessKey = cacheKey;
      cachedClubAccessValue = value;
      cachedClubAccessAt = Date.now();
      return value;
    } catch {
      return null;
    } finally {
      inflightClubAccess = null;
    }
  })();

  return inflightClubAccess;
}

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
  cachedClubAccessKey = null;
  cachedClubAccessValue = null;
  cachedClubAccessAt = 0;
  inflightClubAccess = null;
  try {
    localStorage.removeItem('featureFlags');
  } catch {}
}

export function useFeatureEnabled(apiUrl: string, key: FeatureKey) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(() => buildDefaults()[key] !== false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchFeatures(apiUrl), fetchClubScopedAccess(apiUrl)])
      .then(([m, clubAccess]) => {
        if (cancelled) return;
        const globalEnabled = m[key] !== false;
        if (key === 'booking' || key === 'qr_session' || key === 'points' || key === 'tournaments') {
          const eff = clubAccess?.features?.[key]?.effectiveEnabled;
          if (typeof eff === 'boolean') {
            setEnabled(eff);
          } else {
            setEnabled(globalEnabled);
          }
        } else {
          setEnabled(globalEnabled);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEnabled(buildDefaults()[key] !== false);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [apiUrl, key]);
  return useMemo(() => ({ loading, enabled }), [loading, enabled]);
}
