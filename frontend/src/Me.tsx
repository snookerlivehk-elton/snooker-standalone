import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import BottomNavPublic from './components/BottomNavPublic';
import { API_URL } from './config';
import {
  getMember,
  getClubProfile,
  getMyBreaks,
  getMyClubMessages,
  getMyClubPointsBalances,
  getMyInvites,
  getMyJoinedClubs,
  getPublicLiveAnnouncements,
  getSiteAds,
  getSiteNotice,
  listMemberDistricts,
  listMemberRegions,
  hideClubMessages,
  markClubMessageRead,
  resendMemberVerificationEmail,
  updateClubProfile,
  updateMemberSelf,
} from './lib/api';
import { clearMemberSession, readMemberSession, writeMemberSession, type MemberSession } from './lib/auth';
import Tabs from './components/Tabs';
import { useFeatureEnabled } from './lib/features';
import HelpGuide from './components/HelpGuide';

function normalizeHttpUrl(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

type LocalMsgState = { read: Record<string, boolean>; hidden: Record<string, boolean> };

type InboxItem = {
  key: string;
  kind: 'system' | 'club' | 'live' | 'match';
  title: string;
  content: string;
  createdAt: Date;
  subtitle?: string;
  href?: string | null;
  read: boolean;
  deletable: boolean;
  raw?: any;
};

const Me: React.FC = () => {
  const location = useLocation();
  const session = readMemberSession() as MemberSession;
  const memberId = session?.id;
  const [profile, setProfile] = useState<any>(null);
  const [myClubProfile, setMyClubProfile] = useState<any>(null);
  const [myClubProfileLoading, setMyClubProfileLoading] = useState(false);
  const [myClubProfileSaving, setMyClubProfileSaving] = useState(false);
  const [joinedClubs, setJoinedClubs] = useState<any[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubPointsMap, setClubPointsMap] = useState<Record<string, { balance: number; updatedAt: string | null }>>({});
  const [clubPointsLoading, setClubPointsLoading] = useState(false);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [breaksLoading, setBreaksLoading] = useState(false);
  const [clubMessages, setClubMessages] = useState<any[]>([]);
  const [clubMessagesLoading, setClubMessagesLoading] = useState(false);
  const [publicLiveAnnouncements, setPublicLiveAnnouncements] = useState<any[]>([]);
  const [publicLiveLoading, setPublicLiveLoading] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [siteNotice, setSiteNotice] = useState<any>(null);
  const [siteNoticeLoading, setSiteNoticeLoading] = useState(false);
  const [siteAdItems, setSiteAdItems] = useState<any[]>([]);
  const [siteAdCurrent, setSiteAdCurrent] = useState<any>(null);
  const [siteAdConfig, setSiteAdConfig] = useState<{ enabled: boolean; displaySeconds: number; minIntervalMinutes: number; maxIntervalMinutes: number; versionUpdatedAt: string } | null>(null);
  const [siteAdOpen, setSiteAdOpen] = useState(false);
  const [siteAdNextAt, setSiteAdNextAt] = useState<number | null>(null);
  const siteAdWasOpenRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'clubs' | 'messages' | 'history' | 'settings'>('clubs');
  const [editMode, setEditMode] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editRegionCode, setEditRegionCode] = useState('');
  const [editDistrictCode, setEditDistrictCode] = useState('');
  const [editPublicHighbreak, setEditPublicHighbreak] = useState(false);
  const [regions, setRegions] = useState<Array<{ code3: string; name: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ code3: string; name: string; regionCode?: string }>>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editNewPassword2, setEditNewPassword2] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingVerifyEmail, setSendingVerifyEmail] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [breakQueryMode, setBreakQueryMode] = useState<'range' | 'year' | 'month'>('range');
  const [breakCategory, setBreakCategory] = useState<'ALL' | 'VENUE' | 'TOURNAMENT'>('ALL');
  const [breakFrom, setBreakFrom] = useState('');
  const [breakTo, setBreakTo] = useState('');
  const [breakYear, setBreakYear] = useState<number | null>(null);
  const [breakMonth, setBreakMonth] = useState<string>('');
  const [localMsgState, setLocalMsgState] = useState<LocalMsgState>({ read: {}, hidden: {} });
  const [selectedMsgKeys, setSelectedMsgKeys] = useState<Record<string, boolean>>({});
  const [openMsgKey, setOpenMsgKey] = useState<string | null>(null);

  const { enabled: pointsEnabled } = useFeatureEnabled(API_URL, 'points');
  const { enabled: highbreakEnabled } = useFeatureEnabled(API_URL, 'highbreak');
  const { enabled: clubMessagesEnabled } = useFeatureEnabled(API_URL, 'club_messages');
  const { enabled: liveEnabled } = useFeatureEnabled(API_URL, 'live');
  const { enabled: systemPortalEnabled } = useFeatureEnabled(API_URL, 'system_portal');

  useEffect(() => {
    if (activeTab === 'history' && !highbreakEnabled) setActiveTab('clubs');
  }, [activeTab, highbreakEnabled]);

  const avatarText = useMemo(() => {
    const s = String(profile?.name || session?.email || 'M').trim();
    return (s.slice(0, 1) || 'M').toUpperCase();
  }, [profile?.name, session?.email]);

  const memberTier = useMemo<'BASIC' | 'VERIFIED'>(() => {
    const raw = String(profile?.member_tier || profile?.memberTier || session?.member_tier || '').trim().toUpperCase();
    if (raw === 'VERIFIED') return 'VERIFIED';
    if (profile?.email_verified_at || profile?.emailVerifiedAt || session?.email_verified_at) return 'VERIFIED';
    return 'BASIC';
  }, [profile?.member_tier, profile?.memberTier, profile?.email_verified_at, profile?.emailVerifiedAt, session?.member_tier, session?.email_verified_at]);

  const emailVerifiedAt = profile?.email_verified_at ?? profile?.emailVerifiedAt ?? session?.email_verified_at ?? null;
  const memberEmail = String(profile?.email || session?.email || '').trim();

  const showExpiredBanner = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search || '');
      return sp.get('expired') === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  useEffect(() => {
    (async () => {
      if (!memberId) return;
      setLoading(true);
      try {
        const m = await getMember(API_URL, memberId);
        setProfile(m);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId]);

  useEffect(() => {
    if (!memberId || !profile) return;
    writeMemberSession({
      ...session,
      id: memberId,
      email: String(profile?.email || session?.email || '').trim() || undefined,
      phone: String(session?.phone || '').trim() || undefined,
      role: String(profile?.role || session?.role || '').trim() || undefined,
      member_tier: String(profile?.member_tier || profile?.memberTier || session?.member_tier || 'BASIC').toUpperCase() === 'VERIFIED' ? 'VERIFIED' : 'BASIC',
      email_verified_at: profile?.email_verified_at ?? profile?.emailVerifiedAt ?? session?.email_verified_at ?? null,
    });
  }, [memberId, profile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId || !profile) return;
      if (String(profile?.role || '').toUpperCase() !== 'ADMIN') {
        if (mounted) setMyClubProfile(null);
        return;
      }
      if (mounted) setMyClubProfileLoading(true);
      try {
        const row = await getClubProfile(API_URL, memberId);
        if (mounted) setMyClubProfile(row && typeof row === 'object' ? row : null);
      } catch {
        if (mounted) setMyClubProfile(null);
      } finally {
        if (mounted) setMyClubProfileLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, profile]);

  useEffect(() => {
    if (!memberId) return;
    try {
      const raw = localStorage.getItem(`meMessageState:${memberId}`) || '{}';
      const obj = JSON.parse(raw);
      const read = (obj && typeof obj === 'object' ? obj.read : null) || {};
      const hidden = (obj && typeof obj === 'object' ? obj.hidden : null) || {};
      setLocalMsgState({ read: read && typeof read === 'object' ? read : {}, hidden: hidden && typeof hidden === 'object' ? hidden : {} });
    } catch {
      setLocalMsgState({ read: {}, hidden: {} });
    }
    setSelectedMsgKeys({});
    setOpenMsgKey(null);
  }, [memberId]);

  useEffect(() => {
    if (!memberId || !profile) return;
    setEditPhone(String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? '') || '');
    setEditRegionCode(String(profile?.region_code ?? profile?.regionCode ?? '') || '');
    setEditDistrictCode(String(profile?.district_code ?? profile?.districtCode ?? '') || '');
    setEditPublicHighbreak(!!(profile?.public_highbreak_enabled ?? profile?.publicHighbreakEnabled));
    const bd = profile?.birthDate ?? profile?.birth_date;
    if (bd) {
      const d = new Date(bd);
      if (!Number.isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setEditBirthDate(`${d.getFullYear()}-${mm}-${dd}`);
      }
    }
  }, [memberId, profile]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getSiteAds(API_URL, 'member');
        const cfg = (res as any)?.config || null;
        const rawItems = Array.isArray((res as any)?.items)
          ? (res as any).items
          : Array.isArray((res as any)?.ads)
            ? (res as any).ads
            : [];
        const items = rawItems.filter((x: any) => x && x.enabled !== false && x.imageUrl && x.linkUrl);
        const versionUpdatedAt = String((res as any)?.versionUpdatedAt || cfg?.updatedAt || (rawItems?.[0]?.updatedAt ?? '') || '');
        const enabled = cfg ? (cfg?.enabled !== false) : true;
        const displaySeconds = Math.max(3, Math.min(60, Number(cfg?.displaySeconds ?? rawItems?.[0]?.displaySeconds ?? 15) || 15));
        const minIntervalMinutes = Math.max(1, Math.min(24 * 60, Number(cfg?.minIntervalMinutes ?? rawItems?.[0]?.minIntervalMinutes ?? 20) || 20));
        const maxIntervalMinutes = Math.max(1, Math.min(24 * 60, Number(cfg?.maxIntervalMinutes ?? rawItems?.[0]?.maxIntervalMinutes ?? 30) || 30));
        if (!mounted) return;
        setSiteAdItems(items);
        setSiteAdConfig({ enabled, displaySeconds, minIntervalMinutes, maxIntervalMinutes, versionUpdatedAt });
        setSiteAdCurrent(null);

        const key = `siteAdState:member`;
        let prev: any = null;
        try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
        const now = Date.now();
        const prevVer = String(prev?.versionUpdatedAt || '');
        const prevSeenAt = Number(prev?.seenAt || 0) || 0;
        const prevNextAt = Number(prev?.nextAt || 0) || 0;
        const prevLastItemId = String(prev?.lastItemId || '');

        if (!enabled || items.length === 0) {
          setSiteAdNextAt(null);
          try { localStorage.setItem(key, JSON.stringify({ versionUpdatedAt, seenAt: prevSeenAt || 0, nextAt: 0, lastItemId: prevLastItemId })); } catch {}
          return;
        }

        const low = Math.min(minIntervalMinutes, maxIntervalMinutes);
        const high = Math.max(minIntervalMinutes, maxIntervalMinutes);
        const pickMinutes = low + Math.floor(Math.random() * (high - low + 1));

        let nextAt = prevNextAt || (prevSeenAt ? (prevSeenAt + pickMinutes * 60 * 1000) : 0);
        if (!prev || prevVer !== versionUpdatedAt) nextAt = now;
        if (!nextAt) nextAt = now;

        if (mounted) setSiteAdNextAt(nextAt);
        try { localStorage.setItem(key, JSON.stringify({ versionUpdatedAt, seenAt: prevSeenAt || 0, nextAt, lastItemId: prevLastItemId })); } catch {}
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!siteAdConfig?.enabled) return;
    if (!siteAdNextAt) return;
    if (!Array.isArray(siteAdItems) || siteAdItems.length === 0) return;
    const key = `siteAdState:member`;
    const now = Date.now();
    const delay = Math.max(0, siteAdNextAt - now);
    const t = window.setTimeout(() => {
      let prev: any = null;
      try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
      const lastItemId = String(prev?.lastItemId || '');
      const idx = siteAdItems.findIndex((x) => String(x?.id || '') === lastItemId);
      const next = siteAdItems[(idx >= 0 ? (idx + 1) : 0) % siteAdItems.length] || null;
      if (!next) return;
      setSiteAdCurrent(next);
      setSiteAdOpen(true);
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            versionUpdatedAt: String(siteAdConfig?.versionUpdatedAt || ''),
            seenAt: Date.now(),
            nextAt: siteAdNextAt,
            lastItemId: String(next?.id || ''),
          }),
        );
      } catch {}
    }, delay);
    return () => window.clearTimeout(t);
  }, [siteAdConfig?.enabled, siteAdConfig?.versionUpdatedAt, siteAdItems, siteAdNextAt]);

  useEffect(() => {
    if (!siteAdOpen) return;
    const ds = Math.max(3, Math.min(60, Number(siteAdConfig?.displaySeconds ?? 15) || 15));
    const t = window.setTimeout(() => setSiteAdOpen(false), ds * 1000);
    return () => window.clearTimeout(t);
  }, [siteAdOpen, siteAdConfig?.versionUpdatedAt]);

  useEffect(() => {
    const wasOpen = siteAdWasOpenRef.current;
    siteAdWasOpenRef.current = siteAdOpen;
    if (!siteAdConfig?.enabled) return;
    if (!Array.isArray(siteAdItems) || siteAdItems.length === 0) return;
    if (!wasOpen || siteAdOpen) return;
    const key = `siteAdState:member`;
    const now = Date.now();
    const low = Math.min(siteAdConfig.minIntervalMinutes, siteAdConfig.maxIntervalMinutes);
    const high = Math.max(siteAdConfig.minIntervalMinutes, siteAdConfig.maxIntervalMinutes);
    const pickMinutes = low + Math.floor(Math.random() * (high - low + 1));
    const nextAt = now + pickMinutes * 60 * 1000;
    setSiteAdNextAt(nextAt);
    try {
      let prev: any = null;
      try { prev = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
      const lastItemId = String(siteAdCurrent?.id || prev?.lastItemId || '');
      localStorage.setItem(
        key,
        JSON.stringify({ versionUpdatedAt: String(siteAdConfig?.versionUpdatedAt || ''), seenAt: now, nextAt, lastItemId }),
      );
    } catch {}
  }, [siteAdOpen, siteAdConfig, siteAdItems, siteAdCurrent]);

  useEffect(() => {
    if (activeTab !== 'settings') return;
    let mounted = true;
    setLocLoading(true);
    listMemberRegions(API_URL)
      .then((json) => {
        if (!mounted) return;
        const rs = Array.isArray((json as any)?.regions) ? (json as any).regions : [];
        setRegions(rs);
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted) return;
        setLocLoading(false);
      });
    return () => { mounted = false; };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'settings') return;
    let mounted = true;
    if (!editRegionCode) {
      setDistricts([]);
      setEditDistrictCode('');
      return () => { mounted = false; };
    }
    setLocLoading(true);
    listMemberDistricts(API_URL, editRegionCode)
      .then((json) => {
        if (!mounted) return;
        const ds = Array.isArray((json as any)?.districts) ? (json as any).districts : [];
        setDistricts(ds);
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted) return;
        setLocLoading(false);
      });
    return () => { mounted = false; };
  }, [activeTab, editRegionCode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId) return;
      if (!highbreakEnabled) {
        if (mounted) setBreaks([]);
        if (mounted) setBreaksLoading(false);
        return;
      }
      setBreaksLoading(true);
      try {
        const rows = await getMyBreaks(API_URL, memberId);
        if (mounted) setBreaks(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setBreaks([]);
      } finally {
        if (mounted) setBreaksLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, highbreakEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId) return;
      if (!clubMessagesEnabled) {
        if (mounted) setClubMessages([]);
        if (mounted) setClubMessagesLoading(false);
        return;
      }
      setClubMessagesLoading(true);
      try {
        const rows = await getMyClubMessages(API_URL, memberId);
        if (mounted) setClubMessages(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setClubMessages([]);
      } finally {
        if (mounted) setClubMessagesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, clubMessagesEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId) return;
      setInvitesLoading(true);
      try {
        const res = await getMyInvites(API_URL, memberId);
        const rows = Array.isArray((res as any)?.invites) ? (res as any).invites : [];
        if (mounted) setInvites(rows);
      } catch {
        if (mounted) setInvites([]);
      } finally {
        if (mounted) setInvitesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setSiteNoticeLoading(true);
      try {
        const row = await getSiteNotice(API_URL);
        if (mounted) setSiteNotice(row || null);
      } catch {
        if (mounted) setSiteNotice(null);
      } finally {
        if (mounted) setSiteNoticeLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const parsedBreaks = useMemo(() => {
    const rows = Array.isArray(breaks) ? breaks : [];
    const out = rows.map((b: any) => {
      const tRaw = b?.recorded_at ?? b?.recordedAt ?? b?.createdAt ?? b?.created_at;
      const d = tRaw ? new Date(String(tRaw)) : new Date(NaN);
      const points = Number(b?.points ?? 0);
      return { raw: b, when: d, points: Number.isFinite(points) ? points : 0 };
    });
    out.sort((a, b) => b.when.getTime() - a.when.getTime());
    return out;
  }, [breaks]);

  const breakYears = useMemo(() => {
    const set = new Set<number>();
    for (const b of parsedBreaks) {
      if (Number.isFinite(b.when.getTime())) set.add(b.when.getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [parsedBreaks]);

  useEffect(() => {
    if (breakYear == null && breakYears.length > 0) setBreakYear(breakYears[0]);
  }, [breakYear, breakYears]);

  const breakSummary = useMemo(() => {
    if (parsedBreaks.length === 0) return { highest: 0, total: 0 };
    let highest = 0;
    let total = 0;
    for (const b of parsedBreaks) {
      total += b.points;
      if (b.points > highest) highest = b.points;
    }
    return { highest, total };
  }, [parsedBreaks]);

  const monthlySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of parsedBreaks) {
      if (!Number.isFinite(b.when.getTime())) continue;
      const y = b.when.getFullYear();
      const m = String(b.when.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      map.set(key, (map.get(key) || 0) + b.points);
    }
    const keys = Array.from(map.keys()).sort();
    let cum = 0;
    return keys.map((k) => {
      cum += map.get(k) || 0;
      return { month: k, value: cum };
    });
  }, [parsedBreaks]);

  const breakMonths = useMemo(() => {
    const set = new Set<string>();
    for (const b of parsedBreaks) {
      if (!Number.isFinite(b.when.getTime())) continue;
      const y = b.when.getFullYear();
      const m = String(b.when.getMonth() + 1).padStart(2, '0');
      set.add(`${y}-${m}`);
    }
    return Array.from(set).sort().reverse();
  }, [parsedBreaks]);

  const filteredBreaks = useMemo(() => {
    const rows = parsedBreaks;
    if (breakQueryMode === 'year' && breakYear != null) {
      return rows.filter((b) => Number.isFinite(b.when.getTime()) && b.when.getFullYear() === breakYear);
    }
    if (breakQueryMode === 'month' && breakMonth) {
      return rows.filter((b) => {
        if (!Number.isFinite(b.when.getTime())) return false;
        const y = b.when.getFullYear();
        const m = String(b.when.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}` === breakMonth;
      });
    }
    const from = breakFrom ? new Date(`${breakFrom}T00:00:00`) : null;
    const to = breakTo ? new Date(`${breakTo}T23:59:59`) : null;
    if (!from && !to) return rows;
    return rows.filter((b) => {
      const t = b.when.getTime();
      if (!Number.isFinite(t)) return false;
      if (from && t < from.getTime()) return false;
      if (to && t > to.getTime()) return false;
      return true;
    });
  }, [parsedBreaks, breakQueryMode, breakYear, breakMonth, breakFrom, breakTo]);

  const categorizedBreaks = useMemo(() => {
    if (breakCategory === 'ALL') return filteredBreaks;
    return filteredBreaks.filter((b) => String(b.raw?.record_type || '').toUpperCase() === breakCategory);
  }, [breakCategory, filteredBreaks]);

  const categorizedBreakSummary = useMemo(() => {
    if (categorizedBreaks.length === 0) return { highest: 0, total: 0 };
    let highest = 0;
    let total = 0;
    for (const b of categorizedBreaks) {
      total += b.points;
      if (b.points > highest) highest = b.points;
    }
    return { highest, total };
  }, [categorizedBreaks]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId) return;
      setClubsLoading(true);
      try {
        const rows = await getMyJoinedClubs(API_URL, memberId);
        if (mounted) setJoinedClubs(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setJoinedClubs([]);
      } finally {
        if (mounted) setClubsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId) return;
      if (!pointsEnabled) {
        if (mounted) setClubPointsMap({});
        if (mounted) setClubPointsLoading(false);
        return;
      }
      setClubPointsLoading(true);
      try {
        const rows = await getMyClubPointsBalances(API_URL, memberId);
        const map: Record<string, { balance: number; updatedAt: string | null }> = {};
        for (const r of Array.isArray(rows) ? rows : []) {
          const clubId = String((r as any)?.clubId || '').trim();
          if (!clubId) continue;
          const bal = Number((r as any)?.balance ?? 0);
          map[clubId] = { balance: Number.isFinite(bal) ? bal : 0, updatedAt: (r as any)?.updatedAt ?? null };
        }
        if (mounted) setClubPointsMap(map);
      } catch {
        if (mounted) setClubPointsMap({});
      } finally {
        if (mounted) setClubPointsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId, pointsEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!liveEnabled) {
        if (mounted) setPublicLiveAnnouncements([]);
        if (mounted) setPublicLiveLoading(false);
        return;
      }
      setPublicLiveLoading(true);
      try {
        const rows = await getPublicLiveAnnouncements(API_URL, 20);
        if (mounted) setPublicLiveAnnouncements(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setPublicLiveAnnouncements([]);
      } finally {
        if (mounted) setPublicLiveLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [liveEnabled]);

  const inboxItems = useMemo((): InboxItem[] => {
    const items: InboxItem[] = [];
    const hidden = localMsgState.hidden || {};
    const read = localMsgState.read || {};

    const noticeEnabled = siteNotice?.enabled !== false;
    const noticeMsg = String(siteNotice?.message || '').trim();
    if (noticeEnabled && noticeMsg) {
      const key = 'system:notice';
      if (!hidden[key]) {
        const dRaw = siteNotice?.updatedAt ?? siteNotice?.createdAt;
        const d = dRaw ? new Date(String(dRaw)) : new Date();
        const href = normalizeHttpUrl(siteNotice?.youtubeEmbedUrl);
        const content = href ? `${noticeMsg}\n\nYouTube：${href}` : noticeMsg;
        items.push({
          key,
          kind: 'system',
          title: '系統通知',
          content,
          createdAt: d,
          subtitle: '系統',
          href: null,
          read: !!read[key],
          deletable: true,
          raw: siteNotice,
        });
      }
    }

    for (const m of Array.isArray(clubMessages) ? clubMessages : []) {
      const id = String(m?.id || '').trim();
      if (!id) continue;
      const key = `club:${id}`;
      items.push({
        key,
        kind: 'club',
        title: String(m?.title || '場館訊息'),
        content: String(m?.content || ''),
        createdAt: m?.createdAt ? new Date(String(m.createdAt)) : new Date(),
        subtitle: String(m?.club?.name || '場館'),
        href: null,
        read: !!m?.read,
        deletable: true,
        raw: m,
      });
    }

    for (const it of Array.isArray(publicLiveAnnouncements) ? publicLiveAnnouncements : []) {
      const id = String(it?.id || '').trim();
      if (!id) continue;
      const key = `live:${id}`;
      if (hidden[key]) continue;
      const startsAt = it?.startsAt ? new Date(String(it.startsAt)) : null;
      const d = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt : it?.createdAt ? new Date(String(it.createdAt)) : new Date();
      const href = normalizeHttpUrl(it?.liveUrl);
      const clubName = String(it?.club?.name || '場館');
      const whenText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
      const content = [
        whenText ? `開始時間：${whenText}` : '',
        href ? `連結：${href}` : '',
      ].filter(Boolean).join('\n');
      items.push({
        key,
        kind: 'live',
        title: `直播：${String(it?.title || '') || '直播通告'}`,
        content,
        createdAt: d,
        subtitle: clubName,
        href,
        read: !!read[key],
        deletable: true,
        raw: it,
      });
    }

    for (const inv of Array.isArray(invites) ? invites : []) {
      const token = String(inv?.token || '').trim();
      const id = String(inv?.id || token || '').trim();
      if (!id) continue;
      const key = `match:${id}`;
      if (hidden[key]) continue;
      const dRaw = inv?.createdAt ?? inv?.created_at ?? inv?.invitedAt ?? inv?.invited_at;
      const d = dRaw ? new Date(String(dRaw)) : new Date();
      const roomId = String(inv?.roomId ?? inv?.room_id ?? '').trim();
      const by = String(inv?.operatorName ?? inv?.operator?.name ?? inv?.from ?? '').trim();
      const content = [
        roomId ? `房間：${roomId}` : '',
        by ? `邀請者：${by}` : '',
      ].filter(Boolean).join('\n');
      items.push({
        key,
        kind: 'match',
        title: '比賽通知：邀請加入',
        content,
        createdAt: Number.isFinite(d.getTime()) ? d : new Date(),
        subtitle: '比賽',
        href: null,
        read: !!read[key],
        deletable: true,
        raw: inv,
      });
    }

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items;
  }, [clubMessages, invites, localMsgState.hidden, localMsgState.read, publicLiveAnnouncements, siteNotice]);

  const unreadCount = useMemo(() => inboxItems.filter((x) => !x.read).length, [inboxItems]);

  const inboxLoading = clubMessagesLoading || publicLiveLoading || invitesLoading || siteNoticeLoading;

  const openMsg = useMemo(() => (openMsgKey ? inboxItems.find((x) => x.key === openMsgKey) || null : null), [openMsgKey, inboxItems]);

  useEffect(() => {
    if (!openMsg || !memberId) return;
    if (openMsg.read) return;
    if (openMsg.kind === 'club') {
      const id = String(openMsg.raw?.id || '').trim();
      if (!id) return;
      (async () => {
        try {
          await markClubMessageRead(API_URL, memberId, id);
        } catch {}
        setClubMessages((prev) => (Array.isArray(prev) ? prev.map((m: any) => (String(m?.id || '') === id ? { ...m, read: true } : m)) : prev));
      })();
      return;
    }
    const key = openMsg.key;
    const next: LocalMsgState = { read: { ...(localMsgState.read || {}), [key]: true }, hidden: { ...(localMsgState.hidden || {}) } };
    setLocalMsgState(next);
    try { localStorage.setItem(`meMessageState:${memberId}`, JSON.stringify(next)); } catch {}
  }, [openMsg, memberId, localMsgState.hidden, localMsgState.read]);

  const toggleSelectMsg = (key: string, checked: boolean) => {
    setSelectedMsgKeys((prev) => {
      const next = { ...(prev || {}) };
      if (checked) next[key] = true;
      else delete next[key];
      return next;
    });
  };

  const clearSelection = () => setSelectedMsgKeys({});

  const deleteMessages = async (keys: string[]) => {
    if (!memberId) return;
    const clubIds: string[] = [];
    const otherKeys: string[] = [];
    for (const k of keys) {
      const it = inboxItems.find((x) => x.key === k);
      if (!it) continue;
      if (it.kind === 'club') {
        const id = String(it.raw?.id || '').trim();
        if (id) clubIds.push(id);
      } else {
        otherKeys.push(it.key);
      }
    }
    if (clubIds.length > 0) {
      try {
        await hideClubMessages(API_URL, memberId, clubIds);
        setClubMessages((prev) => (Array.isArray(prev) ? prev.filter((m: any) => !clubIds.includes(String(m?.id || ''))) : prev));
      } catch (e: any) {
        setToast(String(e?.message || '刪除訊息失敗'));
        return;
      }
    }
    if (otherKeys.length > 0) {
      const nextHidden = { ...(localMsgState.hidden || {}) };
      for (const k of otherKeys) nextHidden[k] = true;
      const next: LocalMsgState = { read: { ...(localMsgState.read || {}) }, hidden: nextHidden };
      setLocalMsgState(next);
      try { localStorage.setItem(`meMessageState:${memberId}`, JSON.stringify(next)); } catch {}
    }
    setOpenMsgKey(null);
    clearSelection();
    setToast('已刪除');
  };

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <main
        className="flex-1 pb-24"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="relative">
          <div className="h-40 sm:h-56 w-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950" />
          </div>
          <div className="-mt-8 px-4">
            <div className="max-w-2xl mx-auto glass rounded-xl p-4 sm:p-5">
              {!memberId ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold accent-yellow">尚未登入</div>
                    <div className="text-sm cue-muted mt-1">請先登入或註冊</div>
                  </div>
                  <div className="flex gap-2">
                    <a href="/members/login" className="cue-button px-4 py-2 rounded">登入</a>
                    <a href="/members/register" className="px-4 py-2 rounded cue-surface-strong hover:brightness-95">註冊</a>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <div className="text-slate-800 font-extrabold">{avatarText}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl font-extrabold accent-yellow truncate">
                        {profile?.name || 'Member'}
                      </div>
                      <div className="text-sm cue-muted truncate">{profile?.email || session?.email}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 mt-4">
          <div className="max-w-2xl mx-auto">
            {showExpiredBanner && (
              <div className="cue-surface rounded-lg p-3 mb-4 ring-1 ring-amber-400/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold text-amber-300">場館限期已到期</div>
                    <div className="text-sm cue-muted mt-1">
                      場館管理功能已暫停（非永久刪除）。如需續期，請聯絡管理員。
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => {
                      try {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('expired');
                        window.history.replaceState({}, '', url.toString());
                      } catch {}
                    }}
                  >
                    知道了
                  </button>
                </div>
              </div>
            )}
            {!!memberId && siteAdOpen && siteAdCurrent?.imageUrl && siteAdCurrent?.linkUrl && (
              typeof document !== 'undefined' && document.body
                ? createPortal(
                    <div
                      className="fixed inset-x-0 z-[9999]"
                      style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
                    >
                      <div className="px-4">
                        <div className="max-w-2xl mx-auto">
                          <div className="cue-surface rounded-lg p-3 shadow-lg ring-1 ring-white/10">
                            <div className="flex items-start justify-between gap-3">
                              <a
                                href={normalizeHttpUrl(siteAdCurrent.linkUrl) || String(siteAdCurrent.linkUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="block flex-1 min-w-0"
                              >
                                <img
                                  src={String(siteAdCurrent.imageUrl)}
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
                    </div>,
                    document.body,
                  )
                : null
            )}
            {!!memberId && (
              <Tabs
                items={[
                  { key: 'clubs', label: '場館' },
                  {
                    key: 'messages',
                    label: (
                      <span className="inline-flex items-center">
                        <span>訊息</span>
                        {unreadCount > 0 && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-extrabold">
                            {unreadCount}
                          </span>
                        )}
                      </span>
                    ),
                  },
                  ...(highbreakEnabled ? [{ key: 'history', label: '歷史記錄' }] : []),
                  { key: 'settings', label: '設定' },
                ]}
                activeKey={activeTab}
                onChange={(k) => setActiveTab(k as any)}
              />
            )}

            {!!memberId && activeTab === 'clubs' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">已加入場館</div>
                    <HelpGuide
                      title="已加入場館"
                      intro="查看你已加入的場館、進入場館公開頁、查看消費積分與場館更新。"
                      steps={[
                        '點選場館卡片可進入該場館公開頁，查看場館資料、直播或比賽入口（如場館有公開）。',
                        '如顯示「消費積分」，代表該場館有啟用積分功能；數值會按場館紀錄更新。',
                        '想加入新場館，請向場館索取加入方式或邀請。',
                      ]}
                      tips={[
                        '如見到「—」代表積分仍在讀取或暫時未有資料。',
                        '只顯示最近 20 筆已加入場館。',
                      ]}
                      faq={[
                        { q: '點解我見唔到「消費積分」？', a: '該場館未啟用積分功能，或系統已關閉此功能模組。' },
                        { q: '點解積分數字好似未更新？', a: '積分會按場館記錄同步；如剛有消費/調整，稍後再刷新頁面。' },
                      ]}
                    />
                  </div>
                  {clubsLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!clubsLoading && joinedClubs.length === 0 && <div className="text-sm cue-muted">暫未加入任何場館</div>}
                  {!clubsLoading && joinedClubs.length > 0 && (
                    <div className="space-y-2">
                      {joinedClubs.slice(0, 20).map((r: any, idx: number) => {
                        const c = r?.club || {};
                        const id = String(r?.clubId || c?.id || '');
                        const pts = id ? clubPointsMap[id] : null;
                        const bal = pts ? Number(pts.balance ?? 0) : null;
                        const balOk = bal != null && Number.isFinite(bal);
                        const badgeCls = balOk && bal < 0 ? 'bg-red-700 text-white' : 'bg-emerald-700 text-white';
                        return (
                          <a
                            key={r.id || `${id}-${idx}`}
                            href={id ? `/club/${id}` : '#'}
                            className="block cue-surface-strong rounded-lg p-3 hover:brightness-95"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{c?.name || '場館'}</div>
                                <div className="text-xs cue-muted mt-1 truncate">{c?.address || ''}</div>
                              </div>
                              {pointsEnabled && pts ? (
                                <div className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-extrabold ${badgeCls}`}>
                                  {clubPointsLoading ? '消費積分…' : `消費積分 ${balOk ? String(bal) : '—'}`}
                                </div>
                              ) : null}
                            </div>
                          </a>
                        );
                      })}
                      {joinedClubs.length > 20 && <div className="text-xs cue-muted">只顯示最近 20 筆</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!!memberId && activeTab === 'messages' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">訊息</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs cue-muted">{inboxLoading ? '讀取中…' : `共 ${inboxItems.length} 則`}</div>
                      <HelpGuide
                        title="訊息"
                        intro="查看系統/場館/直播/比賽通知，支援批量選取與刪除。"
                        steps={[
                          '點選訊息卡片可打開內容；會自動標記已讀。',
                          '需要批量處理：先勾選訊息 → 使用「批量刪除」。',
                          '用「全選 / 清除」快速管理多則訊息。',
                          '如訊息內有「開啟連結」，可跳到相關頁面或外部網站。',
                        ]}
                        tips={[
                          '刪除訊息不可復原，刪除前請先確認內容。',
                          '如遇到讀取中，稍後再刷新頁面。',
                        ]}
                        faq={[
                          { q: '點解有啲訊息刪唔到？', a: '部分訊息可能屬系統公告或功能模組限制；可先嘗試批量刪除，或稍後再試。' },
                          { q: '未讀數字點計？', a: '未讀會以本機紀錄 + 後端訊息狀態整合；開啟過訊息後會自動變已讀。' },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="text-sm cue-muted">未讀 {unreadCount} · 已選 {Object.keys(selectedMsgKeys).length}</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const all = inboxItems;
                          if (all.length === 0) return;
                          const allSelected = all.every((x) => selectedMsgKeys[x.key]);
                          if (allSelected) return setSelectedMsgKeys({});
                          const next: Record<string, boolean> = {};
                          for (const x of all) next[x.key] = true;
                          setSelectedMsgKeys(next);
                        }}
                        className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                      >
                        全選
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedMsgKeys({})}
                        className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                      >
                        清除
                      </button>
                      <button
                        type="button"
                        disabled={Object.keys(selectedMsgKeys).length === 0}
                        onClick={async () => {
                          const keys = Object.keys(selectedMsgKeys);
                          if (keys.length === 0) return;
                          if (!confirm(`確定要刪除已選 ${keys.length} 則訊息？`)) return;
                          if (!confirm('再次確認：刪除後不可復原')) return;
                          await deleteMessages(keys);
                        }}
                        className={`px-3 py-2 rounded text-sm font-semibold ${Object.keys(selectedMsgKeys).length === 0 ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                      >
                        批量刪除
                      </button>
                    </div>
                  </div>

                  {inboxLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!inboxLoading && inboxItems.length === 0 && <div className="text-sm cue-muted">暫無訊息</div>}
                  {!inboxLoading && inboxItems.length > 0 && (
                    <div className="space-y-2">
                      {inboxItems.slice(0, 200).map((it) => {
                        const isSelected = !!selectedMsgKeys[it.key];
                        const isUnread = !it.read;
                        return (
                          <div
                            key={it.key}
                            className={`cue-surface-strong rounded-lg p-3 flex items-start gap-3 hover:brightness-95 cursor-pointer ${isUnread ? 'ring-1 ring-yellow-300/30' : ''}`}
                            onClick={() => setOpenMsgKey(it.key)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => toggleSelectMsg(it.key, e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className={`font-semibold truncate ${isUnread ? 'text-white' : 'cue-muted'}`}>{it.title}</div>
                                <div className="text-xs cue-muted flex-shrink-0">{Number.isFinite(it.createdAt.getTime()) ? it.createdAt.toLocaleDateString() : ''}</div>
                              </div>
                              <div className="text-xs cue-muted mt-1 truncate">
                                {it.subtitle ? `${it.subtitle} · ` : ''}
                                {it.kind === 'system' ? '系統' : it.kind === 'club' ? '場館' : it.kind === 'live' ? '直播' : '比賽'}
                                {isUnread ? ' · 未讀' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {inboxItems.length > 200 && <div className="text-xs cue-muted">只顯示前 200 筆</div>}
                    </div>
                  )}
                </div>

                {!!openMsg && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setOpenMsgKey(null)} />
                    <div className="relative w-full max-w-lg cue-surface rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold accent-yellow truncate">{openMsg.title}</div>
                          <div className="text-xs cue-muted mt-1">
                            {openMsg.subtitle ? `${openMsg.subtitle} · ` : ''}
                            {openMsg.kind === 'system' ? '系統' : openMsg.kind === 'club' ? '場館' : openMsg.kind === 'live' ? '直播' : '比賽'}
                            {Number.isFinite(openMsg.createdAt.getTime()) ? ` · ${openMsg.createdAt.toLocaleString()}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenMsgKey(null)}
                          className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                        >
                          返回
                        </button>
                      </div>

                      <div className="mt-4 text-sm whitespace-pre-wrap">{openMsg.content || '—'}</div>

                      {openMsg.href && (
                        <div className="mt-3">
                          <a href={openMsg.href} target="_blank" rel="noreferrer" className="accent-blue underline text-sm">
                            開啟連結
                          </a>
                        </div>
                      )}

                      <div className="mt-5 flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('確定要刪除這則訊息？')) return;
                            if (!confirm('再次確認：刪除後不可復原')) return;
                            await deleteMessages([openMsg.key]);
                          }}
                          className="flex-1 px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-semibold"
                        >
                          刪除
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenMsgKey(null)}
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

            {!!memberId && activeTab === 'settings' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">會員資料</div>
                    <div className="flex items-center gap-2">
                      <HelpGuide
                        title="會員資料"
                        intro="編輯你的聯絡資料、地區設定與公開單杆選項，並可在此登出。"
                        steps={[
                          '按「編輯資料」進入編輯模式。',
                          '修改電話、出生日期、地方、分區及「公開單杆」後按「儲存」。',
                          '如不想保存，按「取消」恢復原本資料。',
                          '按「登出」會清除本機登入狀態。',
                        ]}
                        tips={[
                          '地方與分區需要同時選擇（不可只選其中一個）。',
                          '地方/分區清單讀取中時會暫時不可選。',
                          '電話可輸入 8 位本地號碼或 +852… 格式。',
                        ]}
                        faq={[
                          { q: '點解地方/分區選項係灰色？', a: '代表資料仍在讀取中，或你未先選擇「地方」。' },
                          { q: '我改咗資料但冇反映？', a: '請按「儲存」後等待提示，再刷新頁面確認。' },
                          { q: '點解我已勾選「公開單杆」但首頁龍虎榜仍未見到我？', a: '除了會員要開啟公開單杆外，該筆紀錄所屬場館亦需要開啟公開單杆數據，並且系統首頁設定要顯示綜合單杆龍虎榜。' },
                        ]}
                      />
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={() => {
                          setToast(null);
                          setEditMode((v) => !v);
                        }}
                        className={`px-3 py-1 rounded text-sm font-semibold ${savingProfile ? 'cue-surface-strong cue-muted' : 'cue-surface-strong hover:brightness-95'}`}
                      >
                        {editMode ? '取消編輯' : '編輯資料'}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">ID</div>
                      <div className="text-sm font-semibold text-right">{String(memberId || '-')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">姓名</div>
                      <div className="text-sm font-semibold text-right">{String(profile?.name || '-')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">Email</div>
                      <div className="text-sm font-semibold text-right">{memberEmail || '-'}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">會員身份</div>
                      <div className="text-sm font-semibold text-right">{memberTier === 'VERIFIED' ? '認證會員' : '普通會員'}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">Email 驗證</div>
                      <div className="text-right max-w-[70%]">
                        <div className="text-sm font-semibold">
                          {memberTier === 'VERIFIED'
                            ? `已驗證${emailVerifiedAt ? ` · ${new Date(emailVerifiedAt).toLocaleString()}` : ''}`
                            : memberEmail
                              ? '未驗證'
                              : '未設定 Email'}
                        </div>
                        {memberTier !== 'VERIFIED' && memberEmail ? (
                          <button
                            type="button"
                            disabled={sendingVerifyEmail}
                            onClick={async () => {
                              if (!memberId) return;
                              try {
                                setSendingVerifyEmail(true);
                                const res = await resendMemberVerificationEmail(API_URL, memberId);
                                setToast(res?.alreadyVerified ? '此帳戶已完成 Email 驗證' : '驗證信已重新發送，請檢查你的 Email');
                              } catch (e: any) {
                                setToast(String(e?.message || '重發驗證信失敗'));
                              } finally {
                                setSendingVerifyEmail(false);
                              }
                            }}
                            className={`mt-2 px-3 py-1.5 rounded text-sm font-semibold ${sendingVerifyEmail ? 'cue-surface cue-muted' : 'cue-button'}`}
                          >
                            {sendingVerifyEmail ? '發送中...' : '重新發送驗證信'}
                          </button>
                        ) : null}
                        {memberTier !== 'VERIFIED' && !memberEmail ? (
                          <div className="mt-2 text-xs cue-muted">此帳戶目前未設定 Email，暫時未可升級為認證會員。</div>
                        ) : null}
                        {memberTier !== 'VERIFIED' ? (
                          <div className="mt-2 text-xs cue-muted">完成 Email 驗證後，才可使用預約、比賽報名及後續受限制功能。</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">會員編碼</div>
                      <div className="text-sm font-semibold text-right">{String(profile?.member_code || profile?.memberCode || '無')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">建立時間</div>
                      <div className="text-sm font-semibold text-right">
                        {profile?.created_at
                          ? new Date(profile.created_at).toLocaleString()
                          : profile?.createdAt
                            ? new Date(profile.createdAt).toLocaleString()
                            : '-'}
                      </div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">電話</div>
                      {editMode ? (
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="例如：61234567 或 +85261234567"
                          className="w-64 max-w-[65%] px-3 py-1.5 rounded cue-surface text-sm"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(() => {
                            try {
                              const key = String(profile?.email || memberId || '');
                              const raw = localStorage.getItem('memberOptional') || '{}';
                              const store = JSON.parse(raw);
                              const opt = store[key] || {};
                              const v = String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? opt.phone ?? '') || '-';
                              return v || '-';
                            } catch {
                              return String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? '-') || '-';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">出生日期</div>
                      {editMode ? (
                        <input
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className="w-64 max-w-[65%] px-3 py-1.5 rounded cue-surface text-sm"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(() => {
                            try {
                              const key = String(profile?.email || memberId || '');
                              const raw = localStorage.getItem('memberOptional') || '{}';
                              const store = JSON.parse(raw);
                              const opt = store[key] || {};
                              const v = String(profile?.birthDate ?? profile?.birth_date ?? opt.birthDate ?? '') || '-';
                              return v || '-';
                            } catch {
                              return String(profile?.birthDate ?? profile?.birth_date ?? '-') || '-';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">公開單杆</div>
                      {editMode ? (
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={editPublicHighbreak}
                            onChange={(e) => setEditPublicHighbreak(e.target.checked)}
                          />
                          <span>允許在首頁顯示我的單杆紀錄/累計</span>
                        </label>
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(profile?.public_highbreak_enabled ?? profile?.publicHighbreakEnabled) ? '公開' : '不公開'}
                        </div>
                      )}
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">地方</div>
                      {editMode ? (
                        <select
                          value={editRegionCode}
                          onChange={(e) => setEditRegionCode(String(e.target.value || '').trim().toUpperCase())}
                          className="w-64 max-w-[65%] px-3 py-2 rounded cue-surface text-sm"
                          disabled={locLoading}
                        >
                          <option value="">（不設定）</option>
                          {regions.map((r) => (
                            <option key={r.code3} value={r.code3}>
                              {r.name} ({r.code3})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(() => {
                            const code = String(profile?.region_code ?? profile?.regionCode ?? '') || '';
                            if (!code) return '—';
                            const hit = regions.find((x) => x.code3 === code);
                            return hit ? `${hit.name} (${hit.code3})` : code;
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">分區</div>
                      {editMode ? (
                        <select
                          value={editDistrictCode}
                          onChange={(e) => setEditDistrictCode(String(e.target.value || '').trim().toUpperCase())}
                          className="w-64 max-w-[65%] px-3 py-2 rounded cue-surface text-sm"
                          disabled={locLoading || !editRegionCode}
                        >
                          <option value="">{editRegionCode ? '請選擇分區' : '請先選地方'}</option>
                          {districts.map((d) => (
                            <option key={`${d.regionCode || editRegionCode}-${d.code3}`} value={d.code3}>
                              {d.name} ({d.code3})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(() => {
                            const code = String(profile?.district_code ?? profile?.districtCode ?? '') || '';
                            if (!code) return '—';
                            const hit = districts.find((x) => x.code3 === code);
                            return hit ? `${hit.name} (${hit.code3})` : code;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {String(profile?.role || '').toUpperCase() === 'ADMIN' && (
                    <div className="mt-3 cue-surface-strong rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">場館公開設定</div>
                        <div className="flex items-center gap-2">
                          <HelpGuide
                            title="場館公開設定"
                            intro="控制你的場館是否顯示於首頁場館列表，以及是否公開單杆數據、比賽入口與直播訊息。"
                            steps={[
                              '勾選「公開顯示於首頁場館列表」後，此場館才可被首頁場館列表收錄。',
                              '下方 3 個選項分別控制公開單杆數據、公開比賽入口及公開直播訊息。',
                              '修改後按「儲存」寫入設定。',
                            ]}
                            tips={[
                              '若未勾選首頁場館列表，其餘公開選項會一併停用。',
                              '即使場館已公開，首頁仍需要由 Super Admin 開啟「場館列表」或「綜合單杆龍虎榜」對應模組才會顯示。',
                            ]}
                          />
                          <button
                            type="button"
                            disabled={myClubProfileSaving || myClubProfileLoading || !myClubProfile}
                            onClick={async () => {
                              if (!memberId || !myClubProfile) return;
                              try {
                                setMyClubProfileSaving(true);
                                const payload = {
                                  ...myClubProfile,
                                  publicEnabled: myClubProfile.publicEnabled === true,
                                  publicShowHighbreak: myClubProfile.publicShowHighbreak !== false,
                                  publicShowTournaments: myClubProfile.publicShowTournaments !== false,
                                  publicShowLive: myClubProfile.publicShowLive !== false,
                                };
                                const res = await updateClubProfile(API_URL, memberId, payload);
                                setMyClubProfile(res && typeof res === 'object' ? res : payload);
                                setToast('已更新場館公開設定');
                              } catch (e: any) {
                                setToast(String(e?.message || '更新失敗'));
                              } finally {
                                setMyClubProfileSaving(false);
                              }
                            }}
                            className={`px-3 py-2 rounded text-sm font-semibold ${myClubProfileSaving ? 'cue-surface cue-muted' : 'cue-button'}`}
                          >
                            儲存
                          </button>
                        </div>
                      </div>
                      {myClubProfileLoading ? (
                        <div className="text-sm cue-muted mt-2">讀取中…</div>
                      ) : !myClubProfile ? (
                        <div className="text-sm cue-muted mt-2">尚未建立場館資料。</div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <label className="flex items-center gap-2 text-sm font-semibold">
                            <input
                              type="checkbox"
                              checked={myClubProfile.publicEnabled === true}
                              onChange={(e) => setMyClubProfile((p: any) => ({ ...(p || {}), publicEnabled: e.target.checked }))}
                            />
                            <span>公開顯示於首頁「場館列表」</span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <label className={`flex items-center gap-2 text-sm ${myClubProfile.publicEnabled === true ? '' : 'opacity-50'}`}>
                              <input
                                type="checkbox"
                                disabled={myClubProfile.publicEnabled !== true}
                                checked={myClubProfile.publicShowHighbreak !== false}
                                onChange={(e) => setMyClubProfile((p: any) => ({ ...(p || {}), publicShowHighbreak: e.target.checked }))}
                              />
                              <span>公開單杆數據</span>
                            </label>
                            <label className={`flex items-center gap-2 text-sm ${myClubProfile.publicEnabled === true ? '' : 'opacity-50'}`}>
                              <input
                                type="checkbox"
                                disabled={myClubProfile.publicEnabled !== true}
                                checked={myClubProfile.publicShowTournaments !== false}
                                onChange={(e) => setMyClubProfile((p: any) => ({ ...(p || {}), publicShowTournaments: e.target.checked }))}
                              />
                              <span>公開比賽入口</span>
                            </label>
                            <label className={`flex items-center gap-2 text-sm ${myClubProfile.publicEnabled === true ? '' : 'opacity-50'}`}>
                              <input
                                type="checkbox"
                                disabled={myClubProfile.publicEnabled !== true}
                                checked={myClubProfile.publicShowLive !== false}
                                onChange={(e) => setMyClubProfile((p: any) => ({ ...(p || {}), publicShowLive: e.target.checked }))}
                              />
                              <span>公開直播訊息</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {toast && <div className="mt-3 text-sm cue-muted">{toast}</div>}
                  {editMode && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={async () => {
                          if (!memberId) return;
                          try {
                            setSavingProfile(true);
                            const rc = String(editRegionCode || '').trim().toUpperCase();
                            const dc = String(editDistrictCode || '').trim().toUpperCase();
                            if ((rc && !dc) || (!rc && dc)) {
                              throw new Error('請同時選擇地方及分區');
                            }
                            const res = await updateMemberSelf(API_URL, memberId, {
                              phone: String(editPhone || '').trim(),
                              birthDate: String(editBirthDate || '').trim(),
                              regionCode: rc ? rc : null,
                              districtCode: dc ? dc : null,
                              publicHighbreakEnabled: !!editPublicHighbreak,
                            });
                            const next = (res as any)?.member ?? res;
                            setProfile(next);
                            try {
                              const key = String(next?.email || memberId || '');
                              const raw = localStorage.getItem('memberOptional') || '{}';
                              const store = JSON.parse(raw);
                              store[key] = { ...(store[key] || {}), phone: String(editPhone || '').trim(), birthDate: String(editBirthDate || '').trim() };
                              localStorage.setItem('memberOptional', JSON.stringify(store));
                            } catch {}
                            setToast('已更新資料');
                            setEditMode(false);
                          } catch (e: any) {
                            setToast(String(e?.message || '更新失敗'));
                          } finally {
                            setSavingProfile(false);
                          }
                        }}
                        className={`px-4 py-2 rounded font-semibold ${savingProfile ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                      >
                        儲存
                      </button>
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={() => {
                          setEditMode(false);
                          setToast(null);
                          setEditPhone(String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? '') || '');
                          setEditRegionCode(String(profile?.region_code ?? profile?.regionCode ?? '') || '');
                          setEditDistrictCode(String(profile?.district_code ?? profile?.districtCode ?? '') || '');
                          setEditPublicHighbreak(!!(profile?.public_highbreak_enabled ?? profile?.publicHighbreakEnabled));
                          setEditBirthDate('');
                          const bd = profile?.birthDate ?? profile?.birth_date;
                          if (bd) {
                            const d = new Date(bd);
                            if (!Number.isNaN(d.getTime())) {
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              setEditBirthDate(`${d.getFullYear()}-${mm}-${dd}`);
                            }
                          }
                        }}
                        className="px-4 py-2 rounded font-semibold cue-surface-strong hover:brightness-95"
                      >
                        取消
                      </button>
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        clearMemberSession();
                        window.location.href = '/me';
                      }}
                      className="w-full px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-semibold"
                    >
                      登出
                    </button>
                  </div>
                </div>

                <details className="cue-surface rounded-lg p-4">
                  <summary className="cursor-pointer font-semibold text-lg flex items-center justify-between gap-3">
                    <span>更改密碼</span>
                    <HelpGuide
                      title="更改密碼"
                      intro="更新此帳戶的登入密碼。"
                      steps={[
                        '展開「更改密碼」。',
                        '輸入新密碼（至少 6 位）及再次確認。',
                        '按「更新密碼」。',
                      ]}
                      tips={[
                        '更新後建議重新登入一次，確保新密碼生效。',
                        '如兩次輸入不一致，系統會提示並拒絕更新。',
                      ]}
                    />
                  </summary>
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="新密碼（至少 6 位）"
                      className="w-full px-3 py-2 rounded cue-surface-strong"
                    />
                    <input
                      type="password"
                      value={editNewPassword2}
                      onChange={(e) => setEditNewPassword2(e.target.value)}
                      placeholder="再次輸入新密碼"
                      className="w-full px-3 py-2 rounded cue-surface-strong"
                    />
                    <button
                      type="button"
                      disabled={savingPassword}
                      onClick={async () => {
                        if (!memberId) return;
                        const p1 = String(editNewPassword || '');
                        const p2 = String(editNewPassword2 || '');
                        if (p1.length < 6) return setToast('新密碼至少 6 位');
                        if (p1 !== p2) return setToast('兩次新密碼不一致');
                        try {
                          setSavingPassword(true);
                          const res = await updateMemberSelf(API_URL, memberId, { password: p1 });
                          const next = (res as any)?.member ?? res;
                          setProfile(next);
                          setEditNewPassword('');
                          setEditNewPassword2('');
                          setToast('已更新密碼');
                        } catch (e: any) {
                          setToast(String(e?.message || '更新失敗'));
                        } finally {
                          setSavingPassword(false);
                        }
                      }}
                      className={`w-full px-4 py-2 rounded font-semibold ${savingPassword ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                    >
                      更新密碼
                    </button>
                  </div>
                </details>
              </div>
            )}

            {!!memberId && activeTab === 'history' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">歷史記錄</div>
                    <HelpGuide
                      title="歷史記錄"
                      intro="查看歷史 highbreak 記錄，並分開會內與比賽兩類資料。"
                      steps={[
                        '先切換「全部 / 會內 / 比賽」，再查看對應的歷史最高及累計。',
                        '下方會顯示每月累計走勢。',
                        '可在「時間段 / 年 / 月」切換篩選方式。',
                        '下方列表會顯示符合條件的 highbreak 記錄；如有影片連結可點「連結」開啟。',
                      ]}
                      tips={[
                        '表格在手機可左右滑查看欄位。',
                        '只顯示前 200 筆記錄。',
                      ]}
                    />
                  </div>
                  {breaksLoading ? (
                    <div className="text-sm cue-muted">讀取中…</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setBreakCategory('ALL')}
                          className={`px-3 py-1.5 rounded text-sm font-semibold ${breakCategory === 'ALL' ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                        >
                          全部
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreakCategory('VENUE')}
                          className={`px-3 py-1.5 rounded text-sm font-semibold ${breakCategory === 'VENUE' ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                        >
                          會內
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreakCategory('TOURNAMENT')}
                          className={`px-3 py-1.5 rounded text-sm font-semibold ${breakCategory === 'TOURNAMENT' ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                        >
                          比賽
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="cue-surface-strong rounded-lg p-4">
                          <div className="text-sm cue-muted">目前分類最高</div>
                          <div className="text-3xl font-extrabold accent-yellow mt-1">{categorizedBreakSummary.highest || 0}</div>
                        </div>
                        <div className="cue-surface-strong rounded-lg p-4">
                          <div className="text-sm cue-muted">目前分類累計</div>
                          <div className="text-3xl font-extrabold accent-yellow mt-1">{categorizedBreakSummary.total || 0}</div>
                        </div>
                      </div>

                      <div className="cue-surface-strong rounded-lg p-4">
                        <div className="font-semibold mb-2">每月累計走勢</div>
                        {monthlySeries.length < 2 ? (
                          <div className="text-sm cue-muted">資料不足</div>
                        ) : (
                          (() => {
                            const w = 640;
                            const h = 160;
                            const pad = 18;
                            const vals = monthlySeries.map((x) => x.value);
                            const minV = Math.min(...vals);
                            const maxV = Math.max(...vals);
                            const span = Math.max(1, maxV - minV);
                            const n = monthlySeries.length;
                            const pts = monthlySeries.map((p, i) => {
                              const x = pad + (i * (w - pad * 2)) / Math.max(1, n - 1);
                              const y = pad + (h - pad * 2) * (1 - (p.value - minV) / span);
                              return `${x.toFixed(1)},${y.toFixed(1)}`;
                            }).join(' ');
                            const first = monthlySeries[0]?.month || '';
                            const last = monthlySeries[monthlySeries.length - 1]?.month || '';
                            return (
                              <div className="w-full">
                                <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[160px]">
                                  <polyline points={pts} fill="none" stroke="rgba(250,204,21,0.95)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                  <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgba(255,255,255,0.12)" />
                                  <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="rgba(255,255,255,0.12)" />
                                </svg>
                                <div className="flex items-center justify-between text-xs cue-muted mt-1">
                                  <div>{first}</div>
                                  <div>{last}</div>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>

                      <div className="cue-surface-strong rounded-lg p-4">
                        <div className="font-semibold mb-3">歷史單杆查詢</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setBreakQueryMode('range')}
                            className={`px-3 py-1.5 rounded text-sm font-semibold ${breakQueryMode === 'range' ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                          >
                            時間段
                          </button>
                          <button
                            type="button"
                            onClick={() => setBreakQueryMode('year')}
                            className={`px-3 py-1.5 rounded text-sm font-semibold ${breakQueryMode === 'year' ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                          >
                            年
                          </button>
                          <button
                            type="button"
                            onClick={() => setBreakQueryMode('month')}
                            className={`px-3 py-1.5 rounded text-sm font-semibold ${breakQueryMode === 'month' ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                          >
                            月
                          </button>
                        </div>

                        <div className="mt-3">
                          {breakQueryMode === 'range' && (
                            <div className="flex flex-wrap gap-2 items-center">
                              <input type="date" value={breakFrom} onChange={(e) => setBreakFrom(e.target.value)} className="px-3 py-2 rounded cue-surface text-sm" />
                              <div className="text-sm cue-muted">至</div>
                              <input type="date" value={breakTo} onChange={(e) => setBreakTo(e.target.value)} className="px-3 py-2 rounded cue-surface text-sm" />
                              <button
                                type="button"
                                onClick={() => { setBreakFrom(''); setBreakTo(''); }}
                                className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                              >
                                清除
                              </button>
                            </div>
                          )}
                          {breakQueryMode === 'year' && (
                            <select
                              value={breakYear ?? ''}
                              onChange={(e) => setBreakYear(e.target.value ? Number(e.target.value) : null)}
                              className="px-3 py-2 rounded cue-surface text-sm"
                            >
                              {breakYears.map((y) => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                            </select>
                          )}
                          {breakQueryMode === 'month' && (
                            <select
                              value={breakMonth}
                              onChange={(e) => setBreakMonth(e.target.value)}
                              className="px-3 py-2 rounded cue-surface text-sm"
                            >
                              <option value="">請選擇月份</option>
                              {breakMonths.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="text-xs cue-muted mt-2">
                          目前分類：{breakCategory === 'TOURNAMENT' ? '比賽' : breakCategory === 'VENUE' ? '會內' : '全部'} · 共 {categorizedBreaks.length} 筆
                        </div>

                        <div className="mt-3 overflow-x-auto -mx-2 px-2">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="cue-muted border-b cue-border">
                                <th className="py-2 px-2 whitespace-nowrap">日期</th>
                                <th className="py-2 px-2 whitespace-nowrap">類型</th>
                                <th className="py-2 px-2">球館</th>
                                <th className="py-2 px-2">賽事</th>
                                <th className="py-2 px-2 whitespace-nowrap">單杆</th>
                                <th className="py-2 px-2 whitespace-nowrap">影片</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categorizedBreaks.slice(0, 200).map((b) => {
                                const clubName = String(b.raw?.club?.name || b.raw?._club?.name || b.raw?.clubName || '-');
                                const href = normalizeHttpUrl(b.raw?.video_url ?? b.raw?.videoUrl);
                                const tournamentTitle = String(b.raw?.tournament?.title || '-');
                                const recordTypeLabel = String(b.raw?.record_type || '').toUpperCase() === 'TOURNAMENT' ? '比賽' : '會內';
                                return (
                                  <tr key={String(b.raw?.id || `${b.when.getTime()}-${b.points}`)} className="border-b cue-border hover:brightness-95">
                                    <td className="py-2 px-2 cue-muted whitespace-nowrap">
                                      {Number.isFinite(b.when.getTime()) ? b.when.toLocaleDateString() : '-'}
                                    </td>
                                    <td className="py-2 px-2 whitespace-nowrap">{recordTypeLabel}</td>
                                    <td className="py-2 px-2">{clubName}</td>
                                    <td className="py-2 px-2">{tournamentTitle}</td>
                                    <td className="py-2 px-2 font-semibold accent-yellow whitespace-nowrap">{b.points}</td>
                                    <td className="py-2 px-2">
                                      {href ? (
                                        <a href={href} target="_blank" rel="noreferrer" className="accent-blue underline">連結</a>
                                      ) : (
                                        <span className="cue-muted">-</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {categorizedBreaks.length > 200 && <div className="text-xs cue-muted mt-2">只顯示前 200 筆</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {systemPortalEnabled && (
        <a
          href="https://www.snookerhk.live/"
          target="_blank"
          rel="noreferrer"
          className="fixed z-50 right-4 select-none px-4 py-3 rounded-full bg-amber-400 text-slate-950 font-extrabold shadow-lg ring-2 ring-amber-200 hover:brightness-95 active:brightness-90"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
          aria-label="snookerhk.live首頁"
        >
          snookerhk.live首頁
        </a>
      )}
      <BottomNavPublic />
    </div>
  );
};

export default Me;
