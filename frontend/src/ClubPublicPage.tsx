import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import {
  cancelMyReservation,
  createReservation,
  getAvailability,
  getClubLeaderboardHighest,
  getClubLeaderboardMonthly,
  getClubProfile,
  getMember,
  getMyJoinedClubs,
  getMyReservations,
  getMyClubPointsBalance,
  getPublicClubLiveAnnouncements,
  getPublicClubMessages,
  getPublicClubProfile,
  getPublicClubTournamentParticipantDetail,
  getPublicClubTournamentLiveBoard,
  getPublicClubTournament,
  getPublicClubTournaments,
  getPublicPricing,
  getPublicTables,
  getSiteAds,
  joinClub,
  signupTournament,
} from './lib/api';
import { readMemberSession, type MemberSession } from './lib/auth';
import Tabs from './components/Tabs';
import { useFeatureEnabled, useModuleVisible } from './lib/features';

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

type TournamentFormat = 'KNOCKOUT' | 'LEAGUE';

const PUBLIC_BRACKET_CARD_HEIGHT = 88;
const PUBLIC_BRACKET_BASE_GAP = 18;
const PUBLIC_BRACKET_CONNECTOR_HALF_GAP = 20;

function formatMemberLabel(member: any) {
  return [
    String(member?.member_code || '').trim(),
    String(member?.name || '').trim(),
  ].filter(Boolean).join(' ') || '-';
}

function formatTournamentParticipantLabel(participant: any) {
  if (!participant) return 'BYE';
  const seed = Number(participant?.seed || 0);
  const prefix = seed > 0 ? `#${seed} ` : '';
  return `${prefix}${formatMemberLabel(participant?.member)}`;
}

function normalizeTournamentFormat(value: any): TournamentFormat {
  return String(value || '').trim().toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
}

function formatTournamentFormatLabel(value: any) {
  return normalizeTournamentFormat(value) === 'LEAGUE' ? 'League' : 'Knockout';
}

function formatTournamentWorkflowLabel(value: any) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'REGISTRATION') return '報名中';
  if (normalized === 'SEEDED') return '已排位';
  if (normalized === 'COMPLETED') return '已完成';
  return normalized || '-';
}

function formatTournamentResultTypeLabel(value: any) {
  const normalized = String(value || 'STANDARD').trim().toUpperCase();
  if (normalized === 'BYE') return 'BYE';
  if (normalized === 'WALKOVER') return 'W/O';
  if (normalized === 'FORFEIT') return '棄權';
  return '正常完賽';
}

function formatTournamentMatchStatusLabel(value: any) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'COMPLETED') return '已完成';
  if (normalized === 'LIVE') return '進行中';
  if (normalized === 'READY') return '就緒';
  if (normalized === 'PENDING') return '待定';
  return normalized || '-';
}

function getTournamentMatchMonthKey(match: any) {
  const raw = match?.endedAt || match?.startedAt || match?.scheduledAt || null;
  if (!raw) return '';
  const d = new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthFilterLabel(monthKey: string) {
  const value = String(monthKey || '').trim();
  if (!/^\d{4}-\d{2}$/.test(value)) return value || '全部月份';
  return `${value.slice(0, 4)}年${value.slice(5, 7)}月`;
}

function getPublicTournamentMatchBestOf(match: any, fallbackBestOfRaw?: any) {
  return Math.max(1, Math.floor(Number(match?.best_of_frames ?? fallbackBestOfRaw ?? 1) || 1));
}

function isPublicTournamentLiveMatch(match: any) {
  const status = String(match?.status || '').trim().toUpperCase();
  if (status === 'LIVE') return true;
  if (status === 'COMPLETED' || status === 'PENDING') return false;
  const frames = Array.isArray(match?.frames) ? match.frames : [];
  return frames.length > 0;
}

function formatPublicTournamentStageLabel(match: any, format: TournamentFormat, participantCount: number) {
  const matchNo = Number(match?.match_no || 0);
  if (format === 'LEAGUE') {
    const roundNo = Number(match?.round_no || 0);
    return `${roundNo > 0 ? `第 ${roundNo} 輪` : '循環賽'} · M${matchNo || '-'}`;
  }
  return `${formatPublicKnockoutRoundLabel(match, participantCount)} · M${matchNo || '-'}`;
}

function buildPublicTournamentLiveProgressLabel(match: any, fallbackBestOfRaw?: any) {
  const frames = Array.isArray(match?.frames) ? match.frames : [];
  const completedCount = frames.length;
  const bestOf = getPublicTournamentMatchBestOf(match, fallbackBestOfRaw);
  const aWins = Number(match?.player_a_frames_won || 0);
  const bWins = Number(match?.player_b_frames_won || 0);
  const status = String(match?.status || '').trim().toUpperCase();
  if (status === 'COMPLETED') return `已完成 · 盤數 ${aWins}:${bWins}`;
  if (completedCount <= 0) return `尚未開局 · Best of ${bestOf}`;
  const nextFrameNo = Math.min(bestOf, completedCount + 1);
  return `盤數 ${aWins}:${bWins} · 已完成 ${completedCount}/${bestOf} 局 · 下一局 第 ${nextFrameNo} 局`;
}

function getPublicTournamentBreakRows(match: any) {
  if (Array.isArray(match?.breaks)) return match.breaks;
  if (Array.isArray(match?.break_records)) return match.break_records;
  return [];
}

function buildPublicTournamentBreakSummary(match: any) {
  const rows = getPublicTournamentBreakRows(match);
  const totalCount = rows.length;
  const topRow = rows.reduce((best: any, row: any) => (
    Number(row?.points || 0) > Number(best?.points || 0) ? row : best
  ), rows[0] || null);
  const latestRow = rows.reduce((best: any, row: any) => {
    if (!best) return row;
    const rowTime = row?.recorded_at ? new Date(String(row.recorded_at)).getTime() : 0;
    const bestTime = best?.recorded_at ? new Date(String(best.recorded_at)).getTime() : 0;
    if (rowTime !== bestTime) return rowTime > bestTime ? row : best;
    return Number(row?.frame_no || 0) > Number(best?.frame_no || 0) ? row : best;
  }, null);
  const topValue = Math.max(
    Number(match?.player_a_max_break || 0),
    Number(match?.player_b_max_break || 0),
    Number(topRow?.points || 0),
  );
  return {
    countLabel: totalCount > 0 ? `20+ ${totalCount} 筆` : '暫無 20+',
    topLabel: topValue > 0 ? `最高 break ${topValue}` : '最高 break -',
    latestLabel: latestRow
      ? `最新 20+：${formatMemberLabel(latestRow?.member)} · 第 ${Number(latestRow?.frame_no || 0)} 局 · ${Number(latestRow?.points || 0)}`
      : '未有最新 20+',
  };
}

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function formatPublicKnockoutRoundLabel(match: any, participantCount: number) {
  const roundNo = Number(match?.round_no || 0);
  if (roundNo <= 0) return '-';
  const bracketSize = nextPowerOfTwo(Math.max(2, participantCount || 2));
  const hasPreliminaryRound = participantCount > 0 && participantCount !== bracketSize;
  if (hasPreliminaryRound && roundNo === 1) return '預賽';
  const roundOffset = hasPreliminaryRound ? 1 : 0;
  const adjustedRound = roundNo - roundOffset;
  const totalMainRounds = Math.log2(bracketSize);
  if (adjustedRound === totalMainRounds) return '決賽';
  if (adjustedRound === totalMainRounds - 1) return '四強';
  if (adjustedRound === totalMainRounds - 2) return '八強';
  if (adjustedRound === totalMainRounds - 3) return '16 強';
  return `第 ${roundNo} 輪`;
}

function getPublicBracketColumnPaddingTop(roundIndex: number) {
  if (roundIndex <= 0) return 0;
  return ((2 ** roundIndex) - 1) * (PUBLIC_BRACKET_CARD_HEIGHT + PUBLIC_BRACKET_BASE_GAP) / 2;
}

function getPublicBracketColumnGap(roundIndex: number) {
  if (roundIndex <= 0) return PUBLIC_BRACKET_BASE_GAP;
  return (2 ** roundIndex) * (PUBLIC_BRACKET_CARD_HEIGHT + PUBLIC_BRACKET_BASE_GAP) - PUBLIC_BRACKET_CARD_HEIGHT;
}

function getPublicBracketColumnHeight(matchCount: number) {
  if (matchCount <= 0) return PUBLIC_BRACKET_CARD_HEIGHT;
  return matchCount * PUBLIC_BRACKET_CARD_HEIGHT + Math.max(0, matchCount - 1) * PUBLIC_BRACKET_BASE_GAP;
}

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
  const [memberAccessNotice, setMemberAccessNotice] = useState<string | null>(null);

  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderHighest, setLeaderHighest] = useState<any[]>([]);
  const [leaderMonthly, setLeaderMonthly] = useState<any[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'booking' | 'messages' | 'signup' | 'scoreboard' | 'live' | 'leader' | 'info' | 'contact'>('booking');

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
  const [tournamentLiveBoard, setTournamentLiveBoard] = useState<any[]>([]);
  const [tournamentLiveBoardLoading, setTournamentLiveBoardLoading] = useState(false);
  const [tournamentLiveBoardError, setTournamentLiveBoardError] = useState<string | null>(null);
  const [tournamentOpen, setTournamentOpen] = useState<any>(null);
  const [tournamentOpenLoading, setTournamentOpenLoading] = useState(false);
  const [tournamentDetail, setTournamentDetail] = useState<any>(null);
  const [tournamentDetailLoading, setTournamentDetailLoading] = useState(false);
  const [tournamentDetailError, setTournamentDetailError] = useState<string | null>(null);
  const [tournamentParticipantOpen, setTournamentParticipantOpen] = useState<any>(null);
  const [tournamentParticipantDetail, setTournamentParticipantDetail] = useState<any>(null);
  const [tournamentParticipantDetailLoading, setTournamentParticipantDetailLoading] = useState(false);
  const [tournamentParticipantDetailError, setTournamentParticipantDetailError] = useState<string | null>(null);
  const [tournamentParticipantMonthFilter, setTournamentParticipantMonthFilter] = useState<string>('ALL');
  const [tournamentParticipantRoundFilter, setTournamentParticipantRoundFilter] = useState<string>('ALL');
  const [tournamentSubmitModal, setTournamentSubmitModal] = useState<{ open: boolean; title: string; guide: string }>({ open: false, title: '', guide: '' });
  
  const session = useMemo(() => readMemberSession() as MemberSession, []);
  const isLoggedIn = !!(session && (session as any).id);
  const sessionMemberId = String((session as any)?.id || '').trim() || null;
  const sessionRole = String((session as any)?.role || '').toUpperCase();
  const isAdminSession = sessionRole === 'ADMIN';
  const sessionVerified = String((session as any)?.member_tier || '').toUpperCase() === 'VERIFIED' || !!(session as any)?.email_verified_at;

  const { enabled: clubMessagesEnabled } = useFeatureEnabled(API_URL, 'club_messages');
  const { enabled: liveEnabled } = useFeatureEnabled(API_URL, 'live');
  const { enabled: tournamentsEnabled } = useFeatureEnabled(API_URL, 'tournaments');
  const { enabled: pointsEnabled } = useFeatureEnabled(API_URL, 'points');
  const { visible: systemPortalVisible } = useModuleVisible(API_URL, 'system_portal', 'public');
  const { visible: clubMessagesPublicVisible } = useModuleVisible(API_URL, 'club_messages', 'public');
  const { visible: livePublicVisible } = useModuleVisible(API_URL, 'live', 'public');
  const { visible: tournamentsPublicVisible } = useModuleVisible(API_URL, 'tournaments', 'public');
  const clubMessagesTabEnabled = clubMessagesEnabled && clubMessagesPublicVisible;
  const liveTabEnabled = liveEnabled && livePublicVisible;
  const tournamentsTabEnabled = tournamentsEnabled && tournamentsPublicVisible;

  const [myPoints, setMyPoints] = useState<{ balance: number; updatedAt: string | null } | null>(null);
  const [myPointsLoading, setMyPointsLoading] = useState(false);

  const [siteAdItems, setSiteAdItems] = useState<any[]>([]);
  const [siteAdCurrent, setSiteAdCurrent] = useState<any>(null);
  const [siteAdConfig, setSiteAdConfig] = useState<{ enabled: boolean; displaySeconds: number; minIntervalMinutes: number; maxIntervalMinutes: number; versionUpdatedAt: string } | null>(null);
  const [siteAdOpen, setSiteAdOpen] = useState(false);
  const [siteAdNextAt, setSiteAdNextAt] = useState<number | null>(null);
  const siteAdWasOpenRef = useRef(false);

  const [venueAccessExpiresAt, setVenueAccessExpiresAt] = useState<string | null>(null);
  const [venueAccessDaysLeft, setVenueAccessDaysLeft] = useState<number | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const showShareToast = useCallback((msg: string, ms = 2000) => {
    setShareToast(msg);
    window.setTimeout(() => setShareToast(null), ms);
  }, []);

  useEffect(() => {
    if (!clubId || !sessionMemberId || !isAdminSession) {
      setVenueAccessExpiresAt(null);
      setVenueAccessDaysLeft(null);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const [m, myClub] = await Promise.all([
          getMember(API_URL, sessionMemberId),
          getClubProfile(API_URL, sessionMemberId),
        ]);
        const myClubId = String((myClub as any)?.id || '').trim();
        if (!myClubId || myClubId !== String(clubId)) {
          if (mounted) {
            setVenueAccessExpiresAt(null);
            setVenueAccessDaysLeft(null);
          }
          return;
        }
        const raw = (m as any)?.access_expires_at ?? (m as any)?.accessExpiresAt ?? null;
        if (!raw) return;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return;
        const now = Date.now();
        const daysLeft = Math.ceil((d.getTime() - now) / (24 * 60 * 60 * 1000));
        if (!mounted) return;
        setVenueAccessExpiresAt(d.toISOString());
        setVenueAccessDaysLeft(Number.isFinite(daysLeft) ? daysLeft : null);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [clubId, sessionMemberId, isAdminSession]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getSiteAds(API_URL, 'venue');
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

        const key = `siteAdState:venue`;
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
    const key = `siteAdState:venue`;
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
    const key = `siteAdState:venue`;
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
    if (activeTab === 'messages' && !clubMessagesTabEnabled) setActiveTab('booking');
    if (activeTab === 'signup' && !tournamentsTabEnabled) setActiveTab('booking');
    if (activeTab === 'scoreboard' && !tournamentsTabEnabled) setActiveTab('booking');
    if (activeTab === 'live' && !liveTabEnabled) setActiveTab('booking');
  }, [activeTab, clubMessagesTabEnabled, liveTabEnabled, tournamentsTabEnabled]);

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
      if (!liveTabEnabled) {
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
  }, [clubId, liveTabEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clubId) return;
      if (!tournamentsTabEnabled) {
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
  }, [clubId, sessionMemberId, tournamentsTabEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clubId) return;
      if (!tournamentsTabEnabled) {
        if (mounted) setTournamentLiveBoard([]);
        if (mounted) setTournamentLiveBoardLoading(false);
        if (mounted) setTournamentLiveBoardError(null);
        return;
      }
      if (activeTab !== 'scoreboard') return;
      setTournamentLiveBoardLoading(true);
      setTournamentLiveBoardError(null);
      try {
        const rows = await getPublicClubTournamentLiveBoard(API_URL, clubId);
        if (mounted) setTournamentLiveBoard(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) {
          setTournamentLiveBoard([]);
          setTournamentLiveBoardError(String(e?.message || '讀取賽況資料失敗'));
        }
      } finally {
        if (mounted) setTournamentLiveBoardLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeTab, clubId, tournamentsTabEnabled]);

  useEffect(() => {
    let mounted = true;
    if (!clubId || !tournamentOpen?.id) {
      setTournamentDetail(null);
      setTournamentDetailLoading(false);
      setTournamentDetailError(null);
      setTournamentParticipantOpen(null);
      setTournamentParticipantDetail(null);
      setTournamentParticipantDetailLoading(false);
      setTournamentParticipantDetailError(null);
      return () => { mounted = false; };
    }
    (async () => {
      setTournamentDetailLoading(true);
      setTournamentDetailError(null);
      try {
        const row = await getPublicClubTournament(API_URL, clubId, String(tournamentOpen.id), sessionMemberId || undefined);
        if (mounted) setTournamentDetail(row && typeof row === 'object' ? row : null);
      } catch (e: any) {
        if (mounted) {
          setTournamentDetail(null);
          setTournamentDetailError(String(e?.message || '讀取比賽詳情失敗'));
        }
      } finally {
        if (mounted) setTournamentDetailLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clubId, sessionMemberId, tournamentOpen]);

  useEffect(() => {
    let mounted = true;
    const activeTournamentId =
      tournamentDetail && String(tournamentDetail?.id || '') === String(tournamentOpen?.id || '')
        ? String(tournamentDetail?.id || '')
        : String(tournamentOpen?.id || '');
    if (!clubId || !activeTournamentId || !tournamentParticipantOpen?.participantId) {
      setTournamentParticipantDetail(null);
      setTournamentParticipantDetailLoading(false);
      setTournamentParticipantDetailError(null);
      return () => { mounted = false; };
    }
    (async () => {
      setTournamentParticipantDetailLoading(true);
      setTournamentParticipantDetailError(null);
      try {
        const row = await getPublicClubTournamentParticipantDetail(
          API_URL,
          clubId,
          activeTournamentId,
          String(tournamentParticipantOpen.participantId),
        );
        if (mounted) setTournamentParticipantDetail(row && typeof row === 'object' ? row : null);
      } catch (e: any) {
        if (mounted) {
          setTournamentParticipantDetail(null);
          setTournamentParticipantDetailError(String(e?.message || '讀取球手聯賽數據失敗'));
        }
      } finally {
        if (mounted) setTournamentParticipantDetailLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clubId, tournamentDetail, tournamentOpen, tournamentParticipantOpen]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!clubMessagesTabEnabled) {
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
  }, [clubId, clubMessagesTabEnabled]);

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

  const handleShare = async () => {
    const url = window.location.href;
    const title = String((club as any)?.name || '場館主頁');
    try {
      const navAny: any = navigator as any;
      if (navAny?.share) {
        await navAny.share({ title, url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
      showShareToast('已複製分享連結');
      return;
    } catch {}
    try {
      window.prompt('複製此連結分享：', url);
    } catch {
      showShareToast('分享失敗');
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
  const openedTournament = tournamentDetail && String(tournamentDetail?.id || '') === String(tournamentOpen?.id || '')
    ? tournamentDetail
    : tournamentOpen;
  const openedTournamentFormat = normalizeTournamentFormat(openedTournament?.format);
  const openedTournamentParticipants = useMemo(() => (
    Array.isArray(openedTournament?.participants) ? openedTournament.participants : []
  ), [openedTournament]);
  const openedTournamentMatches = useMemo(() => (
    Array.isArray(openedTournament?.matches) ? openedTournament.matches : []
  ), [openedTournament]);
  const openedTournamentStandings = useMemo(() => (
    Array.isArray(openedTournament?.standings) ? openedTournament.standings : []
  ), [openedTournament]);
  const openedTournamentLiveMatches = useMemo(() => (
    openedTournamentMatches
      .filter((row: any) => isPublicTournamentLiveMatch(row))
      .sort((a: any, b: any) => {
        const aStarted = a?.started_at ? new Date(String(a.started_at)).getTime() : 0;
        const bStarted = b?.started_at ? new Date(String(b.started_at)).getTime() : 0;
        if (aStarted !== bStarted) return bStarted - aStarted;
        return Number(a?.match_no || 0) - Number(b?.match_no || 0);
      })
  ), [openedTournamentMatches]);
  const openedTournamentReadyMatches = useMemo(() => (
    openedTournamentMatches
      .filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY')
      .sort((a: any, b: any) => {
        const aTime = a?.scheduled_at ? new Date(String(a.scheduled_at)).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b?.scheduled_at ? new Date(String(b.scheduled_at)).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;
        return Number(a?.match_no || 0) - Number(b?.match_no || 0);
      })
  ), [openedTournamentMatches]);
  const openedTournamentRecentCompletedMatches = useMemo(() => (
    openedTournamentMatches
      .filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED')
      .sort((a: any, b: any) => {
        const aEnded = a?.ended_at ? new Date(String(a.ended_at)).getTime() : 0;
        const bEnded = b?.ended_at ? new Date(String(b.ended_at)).getTime() : 0;
        if (aEnded !== bEnded) return bEnded - aEnded;
        return Number(b?.match_no || 0) - Number(a?.match_no || 0);
      })
      .slice(0, 3)
  ), [openedTournamentMatches]);
  const openedTournamentLeagueRounds = useMemo(() => {
    const grouped = new Map<number, any[]>();
    for (const row of openedTournamentMatches) {
      const roundNo = Number(row?.round_no || 0);
      if (!grouped.has(roundNo)) grouped.set(roundNo, []);
      grouped.get(roundNo)!.push(row);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([roundNo, items]) => ({
        roundNo,
        label: roundNo > 0 ? `第 ${roundNo} 輪` : '循環賽',
        items: [...items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0)),
      }));
  }, [openedTournamentMatches]);
  const openedTournamentBracketColumns = useMemo(() => {
    const grouped = new Map<string, { roundNo: number; items: Array<any> }>();
    for (const row of openedTournamentMatches) {
      const key = formatPublicKnockoutRoundLabel(row, openedTournamentParticipants.length);
      const roundNo = Number(row?.round_no || 0);
      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(row);
        existing.roundNo = existing.roundNo > 0 ? Math.min(existing.roundNo, roundNo || existing.roundNo) : roundNo;
      } else {
        grouped.set(key, { roundNo, items: [row] });
      }
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[1].roundNo - b[1].roundNo)
      .map(([label, group], roundIndex, allColumns) => {
        const sortedItems = [...group.items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0));
        const paddingTop = getPublicBracketColumnPaddingTop(roundIndex);
        const gap = getPublicBracketColumnGap(roundIndex);
        const cardCenters = sortedItems.map((_: any, itemIndex: number) => (
          paddingTop + itemIndex * (PUBLIC_BRACKET_CARD_HEIGHT + gap) + PUBLIC_BRACKET_CARD_HEIGHT / 2
        ));
        const connectors = roundIndex < allColumns.length - 1
          ? Array.from({ length: Math.floor(sortedItems.length / 2) }, (_unused, pairIndex) => {
              const topCenter = cardCenters[pairIndex * 2];
              const bottomCenter = cardCenters[pairIndex * 2 + 1];
              if (typeof topCenter !== 'number' || typeof bottomCenter !== 'number') return null;
              return {
                top: topCenter,
                height: Math.max(0, bottomCenter - topCenter),
              };
            }).filter(Boolean)
          : [];
        return {
          label,
          roundIndex,
          isFinal: roundIndex === allColumns.length - 1,
          items: sortedItems,
          paddingTop,
          gap,
          columnHeight: Math.max(
            getPublicBracketColumnHeight(openedTournamentMatches.length),
            paddingTop + (sortedItems.length * PUBLIC_BRACKET_CARD_HEIGHT) + Math.max(0, sortedItems.length - 1) * gap,
          ),
          connectors,
        };
      });
  }, [openedTournamentMatches, openedTournamentParticipants.length]);

  const tournamentParticipantFilterOptions = useMemo(() => {
    const matches = Array.isArray(tournamentParticipantDetail?.matches) ? tournamentParticipantDetail.matches : [];
    const months = Array.from(new Set<string>(
      matches
        .map((row: any) => getTournamentMatchMonthKey(row))
        .filter((value: string) => !!value),
    )).sort((a, b) => String(b).localeCompare(String(a)));
    const rounds = Array.from(new Set<number>(
      matches
        .map((row: any) => Number(row?.roundNo || 0))
        .filter((value: number) => Number.isFinite(value) && value > 0),
    )).sort((a, b) => a - b);
    return { months, rounds };
  }, [tournamentParticipantDetail]);

  const filteredTournamentParticipantMatches = useMemo(() => {
    const matches = Array.isArray(tournamentParticipantDetail?.matches) ? tournamentParticipantDetail.matches : [];
    return matches.filter((row: any) => {
      const monthOk = tournamentParticipantMonthFilter === 'ALL'
        || getTournamentMatchMonthKey(row) === tournamentParticipantMonthFilter;
      const roundOk = tournamentParticipantRoundFilter === 'ALL'
        || String(Number(row?.roundNo || 0)) === tournamentParticipantRoundFilter;
      return monthOk && roundOk;
    });
  }, [tournamentParticipantDetail, tournamentParticipantMonthFilter, tournamentParticipantRoundFilter]);

  const filteredTournamentParticipantBreaks = useMemo(() => {
    const breaks = Array.isArray(tournamentParticipantDetail?.breaks) ? tournamentParticipantDetail.breaks : [];
    const matchIdSet = new Set(filteredTournamentParticipantMatches.map((row: any) => String(row?.id || '')));
    return breaks.filter((row: any) => matchIdSet.has(String(row?.matchId || '')));
  }, [filteredTournamentParticipantMatches, tournamentParticipantDetail]);

  const filteredTournamentParticipantRecentForm = useMemo(() => {
    return [...filteredTournamentParticipantMatches]
      .filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED')
      .sort((a: any, b: any) => {
        const aTime = a?.endedAt
          ? new Date(String(a.endedAt)).getTime()
          : a?.startedAt
            ? new Date(String(a.startedAt)).getTime()
            : a?.scheduledAt
              ? new Date(String(a.scheduledAt)).getTime()
              : 0;
        const bTime = b?.endedAt
          ? new Date(String(b.endedAt)).getTime()
          : b?.startedAt
            ? new Date(String(b.startedAt)).getTime()
            : b?.scheduledAt
              ? new Date(String(b.scheduledAt)).getTime()
              : 0;
        if (aTime !== bTime) return bTime - aTime;
        if (a.roundNo !== b.roundNo) return b.roundNo - a.roundNo;
        return b.matchNo - a.matchNo;
      })
      .slice(0, 5);
  }, [filteredTournamentParticipantMatches]);

  const filteredTournamentParticipantOpponentStats = useMemo(() => {
    const map = new Map<string, any>();
    for (const row of filteredTournamentParticipantMatches) {
      const key = String(row?.opponent?.participantId || row?.opponent?.id || 'BYE');
      const existing = map.get(key) || {
        opponent: row?.opponent || null,
        played: 0,
        completed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        totalPoints: 0,
        totalPointsAgainst: 0,
        highestBreak: 0,
        breaks20Plus: 0,
      };
      existing.played += 1;
      if (row?.resultKey === 'WIN') existing.wins += 1;
      else if (row?.resultKey === 'LOSS') existing.losses += 1;
      else if (row?.resultKey === 'DRAW') existing.draws += 1;
      if (String(row?.status || '').trim().toUpperCase() === 'COMPLETED') existing.completed += 1;
      existing.totalPoints += Number(row?.totalPoints || 0);
      existing.totalPointsAgainst += Number(row?.totalPointsAgainst || 0);
      existing.highestBreak = Math.max(existing.highestBreak, Number(row?.maxBreak || 0));
      existing.breaks20Plus += Number(row?.breaks20Plus || 0);
      map.set(key, existing);
    }
    return Array.from(map.values())
      .map((row: any) => ({
        ...row,
        avgPointsPerMatch: row.completed > 0 ? row.totalPoints / row.completed : 0,
        avgBreaks20PlusPerMatch: row.completed > 0 ? row.breaks20Plus / row.completed : 0,
        pointsDiff: row.totalPoints - row.totalPointsAgainst,
      }))
      .sort((a: any, b: any) => {
        if (b.completed !== a.completed) return b.completed - a.completed;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
        return String(a?.opponent?.name || '').localeCompare(String(b?.opponent?.name || ''));
      });
  }, [filteredTournamentParticipantMatches]);

  const filteredTournamentParticipantChartData = useMemo(() => {
    const completedMatches = filteredTournamentParticipantMatches.filter((row: any) => (
      String(row?.status || '').trim().toUpperCase() === 'COMPLETED'
    ));
    const wins = completedMatches.filter((row: any) => row?.resultKey === 'WIN').length;
    const draws = completedMatches.filter((row: any) => row?.resultKey === 'DRAW').length;
    const losses = completedMatches.filter((row: any) => row?.resultKey === 'LOSS').length;
    const totalPoints = completedMatches.reduce((sum: number, row: any) => sum + Number(row?.totalPoints || 0), 0);
    const totalBreaks20Plus = completedMatches.reduce((sum: number, row: any) => sum + Number(row?.breaks20Plus || 0), 0);
    const maxPoints = Math.max(1, ...completedMatches.map((row: any) => Number(row?.totalPoints || 0)));
    const maxBreakCount = Math.max(1, ...completedMatches.map((row: any) => Number(row?.breaks20Plus || 0)));
    return {
      resultCounts: [
        { key: 'WIN', label: '勝', count: wins, className: 'bg-emerald-400' },
        { key: 'DRAW', label: '和', count: draws, className: 'bg-slate-300' },
        { key: 'LOSS', label: '負', count: losses, className: 'bg-rose-400' },
      ],
      pointsTrend: completedMatches
        .slice()
        .sort((a: any, b: any) => {
          if (a.roundNo !== b.roundNo) return a.roundNo - b.roundNo;
          return a.matchNo - b.matchNo;
        })
        .map((row: any) => ({
          id: row.id,
          label: row.roundLabel || `R${row.roundNo || '-'}`,
          opponentLabel: row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE',
          totalPoints: Number(row?.totalPoints || 0),
          breaks20Plus: Number(row?.breaks20Plus || 0),
          resultLabel: row?.resultLabel || '-',
          pointWidth: `${Math.max(8, (Number(row?.totalPoints || 0) / maxPoints) * 100)}%`,
          breakWidth: `${Math.max(8, (Number(row?.breaks20Plus || 0) / maxBreakCount) * 100)}%`,
        })),
      totalPoints,
      totalBreaks20Plus,
      completedCount: completedMatches.length,
    };
  }, [filteredTournamentParticipantMatches]);

  useEffect(() => {
    setTournamentParticipantMonthFilter('ALL');
    setTournamentParticipantRoundFilter('ALL');
  }, [tournamentParticipantOpen?.participantId, tournamentParticipantDetail?.participant?.id]);

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
      {systemPortalVisible && (
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
        {venueAccessDaysLeft !== null && venueAccessDaysLeft >= 0 && venueAccessDaysLeft <= 30 && (
          <div
            className="sticky z-40"
            style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
          >
            <div className="px-4 pt-3">
              <div className="max-w-2xl mx-auto">
                <div className="rounded-lg bg-amber-400 text-slate-950 px-4 py-3 shadow-lg ring-2 ring-amber-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-extrabold">
                        場館限期尚餘 {venueAccessDaysLeft} 日
                      </div>
                      {venueAccessExpiresAt && (
                        <div className="text-sm opacity-80 mt-0.5">
                          到期日：{new Date(venueAccessExpiresAt).toISOString().slice(0, 10)}（請盡快續費）
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 rounded bg-black/10 hover:bg-black/15 text-sm font-semibold"
                      onClick={() => {
                        setVenueAccessDaysLeft(null);
                        setVenueAccessExpiresAt(null);
                      }}
                    >
                      隱藏
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {siteAdOpen && siteAdCurrent?.imageUrl && siteAdCurrent?.linkUrl && (
          typeof document !== 'undefined' && document.body
            ? createPortal(
                <div
                  className="fixed inset-x-0 z-[9999]"
                  style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
                >
                  <div className="px-4 pt-3">
                    <div className="max-w-2xl mx-auto">
                      <div className="cue-surface rounded-lg p-3 shadow-lg ring-1 ring-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <a
                            href={normalizeVideoHref(siteAdCurrent.linkUrl) || String(siteAdCurrent.linkUrl)}
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShare}
                      className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    >
                      分享
                    </button>
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
              ...(clubMessagesTabEnabled ? [{
                key: 'messages',
                label: (
                  <span className="inline-flex items-center">
                    <span>訊息</span>
                  </span>
                ),
              }] : []),
              ...(tournamentsTabEnabled ? [{ key: 'signup', label: '報名' }] : []),
              ...(tournamentsTabEnabled ? [{ key: 'scoreboard', label: '賽況' }] : []),
              ...(liveTabEnabled ? [{
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

          {memberAccessNotice ? (
            <div className="mt-4 cue-surface rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="font-semibold accent-yellow">會員資格提示</div>
                <div className="text-sm cue-muted mt-1">{memberAccessNotice}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => nav('/me')}
                  className="px-3 py-2 rounded cue-button text-sm font-semibold"
                >
                  前往會員中心
                </button>
                <button
                  type="button"
                  onClick={() => setMemberAccessNotice(null)}
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                >
                  關閉
                </button>
              </div>
            </div>
          ) : null}

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

            {activeTab === 'scoreboard' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="font-semibold text-lg">公開賽況</div>
                      <div className="text-xs cue-muted mt-1">集中顯示目前可公開查看的 tournament 進度、即將上場與最近完成場次</div>
                    </div>
                    <div className="text-xs cue-muted">
                      {tournamentLiveBoardLoading ? '讀取中…' : `共 ${tournamentLiveBoard.length} 個賽事項目`}
                    </div>
                  </div>

                  {tournamentLiveBoardError && <div className="text-sm text-rose-300 mb-2">{tournamentLiveBoardError}</div>}
                  {tournamentLiveBoardLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!tournamentLiveBoardLoading && tournamentLiveBoard.length === 0 && (
                    <div className="text-sm cue-muted">目前未有可公開顯示的 tournament 賽況。</div>
                  )}
                  {!tournamentLiveBoardLoading && tournamentLiveBoard.length > 0 && (
                    <div className="space-y-4">
                      {tournamentLiveBoard.map((tournament: any) => (
                        <div key={String(tournament?.id || Math.random())} className="cue-surface-strong rounded-lg p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="font-semibold text-lg truncate">{String(tournament?.title || '比賽')}</div>
                              <div className="text-xs cue-muted mt-1">
                                {formatTournamentFormatLabel(tournament?.format)} · {formatTournamentWorkflowLabel(tournament?.workflow_status)}
                                {tournament?.startsAt ? ` · ${new Date(String(tournament.startsAt)).toLocaleString()}` : ''}
                              </div>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <div className="px-3 py-2 rounded cue-surface">
                                進行中 {Number(tournament?.summary?.liveMatchCount || 0)}
                              </div>
                              <div className="px-3 py-2 rounded cue-surface">
                                即將上場 {Number(tournament?.summary?.readyMatchCount || 0)}
                              </div>
                              <div className="px-3 py-2 rounded cue-surface">
                                已完成 {Number(tournament?.summary?.completedMatchCount || 0)}
                              </div>
                            </div>
                          </div>

                          {Array.isArray(tournament?.liveMatches) && tournament.liveMatches.length > 0 ? (
                            <div className="mt-4">
                              <div className="font-semibold mb-2">進行中場次</div>
                              <div className="grid gap-3 xl:grid-cols-2">
                                {tournament.liveMatches.map((row: any) => {
                                  const breakSummary = buildPublicTournamentBreakSummary(row);
                                  return (
                                    <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</div>
                                          <div className="text-xs cue-muted mt-1">{buildPublicTournamentLiveProgressLabel(row, tournament?.bestOfFrames)}</div>
                                        </div>
                                        <div className="text-xs font-semibold accent-yellow">{formatTournamentMatchStatusLabel(row?.status)}</div>
                                      </div>
                                      <div className="mt-3">
                                        <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                        <div className="text-sm cue-muted my-1">
                                          {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                                        </div>
                                        <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                      </div>
                                      <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                                        <div className="cue-surface-strong rounded-lg p-2">{breakSummary.topLabel}</div>
                                        <div className="cue-surface-strong rounded-lg p-2">{breakSummary.countLabel}</div>
                                        <div className="cue-surface-strong rounded-lg p-2">已完成 {Array.isArray(row?.frames) ? row.frames.length : 0} 局</div>
                                      </div>
                                      <div className="text-xs cue-muted mt-3">{breakSummary.latestLabel}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {Array.isArray(tournament?.readyMatches) && tournament.readyMatches.length > 0 ? (
                            <div className="mt-4">
                              <div className="font-semibold mb-2">即將上場</div>
                              <div className="grid gap-2 lg:grid-cols-2">
                                {tournament.readyMatches.map((row: any) => (
                                  <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                    <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                                      <span>{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</span>
                                      <span>{row?.scheduled_at ? new Date(String(row.scheduled_at)).toLocaleString() : '待定時間'}</span>
                                    </div>
                                    <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                    <div className="text-xs cue-muted my-1">vs</div>
                                    <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {Array.isArray(tournament?.recentCompletedMatches) && tournament.recentCompletedMatches.length > 0 ? (
                            <div className="mt-4">
                              <div className="font-semibold mb-2">最近完成</div>
                              <div className="grid gap-2 lg:grid-cols-3">
                                {tournament.recentCompletedMatches.map((row: any) => (
                                  <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                    <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</div>
                                    <div className="font-semibold mt-2">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                    <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                                    <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-4 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setTournamentOpen(tournaments.find((row: any) => String(row?.id || '') === String(tournament?.id || '')) || tournament)}
                              className="px-4 py-2 rounded cue-button text-sm font-semibold"
                            >
                              查看詳情
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto cue-surface rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold accent-yellow truncate">{String(openedTournament?.title || '比賽')}</div>
                          <div className="text-xs cue-muted mt-1">
                            {(() => {
                              const cap = Number(openedTournament?.capacity ?? 0);
                              const count = Number(openedTournament?.signupCount ?? 0);
                              const status = cap > 0 ? `${count}/${cap}` : `${count}/—`;
                              const startsAt = openedTournament?.startsAt ? new Date(String(openedTournament.startsAt)) : null;
                              const startsText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
                              const closesAt = openedTournament?.signupClosesAt ? new Date(String(openedTournament.signupClosesAt)) : null;
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

                      {tournamentDetailLoading ? (
                        <div className="mt-4 text-sm cue-muted">讀取比賽詳情中…</div>
                      ) : tournamentDetailError ? (
                        <div className="mt-4 text-sm text-rose-300">{tournamentDetailError}</div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">賽制</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">{formatTournamentFormatLabel(openedTournamentFormat)}</div>
                              <div className="text-xs cue-muted mt-2">{formatTournamentWorkflowLabel(openedTournament?.workflow_status)}</div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">報名</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">{Number(openedTournament?.signupCount ?? 0)}</div>
                              <div className="text-xs cue-muted mt-2">
                                {Number(openedTournament?.capacity ?? 0) > 0 ? `上限 ${Number(openedTournament?.capacity || 0)} 人` : '不限名額'}
                              </div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">參賽 / 賽程</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(openedTournament?.summary?.participantCount || openedTournamentParticipants.length)} / {openedTournamentMatches.length}
                              </div>
                              <div className="text-xs cue-muted mt-2">正式參賽者 / 對局數</div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">進度</div>
                              <div className="text-sm font-semibold mt-2">已完成 {Number(openedTournament?.summary?.completedMatchCount || 0)} 場</div>
                              <div className="text-xs cue-muted mt-2">
                                就緒 {Number(openedTournament?.summary?.readyMatchCount || 0)} · 待定 {Number(openedTournament?.summary?.pendingMatchCount || 0)}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            <div className="xl:col-span-2 cue-surface-strong rounded-lg p-4">
                              <div className="font-semibold mb-2">比賽詳情</div>
                              <div className="text-sm whitespace-pre-wrap">{String(openedTournament?.description || '—')}</div>
                              {String(openedTournament?.signupGuide || '').trim() ? (
                                <div className="mt-4 rounded-lg p-3 cue-surface">
                                  <div className="font-semibold mb-1">報名指引</div>
                                  <div className="text-sm cue-muted whitespace-pre-wrap">{String(openedTournament?.signupGuide || '')}</div>
                                </div>
                              ) : null}
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="font-semibold mb-2">我的狀態</div>
                              <div className="text-sm">
                                {String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
                                  ? '已確認'
                                  : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
                                    ? '待確認'
                                    : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CANCELLED'
                                      ? '已取消'
                                      : '未報名'}
                              </div>
                              <div className="text-xs cue-muted mt-2">{openedTournament?.club?.name ? `場館：${openedTournament.club.name}` : ''}</div>
                              <div className="text-xs cue-muted mt-1">
                                {openedTournament?.startsAt ? `比賽時間：${new Date(String(openedTournament.startsAt)).toLocaleString()}` : '未設定比賽時間'}
                              </div>
                            </div>
                          </div>

                          {openedTournamentMatches.length > 0 ? (
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
                                <div>
                                  <div className="font-semibold">Live 賽況</div>
                                  <div className="text-xs cue-muted mt-1">即時反映目前盤數、下一局與本場 break 摘要</div>
                                </div>
                                <div className="text-xs cue-muted">
                                  進行中 {openedTournamentLiveMatches.length} · 即將上場 {openedTournamentReadyMatches.length} · 最近完成 {openedTournamentRecentCompletedMatches.length}
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3 mb-4">
                                <div className="cue-surface rounded-lg p-3">
                                  <div className="text-sm cue-muted">進行中</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">{openedTournamentLiveMatches.length}</div>
                                  <div className="text-xs cue-muted mt-2">已開局而未完賽場次</div>
                                </div>
                                <div className="cue-surface rounded-lg p-3">
                                  <div className="text-sm cue-muted">即將上場</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">{openedTournamentReadyMatches.length}</div>
                                  <div className="text-xs cue-muted mt-2">已排位可隨時開打場次</div>
                                </div>
                                <div className="cue-surface rounded-lg p-3">
                                  <div className="text-sm cue-muted">最新完成</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">{Number(openedTournament?.summary?.completedMatchCount || 0)}</div>
                                  <div className="text-xs cue-muted mt-2">本賽事已完成場次總數</div>
                                </div>
                              </div>

                              {openedTournamentLiveMatches.length > 0 ? (
                                <div className="grid gap-3 xl:grid-cols-2">
                                  {openedTournamentLiveMatches.map((row: any) => {
                                    const breakSummary = buildPublicTournamentBreakSummary(row);
                                    return (
                                      <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-4">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</div>
                                            <div className="text-xs cue-muted mt-1">{buildPublicTournamentLiveProgressLabel(row, openedTournament?.bestOfFrames)}</div>
                                          </div>
                                          <div className="text-xs font-semibold accent-yellow">{formatTournamentMatchStatusLabel(row?.status)}</div>
                                        </div>
                                        <div className="mt-3">
                                          <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                          <div className="text-sm cue-muted my-1">
                                            {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                                          </div>
                                          <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                                          <div className="cue-surface-strong rounded-lg p-2">{breakSummary.topLabel}</div>
                                          <div className="cue-surface-strong rounded-lg p-2">{breakSummary.countLabel}</div>
                                          <div className="cue-surface-strong rounded-lg p-2">
                                            已完成 {Array.isArray(row?.frames) ? row.frames.length : 0} 局
                                          </div>
                                        </div>
                                        <div className="text-xs cue-muted mt-3">{breakSummary.latestLabel}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-sm cue-muted">目前未有進行中場次；下方會顯示即將上場或最近完成的對局。</div>
                              )}

                              {openedTournamentReadyMatches.length > 0 ? (
                                <div className="mt-4">
                                  <div className="font-semibold mb-2">即將上場</div>
                                  <div className="grid gap-2 lg:grid-cols-2">
                                    {openedTournamentReadyMatches.slice(0, 4).map((row: any) => (
                                      <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                        <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                                          <span>{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</span>
                                          <span>{row?.scheduled_at ? new Date(String(row.scheduled_at)).toLocaleString() : '待定時間'}</span>
                                        </div>
                                        <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                        <div className="text-xs cue-muted my-1">vs</div>
                                        <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {openedTournamentRecentCompletedMatches.length > 0 ? (
                                <div className="mt-4">
                                  <div className="font-semibold mb-2">最近完成</div>
                                  <div className="grid gap-2 lg:grid-cols-3">
                                    {openedTournamentRecentCompletedMatches.map((row: any) => (
                                      <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                        <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</div>
                                        <div className="font-semibold mt-2">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                        <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                                        <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                        <div className="text-xs cue-muted mt-2">{buildPublicTournamentLiveProgressLabel(row, openedTournament?.bestOfFrames)}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}

                          {!!openedTournament?.podium && (openedTournament.podium?.champion || openedTournament.podium?.runnerUp || (Array.isArray(openedTournament.podium?.semiFinalists) && openedTournament.podium.semiFinalists.length > 0)) ? (
                            <div className="grid gap-3 md:grid-cols-3">
                              <div className="cue-surface-strong rounded-lg p-4">
                                <div className="text-sm cue-muted">冠軍</div>
                                <div className="font-semibold mt-1">{openedTournament.podium?.champion ? formatTournamentParticipantLabel(openedTournament.podium.champion) : '-'}</div>
                              </div>
                              <div className="cue-surface-strong rounded-lg p-4">
                                <div className="text-sm cue-muted">亞軍</div>
                                <div className="font-semibold mt-1">{openedTournament.podium?.runnerUp ? formatTournamentParticipantLabel(openedTournament.podium.runnerUp) : '-'}</div>
                              </div>
                              <div className="cue-surface-strong rounded-lg p-4">
                                <div className="text-sm cue-muted">四強</div>
                                <div className="font-semibold mt-1">
                                  {Array.isArray(openedTournament.podium?.semiFinalists) && openedTournament.podium.semiFinalists.length > 0
                                    ? openedTournament.podium.semiFinalists.map((row: any) => formatTournamentParticipantLabel(row)).join(' / ')
                                    : '-'}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">正式參賽名單</div>
                                <div className="text-xs cue-muted">{openedTournamentParticipants.length} 人</div>
                              </div>
                              {openedTournamentParticipants.length === 0 ? (
                                <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
                              ) : (
                                <div className="overflow-x-auto -mx-2 px-2">
                                  <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                      <tr className="cue-muted border-b cue-border">
                                        <th className="py-2 px-2">Seed</th>
                                        <th className="py-2 px-2">球手</th>
                                        <th className="py-2 px-2">狀態</th>
                                        <th className="py-2 px-2">名次</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {openedTournamentParticipants.map((row: any) => (
                                        <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                                          <td className="py-2 px-2">{row?.seed || '-'}</td>
                                          <td className="py-2 px-2 font-semibold">{formatTournamentParticipantLabel(row)}</td>
                                          <td className="py-2 px-2 cue-muted">{String(row?.status || '-')}</td>
                                          <td className="py-2 px-2 cue-muted">{row?.final_rank || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {openedTournamentFormat === 'LEAGUE' ? (
                              <div className="cue-surface-strong rounded-lg p-4">
                                <div className="flex items-center justify-between gap-3 mb-3">
                                  <div className="font-semibold">League 積分榜</div>
                                  <div className="text-xs cue-muted">{openedTournamentStandings.length} 人</div>
                                </div>
                                {openedTournamentStandings.length === 0 ? (
                                  <div className="text-sm cue-muted">賽程生成後會在這裡顯示 standings</div>
                                ) : (
                                  <div className="overflow-x-auto -mx-2 px-2">
                                    <table className="w-full text-left border-collapse text-sm">
                                      <thead>
                                        <tr className="cue-muted border-b cue-border">
                                          <th className="py-2 px-2">名次</th>
                                          <th className="py-2 px-2">球手</th>
                                          <th className="py-2 px-2">賽</th>
                                          <th className="py-2 px-2">勝和負</th>
                                          <th className="py-2 px-2">局差</th>
                                          <th className="py-2 px-2">積分</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {openedTournamentStandings.map((row: any) => (
                                          <tr
                                            key={String(row?.participantId || Math.random())}
                                            className="border-b cue-border hover:brightness-95 cursor-pointer"
                                            onClick={() => setTournamentParticipantOpen({
                                              participantId: String(row?.participantId || ''),
                                              label: formatTournamentParticipantLabel(row?.participant),
                                            })}
                                          >
                                            <td className="py-2 px-2 font-semibold">{row?.position || '-'}</td>
                                            <td className="py-2 px-2 font-semibold">
                                              <div>{formatTournamentParticipantLabel(row?.participant)}</div>
                                              <div className="text-xs cue-muted mt-1">查看聯賽詳細數據</div>
                                            </td>
                                            <td className="py-2 px-2 cue-muted">{Number(row?.played || 0)}</td>
                                            <td className="py-2 px-2 cue-muted">{Number(row?.won || 0)} / {Number(row?.drawn || 0)} / {Number(row?.lost || 0)}</td>
                                            <td className="py-2 px-2 cue-muted">{Number(row?.framesFor || 0)} - {Number(row?.framesAgainst || 0)} ({Number(row?.frameDiff || 0)})</td>
                                            <td className="py-2 px-2">{Number(row?.matchPoints || 0)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>

                          {openedTournamentFormat === 'KNOCKOUT' && openedTournamentBracketColumns.length > 0 ? (
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">Knockout Bracket</div>
                                <div className="text-xs cue-muted">{openedTournamentMatches.length} 場</div>
                              </div>
                              <div className="overflow-x-auto -mx-2 px-2">
                                <div className="flex gap-10 min-w-max items-start pb-2">
                                  {openedTournamentBracketColumns.map((column: any) => (
                                    <div key={String(column?.label || Math.random())} className="w-72">
                                      <div className="font-semibold mb-3">{column.label}</div>
                                      <div className="relative" style={{ height: `${column.columnHeight}px`, paddingTop: `${column.paddingTop}px` }}>
                                        {column.connectors.map((connector: any, connectorIndex: number) => (
                                          <React.Fragment key={`${column.label}-connector-${connectorIndex}`}>
                                            <div className="absolute border-t cue-border" style={{ left: '100%', top: `${connector.top}px`, width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                                            <div className="absolute border-r cue-border" style={{ left: `calc(100% + ${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px)`, top: `${connector.top}px`, height: `${connector.height}px` }} />
                                            <div className="absolute border-t cue-border" style={{ left: '100%', top: `${connector.top + connector.height}px`, width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                                          </React.Fragment>
                                        ))}
                                        <div className="flex flex-col" style={{ gap: `${column.gap}px` }}>
                                          {column.items.map((row: any) => {
                                            const winnerId = String(row?.winner_participant_id || '');
                                            const aParticipantId = String(row?.player_a_participant_id || '');
                                            const bParticipantId = String(row?.player_b_participant_id || '');
                                            return (
                                              <div key={String(row?.id || Math.random())} className="relative" style={{ height: `${PUBLIC_BRACKET_CARD_HEIGHT}px` }}>
                                                {column.roundIndex > 0 ? (
                                                  <div className="absolute border-t cue-border" style={{ right: '100%', top: '50%', width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                                                ) : null}
                                                {!column.isFinal ? (
                                                  <div className="absolute border-t cue-border" style={{ left: '100%', top: '50%', width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                                                ) : null}
                                                <div className="relative z-10 h-full w-full rounded-lg border cue-border cue-surface p-3">
                                                  <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                                                    <span>M{row?.match_no || '-'}</span>
                                                    <span>{formatTournamentResultTypeLabel(row?.result_type)}</span>
                                                  </div>
                                                  <div className={`font-semibold truncate ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                                  <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                                                  <div className={`font-semibold truncate ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          {openedTournamentFormat === 'LEAGUE' && openedTournamentLeagueRounds.length > 0 ? (
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">League Rounds</div>
                                <div className="text-xs cue-muted">{openedTournamentLeagueRounds.length} 輪</div>
                              </div>
                              <div className="grid gap-3 lg:grid-cols-2">
                                {openedTournamentLeagueRounds.map((round: any) => (
                                  <div key={String(round?.label || round?.roundNo || Math.random())} className="cue-surface rounded-lg p-3">
                                    <div className="font-semibold mb-2">{round.label}</div>
                                    <div className="grid gap-2">
                                      {round.items.map((row: any) => (
                                        <div key={String(row?.id || Math.random())} className="rounded-lg border cue-border p-3">
                                          <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                                            <span>M{row?.match_no || '-'}</span>
                                            <span>{formatTournamentResultTypeLabel(row?.result_type)}</span>
                                          </div>
                                          <div className="font-semibold truncate">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                          <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                                          <div className="font-semibold truncate">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="cue-surface-strong rounded-lg p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="font-semibold">公開賽程列表</div>
                              <div className="text-xs cue-muted">{openedTournamentMatches.length} 場</div>
                            </div>
                            {openedTournamentMatches.length === 0 ? (
                              <div className="text-sm cue-muted">尚未生成賽程</div>
                            ) : (
                              <div className="overflow-x-auto -mx-2 px-2">
                                <table className="w-full text-left border-collapse text-sm">
                                  <thead>
                                    <tr className="cue-muted border-b cue-border">
                                      <th className="py-2 px-2">輪次</th>
                                      <th className="py-2 px-2">對賽</th>
                                      <th className="py-2 px-2">比分</th>
                                      <th className="py-2 px-2">狀態</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {openedTournamentMatches.map((row: any) => (
                                      <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                                        <td className="py-2 px-2 whitespace-nowrap">
                                          {openedTournamentFormat === 'LEAGUE'
                                            ? `第 ${Number(row?.round_no || 0)} 輪`
                                            : formatPublicKnockoutRoundLabel(row, openedTournamentParticipants.length)}
                                        </td>
                                        <td className="py-2 px-2">
                                          <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)} vs {formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                          <div className="text-xs cue-muted mt-1">M{row?.match_no || '-'} · {formatTournamentResultTypeLabel(row?.result_type)}</div>
                                        </td>
                                        <td className="py-2 px-2 whitespace-nowrap">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</td>
                                        <td className="py-2 px-2 whitespace-nowrap">{formatTournamentMatchStatusLabel(row?.status)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-5 flex gap-2">
                        <button
                          type="button"
                          disabled={
                            tournamentOpenLoading
                            || tournamentDetailLoading
                            || String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
                            || String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
                            || openedTournament?.signupOpen === false
                          }
                          onClick={async () => {
                            if (!clubId) return;
                            if (!sessionMemberId) {
                              nav(`/members/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`);
                              return;
                            }
                            try {
                              setTournamentOpenLoading(true);
                              const res = await signupTournament(API_URL, clubId, sessionMemberId, String(openedTournament.id));
                              const ok = !!(res && (res as any).ok);
                              if (!ok) throw new Error('報名失敗');
                              setTournamentSubmitModal({ open: true, title: String(openedTournament?.title || '比賽'), guide: String(openedTournament?.signupGuide || '') });
                              try {
                                const rows = await getPublicClubTournaments(API_URL, clubId, sessionMemberId || undefined);
                                setTournaments(Array.isArray(rows) ? rows : []);
                              } catch {}
                              try {
                                const detail = await getPublicClubTournament(API_URL, clubId, String(openedTournament.id), sessionMemberId || undefined);
                                setTournamentDetail(detail && typeof detail === 'object' ? detail : null);
                              } catch {}
                              setTournamentOpen(null);
                            } catch (e: any) {
                              if (String((e as any)?.code || '') === 'member_not_verified') {
                                setMemberAccessNotice(String(e?.message || '比賽報名只限認證會員使用，請先完成 Email 驗證'));
                                setTournamentOpen(null);
                                nav('/me');
                                return;
                              }
                              alert(String(e?.message || '報名失敗'));
                            } finally {
                              setTournamentOpenLoading(false);
                            }
                          }}
                          className={`flex-1 px-4 py-2 rounded font-semibold ${tournamentOpenLoading ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                        >
                          {String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
                            ? '已確認報名'
                            : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
                              ? '待場館確認'
                              : openedTournament?.signupOpen === false
                                ? '暫未開放報名'
                                : '一鍵報名'}
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

                {!!tournamentParticipantOpen && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/85" onClick={() => setTournamentParticipantOpen(null)} />
                    <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto cue-surface rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-lg font-extrabold accent-yellow truncate">
                            {tournamentParticipantDetail?.participant?.member
                              ? formatTournamentParticipantLabel({
                                  seed: tournamentParticipantDetail?.participant?.seed,
                                  member: tournamentParticipantDetail?.participant?.member,
                                })
                              : String(tournamentParticipantOpen?.label || '球手聯賽數據')}
                          </div>
                          <div className="text-xs cue-muted mt-1">
                            {String(openedTournament?.title || '聯賽')} · 個人詳細數據
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTournamentParticipantOpen(null)}
                          className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                        >
                          返回
                        </button>
                      </div>

                      {tournamentParticipantDetailLoading ? (
                        <div className="mt-4 text-sm cue-muted">讀取球手聯賽數據中…</div>
                      ) : tournamentParticipantDetailError ? (
                        <div className="mt-4 text-sm text-rose-300">{tournamentParticipantDetailError}</div>
                      ) : tournamentParticipantDetail ? (
                        <div className="mt-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">目前名次</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(tournamentParticipantDetail?.standing?.position || 0) || '-'}
                              </div>
                              <div className="text-xs cue-muted mt-2">Seed {tournamentParticipantDetail?.participant?.seed ?? '-'}</div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">戰績</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(tournamentParticipantDetail?.summary?.wins || 0)} / {Number(tournamentParticipantDetail?.summary?.draws || 0)} / {Number(tournamentParticipantDetail?.summary?.losses || 0)}
                              </div>
                              <div className="text-xs cue-muted mt-2">勝 / 和 / 負</div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">聯賽總得分</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(tournamentParticipantDetail?.summary?.totalPoints || 0)}
                              </div>
                              <div className="text-xs cue-muted mt-2">
                                失分 {Number(tournamentParticipantDetail?.summary?.totalPointsAgainst || 0)} · 差 {Number(tournamentParticipantDetail?.summary?.pointsDiff || 0)}
                              </div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">單杆 / 20+</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(tournamentParticipantDetail?.summary?.highestBreak || 0)}
                              </div>
                              <div className="text-xs cue-muted mt-2">20+ 共 {Number(tournamentParticipantDetail?.summary?.breaks20Plus || 0)} 筆</div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">平均每場得分</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(tournamentParticipantDetail?.summary?.avgPointsPerMatch || 0).toFixed(1)}
                              </div>
                              <div className="text-xs cue-muted mt-2">以已完成場次計算</div>
                            </div>
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="text-sm cue-muted">平均每場 20+</div>
                              <div className="text-2xl font-extrabold accent-yellow mt-1">
                                {Number(tournamentParticipantDetail?.summary?.avgBreaks20PlusPerMatch || 0).toFixed(2)}
                              </div>
                              <div className="text-xs cue-muted mt-2">以已完成場次計算</div>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            <div className="xl:col-span-1 cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">最近 5 場表現</div>
                                <div className="text-xs cue-muted">
                                  {filteredTournamentParticipantRecentForm.length} 場
                                </div>
                              </div>
                              {filteredTournamentParticipantRecentForm.length > 0 ? (
                                <div className="space-y-2">
                                  {filteredTournamentParticipantRecentForm.map((row: any) => (
                                    <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</div>
                                          <div className="text-xs cue-muted mt-1">{row?.roundLabel || '-'}</div>
                                        </div>
                                        <div className={`text-xs font-semibold px-2 py-1 rounded ${
                                          row?.resultKey === 'WIN'
                                            ? 'bg-emerald-500/15 text-emerald-300'
                                            : row?.resultKey === 'LOSS'
                                              ? 'bg-rose-500/15 text-rose-300'
                                              : 'bg-white/10 cue-muted'
                                        }`}>
                                          {row?.resultLabel || '-'}
                                        </div>
                                      </div>
                                      <div className="mt-2 text-sm cue-muted">
                                        局數 {Number(row?.framesWon || 0)} - {Number(row?.framesLost || 0)} · 得分 {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                      </div>
                                      <div className="mt-1 text-xs cue-muted">
                                        單杆 {Number(row?.maxBreak || 0)} · 20+ {Number(row?.breaks20Plus || 0)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm cue-muted">尚未有最近賽果。</div>
                              )}
                            </div>

                            <div className="xl:col-span-2 cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">對手分布統計</div>
                                <div className="text-xs cue-muted">
                                  {filteredTournamentParticipantOpponentStats.length} 位對手
                                </div>
                              </div>
                              {filteredTournamentParticipantOpponentStats.length > 0 ? (
                                <div className="overflow-x-auto -mx-2 px-2">
                                  <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                      <tr className="cue-muted border-b cue-border">
                                        <th className="py-2 px-2">對手</th>
                                        <th className="py-2 px-2">戰績</th>
                                        <th className="py-2 px-2">總得分</th>
                                        <th className="py-2 px-2">平均</th>
                                        <th className="py-2 px-2">單杆 / 20+</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredTournamentParticipantOpponentStats.map((row: any, index: number) => (
                                        <tr key={`${String(row?.opponent?.participantId || row?.opponent?.id || 'bye')}-${index}`} className="border-b cue-border">
                                          <td className="py-2 px-2 font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</td>
                                          <td className="py-2 px-2 cue-muted">
                                            {Number(row?.wins || 0)} / {Number(row?.draws || 0)} / {Number(row?.losses || 0)}
                                            <div className="text-xs cue-muted mt-1">已完成 {Number(row?.completed || 0)} 場</div>
                                          </td>
                                          <td className="py-2 px-2 cue-muted">
                                            {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                            <div className="text-xs cue-muted mt-1">差 {Number(row?.pointsDiff || 0)}</div>
                                          </td>
                                          <td className="py-2 px-2 cue-muted">
                                            <div>{Number(row?.avgPointsPerMatch || 0).toFixed(1)} 分/場</div>
                                            <div className="text-xs cue-muted mt-1">{Number(row?.avgBreaks20PlusPerMatch || 0).toFixed(2)} 筆 20+/場</div>
                                          </td>
                                          <td className="py-2 px-2 cue-muted">
                                            <div>{Number(row?.highestBreak || 0)}</div>
                                            <div className="text-xs cue-muted mt-1">20+ {Number(row?.breaks20Plus || 0)}</div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-sm cue-muted">尚未有對手分布統計。</div>
                              )}
                            </div>
                          </div>

                          <div className="cue-surface-strong rounded-lg p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                              <div>
                                <div className="font-semibold">月份 / 輪次篩選</div>
                                <div className="text-xs cue-muted mt-1">以下圖表與逐場/20+資料會跟隨篩選更新；上方總覽卡保留整個聯賽總成績。</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setTournamentParticipantMonthFilter('ALL');
                                  setTournamentParticipantRoundFilter('ALL');
                                }}
                                className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                              >
                                重設篩選
                              </button>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <label className="block">
                                <div className="text-xs cue-muted mb-1">月份</div>
                                <select
                                  value={tournamentParticipantMonthFilter}
                                  onChange={(e) => setTournamentParticipantMonthFilter(e.target.value)}
                                  className="w-full rounded-lg cue-surface px-3 py-2 text-sm"
                                >
                                  <option value="ALL">全部月份</option>
                                  {tournamentParticipantFilterOptions.months.map((month) => (
                                    <option key={month} value={month}>{formatMonthFilterLabel(month)}</option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <div className="text-xs cue-muted mb-1">輪次</div>
                                <select
                                  value={tournamentParticipantRoundFilter}
                                  onChange={(e) => setTournamentParticipantRoundFilter(e.target.value)}
                                  className="w-full rounded-lg cue-surface px-3 py-2 text-sm"
                                >
                                  <option value="ALL">全部輪次</option>
                                  {tournamentParticipantFilterOptions.rounds.map((roundNo) => (
                                    <option key={roundNo} value={String(roundNo)}>{`第 ${roundNo} 輪`}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <div className="mt-3 text-xs cue-muted">
                              篩選結果：{filteredTournamentParticipantMatches.length} 場賽事、{filteredTournamentParticipantBreaks.length} 筆 20+
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">賽果分布</div>
                                <div className="text-xs cue-muted">{filteredTournamentParticipantChartData.completedCount} 場</div>
                              </div>
                              <div className="space-y-3">
                                {filteredTournamentParticipantChartData.resultCounts.map((row) => {
                                  const total = Math.max(1, filteredTournamentParticipantChartData.completedCount);
                                  const width = `${Math.max(row.count > 0 ? 12 : 0, (row.count / total) * 100)}%`;
                                  return (
                                    <div key={row.key}>
                                      <div className="flex items-center justify-between gap-3 text-sm mb-1">
                                        <span className="font-semibold">{row.label}</span>
                                        <span className="cue-muted">{row.count}</span>
                                      </div>
                                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                        <div className={`h-full rounded-full ${row.className}`} style={{ width }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="xl:col-span-2 cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">圖表化展示</div>
                                <div className="text-xs cue-muted">每輪得分與 20+</div>
                              </div>
                              {filteredTournamentParticipantChartData.pointsTrend.length > 0 ? (
                                <div className="space-y-3">
                                  {filteredTournamentParticipantChartData.pointsTrend.map((row: any) => (
                                    <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="font-semibold truncate">{row.label} · {row.opponentLabel}</div>
                                          <div className="text-xs cue-muted mt-1">{row.resultLabel}</div>
                                        </div>
                                        <div className="text-xs cue-muted text-right">
                                          <div>得分 {row.totalPoints}</div>
                                          <div className="mt-1">20+ {row.breaks20Plus}</div>
                                        </div>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        <div>
                                          <div className="flex items-center justify-between gap-3 text-xs cue-muted mb-1">
                                            <span>得分</span>
                                            <span>{row.totalPoints}</span>
                                          </div>
                                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                            <div className="h-full rounded-full bg-amber-400" style={{ width: row.pointWidth }} />
                                          </div>
                                        </div>
                                        <div>
                                          <div className="flex items-center justify-between gap-3 text-xs cue-muted mb-1">
                                            <span>20+</span>
                                            <span>{row.breaks20Plus}</span>
                                          </div>
                                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                            <div className="h-full rounded-full bg-sky-400" style={{ width: row.breakWidth }} />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm cue-muted">所選月份 / 輪次尚未有已完成賽事可供展示。</div>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            <div className="xl:col-span-2 cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">逐場聯賽紀錄</div>
                                <div className="text-xs cue-muted">{filteredTournamentParticipantMatches.length} 場</div>
                              </div>
                              {filteredTournamentParticipantMatches.length > 0 ? (
                                <div className="overflow-x-auto -mx-2 px-2">
                                  <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                      <tr className="cue-muted border-b cue-border">
                                        <th className="py-2 px-2">輪次</th>
                                        <th className="py-2 px-2">對手</th>
                                        <th className="py-2 px-2">賽果</th>
                                        <th className="py-2 px-2">總得分</th>
                                        <th className="py-2 px-2">單杆</th>
                                        <th className="py-2 px-2">20+</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredTournamentParticipantMatches.map((row: any) => (
                                        <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                                          <td className="py-2 px-2">
                                            <div className="font-semibold">{row?.roundLabel || '-'}</div>
                                            <div className="text-xs cue-muted mt-1">M{row?.matchNo || '-'}</div>
                                          </td>
                                          <td className="py-2 px-2 font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</td>
                                          <td className="py-2 px-2">
                                            <div className="font-semibold">{row?.resultLabel || '-'}</div>
                                            <div className="text-xs cue-muted mt-1">{Number(row?.framesWon || 0)} - {Number(row?.framesLost || 0)}</div>
                                          </td>
                                          <td className="py-2 px-2 cue-muted">
                                            {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                          </td>
                                          <td className="py-2 px-2 cue-muted">{Number(row?.maxBreak || 0)}</td>
                                          <td className="py-2 px-2 cue-muted">{Number(row?.breaks20Plus || 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-sm cue-muted">尚未有聯賽賽果。</div>
                              )}
                            </div>

                            <div className="cue-surface-strong rounded-lg p-4">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="font-semibold">20+ 詳細記錄</div>
                                <div className="text-xs cue-muted">{filteredTournamentParticipantBreaks.length} 筆</div>
                              </div>
                              {filteredTournamentParticipantBreaks.length > 0 ? (
                                <div className="space-y-2">
                                  {filteredTournamentParticipantBreaks.map((row: any) => (
                                    <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <div className="font-semibold accent-yellow">{Number(row?.points || 0)}</div>
                                          <div className="text-xs cue-muted mt-1">
                                            {row?.roundLabel || '-'} · {row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}
                                          </div>
                                        </div>
                                        <div className="text-xs cue-muted">第 {Number(row?.frameNo || 0)} 局</div>
                                      </div>
                                      <div className="text-xs cue-muted mt-2">
                                        {row?.recordedAt ? new Date(String(row.recordedAt)).toLocaleString() : '未記錄時間'}
                                      </div>
                                      {String(row?.note || '').trim() ? (
                                        <div className="text-xs cue-muted mt-1 whitespace-pre-wrap">{String(row.note || '')}</div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm cue-muted">尚未記錄 20+。</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 text-sm cue-muted">暫無球手聯賽數據。</div>
                      )}
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
                    <div className="font-semibold text-lg">場館 Highbreak 排行榜</div>
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
                      <div className="font-semibold mb-2">會內最高單杆 Top 10</div>
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
                      <div className="font-semibold mb-2">會內本月累計 Top 10</div>
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
                  ) : !sessionVerified ? (
                    <div className="text-sm mb-3 px-3 py-2 rounded cue-surface-strong">
                      <span className="accent-yellow font-semibold">此功能只限認證會員使用。</span>
                      <button type="button" onClick={() => nav('/me')} className="ml-2 underline">前往會員中心完成 Email 驗證</button>
                    </div>
                  ) : null}

                  {session.id && pointsEnabled && (myPointsLoading || myPoints !== null) ? (
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
                            if (String((err as any)?.code || '') === 'member_not_verified') {
                              setMemberAccessNotice(String(err?.message || '此功能只限認證會員使用，請先完成 Email 驗證'));
                              nav('/me');
                              return;
                            }
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

      {shareToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full bg-black/80 text-white text-sm font-semibold">
          {shareToast}
        </div>
      )}

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
