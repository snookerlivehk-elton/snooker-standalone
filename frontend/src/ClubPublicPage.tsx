import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import {
  cancelMyReservation,
  createReservation,
  getAvailability,
  getClubLeaderboardHighest,
  getClubLeaderboardMonthly,
  getMyJoinedClubs,
  getMyReservations,
  getMyClubPointsBalance,
  getPublicClubLiveAnnouncements,
  getPublicClubMessages,
  getPublicClubProfile,
  getPublicClubTournaments,
  getPublicPricing,
  getPublicTables,
  getSiteAds,
  joinClub,
  signupTournament,
} from './lib/api';
import TimeFeeCalculator from './components/TimeFeeCalculator';
import Tabs from './components/Tabs';
import { useFeatureEnabled } from './lib/features';

function normalizeVideoHref(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

type LocalMsgState = { read: Record<string, boolean>; hidden: Record<string, boolean> };

type InboxItem = {
  key: string;
  kind: 'system' | 'club' | 'live';
  title: string;
  content: string;
  createdAt: Date;
  subtitle?: string;
  href?: string | null;
  read: boolean;
  deletable: boolean;
  raw?: any;
};

const ClubPublicPage: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const nav = useNavigate();
  const loc = useLocation();
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selTable, setSelTable] = useState<string>('');
  const [selScheme, setSelScheme] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [start, setStart] = useState<string>('10:00');
  const [hours, setHours] = useState<number>(1);
  const [dayReservations, setDayReservations] = useState<any[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [myReservations, setMyReservations] = useState<any[]>([]);
  const [myResLoading, setMyResLoading] = useState(false);
  const [myResError, setMyResError] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [submitModal, setSubmitModal] = useState<{ open: boolean; quote: number | null }>({ open: false, quote: null });

  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderHighest, setLeaderHighest] = useState<any[]>([]);
  const [leaderMonthly, setLeaderMonthly] = useState<any[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'booking' | 'messages' | 'signup' | 'live' | 'leader' | 'info' | 'contact'>('booking');

  const [clubMessages, setClubMessages] = useState<any[]>([]);
  const [clubMessagesLoading, setClubMessagesLoading] = useState(false);
  const [clubMsgOpenId, setClubMsgOpenId] = useState<string | null>(null);

  const [clubLive, setClubLive] = useState<any[]>([]);
  const [clubLiveLoading, setClubLiveLoading] = useState(false);
  const [clubLiveState, setClubLiveState] = useState<{ read: Record<string, boolean>; hidden: Record<string, boolean> }>({ read: {}, hidden: {} });
  const [clubLiveSelected, setClubLiveSelected] = useState<Record<string, boolean>>({});
  const [clubLiveOpenKey, setClubLiveOpenKey] = useState<string | null>(null);

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState<any>(null);
  const [tournamentOpenLoading, setTournamentOpenLoading] = useState(false);
  const [tournamentSubmitModal, setTournamentSubmitModal] = useState<{ open: boolean; title: string; guide: string }>({ open: false, title: '', guide: '' });
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);
  const isLoggedIn = !!(session && (session as any).id);
  const sessionMemberId = String((session as any)?.id || '').trim() || null;

  const { enabled: clubMessagesEnabled } = useFeatureEnabled(API_URL, 'club_messages');
  const { enabled: liveEnabled } = useFeatureEnabled(API_URL, 'live');
  const { enabled: tournamentsEnabled } = useFeatureEnabled(API_URL, 'tournaments');
  const { enabled: pointsEnabled } = useFeatureEnabled(API_URL, 'points');
  const { enabled: systemPortalEnabled } = useFeatureEnabled(API_URL, 'system_portal');

  const [myPoints, setMyPoints] = useState<{ balance: number; updatedAt: string | null } | null>(null);
  const [myPointsLoading, setMyPointsLoading] = useState(false);

  const [siteAd, setSiteAd] = useState<any>(null);
  const [siteAdOpen, setSiteAdOpen] = useState(false);
  const [siteAdNextAt, setSiteAdNextAt] = useState<number | null>(null);
  const siteAdWasOpenRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getSiteAds(API_URL, 'venue');
        const ad = Array.isArray((res as any)?.ads) ? (res as any).ads[0] : null;
        if (!mounted) return;
        setSiteAd(ad || null);
        if (!ad) return;
        const key = `siteAdSeen:venue`;
        let prev: any = null;
        try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
        const now = Date.now();
        const currUpdatedAt = String(ad?.updatedAt || '');
        const prevUpdatedAt = String(prev?.updatedAt || '');
        const prevSeenAt = Number(prev?.seenAt || 0) || 0;
        const prevNextAt = Number(prev?.nextAt || 0) || 0;

        const minM = Math.max(1, Math.min(24 * 60, Number((ad as any)?.minIntervalMinutes ?? 20) || 20));
        const maxM = Math.max(1, Math.min(24 * 60, Number((ad as any)?.maxIntervalMinutes ?? 30) || 30));
        const low = Math.min(minM, maxM);
        const high = Math.max(minM, maxM);
        const pickMinutes = low + Math.floor(Math.random() * (high - low + 1));

        let nextAt = prevNextAt || (prevSeenAt ? (prevSeenAt + pickMinutes * 60 * 1000) : 0);
        if (!prev || prevUpdatedAt !== currUpdatedAt) nextAt = now;
        if (!nextAt) nextAt = now;

        if (mounted) setSiteAdNextAt(nextAt);
        try { localStorage.setItem(key, JSON.stringify({ updatedAt: currUpdatedAt, seenAt: prevSeenAt || 0, nextAt })); } catch {}
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!siteAd || !siteAdNextAt) return;
    if (!siteAd?.imageUrl || !siteAd?.linkUrl) return;
    const key = `siteAdSeen:venue`;
    const now = Date.now();
    const delay = Math.max(0, siteAdNextAt - now);
    const t = window.setTimeout(() => {
      setSiteAdOpen(true);
      try {
        const currUpdatedAt = String(siteAd?.updatedAt || '');
        localStorage.setItem(key, JSON.stringify({ updatedAt: currUpdatedAt, seenAt: Date.now(), nextAt: siteAdNextAt }));
      } catch {}
    }, delay);
    return () => window.clearTimeout(t);
  }, [siteAd, siteAdNextAt]);

  useEffect(() => {
    if (!siteAdOpen) return;
    const ds = Math.max(3, Math.min(60, Number((siteAd as any)?.displaySeconds ?? 15) || 15));
    const t = window.setTimeout(() => setSiteAdOpen(false), ds * 1000);
    return () => window.clearTimeout(t);
  }, [siteAdOpen, siteAd?.updatedAt]);

  useEffect(() => {
    const wasOpen = siteAdWasOpenRef.current;
    siteAdWasOpenRef.current = siteAdOpen;
    if (!siteAd) return;
    if (!wasOpen || siteAdOpen) return;
    const key = `siteAdSeen:venue`;
    const now = Date.now();
    const minM = Math.max(1, Math.min(24 * 60, Number((siteAd as any)?.minIntervalMinutes ?? 20) || 20));
    const maxM = Math.max(1, Math.min(24 * 60, Number((siteAd as any)?.maxIntervalMinutes ?? 30) || 30));
    const low = Math.min(minM, maxM);
    const high = Math.max(minM, maxM);
    const pickMinutes = low + Math.floor(Math.random() * (high - low + 1));
    const nextAt = now + pickMinutes * 60 * 1000;
    setSiteAdNextAt(nextAt);
    try {
      const updatedAt = String(siteAd?.updatedAt || '');
      localStorage.setItem(key, JSON.stringify({ updatedAt, seenAt: now, nextAt }));
    } catch {}
  }, [siteAdOpen, siteAd]);

  useEffect(() => {
    if (activeTab === 'messages' && !clubMessagesEnabled) setActiveTab('booking');
    if (activeTab === 'signup' && !tournamentsEnabled) setActiveTab('booking');
    if (activeTab === 'live' && !liveEnabled) setActiveTab('booking');
  }, [activeTab, clubMessagesEnabled, liveEnabled, tournamentsEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pointsEnabled || !sessionMemberId || !club?.id) {
        if (mounted) setMyPoints(null);
        return;
      }
      setMyPointsLoading(true);
      try {
        const row = await getMyClubPointsBalance(API_URL, sessionMemberId, String(club.id));
        const bal = Number((row as any)?.balance ?? 0);
        if (mounted) setMyPoints({ balance: Number.isFinite(bal) ? bal : 0, updatedAt: (row as any)?.updatedAt ?? null });
      } catch {
        if (mounted) setMyPoints(null);
      } finally {
        if (mounted) setMyPointsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [pointsEnabled, sessionMemberId, club?.id]);

  const galleryUrls = useMemo(() => {
    const raw = (club as any)?.galleryUrls;
    if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean);
    return [];
  }, [club]);

  const facilities = useMemo(() => {
    const raw = (club as any)?.facilities;
    if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean);
    return [];
  }, [club]);

  const normalizeImageSrc = useCallback((raw: any) => {
    const s = String(raw || '').trim();
    if (!s) return null;
    if (/^data:/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return `https:${s}`;
    if (s.startsWith('/')) return `${API_URL.replace(/\/$/, '')}${s}`;
    return `https://${s}`;
  }, []);

  const logoSrc = useMemo(() => {
    const raw = String((club as any)?.logoUrl || (club as any)?.logo_url || '').trim();
    return normalizeImageSrc(raw);
  }, [club, normalizeImageSrc]);

  const coverSrc = useMemo(() => {
    const raw = String((club as any)?.coverImageUrl || (club as any)?.cover_image_url || '').trim();
    const fallback = String((club as any)?.logoUrl || (club as any)?.logo_url || '').trim();
    return normalizeImageSrc(raw || fallback);
  }, [club, normalizeImageSrc]);

  const heroImages = useMemo(() => {
    const list: string[] = [];
    if (coverSrc) list.push(coverSrc);
    for (const u of galleryUrls) {
      const n = normalizeImageSrc(u);
      if (n) list.push(n);
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const u of list) {
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out.slice(0, 12);
  }, [coverSrc, galleryUrls, normalizeImageSrc]);

  const heroRef = useRef<HTMLDivElement | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    setHeroIndex(0);
    try {
      if (heroRef.current) heroRef.current.scrollLeft = 0;
    } catch {}
  }, [clubId, heroImages.length]);

  const onHeroScroll = useCallback(() => {
    const el = heroRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const idx = Math.round((el.scrollLeft || 0) / w);
    const maxIdx = Math.max(0, heroImages.length - 1);
    setHeroIndex(Math.min(Math.max(idx, 0), maxIdx));
  }, [heroImages.length]);

  const mapHref = useMemo(() => {
    const raw = String((club as any)?.mapUrl || (club as any)?.map_url || '').trim();
    if (raw) return normalizeVideoHref(raw);
    const addr = String((club as any)?.address || '').trim();
    if (!addr) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  }, [club]);

  const pad2 = useCallback((n: number) => String(n).padStart(2, '0'), []);
  const minDate = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, [pad2]);

  useEffect(() => {
    if (!date) setDate(minDate);
  }, [date, minDate]);

  const selectedStartAt = useMemo(() => {
    if (!date || !start) return null;
    const [h, m] = start.split(':').map(x => parseInt(x, 10));
    const s = new Date(date);
    s.setHours(h || 0, m || 0, 0, 0);
    return Number.isFinite(s.getTime()) ? s : null;
  }, [date, start]);

  const selectedEndAt = useMemo(() => {
    if (!selectedStartAt) return null;
    const h = Math.max(1, Number(hours) || 1);
    const e = new Date(selectedStartAt.getTime() + h * 60 * 60 * 1000);
    return Number.isFinite(e.getTime()) ? e : null;
  }, [selectedStartAt, hours]);

  const isPastStartTime = useMemo(() => {
    if (!selectedStartAt) return false;
    return selectedStartAt.getTime() < Date.now() - 60_000;
  }, [selectedStartAt]);

  const daySlotButtons = useMemo(() => {
    if (!date) return [];
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    if (!Number.isFinite(dayStart.getTime())) return [];

    const intervals = (Array.isArray(dayReservations) ? dayReservations : [])
      .map((r) => {
        const s = new Date(String((r as any)?.startAt));
        const e = new Date(String((r as any)?.endAt));
        if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return null;
        return { startAt: s.getTime(), endAt: e.getTime() };
      })
      .filter(Boolean) as Array<{ startAt: number; endAt: number }>;

    const overlaps = (aStart: number, aEnd: number) => intervals.some((it) => it.startAt < aEnd && it.endAt > aStart);

    return Array.from({ length: 24 }).map((_, hour) => {
      const slotStart = new Date(dayStart.getTime());
      slotStart.setHours(hour, 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      const busy = overlaps(slotStart.getTime(), slotEnd.getTime());
      const isPast = slotEnd.getTime() < Date.now() - 60_000;
      const label = `${pad2(hour)}:00`;
      return { hour, label, busy, isPast };
    });
  }, [dayReservations, date, pad2]);

  const loadClub = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPublicClubProfile(API_URL, clubId!);
      setClub(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load club');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    if (clubId) {
      loadClub();
      getPublicTables(API_URL, clubId).then(setTables).catch(() => setTables([]));
      setSchemes([]);
    }
  }, [clubId, loadClub]);

  useEffect(() => {
    if (!clubId || !session?.id) {
      setJoined(false);
      return;
    }
    getMyJoinedClubs(API_URL, session.id)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const ok = list.some((r: any) => String(r?.clubId || r?.club?.id || '') === String(clubId));
        setJoined(ok);
      })
      .catch(() => setJoined(false));
  }, [clubId, session]);

  useEffect(() => {
    if (!clubId) return;
    const key = `clubPageLiveState:${clubId}:${sessionMemberId || 'guest'}`;
    try {
      const raw = localStorage.getItem(key) || '{}';
      const obj = JSON.parse(raw);
      const read = (obj && typeof obj === 'object' ? obj.read : null) || {};
      const hidden = (obj && typeof obj === 'object' ? obj.hidden : null) || {};
      setClubLiveState({ read: read && typeof read === 'object' ? read : {}, hidden: hidden && typeof hidden === 'object' ? hidden : {} });
    } catch {
      setClubLiveState({ read: {}, hidden: {} });
    }
    setClubLiveSelected({});
    setClubLiveOpenKey(null);
  }, [clubId, sessionMemberId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clubId) return;
      if (!liveEnabled) {
        if (mounted) setClubLive([]);
        if (mounted) setClubLiveLoading(false);
        return;
      }
      setClubLiveLoading(true);
      try {
        const rows = await getPublicClubLiveAnnouncements(API_URL, clubId, 5);
        if (mounted) setClubLive(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setClubLive([]);
      } finally {
        if (mounted) setClubLiveLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clubId, liveEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clubId) return;
      if (!tournamentsEnabled) {
        if (mounted) setTournaments([]);
        if (mounted) setTournamentsLoading(false);
        return;
      }
      setTournamentsLoading(true);
      try {
        const rows = await getPublicClubTournaments(API_URL, clubId, sessionMemberId || undefined);
        if (mounted) setTournaments(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setTournaments([]);
      } finally {
        if (mounted) setTournamentsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clubId, sessionMemberId, tournamentsEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clubMessagesEnabled) {
        if (mounted) setClubMessages([]);
        if (mounted) setClubMessagesLoading(false);
        return;
      }
      setClubMessagesLoading(true);
      try {
        if (!clubId) {
          if (mounted) setClubMessages([]);
          return;
        }
        const rows = await getPublicClubMessages(API_URL, clubId, 50);
        if (mounted) setClubMessages(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setClubMessages([]);
      } finally {
        if (mounted) setClubMessagesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clubId, clubMessagesEnabled]);

  useEffect(() => {
    if (!clubId || !session?.id) {
      setMyReservations([]);
      setMyResError(null);
      return;
    }
    setMyResLoading(true);
    setMyResError(null);
    getMyReservations(API_URL, clubId, session.id)
      .then((rows) => setMyReservations(Array.isArray(rows) ? rows : []))
      .catch((e: any) => {
        setMyReservations([]);
        setMyResError(e?.message || '讀取我的預約失敗');
      })
      .finally(() => setMyResLoading(false));
  }, [clubId, session]);

  useEffect(() => {
    if (!clubId) {
      setLeaderHighest([]);
      setLeaderMonthly([]);
      setLeaderError(null);
      return;
    }
    let mounted = true;
    setLeaderLoading(true);
    setLeaderError(null);
    Promise.all([
      getClubLeaderboardHighest(API_URL, clubId, 10).catch(() => []),
      getClubLeaderboardMonthly(API_URL, clubId, leaderMonth, 10).catch(() => []),
    ])
      .then(([highest, monthly]) => {
        if (!mounted) return;
        setLeaderHighest(Array.isArray(highest) ? highest : []);
        setLeaderMonthly(Array.isArray(monthly) ? monthly : []);
      })
      .catch((e: any) => {
        if (!mounted) return;
        setLeaderError(e?.message || '讀取排行榜失敗');
      })
      .finally(() => {
        if (!mounted) return;
        setLeaderLoading(false);
      });
    return () => { mounted = false; };
  }, [clubId, leaderMonth]);

  useEffect(() => {
    if (!clubId || !selTable || !date || !start || !hours || selectedHours.length === 0) {
      setSchemes([]);
      return;
    }
    if (isPastStartTime) {
      setSchemes([]);
      return;
    }
    const [h, m] = start.split(':').map(x => parseInt(x, 10));
    const s = new Date(date);
    s.setHours(h || 0, m || 0, 0, 0);
    const e = new Date(s.getTime() + Math.max(1, Number(hours) || 1) * 60 * 60 * 1000);
    getPublicPricing(API_URL, clubId, selTable, s.toISOString(), e.toISOString())
      .then(setSchemes)
      .catch(() => setSchemes([]));
  }, [clubId, selTable, date, start, hours, isPastStartTime, selectedHours.length]);

  useEffect(() => {
    if (!clubId || !selTable || !date) {
      setDayReservations([]);
      setAvailError(null);
      return;
    }
    const from = new Date(date);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      setDayReservations([]);
      setAvailError('日期格式不正確');
      return;
    }
    setAvailLoading(true);
    setAvailError(null);
    getAvailability(API_URL, clubId, from.toISOString(), to.toISOString(), selTable)
      .then((rows) => setDayReservations(Array.isArray(rows) ? rows : []))
      .catch((e: any) => {
        setDayReservations([]);
        setAvailError(e?.message || '讀取可用性失敗');
      })
      .finally(() => setAvailLoading(false));
  }, [clubId, selTable, date]);

  useEffect(() => {
    if (selScheme && !schemes.some(s => s.id === selScheme)) setSelScheme('');
  }, [schemes, selScheme]);

  useEffect(() => {
    setSelectedHours([]);
    setStart('10:00');
    setHours(1);
    setSelScheme('');
    setSchemes([]);
  }, [clubId, selTable, date]);

  useEffect(() => {
    if (!selTable && Array.isArray(tables) && tables.length > 0) {
      setSelTable(String(tables[0]?.id || ''));
    }
  }, [tables, selTable]);

  const fmtMoney = useCallback((n: number) => new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 2 }).format(n), []);
  const reservationTag = useCallback((r: any) => {
    const status = String(r?.status || '').toUpperCase();
    const e = new Date(String(r?.endAt));
    const ended = Number.isFinite(e.getTime()) && e.getTime() < Date.now() - 60_000;
    if (status === 'PENDING') return { label: '待確認', bg: '#7c2d12', fg: '#fff' };
    if (status === 'CONFIRMED' && ended) return { label: '已完成', bg: '#065f46', fg: '#fff' };
    if (status === 'CONFIRMED') return { label: '已確認', bg: '#1d4ed8', fg: '#fff' };
    if (status === 'CANCELLED') return { label: '已取消', bg: '#444', fg: '#ddd' };
    return { label: status || '—', bg: '#444', fg: '#ddd' };
  }, []);

  const selectedTable = useMemo(() => tables.find(t => t.id === selTable) || null, [tables, selTable]);
  const basePricePerHour = useMemo(() => {
    const n = Number((selectedTable as any)?.basePrice);
    return Number.isFinite(n) ? n : null;
  }, [selectedTable]);

  const selectedScheme = useMemo(() => schemes.find(s => s.id === selScheme) || null, [schemes, selScheme]);
  const schemePricePerHour = useMemo(() => {
    const n = Number((selectedScheme as any)?.effectivePricePerHour ?? (selectedScheme as any)?.price);
    return Number.isFinite(n) ? n : null;
  }, [selectedScheme]);
  const schemeMinHours = useMemo(() => {
    const v = (selectedScheme as any)?.minHours ?? (selectedScheme as any)?.rulesJson?.minHours ?? (selectedScheme as any)?.rulesJson?.minQuantityHours;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const i = Math.floor(n);
    if (i < 1) return null;
    return i;
  }, [selectedScheme]);

  const unitPricePerHour = selScheme ? schemePricePerHour : basePricePerHour;
  const minHoursNotMet = useMemo(() => {
    if (!selScheme) return false;
    if (schemeMinHours == null) return false;
    const h = Math.max(1, Number(hours) || 1);
    return h + 1e-9 < schemeMinHours;
  }, [selScheme, schemeMinHours, hours]);
  const totalPrice = useMemo(() => {
    if (unitPricePerHour == null) return null;
    const h = Math.max(1, Number(hours) || 1);
    return unitPricePerHour * h;
  }, [unitPricePerHour, hours]);

  const handleJoin = async () => {
    if (!session.id) {
      alert('請先登入會員');
      window.location.href = '/members/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
    
    if (!confirm(`確定要加入 ${club.name || '此場館'} 嗎?`)) return;

    try {
      await joinClub(API_URL, session.id, club.id);
      alert('成功加入場館！');
      setJoined(true);
    } catch (err: any) {
      alert(err.message || '加入失敗');
    }
  };

  const toggleHour = (hour: number) => {
    setSelectedHours((prev) => {
      const list = Array.isArray(prev) ? prev.slice() : [];
      const has = list.includes(hour);
      let next: number[] = [];
      if (has) {
        next = list.filter((h) => h !== hour).sort((a, b) => a - b);
      } else {
        if (list.length === 0) {
          next = [hour];
        } else {
          const sorted = list.slice().sort((a, b) => a - b);
          const minH = sorted[0];
          const maxH = sorted[sorted.length - 1];
          if (hour === minH - 1 || hour === maxH + 1) next = [...sorted, hour].sort((a, b) => a - b);
          else next = [hour];
        }
      }

      if (next.length > 0) {
        for (let i = 1; i < next.length; i++) {
          if (next[i] !== next[i - 1] + 1) {
            next = [hour];
            break;
          }
        }
      }

      if (next.length > 0) {
        const minH = next[0];
        setStart(`${pad2(minH)}:00`);
        setHours(next.length);
      } else {
        setHours(1);
      }
      setSelScheme('');
      return next;
    });
  };

  const clubNoticeItems = useMemo((): InboxItem[] => {
    const rows = Array.isArray(clubMessages) ? clubMessages : [];
    const items = rows.map((m) => ({
      key: String(m?.id || ''),
      kind: 'club' as const,
      title: String(m?.title || '場館訊息'),
      content: String(m?.content || ''),
      createdAt: m?.createdAt ? new Date(String(m.createdAt)) : new Date(),
      subtitle: String(club?.name || '場館'),
      href: null,
      read: true,
      deletable: false,
      raw: m,
    })).filter((x) => x.key);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }, [club?.name, clubMessages]);

  const clubNoticeOpen = useMemo(() => (clubMsgOpenId ? clubNoticeItems.find((x) => x.key === clubMsgOpenId) || null : null), [clubMsgOpenId, clubNoticeItems]);

  const clubLiveItems = useMemo((): InboxItem[] => {
    const items: InboxItem[] = [];
    const hidden = clubLiveState.hidden || {};
    const read = clubLiveState.read || {};
    const rows = Array.isArray(clubLive) ? clubLive : [];
    for (const it of rows) {
      const id = String(it?.id || '').trim();
      if (!id) continue;
      const key = `live:${id}`;
      if (hidden[key]) continue;
      const startsAt = it?.startsAt ? new Date(String(it.startsAt)) : null;
      const d = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : it?.createdAt ? new Date(String(it.createdAt)) : new Date();
      const href = normalizeVideoHref(it?.liveUrl);
      const whenText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
      const content = [
        whenText ? `開始時間：${whenText}` : '',
        href ? `連結：${href}` : '',
      ].filter(Boolean).join('\n');
      items.push({
        key,
        kind: 'live',
        title: String(it?.title || '直播通告'),
        content,
        createdAt: d,
        subtitle: String(club?.name || '場館'),
        href,
        read: !!read[key],
        deletable: true,
        raw: it,
      });
    }
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }, [club?.name, clubLive, clubLiveState.hidden, clubLiveState.read]);

  const clubLiveUnreadCount = useMemo(() => clubLiveItems.filter((x) => !x.read).length, [clubLiveItems]);
  const clubLiveOpen = useMemo(() => (clubLiveOpenKey ? clubLiveItems.find((x) => x.key === clubLiveOpenKey) || null : null), [clubLiveOpenKey, clubLiveItems]);

  useEffect(() => {
    if (!clubLiveOpen || !clubId) return;
    if (clubLiveOpen.read) return;
    const key = clubLiveOpen.key;
    const next: LocalMsgState = { read: { ...(clubLiveState.read || {}), [key]: true }, hidden: { ...(clubLiveState.hidden || {}) } };
    setClubLiveState(next);
    try { localStorage.setItem(`clubPageLiveState:${clubId}:${sessionMemberId || 'guest'}`, JSON.stringify(next)); } catch {}
  }, [clubId, clubLiveOpen, clubLiveState.hidden, clubLiveState.read, sessionMemberId]);

  const clubLiveToggleSelect = (key: string, checked: boolean) => {
    setClubLiveSelected((prev) => {
      const next = { ...(prev || {}) };
      if (checked) next[key] = true;
      else delete next[key];
      return next;
    });
  };

  const clubLiveDelete = async (keys: string[]) => {
    if (!clubId) return;
    const nextHidden = { ...(clubLiveState.hidden || {}) };
    for (const k of keys) nextHidden[k] = true;
    const next: LocalMsgState = { read: { ...(clubLiveState.read || {}) }, hidden: nextHidden };
    setClubLiveState(next);
    try { localStorage.setItem(`clubPageLiveState:${clubId}:${sessionMemberId || 'guest'}`, JSON.stringify(next)); } catch {}
    setClubLiveOpenKey(null);
    setClubLiveSelected({});
  };

  if (loading) return <div className="brand-page p-6 text-center cue-muted">載入中...</div>;
  if (error) return <div className="brand-page p-6 text-center text-red-500">錯誤：{error}</div>;
  if (!club) return <div className="brand-page p-6 text-center cue-muted">找不到場館</div>;

  return (
    <div className="brand-page min-h-[100dvh]">
      <div
        className="fixed z-50 right-4"
        style={{
          top: 'calc(0.75rem + env(safe-area-inset-top))',
          pointerEvents: 'auto',
        }}
      >
        {isLoggedIn ? (
          <button
            type="button"
            onClick={() => nav('/me')}
            className="px-3 py-2 rounded-full cue-surface-strong hover:brightness-95 text-sm font-semibold"
          >
            會員
          </button>
        ) : (
          <button
            type="button"
            onClick={() => nav(`/members/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`)}
            className="px-3 py-2 rounded-full cue-button text-sm font-semibold"
          >
            登入
          </button>
        )}
      </div>
      {systemPortalEnabled && (
        <a
          href="https://www.snookerhk.live/"
          target="_blank"
          rel="noreferrer"
          className="fixed z-50 right-4 select-none px-4 py-3 rounded-full bg-amber-400 text-slate-950 font-extrabold shadow-lg ring-2 ring-amber-200 hover:brightness-95 active:brightness-90"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          aria-label="snookerhk.live首頁"
        >
          snookerhk.live首頁
        </a>
      )}

      <div style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {siteAdOpen && siteAd?.imageUrl && siteAd?.linkUrl && (
          <div className="px-4 pt-3">
            <div className="max-w-2xl mx-auto">
              <div className="cue-surface rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={normalizeVideoHref(siteAd.linkUrl) || String(siteAd.linkUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="block flex-1 min-w-0"
                  >
                    <img
                      src={String(siteAd.imageUrl)}
                      alt=""
                      className="w-full rounded-lg object-cover max-h-[30vh]"
                      onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                    />
                  </a>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => setSiteAdOpen(false)}
                  >
                    收起
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="bg-[var(--glass-bg)] border-b border-[var(--glass-border)] backdrop-blur">
          <div className="px-4 pt-3">
            <div className="max-w-2xl mx-auto">
              <div className="relative rounded-xl overflow-hidden border border-white/10">
                <div
                  ref={heroRef}
                  onScroll={onHeroScroll}
                  className="w-full overflow-x-auto flex snap-x snap-mandatory scroll-smooth"
                  style={{ scrollbarWidth: 'none' } as any}
                >
                  {(heroImages.length > 0 ? heroImages : ['']).map((src, idx) => (
                    <div key={`${src || 'fallback'}-${idx}`} className="w-full flex-shrink-0 snap-center">
                      <div className="h-[22vh] min-h-[140px] max-h-[260px] w-full bg-gradient-to-br from-slate-800 to-slate-950">
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {(heroImages.length > 0 ? heroImages : ['']).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 w-1.5 rounded-full ${idx === heroIndex ? 'bg-white' : 'bg-white/40'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 pt-3 pb-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="text-xs cue-muted">LOGO</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-extrabold truncate">
                      {club.name || '未命名場館'}
                    </div>
                    {club.intro && (
                      <div className="mt-1 text-sm cue-muted whitespace-pre-wrap max-h-10 overflow-hidden">
                        {club.intro}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {!joined ? (
                    <button type="button" onClick={handleJoin} className="px-3 py-2 rounded cue-button font-semibold">
                      加入
                    </button>
                  ) : (
                    <div className="px-3 py-2 rounded cue-surface text-emerald-600 text-sm font-semibold">
                      已加入
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-1.5 text-sm cue-muted">
                {(club as any)?.address ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs cue-muted">地址</div>
                      <div className="text-sm text-white/90 whitespace-pre-wrap">{String((club as any)?.address || '')}</div>
                    </div>
                    {mapHref && (
                      <a
                        href={mapHref}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold flex-shrink-0"
                      >
                        地圖
                      </a>
                    )}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {(club as any)?.phone ? (
                    <div><span className="text-xs cue-muted">電話：</span><span className="text-white/90">{String((club as any)?.phone || '')}</span></div>
                  ) : null}
                  {(club as any)?.email ? (
                    <div><span className="text-xs cue-muted">Email：</span><span className="text-white/90">{String((club as any)?.email || '')}</span></div>
                  ) : null}
                </div>
              </div>

              {facilities.length > 0 && (
                <div className="mt-3 w-full overflow-x-auto">
                  <div className="inline-flex gap-2 min-w-full">
                    {facilities.slice(0, 24).map((f) => (
                      <div key={f} className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-xs whitespace-nowrap text-white/90">
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="px-4 py-4" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto">
          <Tabs
            items={[
              { key: 'booking', label: '訂台' },
              ...(clubMessagesEnabled ? [{
                key: 'messages',
                label: (
                  <span className="inline-flex items-center">
                    <span>訊息</span>
                  </span>
                ),
              }] : []),
              ...(tournamentsEnabled ? [{ key: 'signup', label: '報名' }] : []),
              ...(liveEnabled ? [{
                key: 'live',
                label: (
                  <span className="inline-flex items-center">
                    <span>直播</span>
                    {clubLiveUnreadCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-extrabold">
                        {clubLiveUnreadCount}
                      </span>
                    )}
                  </span>
                ),
              }] : []),
              { key: 'leader', label: '排行榜' },
              { key: 'info', label: '資訊' },
              { key: 'contact', label: '聯絡' },
            ]}
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as any)}
          />

            {activeTab === 'messages' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">訊息</div>
                    <div className="text-xs cue-muted">{clubMessagesLoading ? '讀取中…' : `共 ${clubNoticeItems.length} 則`}</div>
                  </div>

                  {clubMessagesLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!clubMessagesLoading && clubNoticeItems.length === 0 && <div className="text-sm cue-muted">暫無訊息</div>}
                  {!clubMessagesLoading && clubNoticeItems.length > 0 && (
                    <div className="space-y-2">
                      {clubNoticeItems.slice(0, 200).map((it) => (
                        <div
                          key={it.key}
                          className="cue-surface-strong rounded-lg p-3 flex items-start gap-3 hover:brightness-95 cursor-pointer"
                          onClick={() => setClubMsgOpenId(it.key)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold truncate">{it.title}</div>
                              <div className="text-xs cue-muted flex-shrink-0">{Number.isFinite(it.createdAt.getTime()) ? it.createdAt.toLocaleDateString() : ''}</div>
                            </div>
                            <div className="text-xs cue-muted mt-1 truncate">{Number.isFinite(it.createdAt.getTime()) ? it.createdAt.toLocaleString() : ''}</div>
                          </div>
                        </div>
                      ))}
                      {clubNoticeItems.length > 200 && <div className="text-xs cue-muted">只顯示前 200 筆</div>}
                    </div>
                  )}
                </div>

                {!!clubNoticeOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setClubMsgOpenId(null)} />
                    <div className="relative w-full max-w-lg cue-surface rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold accent-yellow truncate">{clubNoticeOpen.title}</div>
                          <div className="text-xs cue-muted mt-1">
                            {clubNoticeOpen.subtitle ? `${clubNoticeOpen.subtitle} · ` : ''}
                            {Number.isFinite(clubNoticeOpen.createdAt.getTime()) ? ` · ${clubNoticeOpen.createdAt.toLocaleString()}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClubMsgOpenId(null)}
                          className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                        >
                          返回
                        </button>
                      </div>

                      <div className="mt-4 text-sm whitespace-pre-wrap">{clubNoticeOpen.content || '—'}</div>
                      <div className="mt-5">
                        <button
                          type="button"
                          onClick={() => setClubMsgOpenId(null)}
                          className="w-full px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
                        >
                          返回
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'live' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">直播</div>
                    <div className="text-xs cue-muted">{clubLiveLoading ? '讀取中…' : `共 ${clubLiveItems.length} 則`}</div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="text-sm cue-muted">未讀 {clubLiveUnreadCount} · 已選 {Object.keys(clubLiveSelected).length}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const all = clubLiveItems;
                          if (all.length === 0) return;
                          const allSelected = all.every((x) => clubLiveSelected[x.key]);
                          if (allSelected) return setClubLiveSelected({});
                          const next: Record<string, boolean> = {};
                          for (const x of all) next[x.key] = true;
                          setClubLiveSelected(next);
                        }}
                        className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                      >
                        全選
                      </button>
                      <button
                        type="button"
                        onClick={() => setClubLiveSelected({})}
                        className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                      >
                        清除
                      </button>
                      <button
                        type="button"
                        disabled={Object.keys(clubLiveSelected).length === 0}
                        onClick={async () => {
                          const keys = Object.keys(clubLiveSelected);
                          if (keys.length === 0) return;
                          if (!confirm(`確定要刪除已選 ${keys.length} 則直播訊息？`)) return;
                          if (!confirm('再次確認：刪除後不可復原')) return;
                          await clubLiveDelete(keys);
                        }}
                        className={`px-3 py-2 rounded text-sm font-semibold ${Object.keys(clubLiveSelected).length === 0 ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                      >
                        批量刪除
                      </button>
                    </div>
                  </div>

                  {clubLiveLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!clubLiveLoading && clubLiveItems.length === 0 && <div className="text-sm cue-muted">暫無直播訊息</div>}
                  {!clubLiveLoading && clubLiveItems.length > 0 && (
                    <div className="space-y-2">
                      {clubLiveItems.map((it) => {
                        const isSelected = !!clubLiveSelected[it.key];
                        const isUnread = !it.read;
                        return (
                          <div
                            key={it.key}
                            className={`cue-surface-strong rounded-lg p-3 flex items-start gap-3 hover:brightness-95 cursor-pointer ${isUnread ? 'ring-1 ring-yellow-300/30' : ''}`}
                            onClick={() => setClubLiveOpenKey(it.key)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => clubLiveToggleSelect(it.key, e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className={`font-semibold truncate ${isUnread ? 'text-white' : 'cue-muted'}`}>{it.title}</div>
                                <div className="text-xs cue-muted flex-shrink-0">{Number.isFinite(it.createdAt.getTime()) ? it.createdAt.toLocaleDateString() : ''}</div>
                              </div>
                              <div className="text-xs cue-muted mt-1 truncate">
                                {Number.isFinite(it.createdAt.getTime()) ? it.createdAt.toLocaleString() : ''}
                                {isUnread ? ' · 未讀' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!!clubLiveOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setClubLiveOpenKey(null)} />
                    <div className="relative w-full max-w-lg cue-surface rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold accent-yellow truncate">{clubLiveOpen.title}</div>
                          <div className="text-xs cue-muted mt-1">
                            {Number.isFinite(clubLiveOpen.createdAt.getTime()) ? clubLiveOpen.createdAt.toLocaleString() : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClubLiveOpenKey(null)}
                          className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                        >
                          返回
                        </button>
                      </div>

                      <div className="mt-4 text-sm whitespace-pre-wrap">{clubLiveOpen.content || '—'}</div>

                      {clubLiveOpen.href && (
                        <div className="mt-3">
                          <a href={clubLiveOpen.href} target="_blank" rel="noreferrer" className="accent-blue underline text-sm">
                            開啟連結
                          </a>
                        </div>
                      )}

                      <div className="mt-5 flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('確定要刪除這則直播訊息？')) return;
                            if (!confirm('再次確認：刪除後不可復原')) return;
                            await clubLiveDelete([clubLiveOpen.key]);
                          }}
                          className="flex-1 px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-semibold"
                        >
                          刪除
                        </button>
                        <button
                          type="button"
                          onClick={() => setClubLiveOpenKey(null)}
                          className="flex-1 px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
                        >
                          返回
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'signup' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">比賽列表</div>
                    <div className="text-xs cue-muted">{tournamentsLoading ? '讀取中…' : `共 ${tournaments.length} 場`}</div>
                  </div>

                  {tournamentsLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!tournamentsLoading && tournaments.length === 0 && <div className="text-sm cue-muted">暫無比賽</div>}
                  {!tournamentsLoading && tournaments.length > 0 && (
                    <div className="space-y-2">
                      {tournaments.slice(0, 50).map((t) => {
                        const title = String(t?.title || '比賽');
                        const cap = Number(t?.capacity ?? 0);
                        const count = Number(t?.signupCount ?? 0);
                        const status = cap > 0 ? `${count}/${cap}` : `${count}/—`;
                        const startsAt = t?.startsAt ? new Date(String(t.startsAt)) : null;
                        const startsText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
                        const closesAt = t?.signupClosesAt ? new Date(String(t.signupClosesAt)) : null;
                        const closesText = closesAt && Number.isFinite(closesAt.getTime()) ? closesAt.toLocaleDateString() : '';
                        const my = t?.mySignup;
                        const myStatus = String(my?.status || '').toUpperCase();
                        const myLabel = myStatus === 'CONFIRMED' ? '已確認' : myStatus === 'PENDING' ? '待確認' : myStatus === 'CANCELLED' ? '已取消' : '';
                        return (
                          <div
                            key={String(t?.id || title)}
                            className="cue-surface-strong rounded-lg p-3 flex items-start justify-between gap-3 hover:brightness-95 cursor-pointer"
                            onClick={() => setTournamentOpen(t)}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{title}</div>
                              <div className="text-xs cue-muted mt-1 truncate">
                                {startsText ? `${startsText} · ` : ''}
                                {closesText ? `截止 ${closesText} · ` : ''}
                                {myLabel ? `${myLabel} · ` : ''}
                                報名 {status}
                              </div>
                            </div>
                            <div className="flex-shrink-0 font-semibold accent-yellow">{status}</div>
                          </div>
                        );
                      })}
                      {tournaments.length > 50 && <div className="text-xs cue-muted">只顯示前 50 場</div>}
                    </div>
                  )}
                </div>

                {!!tournamentOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setTournamentOpen(null)} />
                    <div className="relative w-full max-w-lg cue-surface rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold accent-yellow truncate">{String(tournamentOpen?.title || '比賽')}</div>
                          <div className="text-xs cue-muted mt-1">
                            {(() => {
                              const cap = Number(tournamentOpen?.capacity ?? 0);
                              const count = Number(tournamentOpen?.signupCount ?? 0);
                              const status = cap > 0 ? `${count}/${cap}` : `${count}/—`;
                              const startsAt = tournamentOpen?.startsAt ? new Date(String(tournamentOpen.startsAt)) : null;
                              const startsText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
                              const closesAt = tournamentOpen?.signupClosesAt ? new Date(String(tournamentOpen.signupClosesAt)) : null;
                              const closesText = closesAt && Number.isFinite(closesAt.getTime()) ? closesAt.toLocaleDateString() : '';
                              return `${startsText ? `${startsText} · ` : ''}${closesText ? `截止 ${closesText} · ` : ''}報名 ${status}`;
                            })()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTournamentOpen(null)}
                          className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                        >
                          返回
                        </button>
                      </div>

                      <div className="mt-4 text-sm whitespace-pre-wrap">{String(tournamentOpen?.description || '—')}</div>

                      <div className="mt-5 flex gap-2">
                        <button
                          type="button"
                          disabled={tournamentOpenLoading}
                          onClick={async () => {
                            if (!clubId) return;
                            if (!sessionMemberId) {
                              nav(`/members/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`);
                              return;
                            }
                            try {
                              setTournamentOpenLoading(true);
                              const res = await signupTournament(API_URL, clubId, sessionMemberId, String(tournamentOpen.id));
                              const ok = !!(res && (res as any).ok);
                              if (!ok) throw new Error('報名失敗');
                              setTournamentSubmitModal({ open: true, title: String(tournamentOpen?.title || '比賽'), guide: String(tournamentOpen?.signupGuide || '') });
                              try {
                                const rows = await getPublicClubTournaments(API_URL, clubId, sessionMemberId || undefined);
                                setTournaments(Array.isArray(rows) ? rows : []);
                              } catch {}
                              setTournamentOpen(null);
                            } catch (e: any) {
                              alert(String(e?.message || '報名失敗'));
                            } finally {
                              setTournamentOpenLoading(false);
                            }
                          }}
                          className={`flex-1 px-4 py-2 rounded font-semibold ${tournamentOpenLoading ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                        >
                          一鍵報名
                        </button>
                        <button
                          type="button"
                          onClick={() => setTournamentOpen(null)}
                          className="flex-1 px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
                        >
                          返回
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {tournamentSubmitModal.open && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
                    <div className="w-full max-w-md cue-surface rounded-xl border cue-border p-4">
                      <div className="font-extrabold text-lg">已提交報名</div>
                      <div className="mt-2 text-sm cue-muted">
                        已提交至場館，等待確認。{tournamentSubmitModal.title ? `（${tournamentSubmitModal.title}）` : ''}
                      </div>
                      {String(tournamentSubmitModal.guide || '').trim() && (
                        <div className="mt-3 cue-surface-strong rounded-lg p-3">
                          <div className="font-semibold mb-1">報名指引 / 流程</div>
                          <div className="text-sm cue-muted whitespace-pre-wrap">{String(tournamentSubmitModal.guide || '')}</div>
                        </div>
                      )}
                      <div className="mt-4 flex justify-end">
                        <button type="button" className="px-4 py-2 rounded cue-button font-semibold" onClick={() => setTournamentSubmitModal({ open: false, title: '', guide: '' })}>
                          知道了
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'info' && (
              <div className="mt-5 space-y-6">
                {galleryUrls.length > 0 && (
                  <div className="cue-surface rounded-lg p-4">
                    <div className="font-semibold text-lg mb-3">相片</div>
                    <div className="w-full overflow-x-auto">
                      <div className="inline-flex gap-3">
                        {galleryUrls.slice(0, 12).map((u, idx) => {
                          const src = normalizeImageSrc(u);
                          if (!src) return null;
                          return (
                            <div key={`${src}-${idx}`} className="w-40 h-28 rounded-lg overflow-hidden bg-black/30 border border-white/10 flex-shrink-0">
                              <img
                                src={src}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="cue-surface rounded-lg p-4">
                  <div className="font-semibold text-lg mb-3">波鐘計算機</div>
                  <TimeFeeCalculator title="波鐘計算機" />
                </div>

                {String((club as any)?.policies || '').trim() && (
                  <div className="cue-surface rounded-lg p-4">
                    <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">政策</div>
                    <div className="text-sm cue-muted whitespace-pre-wrap">{String((club as any)?.policies || '')}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'leader' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4 text-left">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 pb-2 border-b cue-border">
                    <div className="font-semibold text-lg">單杆排行榜</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs cue-muted">本月</div>
                      <input
                        type="month"
                        value={leaderMonth}
                        onChange={(e) => setLeaderMonth(e.target.value)}
                        className="px-3 py-1.5 rounded cue-input text-sm"
                      />
                    </div>
                  </div>

                  {leaderError && <div className="text-sm text-red-500 mb-2">{leaderError}</div>}
                  {leaderLoading && <div className="text-sm cue-muted mb-2">載入中...</div>}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="cue-surface-strong rounded-lg p-3">
                      <div className="font-semibold mb-2">歷史最高單杆 Top 10</div>
                      {leaderHighest.length === 0 ? (
                        <div className="text-sm cue-muted">暫無資料</div>
                      ) : (
                        <div className="grid gap-2">
                          {leaderHighest.slice(0, 10).map((r: any, idx: number) => (
                            <div key={r.id || `${r.member?.id || 'm'}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">
                                  {idx + 1}. {r.member?.name || '-'}
                                </div>
                                <div className="text-xs cue-muted">
                                  {r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '-'}
                                </div>
                                {normalizeVideoHref(r.video_url) && (
                                  <a
                                    href={normalizeVideoHref(r.video_url) as string}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs accent-blue underline"
                                  >
                                    影片連結
                                  </a>
                                )}
                              </div>
                              <div className="flex-shrink-0 font-semibold accent-yellow">
                                {r.points}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="cue-surface-strong rounded-lg p-3">
                      <div className="font-semibold mb-2">本月累計 Top 10</div>
                      {leaderMonthly.length === 0 ? (
                        <div className="text-sm cue-muted">暫無資料</div>
                      ) : (
                        <div className="grid gap-2">
                          {leaderMonthly.slice(0, 10).map((r: any, idx: number) => (
                            <div key={r.member?.id || `${idx}`} className="flex items-center justify-between gap-3 text-sm">
                              <div className="min-w-0 font-semibold truncate">
                                {idx + 1}. {r.member?.name || '-'}
                              </div>
                              <div className="flex-shrink-0 font-semibold text-emerald-600">
                                {r.totalPoints}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4 text-left">
                  <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">聯絡資訊</div>
                  <div className="grid gap-2 text-sm">
                    {club.address && (
                      <div><span className="cue-muted">地址：</span>{club.address}</div>
                    )}
                    {club.phone && (
                      <div><span className="cue-muted">電話：</span>{club.phone}</div>
                    )}
                    {club.email && (
                      <div><span className="cue-muted">Email：</span>{club.email}</div>
                    )}
                  </div>
                </div>

                {club.paymentInfo && (
                  <div className="cue-surface rounded-lg p-4 text-left">
                    <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">付款方式</div>
                    <div className="text-sm cue-muted whitespace-pre-wrap">{String(club.paymentInfo)}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'booking' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4 text-left">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-3 pb-3 border-b cue-border">
                    <div className="font-semibold text-lg">當日時間表</div>
                    <div className="grid gap-2 sm:flex sm:items-center sm:gap-2">
                      <label className="grid gap-1">
                        <div className="text-xs cue-muted">日期</div>
                        <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded cue-input text-sm" />
                      </label>
                      <label className="grid gap-1">
                        <div className="text-xs cue-muted">球枱</div>
                        <select value={selTable} onChange={(e) => setSelTable(e.target.value)} className="w-full px-3 py-2 rounded cue-input text-sm">
                          <option value="">請選擇</option>
                          {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  {!session.id ? (
                    <div className="text-sm cue-muted mb-3">
                      需登入才能預約。<a href="/members/login" className="accent-yellow underline">登入</a>
                    </div>
                  ) : null}

                  {session.id && pointsEnabled ? (
                    <div
                      className={`mb-3 rounded-xl px-4 py-3 border cue-border flex items-center justify-between gap-3 ${myPoints && myPoints.balance < 0 ? 'bg-red-700 text-white' : 'bg-emerald-700 text-white'}`}
                    >
                      <div className="text-sm font-semibold opacity-90">我的消費積分（此場館）</div>
                      <div className="text-2xl font-extrabold">
                        {myPointsLoading ? '…' : (myPoints ? String(myPoints.balance) : '—')}
                      </div>
                    </div>
                  ) : null}

                  {!selTable || !date ? (
                    <div className="text-sm cue-muted">請先選擇日期及球枱，即可查看該日已預約/空閒時段。</div>
                  ) : availLoading ? (
                    <div className="text-sm cue-muted">載入中...</div>
                  ) : availError ? (
                    <div className="text-sm text-red-500">{availError}</div>
                  ) : (
                    <>
                      <div className="text-xs cue-muted mb-3">綠色=空閒、紅色=已預約、藍色=已選擇（可連續選多格，例如 3 小時就選 3 格）。</div>
                      <div className="grid grid-cols-4 gap-2">
                        {daySlotButtons.map((b) => {
                          const isSelected = selectedHours.includes(b.hour);
                          const disabled = b.busy || b.isPast;
                          const cls = disabled
                            ? (b.busy ? 'bg-red-700 text-white' : 'cue-surface-strong cue-muted')
                            : (isSelected ? 'bg-sky-600 text-white hover:brightness-95' : 'bg-emerald-700 text-white hover:brightness-95');
                          return (
                            <button
                              key={b.hour}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleHour(b.hour)}
                              className={`px-2 py-2 rounded-lg text-sm border cue-border ${cls} disabled:opacity-80`}
                            >
                              {b.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 cue-surface-strong rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="cue-muted">已選時段</div>
                          <div className="font-semibold">
                            {selectedStartAt && selectedEndAt && selectedHours.length > 0
                              ? `${pad2(selectedStartAt.getHours())}:${pad2(selectedStartAt.getMinutes())} - ${pad2(selectedEndAt.getHours())}:${pad2(selectedEndAt.getMinutes())}（${selectedHours.length}小時）`
                              : '（未選擇）'}
                          </div>
                        </div>
                        {isPastStartTime && selectedHours.length > 0 && (
                          <div className="mt-2 text-xs text-red-500">
                            不能預約已過去的時間，請選擇將來的日期/時間。
                          </div>
                        )}
                      </div>

                      {selectedHours.length > 0 && (
                        <div className="mt-3 cue-surface-strong rounded-lg p-3">
                          <div className="font-semibold mb-2">優惠方案</div>
                          <div className="grid gap-2">
                            <button
                              type="button"
                              onClick={() => setSelScheme('')}
                              className={`px-3 py-2 rounded-lg text-sm border cue-border text-left ${!selScheme ? 'bg-white/10' : 'cue-surface'}`}
                            >
                              一般（正價）
                            </button>
                            {schemes.map((s) => {
                              const perHour = Number((s as any).effectivePricePerHour ?? (s as any).price);
                              const mh = Number((s as any).minHours ?? (s as any).rulesJson?.minHours ?? (s as any).rulesJson?.minQuantityHours);
                              const minText = Number.isFinite(mh) && mh >= 1 ? `（最少${Math.floor(mh)}小時）` : '';
                              const disabled = !Number.isFinite(perHour);
                              const active = selScheme === s.id;
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => setSelScheme(s.id)}
                                  className={`px-3 py-2 rounded-lg text-sm border cue-border text-left ${active ? 'bg-white/10' : 'cue-surface'} disabled:opacity-60`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="font-semibold">{s.title}{minText}</div>
                                    <div className="font-semibold">{Number.isFinite(perHour) ? `$${fmtMoney(perHour)}/小時` : '未設定'}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {unitPricePerHour != null && schemes.length === 0 && (
                            <div className="mt-2 text-xs cue-muted">
                              此時段沒有可用方案，將以正價計算。
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 cue-surface-strong rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="cue-muted">每小時</div>
                          <div className="font-semibold">
                            {unitPricePerHour == null ? '未設定' : `$${fmtMoney(unitPricePerHour)}`}
                            <span className="ml-2 cue-muted font-normal">
                              {selScheme ? (selectedScheme ? `（${selectedScheme.title}）` : '') : '（正價）'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm mt-1">
                          <div className="cue-muted">總價</div>
                          <div className="font-semibold">{totalPrice == null ? '—' : `$${fmtMoney(totalPrice)}`}</div>
                        </div>
                        {unitPricePerHour == null && selectedHours.length > 0 && (
                          <div className="mt-2 text-xs text-red-500">
                            此球枱未設定正價，且此時段沒有可用方案／方案價錢未設定，暫時無法提交預約。
                          </div>
                        )}
                        {minHoursNotMet && (
                          <div className="mt-2 text-xs text-red-500">
                            此方案需最少購買 {schemeMinHours} 小時。
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!session.id) {
                            window.location.href = '/members/login?redirect=' + encodeURIComponent(window.location.pathname);
                            return;
                          }
                          if (!selTable || !date || selectedHours.length === 0) { alert('請選擇球枱/日期/時間'); return; }
                          if (unitPricePerHour == null) { alert('此時段未設定價錢，無法預約'); return; }
                          if (minHoursNotMet) { alert(`此方案需最少購買 ${schemeMinHours} 小時`); return; }
                          if (!selectedStartAt || !selectedEndAt) { alert('時間格式不正確'); return; }
                          if (selectedStartAt.getTime() < Date.now() - 60_000) { alert('不能預約已過去的時間'); return; }
                          try {
                            const created = await createReservation(API_URL, club.id, session.id, { tableId: selTable, startAt: selectedStartAt.toISOString(), endAt: selectedEndAt.toISOString(), quantityHours: selectedHours.length, schemeId: selScheme || undefined });
                            const quote = created?.priceQuote != null ? Number(created.priceQuote) : null;
                            setSubmitModal({ open: true, quote: Number.isFinite(quote) ? (quote as number) : null });
                            setSelectedHours([]);
                            setSelScheme('');
                            try {
                              const from = new Date(date);
                              from.setHours(0, 0, 0, 0);
                              const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
                              const [rows, myRows] = await Promise.all([
                                getAvailability(API_URL, club.id, from.toISOString(), to.toISOString(), selTable),
                                getMyReservations(API_URL, club.id, session.id),
                              ]);
                              setDayReservations(Array.isArray(rows) ? rows : []);
                              setMyReservations(Array.isArray(myRows) ? myRows : []);
                            } catch {}
                          } catch (err: any) {
                            alert(err.message || '預約失敗');
                          }
                        }}
                        disabled={selectedHours.length === 0 || unitPricePerHour == null || minHoursNotMet || isPastStartTime}
                        className="mt-3 w-full cue-button py-2.5 rounded-lg font-semibold disabled:opacity-60"
                      >
                        確認預訂
                      </button>

                      <details className="mt-3">
                        <summary className="text-xs cue-muted cursor-pointer select-none">已預約時段（清單）</summary>
                        <div className="mt-2 text-xs cue-muted">
                          {Array.isArray(dayReservations) && dayReservations.length > 0 ? (
                            <div className="mt-2 grid gap-2">
                              {dayReservations.map((r: any) => {
                                const s = new Date(String(r?.startAt));
                                const e = new Date(String(r?.endAt));
                                const ok = Number.isFinite(s.getTime()) && Number.isFinite(e.getTime());
                                const label = ok ? `${pad2(s.getHours())}:${pad2(s.getMinutes())} - ${pad2(e.getHours())}:${pad2(e.getMinutes())}` : '—';
                                return <div key={r.id} className="cue-surface-strong rounded-lg px-3 py-2">{label}</div>;
                              })}
                            </div>
                          ) : (
                            <div className="mt-2">（暫無）</div>
                          )}
                        </div>
                      </details>
                    </>
                  )}
                </div>

                <div className="cue-surface rounded-lg p-4 text-left">
                  <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">我的預約（此場館）</div>
              {!session.id ? (
                <div className="text-sm cue-muted">需登入才能查看。</div>
              ) : myResLoading ? (
                <div className="text-sm cue-muted">載入中...</div>
              ) : myResError ? (
                <div className="text-sm text-red-500">{myResError}</div>
              ) : (
                (() => {
                  const list = Array.isArray(myReservations) ? myReservations : [];
                  if (list.length === 0) return <div className="text-sm cue-muted">（暫無）</div>;
                  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                  const recent = list
                    .filter((r: any) => {
                      const s = new Date(String(r?.startAt));
                      return Number.isFinite(s.getTime()) && s.getTime() >= cutoff;
                    })
                    .slice(0, 5);
                  const display = recent.length > 0 ? recent : list.slice(0, 5);
                  return (
                    <div className="grid gap-2">
                      {display.map((r: any) => {
                        const s = new Date(String(r?.startAt));
                        const e = new Date(String(r?.endAt));
                        const ok = Number.isFinite(s.getTime()) && Number.isFinite(e.getTime());
                        const ymd = ok ? `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}` : '—';
                        const time = ok ? `${pad2(s.getHours())}:${pad2(s.getMinutes())} - ${pad2(e.getHours())}:${pad2(e.getMinutes())}` : '—';
                        const tableName = String(r?.table?.name || '');
                        const quote = r?.priceQuote != null ? Number(r.priceQuote) : null;
                        const quoteText = Number.isFinite(quote) ? `$${fmtMoney(quote as number)}` : null;
                        const tag = reservationTag(r);
                        const status = String(r?.status || '').toUpperCase();
                        const canCancel = status !== 'CANCELLED' && (!Number.isFinite(s.getTime()) || s.getTime() >= Date.now() - 60_000);
                        return (
                          <div key={r.id} className="cue-surface-strong rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold truncate">{tableName || '球枱'}</div>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
                            </div>
                            <div className="text-xs cue-muted mt-0.5">{ymd} · {time}{quoteText ? ` · ${quoteText}` : ''}</div>
                            <div className="mt-2 flex justify-end">
                              <button
                                type="button"
                                disabled={!canCancel}
                                onClick={async () => {
                                  if (!session?.id) return;
                                  if (!confirm('確定要刪除此預約（取消）嗎？')) return;
                                  try {
                                    await cancelMyReservation(API_URL, String(club.id), String(session.id), String(r.id));
                                    const myRows = await getMyReservations(API_URL, String(club.id), String(session.id));
                                    setMyReservations(Array.isArray(myRows) ? myRows : []);
                                    try {
                                      if (selTable && date) {
                                        const from = new Date(date);
                                        from.setHours(0, 0, 0, 0);
                                        const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
                                        const rows = await getAvailability(API_URL, String(club.id), from.toISOString(), to.toISOString(), selTable);
                                        setDayReservations(Array.isArray(rows) ? rows : []);
                                      }
                                    } catch {}
                                  } catch (e: any) {
                                    alert(e.message || '刪除失敗');
                                  }
                                }}
                                className={`px-3 py-1.5 rounded text-sm ${canCancel ? 'bg-red-700 hover:bg-red-600 text-white' : 'cue-surface cue-muted'}`}
                              >
                                刪除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {recent.length === 0 && list.length > display.length && (
                        <div className="text-xs cue-muted">近 1 個月沒有預約紀錄，已改為顯示最近 {display.length} 筆</div>
                      )}
                    </div>
                  );
                })()
              )}
                </div>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link to="/me" className="accent-blue underline">回首頁</Link>
            </div>
          </div>
      </main>

      {submitModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
          <div className="w-full max-w-md cue-surface rounded-xl border cue-border p-4">
            <div className="font-extrabold text-lg">已發送預約</div>
            <div className="mt-2 text-sm cue-muted">
              已提交至場館，等待確認。
              {submitModal.quote != null ? `（報價：$${fmtMoney(submitModal.quote)}）` : ''}
            </div>
            {String((club as any)?.paymentInfo || '').trim() && (
              <div className="mt-3 cue-surface-strong rounded-lg p-3">
                <div className="font-semibold mb-1">付款方法</div>
                <div className="text-sm cue-muted whitespace-pre-wrap">{String((club as any)?.paymentInfo || '')}</div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button type="button" className="px-4 py-2 rounded cue-button font-semibold" onClick={() => setSubmitModal({ open: false, quote: null })}>
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubPublicPage;
