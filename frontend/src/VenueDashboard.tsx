import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL, SOCKET_URL } from './config';
import { createOperatorRoom, getOperatorMatches, getOperatorActiveRooms, updateMemberSelf, deleteOperatorRoom, getClubProfile, updateClubProfile, getClubMembers, updateClubMemberRating, removeClubMember, broadcastClubMessage, getClubMessagesManage, updateClubMessageManage, deleteClubMessageManage, createLiveAnnouncement, updateLiveAnnouncement, getLiveAnnouncements, deleteLiveAnnouncement, getMyTables, createTable, updateTable, deleteTable, getMyPricingSchemes, createPricingScheme, updatePricingScheme, deletePricingScheme, getPendingReservations, confirmReservation, cancelReservation, getClubReservations, createManualReservation, createClubBreak, getClubBreaks, getClubLeaderboardHighest, getClubLeaderboardMonthly, searchClubPointsBalances, getClubPointsLedger, adjustClubMemberPoints, rotateClubTableQr, getActiveTableSessions, endTableSessionAsOperator, getMyClubTournaments, createClubTournament, updateClubTournament, publishClubTournament, closeClubTournament, getTournamentSignups, confirmTournamentSignup, cancelTournamentSignup, listMemberRegions, listMemberDistricts, getMember } from './lib/api';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useFeatureEnabled } from './lib/features';
import Tabs from './components/Tabs';

type PricingRule = {
  daysOfWeek?: number[];
  start?: string;
  end?: string;
  pricePerHour?: number | null;
};

function normalizeVideoHref(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

const VenueDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venueAccessExpiresAt, setVenueAccessExpiresAt] = useState<string | null>(null);
  const [venueAccessDaysLeft, setVenueAccessDaysLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [clubProfile, setClubProfile] = useState<any>({});
  const [facilitiesDraft, setFacilitiesDraft] = useState('');
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRatingDraft, setMemberRatingDraft] = useState<Record<string, string>>({});
  const [memberSavingId, setMemberSavingId] = useState<string>('');
  const [memberRemovingId, setMemberRemovingId] = useState<string>('');
  const [memberLocOpen, setMemberLocOpen] = useState(false);
  const [memberLocMemberId, setMemberLocMemberId] = useState('');
  const [memberLocRegionCode, setMemberLocRegionCode] = useState('');
  const [memberLocDistrictCode, setMemberLocDistrictCode] = useState('');
  const [memberLocRegions, setMemberLocRegions] = useState<Array<{ code3: string; name: string }>>([]);
  const [memberLocDistricts, setMemberLocDistricts] = useState<Array<{ code3: string; name: string; regionCode?: string }>>([]);
  const [memberLocLoading, setMemberLocLoading] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [clubMsgs, setClubMsgs] = useState<any[]>([]);
  const [clubMsgsLoading, setClubMsgsLoading] = useState(false);
  const [editingClubMsgId, setEditingClubMsgId] = useState<string>('');
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDate, setLiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [liveTime, setLiveTime] = useState(() => `${String(new Date().getHours()).padStart(2, '0')}:00`);
  const [liveUrl, setLiveUrl] = useState('');
  const [liveCreating, setLiveCreating] = useState(false);
  const [editingLiveId, setEditingLiveId] = useState<string>('');
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentTitle, setTournamentTitle] = useState('');
  const [tournamentDesc, setTournamentDesc] = useState('');
  const [tournamentGuide, setTournamentGuide] = useState('');
  const [tournamentCapacity, setTournamentCapacity] = useState('32');
  const [tournamentStartsAt, setTournamentStartsAt] = useState('');
  const [tournamentDeadline, setTournamentDeadline] = useState('');
  const [tournamentCreating, setTournamentCreating] = useState(false);
  const [tournamentSelectedId, setTournamentSelectedId] = useState<string>('');
  const [tournamentSignups, setTournamentSignups] = useState<any[]>([]);
  const [tournamentSignupsLoading, setTournamentSignupsLoading] = useState(false);
  const [tournamentConfirmed, setTournamentConfirmed] = useState<any[]>([]);
  const [tournamentConfirmedLoading, setTournamentConfirmedLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableNotes, setNewTableNotes] = useState('');
  const [newTableBasePrice, setNewTableBasePrice] = useState('');
  const [pricing, setPricing] = useState<any[]>([]);
  const [pricingSavingId, setPricingSavingId] = useState<string>('');
  const [newPricingTitle, setNewPricingTitle] = useState('');
  const [newPricingDesc, setNewPricingDesc] = useState('');
  const [newPricingPrice, setNewPricingPrice] = useState('');
  const [newPricingMinHours, setNewPricingMinHours] = useState('');
  const [newPricingRules, setNewPricingRules] = useState<PricingRule[]>([]);
  const [pendingReservations, setPendingReservations] = useState<any[]>([]);
  const [allReservations, setAllReservations] = useState<any[]>([]);
  const [allReservationsDate, setAllReservationsDate] = useState('');
  const [allReservationsShowCompleted, setAllReservationsShowCompleted] = useState(false);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [manualMode, setManualMode] = useState<'BLOCK' | 'MEMBER'>('BLOCK');
  const [manualTableId, setManualTableId] = useState('');
  const [manualMemberId, setManualMemberId] = useState('');
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState(() => `${String(new Date().getHours()).padStart(2, '0')}:00`);
  const [manualHours, setManualHours] = useState(1);
  const [manualCreating, setManualCreating] = useState(false);
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [breaks, setBreaks] = useState<any[]>([]);
  const [breaksLoading, setBreaksLoading] = useState(false);
  const [breakMemberId, setBreakMemberId] = useState('');
  const [breakPoints, setBreakPoints] = useState('');
  const [breakRecordedAt, setBreakRecordedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [breakVideoUrl, setBreakVideoUrl] = useState('');
  const [breakNote, setBreakNote] = useState('');
  const [breakFilterMonth, setBreakFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [breakFilterMember, setBreakFilterMember] = useState('');
  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderHighest, setLeaderHighest] = useState<any[]>([]);
  const [leaderMonthly, setLeaderMonthly] = useState<any[]>([]);

  const [pointsLoading, setPointsLoading] = useState(false);

  const [pointsAdjustMemberQuery, setPointsAdjustMemberQuery] = useState('');
  const [pointsAdjustMemberOptions, setPointsAdjustMemberOptions] = useState<any[]>([]);
  const [pointsAdjustMemberLoading, setPointsAdjustMemberLoading] = useState(false);
  const [pointsAdjustMemberId, setPointsAdjustMemberId] = useState('');
  const [pointsAdjustDelta, setPointsAdjustDelta] = useState('');
  const [pointsAdjustReason, setPointsAdjustReason] = useState('');

  const [pointsBalanceQuery, setPointsBalanceQuery] = useState('');
  const [pointsBalanceRows, setPointsBalanceRows] = useState<any[]>([]);
  const [pointsBalanceLoading, setPointsBalanceLoading] = useState(false);

  const [pointsLedgerMode, setPointsLedgerMode] = useState<'detail' | 'month'>('detail');
  const [pointsLedgerRows, setPointsLedgerRows] = useState<any[]>([]);
  const [pointsLedgerLoading, setPointsLedgerLoading] = useState(false);
  const [pointsLedgerTotalDelta, setPointsLedgerTotalDelta] = useState(0);
  const [pointsLedgerMemberId, setPointsLedgerMemberId] = useState('');
  const [pointsLedgerFrom, setPointsLedgerFrom] = useState('');
  const [pointsLedgerTo, setPointsLedgerTo] = useState('');
  const [pointsLedgerMonth, setPointsLedgerMonth] = useState('');

  const operatorId = session.id;
  const operatorName = session.name || session.email;
  const isOperator = session.role === 'ADMIN' || session.role === 'OPERATOR';

  const { enabled: bookingEnabled } = useFeatureEnabled(API_URL, 'booking');
  const { enabled: liveEnabled } = useFeatureEnabled(API_URL, 'live');
  const { enabled: clubMessagesEnabled } = useFeatureEnabled(API_URL, 'club_messages');
  const { enabled: highbreakEnabled } = useFeatureEnabled(API_URL, 'highbreak');
  const { enabled: scoringEnabled } = useFeatureEnabled(API_URL, 'scoring');
  const { enabled: pointsEnabled } = useFeatureEnabled(API_URL, 'points');
  const { enabled: qrEnabled } = useFeatureEnabled(API_URL, 'qr_session');
  const { enabled: tournamentsEnabled } = useFeatureEnabled(API_URL, 'tournaments');

  const [activeTab, setActiveTab] = useState<'home' | 'booking' | 'qr' | 'points' | 'highbreak' | 'content' | 'members' | 'scoring'>('home');

  function resolveTab(): 'home' | 'booking' | 'qr' | 'points' | 'highbreak' | 'content' | 'members' | 'scoring' {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      if (t === 'home' || t === 'booking' || t === 'qr' || t === 'points' || t === 'highbreak' || t === 'content' || t === 'members' || t === 'scoring') return t;
      return (localStorage.getItem('venueDashboardTab') as any) || 'home';
    } catch {
      return 'home';
    }
  }

  function updateTab(t: 'home' | 'booking' | 'qr' | 'points' | 'highbreak' | 'content' | 'members' | 'scoring') {
    setActiveTab(t);
    try {
      localStorage.setItem('venueDashboardTab', t);
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  useEffect(() => {
    if (!memberLocOpen) return;
    let mounted = true;
    setMemberLocLoading(true);
    listMemberRegions(API_URL)
      .then((json) => {
        if (!mounted) return;
        const rs = Array.isArray((json as any)?.regions) ? (json as any).regions : [];
        setMemberLocRegions(rs);
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted) return;
        setMemberLocLoading(false);
      });
    return () => { mounted = false; };
  }, [memberLocOpen]);

  useEffect(() => {
    if (!memberLocOpen) return;
    let mounted = true;
    if (!memberLocRegionCode) {
      setMemberLocDistricts([]);
      setMemberLocDistrictCode('');
      return () => { mounted = false; };
    }
    setMemberLocLoading(true);
    listMemberDistricts(API_URL, memberLocRegionCode)
      .then((json) => {
        if (!mounted) return;
        const ds = Array.isArray((json as any)?.districts) ? (json as any).districts : [];
        setMemberLocDistricts(ds);
      })
      .catch(() => {})
      .finally(() => {
        if (!mounted) return;
        setMemberLocLoading(false);
      });
    return () => { mounted = false; };
  }, [memberLocOpen, memberLocRegionCode]);

  const rawBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const baseUrl = `${window.location.origin}${rawBase}`;
  const joinUrl = clubProfile?.id ? new URL(`/club/${clubProfile.id}`, window.location.origin).toString() : '';
  const joinQrSvgRef = useRef<SVGSVGElement | null>(null);
  const joinQrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const downloadJoinQrSvg = useCallback(() => {
    if (!clubProfile?.id) return;
    const svg = joinQrSvgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `club-${clubProfile.id}-join-qr.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [clubProfile?.id]);

  const downloadJoinQrPng = useCallback(() => {
    if (!clubProfile?.id) return;
    const canvas = joinQrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `club-${clubProfile.id}-join-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [clubProfile?.id]);

  const safeFilePart = (raw: any) => {
    const s = String(raw || '').trim();
    const out = s.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    return out || 'qr';
  };

  const normalizeImageSrc = useCallback((raw: any) => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (/^data:/i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return `https:${s}`;
    if (s.startsWith('/')) return `${API_URL.replace(/\/$/, '')}${s}`;
    return `https://${s}`;
  }, []);

  const resizeImageFileToDataUrl = useCallback(async (file: File, opts: { maxW: number; maxH: number; type: 'image/jpeg' | 'image/png'; quality?: number }) => {
    const { maxW, maxH, type, quality } = opts;
    const blobUrl = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = blobUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
      });
      const sw = img.naturalWidth || img.width || 1;
      const sh = img.naturalHeight || img.height || 1;
      const scale = Math.min(1, maxW / sw, maxH / sh);
      const tw = Math.max(1, Math.round(sw * scale));
      const th = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas not supported');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, tw, th);
      return canvas.toDataURL(type, type === 'image/jpeg' ? (quality ?? 0.82) : undefined);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }, []);

  const parseLines = useCallback((raw: string, max: number) => {
    return String(raw || '')
      .split('\n')
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
      .slice(0, max);
  }, []);

  useEffect(() => {
    const lines = Array.isArray(clubProfile?.facilities) ? clubProfile.facilities.map((x: any) => String(x)) : [];
    setFacilitiesDraft(lines.join('\n'));
  }, [clubProfile?.id, clubProfile?.updatedAt]);

  const getGalleryArray = useCallback((raw: any) => {
    return Array.isArray(raw) ? raw.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
  }, []);

  const removeGalleryAt = useCallback((idx: number) => {
    setClubProfile((prev: any) => {
      const list = getGalleryArray(prev?.galleryUrls);
      const next = list.filter((_, i) => i !== idx);
      return { ...prev, galleryUrls: next };
    });
  }, [getGalleryArray]);

  const setGalleryAsCover = useCallback((idx: number) => {
    setClubProfile((prev: any) => {
      const list = getGalleryArray(prev?.galleryUrls);
      const picked = list[idx] || '';
      if (!picked) return prev;
      const rest = list.filter((_, i) => i !== idx);
      const oldCover = String(prev?.coverImageUrl || '').trim();
      const nextGallery = oldCover ? [oldCover, ...rest] : rest;
      return { ...prev, coverImageUrl: picked, galleryUrls: nextGallery.slice(0, 12) };
    });
  }, [getGalleryArray]);

  const downloadSvgElement = useCallback((svg: SVGSVGElement, filename: string) => {
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const downloadSvgAsPng = useCallback(async (svg: SVGSVGElement, filename: string, title?: string) => {
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = svgUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
      });
      const size = 1024;
      const titleHeight = title ? 180 : 0;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size + titleHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas not supported');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size + titleHeight);
      if (title) {
        const text = String(title).trim();
        const maxWidth = size - 80;
        const centerX = size / 2;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000000';

        let fontSize = 64;
        const minFontSize = 28;
        const fitFont = (s: number) => {
          ctx.font = `700 ${s}px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`;
        };
        fitFont(fontSize);
        while (fontSize > minFontSize && ctx.measureText(text).width > maxWidth) {
          fontSize -= 2;
          fitFont(fontSize);
        }

        const drawOneLine = () => {
          const y = titleHeight / 2;
          ctx.fillText(text, centerX, y);
        };

        if (ctx.measureText(text).width <= maxWidth || fontSize > minFontSize) {
          drawOneLine();
        } else {
          const mid = Math.max(1, Math.floor(text.length / 2));
          const a = text.slice(0, mid).trim();
          const b = text.slice(mid).trim();
          fitFont(42);
          const lineHeight = 56;
          const y1 = (titleHeight / 2) - (lineHeight / 2);
          const y2 = (titleHeight / 2) + (lineHeight / 2);
          ctx.fillText(a, centerX, y1);
          ctx.fillText(b, centerX, y2);
        }
      }

      ctx.drawImage(img, 0, titleHeight, size, size);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }, []);

  const weekDays = useMemo(() => ([
    { n: 1, label: '一' },
    { n: 2, label: '二' },
    { n: 3, label: '三' },
    { n: 4, label: '四' },
    { n: 5, label: '五' },
    { n: 6, label: '六' },
    { n: 7, label: '日' },
  ]), []);

  const formatLocalYmd = useCallback((d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }, []);

  const filteredAllReservations = useMemo(() => {
    const dateKey = String(allReservationsDate || '').trim();
    return (Array.isArray(allReservations) ? allReservations : []).filter((r: any) => {
      const status = String(r?.status || '').toUpperCase();
      const endAt = new Date(String(r?.endAt || ''));
      const ended = Number.isFinite(endAt.getTime()) && endAt.getTime() < Date.now() - 60_000;
      const finished = ended || status === 'CANCELLED';
      if (!allReservationsShowCompleted && finished) return false;
      if (dateKey) {
        const startAt = new Date(String(r?.startAt || ''));
        if (!Number.isFinite(startAt.getTime())) return false;
        if (formatLocalYmd(startAt) !== dateKey) return false;
      }
      return true;
    });
  }, [allReservations, allReservationsDate, allReservationsShowCompleted, formatLocalYmd]);

  const getRulesArray = (rulesJson: any): any[] => {
    if (Array.isArray(rulesJson)) return rulesJson;
    if (rulesJson && typeof rulesJson === 'object' && Array.isArray((rulesJson as any).rules)) return (rulesJson as any).rules;
    return [];
  };

  const getMinHours = (rulesJson: any): number | null => {
    if (!rulesJson || typeof rulesJson !== 'object' || Array.isArray(rulesJson)) return null;
    const v = (rulesJson as any).minHours ?? (rulesJson as any).minQuantityHours ?? (rulesJson as any).minQtyHours;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const i = Math.floor(n);
    if (i < 1) return null;
    return i;
  };

  const normalizeRules = (rulesJson: any): PricingRule[] => {
    const arr = getRulesArray(rulesJson);
    return arr.map((r: any) => ({
      daysOfWeek: Array.isArray(r?.daysOfWeek) ? r.daysOfWeek.filter((x: any) => typeof x === 'number') : [],
      start: typeof r?.start === 'string' ? r.start : '09:00',
      end: typeof r?.end === 'string' ? r.end : '16:00',
      pricePerHour: r?.pricePerHour == null || r?.pricePerHour === '' ? null : Number(r.pricePerHour),
    }));
  };

  const withRules = (rulesJson: any, rules: PricingRule[]) => {
    const minHours = getMinHours(rulesJson);
    return minHours == null ? rules : { minHours, rules };
  };

  const withMinHours = (rulesJson: any, minHours: number | null) => {
    const rules = normalizeRules(rulesJson);
    return minHours == null ? rules : { minHours, rules };
  };

  const toggleDayInRule = (rule: PricingRule, day: number): PricingRule => {
    const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
    return { ...rule, daysOfWeek: next };
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [matchesRes, roomsRes, clubProfileRes, clubMembersRes, liveRes, tablesRes, pricingRes, pendingRes, allRes, sessionsRes] = await Promise.all([
        getOperatorMatches(API_URL, operatorId),
        getOperatorActiveRooms(API_URL, operatorId),
        getClubProfile(API_URL, operatorId).catch(() => ({})),
        getClubMembers(API_URL, operatorId).catch(() => []),
        getLiveAnnouncements(API_URL, operatorId).catch(() => []),
        getMyTables(API_URL, operatorId).catch(() => []),
        getMyPricingSchemes(API_URL, operatorId).catch(() => []),
        getPendingReservations(API_URL, operatorId).catch(() => []),
        getClubReservations(API_URL, operatorId).catch(() => []),
        qrEnabled ? getActiveTableSessions(API_URL, operatorId).catch(() => []) : Promise.resolve([]),
      ]);
      setMatches(matchesRes.matches || []);
      setActiveRooms(roomsRes.rooms || []);
      setClubProfile(clubProfileRes || {});
      setClubMembers(clubMembersRes || []);
      setLiveAnnouncements(Array.isArray(liveRes) ? liveRes : []);
      setTables(tablesRes || []);
      setPricing(pricingRes || []);
      setPendingReservations(pendingRes || []);
      setAllReservations(allRes || []);
      setActiveSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
    } catch (err: any) {
      setError(err.message || '無法載入資料');
    } finally {
      setLoading(false);
    }
  }, [operatorId, qrEnabled]);

  const loadBreakData = useCallback(async () => {
    if (!operatorId || !clubProfile?.id) return;
    setBreaksLoading(true);
    try {
      const [rows, highest, monthly] = await Promise.all([
        getClubBreaks(API_URL, operatorId, { month: breakFilterMonth, memberId: breakFilterMember || undefined }).catch(() => []),
        getClubLeaderboardHighest(API_URL, clubProfile.id, 10).catch(() => []),
        getClubLeaderboardMonthly(API_URL, clubProfile.id, leaderMonth, 10).catch(() => []),
      ]);
      setBreaks(Array.isArray(rows) ? rows : []);
      setLeaderHighest(Array.isArray(highest) ? highest : []);
      setLeaderMonthly(Array.isArray(monthly) ? monthly : []);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!msg.includes('feature_disabled')) {
        setToast(msg || '載入單杆資料失敗');
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setBreaksLoading(false);
    }
  }, [operatorId, clubProfile?.id, breakFilterMonth, breakFilterMember, leaderMonth]);

  const loadPointsData = useCallback(async () => {
    if (!operatorId || !isOperator) return;
    if (!pointsEnabled) return;
    setPointsLoading(true);
    try {
      setPointsLedgerMode('detail');
      const res = await getClubPointsLedger(API_URL, operatorId, { limit: 50, includeTotal: true });
      const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : (Array.isArray(res) ? res : []);
      const totalDelta = Number((res as any)?.totalDelta ?? 0);
      setPointsLedgerRows(rows);
      setPointsLedgerTotalDelta(Number.isFinite(totalDelta) ? totalDelta : 0);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!msg.includes('feature_disabled')) {
        setToast(msg || '載入消費積分資料失敗');
        setTimeout(() => setToast(null), 3000);
      }
      setPointsLedgerRows([]);
      setPointsLedgerTotalDelta(0);
    } finally {
      setPointsLoading(false);
    }
  }, [operatorId, isOperator, pointsEnabled]);

  useEffect(() => {
    if (!operatorId || !isOperator) {
      navigate('/members/login?next=/venue/dashboard', { replace: true });
      return;
    }
    let canceled = false;
    (async () => {
      try {
        if (String(session?.role || '').toUpperCase() === 'ADMIN') {
          const m = await getMember(API_URL, String(operatorId));
          const raw = (m as any)?.access_expires_at ?? (m as any)?.accessExpiresAt ?? null;
          if (raw) {
            const d = new Date(raw);
            if (!Number.isNaN(d.getTime())) {
              const now = Date.now();
              const daysLeft = Math.ceil((d.getTime() - now) / (24 * 60 * 60 * 1000));
              if (!canceled) {
                setVenueAccessExpiresAt(d.toISOString());
                setVenueAccessDaysLeft(Number.isFinite(daysLeft) ? daysLeft : null);
              }
              if (d.getTime() <= now) {
                if (!canceled) navigate('/me?expired=1', { replace: true });
                return;
              }
            }
          }
        }
      } catch {}
      if (!canceled) loadData();
    })();
    return () => { canceled = true; };
  }, [operatorId, isOperator, navigate, loadData]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!operatorId) return;
      if (!tournamentsEnabled) {
        if (mounted) setTournaments([]);
        return;
      }
      if (activeTab !== 'content') return;
      setTournamentsLoading(true);
      try {
        const rows = await getMyClubTournaments(API_URL, operatorId);
        if (mounted) setTournaments(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) setTournaments([]);
        setToast(e?.message || '載入比賽失敗');
        setTimeout(() => setToast(null), 3000);
      } finally {
        if (mounted) setTournamentsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeTab, operatorId, tournamentsEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!operatorId) return;
      if (!tournamentsEnabled) return;
      if (!tournamentSelectedId) {
        if (mounted) setTournamentSignups([]);
        if (mounted) setTournamentConfirmed([]);
        return;
      }
      setTournamentSignupsLoading(true);
      setTournamentConfirmedLoading(true);
      try {
        const [pendingRows, confirmedRows] = await Promise.all([
          getTournamentSignups(API_URL, operatorId, tournamentSelectedId, 'PENDING').catch(() => []),
          getTournamentSignups(API_URL, operatorId, tournamentSelectedId, 'CONFIRMED').catch(() => []),
        ]);
        if (mounted) setTournamentSignups(Array.isArray(pendingRows) ? pendingRows : []);
        if (mounted) setTournamentConfirmed(Array.isArray(confirmedRows) ? confirmedRows : []);
      } catch (e: any) {
        if (mounted) setTournamentSignups([]);
        if (mounted) setTournamentConfirmed([]);
        setToast(e?.message || '載入報名名單失敗');
        setTimeout(() => setToast(null), 3000);
      } finally {
        if (mounted) setTournamentSignupsLoading(false);
        if (mounted) setTournamentConfirmedLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [operatorId, tournamentSelectedId, tournamentsEnabled]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!operatorId) return;
      if (activeTab !== 'content') return;
      if (!clubMessagesEnabled) {
        if (mounted) setClubMsgs([]);
        if (mounted) setClubMsgsLoading(false);
        return;
      }
      setClubMsgsLoading(true);
      try {
        const rows = await getClubMessagesManage(API_URL, operatorId, 80);
        if (mounted) setClubMsgs(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) setClubMsgs([]);
        setToast(e?.message || '載入場館訊息失敗');
        setTimeout(() => setToast(null), 3000);
      } finally {
        if (mounted) setClubMsgsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activeTab, clubMessagesEnabled, operatorId]);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, []);

  useEffect(() => {
    const contentVisible = clubMessagesEnabled || liveEnabled || tournamentsEnabled;
    if (activeTab === 'booking' && !bookingEnabled) return updateTab('home');
    if (activeTab === 'qr' && !qrEnabled) return updateTab('home');
    if (activeTab === 'points' && !pointsEnabled) return updateTab('home');
    if (activeTab === 'highbreak' && !highbreakEnabled) return updateTab('home');
    if (activeTab === 'content' && !contentVisible) return updateTab('home');
    if (activeTab === 'scoring' && !scoringEnabled) return updateTab('home');
  }, [activeTab, bookingEnabled, qrEnabled, pointsEnabled, highbreakEnabled, clubMessagesEnabled, liveEnabled, tournamentsEnabled, scoringEnabled]);

  useEffect(() => {
    if (!operatorId || !isOperator) return;
    if (!clubProfile?.id) return;
    if (!highbreakEnabled) return;
    loadBreakData();
  }, [operatorId, isOperator, clubProfile?.id, highbreakEnabled, loadBreakData]);

  useEffect(() => {
    if (!operatorId || !isOperator) return;
    if (!pointsEnabled) return;
    loadPointsData();
  }, [operatorId, isOperator, pointsEnabled, loadPointsData]);

  useEffect(() => {
    if (!operatorId || !isOperator) return;
    if (!pointsEnabled) return;
    if (activeTab !== 'points') return;
    let mounted = true;
    const q = String(pointsAdjustMemberQuery || '').trim();
    if (!q) {
      setPointsAdjustMemberOptions([]);
      setPointsAdjustMemberLoading(false);
      return;
    }
    const t = window.setTimeout(async () => {
      setPointsAdjustMemberLoading(true);
      try {
        const rows = await searchClubPointsBalances(API_URL, operatorId, { q, limit: 30 });
        if (mounted) setPointsAdjustMemberOptions(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setPointsAdjustMemberOptions([]);
      } finally {
        if (mounted) setPointsAdjustMemberLoading(false);
      }
    }, 250);
    return () => {
      mounted = false;
      window.clearTimeout(t);
    };
  }, [activeTab, operatorId, isOperator, pointsAdjustMemberQuery, pointsEnabled]);

  useEffect(() => {
    if (!operatorId || !isOperator) return;
    if (!pointsEnabled) return;
    if (activeTab !== 'points') return;
    let mounted = true;
    const q = String(pointsBalanceQuery || '').trim();
    if (!q) {
      setPointsBalanceRows([]);
      setPointsBalanceLoading(false);
      return;
    }
    const t = window.setTimeout(async () => {
      setPointsBalanceLoading(true);
      try {
        const rows = await searchClubPointsBalances(API_URL, operatorId, { q, limit: 50 });
        if (mounted) setPointsBalanceRows(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setPointsBalanceRows([]);
      } finally {
        if (mounted) setPointsBalanceLoading(false);
      }
    }, 250);
    return () => {
      mounted = false;
      window.clearTimeout(t);
    };
  }, [activeTab, operatorId, isOperator, pointsBalanceQuery, pointsEnabled]);

  const handleCreateRoom = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      await createOperatorRoom(API_URL, operatorId);
      // 立即重新載入所有資料（避免快取/延遲）
      await loadData();
    } catch (err: any) {
      setError(err.message || '建立房間失敗');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (deletingId) return;
    if (!window.confirm('確定要刪除此房間嗎？刪除後無法復原。')) return;
    
    setDeletingId(roomId);
    try {
      await deleteOperatorRoom(API_URL, roomId);
      setToast('房間已刪除');
      setTimeout(() => setToast(null), 2000);
      
      // 刪除後同步重新載入（含歷史）
      await loadData();
    } catch (err: any) {
      setError(err.message || '刪除房間失敗');
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = (path: string) => {
    const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
    const url = `${baseUrl}${path}${params}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`連結已複製：\n${url}`);
    });
  };

  if (!operatorId || !isOperator) return null;

  return (
    <div className="brand-page p-4 sm:p-6">
      <div className="max-w-4xl mx-auto grid gap-6">
        {venueAccessDaysLeft !== null && venueAccessDaysLeft >= 0 && venueAccessDaysLeft <= 30 && (
          <div
            className="sticky z-50"
            style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
          >
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
        )}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words min-w-0">
            Cue Aim System - 場館管理後台 <span className="text-sm font-normal accent-yellow ml-2">v2.1 Club</span>
          </h1>
          <div className="sm:ml-auto">
            <button 
              onClick={() => {
                localStorage.removeItem('memberSession');
                navigate('/members/login');
              }}
              className="px-4 py-2 rounded-lg cue-surface-strong hover:brightness-95 transition-colors w-full sm:w-auto"
            >
              登出
            </button>
          </div>
        </div>

        <div className="glass rounded-xl p-3 sm:p-4">
          <Tabs
            items={[
              { key: 'home', label: '主頁編輯' },
              ...(bookingEnabled ? [{ key: 'booking', label: '預約/球枱' }] : []),
              ...(qrEnabled ? [{ key: 'qr', label: '掃碼起鐘' }] : []),
              ...(pointsEnabled ? [{ key: 'points', label: '消費積分' }] : []),
              ...(highbreakEnabled ? [{ key: 'highbreak', label: '單杆' }] : []),
              ...((clubMessagesEnabled || liveEnabled || tournamentsEnabled) ? [{ key: 'content', label: '內容管理' }] : []),
              { key: 'members', label: '會員管理' },
              ...(scoringEnabled ? [{ key: 'scoring', label: '計分/房間' }] : []),
            ]}
            activeKey={activeTab}
            onChange={(k) => updateTab(k as any)}
          />
        </div>

        {error && (
          <div className="cue-surface p-3 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow-lg z-50">
            {toast}
          </div>
        )}

        {activeTab === 'home' && (
        <>
        {/* Club Profile Management */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b cue-border pb-2">場館資料管理</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">場館名稱 (Club Name)</label>
               <input 
                 value={clubProfile.name || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, name: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input" 
                 placeholder="例如：南華會桌球室"
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">場館簡介 (Intro)</label>
               <textarea 
                 value={clubProfile.intro || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, intro: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input h-24" 
                 placeholder="簡介..."
               />
            </div>
            <div>
               <label className="block text-sm mb-1 cue-muted">聯絡電話 (Phone)</label>
               <input 
                 value={clubProfile.phone || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, phone: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input" 
               />
            </div>
            <div>
               <label className="block text-sm mb-1 cue-muted">聯絡 Email</label>
               <input 
                 value={clubProfile.email || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, email: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input" 
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">地址 (Address)</label>
               <input 
                 value={clubProfile.address || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, address: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input" 
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">Google Map URL（可選）</label>
               <input
                 value={clubProfile.mapUrl || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, mapUrl: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input"
                 placeholder="https://maps.app.goo.gl/... 或 https://www.google.com/maps/..."
               />
               <div className="text-xs cue-muted mt-1">如留空，公開頁會用「地址」自動生成地圖搜尋連結。</div>
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">LOGO（上傳圖片）</label>
               <div className="flex flex-col gap-2">
                 <input
                   type="file"
                   accept="image/*"
                   onChange={async (e) => {
                     const f = e.target.files?.[0];
                     e.currentTarget.value = '';
                     if (!f) return;
                     try {
                       const dataUrl = await resizeImageFileToDataUrl(f, { maxW: 512, maxH: 512, type: 'image/png' });
                       setClubProfile((prev: any) => ({ ...prev, logoUrl: dataUrl }));
                       setToast('LOGO 已加入（會自動縮放）');
                       setTimeout(() => setToast(null), 2000);
                     } catch {
                       setToast('LOGO 圖片處理失敗');
                       setTimeout(() => setToast(null), 3000);
                     }
                   }}
                   className="w-full px-3 py-2 rounded cue-input"
                 />
                 <div className="text-xs cue-muted">建議：512×512px（或更大正方形），PNG/JPG 均可；系統會自動縮放至 512px。</div>
                 {clubProfile.logoUrl ? (
                   <div className="flex items-center gap-3">
                     <div className="w-14 h-14 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden flex-shrink-0">
                       <img src={normalizeImageSrc(clubProfile.logoUrl)} alt="" className="w-full h-full object-contain" />
                     </div>
                     <button type="button" className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm" onClick={() => setClubProfile((p: any) => ({ ...p, logoUrl: '' }))}>
                       移除 LOGO
                     </button>
                   </div>
                 ) : null}
                 <details className="mt-1">
                   <summary className="text-xs cue-muted cursor-pointer select-none">進階：使用 URL</summary>
                   <div className="mt-2">
                     <input
                       value={clubProfile.logoUrl || ''}
                       onChange={(e) => setClubProfile({ ...clubProfile, logoUrl: e.target.value })}
                       className="w-full px-3 py-2 rounded cue-input"
                       placeholder="https://..."
                     />
                   </div>
                 </details>
               </div>
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">付款方式說明（預約用）</label>
               <textarea
                 value={clubProfile.paymentInfo || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, paymentInfo: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input h-20" 
                 placeholder="例如：到場以現金/轉數快付款；需預付訂金..."
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">場館頁頂部輪播相片（上傳）</label>
               <div className="flex flex-col gap-2">
                 <input
                   type="file"
                   accept="image/*"
                   multiple
                   onChange={async (e) => {
                     const files = Array.from(e.target.files || []);
                     e.currentTarget.value = '';
                     if (files.length === 0) return;
                     try {
                       const processed: string[] = [];
                       for (const f of files.slice(0, 12)) {
                         const dataUrl = await resizeImageFileToDataUrl(f, { maxW: 1600, maxH: 900, type: 'image/jpeg', quality: 0.82 });
                         processed.push(dataUrl);
                       }
                       setClubProfile((prev: any) => {
                         const curCover = String(prev?.coverImageUrl || '').trim();
                         const curGallery = getGalleryArray(prev?.galleryUrls);
                         let cover = curCover;
                         let gallery = curGallery.slice();
                         if (!cover && processed.length > 0) {
                           cover = processed[0];
                           gallery = [...gallery, ...processed.slice(1)];
                         } else {
                           gallery = [...gallery, ...processed];
                         }
                         gallery = gallery.filter(Boolean).slice(0, 12);
                         return { ...prev, coverImageUrl: cover, galleryUrls: gallery };
                       });
                       setToast('輪播相片已加入（會自動縮放/壓縮）');
                       setTimeout(() => setToast(null), 2000);
                     } catch {
                       setToast('輪播相片處理失敗');
                       setTimeout(() => setToast(null), 3000);
                     }
                   }}
                   className="w-full px-3 py-2 rounded cue-input"
                 />
                 <div className="text-xs cue-muted">建議：1600×900px（16:9）或 1200×675px；系統會自動縮放至最長邊 1600px（JPEG）。</div>
                 <div className="grid gap-3">
                   <div className="cue-surface-strong rounded-lg p-3">
                     <div className="flex items-center justify-between gap-3">
                       <div className="font-semibold">封面（輪播第一張）</div>
                       {clubProfile.coverImageUrl ? (
                         <button type="button" className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-xs" onClick={() => setClubProfile((p: any) => ({ ...p, coverImageUrl: '' }))}>
                           移除封面
                         </button>
                       ) : null}
                     </div>
                     {clubProfile.coverImageUrl ? (
                       <div className="mt-2 rounded-lg overflow-hidden border border-white/10 bg-black/30">
                         <img src={normalizeImageSrc(clubProfile.coverImageUrl)} alt="" className="w-full h-40 object-cover" />
                       </div>
                     ) : (
                       <div className="mt-2 text-sm cue-muted">（未設定）</div>
                     )}
                   </div>
                   <div className="cue-surface-strong rounded-lg p-3">
                     <div className="font-semibold">相簿（輪播其餘圖片，最多 12 張）</div>
                     {getGalleryArray(clubProfile.galleryUrls).length > 0 ? (
                       <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                         {getGalleryArray(clubProfile.galleryUrls).slice(0, 12).map((u: string, idx: number) => (
                           <div key={`${u}-${idx}`} className="rounded-lg overflow-hidden border border-white/10 bg-black/30">
                             <img src={normalizeImageSrc(u)} alt="" className="w-full h-24 object-cover" />
                             <div className="p-2 flex gap-2">
                               <button type="button" className="flex-1 px-2 py-1 rounded cue-surface hover:brightness-95 text-xs" onClick={() => setGalleryAsCover(idx)}>
                                 設為封面
                               </button>
                               <button type="button" className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs" onClick={() => removeGalleryAt(idx)}>
                                 刪除
                               </button>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="mt-2 text-sm cue-muted">（暫無）</div>
                     )}
                   </div>
                 </div>
                 <details className="mt-1">
                   <summary className="text-xs cue-muted cursor-pointer select-none">進階：使用 URL</summary>
                   <div className="mt-2 grid gap-2">
                     <label className="block text-xs cue-muted">封面圖 URL（Cover Image）</label>
                     <input
                       value={clubProfile.coverImageUrl || ''} 
                       onChange={(e) => setClubProfile({ ...clubProfile, coverImageUrl: e.target.value })} 
                       className="w-full px-3 py-2 rounded cue-input"
                       placeholder="https://..."
                     />
                     <label className="block text-xs cue-muted">相簿（每行一張圖片 URL，最多 12 張）</label>
                     <textarea
                       value={Array.isArray(clubProfile.galleryUrls) ? clubProfile.galleryUrls.join('\n') : ''}
                       onChange={(e) => setClubProfile({ ...clubProfile, galleryUrls: parseLines(e.target.value, 12) })}
                       className="w-full px-3 py-2 rounded cue-input h-24"
                       placeholder="https://...jpg"
                     />
                   </div>
                 </details>
               </div>
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">設施（每行一項，最多 24 項）</label>
               <textarea
                 value={facilitiesDraft}
                 onChange={(e) => {
                   const v = e.target.value;
                   setFacilitiesDraft(v);
                   setClubProfile((prev: any) => ({ ...prev, facilities: parseLines(v, 24) }));
                 }}
                 className="w-full px-3 py-2 rounded cue-input h-24"
                 placeholder="例如：免費泊車\n淋浴\n家庭房"
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 cue-muted">政策（文字，可多行）</label>
               <textarea
                 value={clubProfile.policies || ''}
                 onChange={(e) => setClubProfile({ ...clubProfile, policies: e.target.value })}
                 className="w-full px-3 py-2 rounded cue-input h-24"
                 placeholder="例如：\n- 請準時到場\n- 禁止吸煙\n- 取消預約需提前 2 小時"
               />
            </div>
          </div>

          <div className="mt-6 cue-surface rounded-lg p-4">
            <div className="font-semibold mb-3">主頁預覽</div>
            <div className="relative overflow-hidden rounded-xl border border-white/10">
              <div className="relative h-36 sm:h-44 bg-black/30 overflow-hidden">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-800 to-slate-950" />
                {(clubProfile.coverImageUrl || clubProfile.logoUrl) ? (
                  <img
                    src={normalizeImageSrc(clubProfile.coverImageUrl || clubProfile.logoUrl)}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : null}
              </div>
              <div className="-mt-8 px-3 pb-3">
                <div className="glass rounded-xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {clubProfile.logoUrl ? (
                          <>
                            <div className="text-xs cue-muted">LOGO</div>
                            <img
                              src={normalizeImageSrc(clubProfile.logoUrl)}
                              alt=""
                              className="w-full h-full object-contain"
                              onLoad={(e) => {
                                try {
                                  const el = e.currentTarget;
                                  const box = el.parentElement;
                                  const t = box?.querySelector('div');
                                  if (t) (t as HTMLElement).style.display = 'none';
                                } catch {}
                              }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </>
                        ) : (
                          <div className="text-xs cue-muted">LOGO</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold accent-yellow truncate">{clubProfile.name || '未命名場館'}</div>
                        {clubProfile.intro && <div className="text-xs cue-muted whitespace-pre-wrap max-h-10 overflow-hidden mt-1">{clubProfile.intro}</div>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 px-3 py-2 rounded cue-button text-sm font-semibold">加入</div>
                  </div>
                  {Array.isArray(clubProfile.facilities) && clubProfile.facilities.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {clubProfile.facilities.slice(0, 24).map((f: any) => (
                        <div key={String(f)} className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-xs break-words">
                          {String(f)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {clubProfile.id && (
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                <Link to={`/club/${clubProfile.id}`} target="_blank" className="accent-blue underline text-sm">
                  以新視覺預覽公開頁面
                </Link>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
             <button
              onClick={async () => {
                try {
                   if (!operatorId) return;
                   const res = await updateClubProfile(API_URL, operatorId, clubProfile);
                   setClubProfile(res);
                   setToast('場館資料已更新');
                   setTimeout(() => setToast(null), 3000);
                } catch (err: any) {
                   setToast(err.message || '更新失敗');
                   setTimeout(() => setToast(null), 3000);
                }
              }}
              className="px-4 py-2 rounded brand-button text-black transition-colors"
            >
              儲存場館資料
            </button>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="text-center">
                    {clubProfile.id ? (
                      <>
                        <div className="inline-block bg-white p-2 rounded-lg">
                          <QRCodeSVG
                            ref={joinQrSvgRef as any}
                            value={joinUrl}
                            size={120}
                            fgColor="#000000"
                            bgColor="#FFFFFF"
                            includeMargin
                          />
                        </div>
                        <div className="text-xs cue-muted mt-1">入會二維碼</div>
                        <div className="mt-2 flex flex-col sm:flex-row gap-2 justify-center">
                          <button type="button" onClick={downloadJoinQrPng} className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-xs">
                            下載 PNG
                          </button>
                          <button type="button" onClick={downloadJoinQrSvg} className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-xs">
                            下載 SVG
                          </button>
                        </div>
                        <div style={{ display: 'none' }}>
                          <QRCodeCanvas ref={joinQrCanvasRef as any} value={joinUrl} size={512} includeMargin />
                        </div>
                      </>
                    ) : (
                      <div className="cue-surface rounded-lg p-3">
                        <div className="text-sm font-semibold mb-1">入會二維碼</div>
                        <div className="text-xs cue-muted mb-2">首次使用請先儲存一次場館資料，以生成入會連結。</div>
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded cue-button hover:brightness-95 text-xs w-full"
                          onClick={async () => {
                            try {
                              if (!operatorId) return;
                              const payload = {
                                ...clubProfile,
                                name: String(clubProfile?.name || '').trim() || String(operatorName || '未命名場館'),
                              };
                              const res = await updateClubProfile(API_URL, operatorId, payload);
                              setClubProfile(res);
                              setToast('已生成入會二維碼');
                              setTimeout(() => setToast(null), 2000);
                            } catch (e: any) {
                              setToast(e?.message || '生成失敗');
                              setTimeout(() => setToast(null), 3000);
                            }
                          }}
                        >
                          生成二維碼
                        </button>
                      </div>
                    )}
                </div>
                {clubProfile.id && (
                  <Link to={`/club/${clubProfile.id}`} target="_blank" className="accent-blue underline text-sm">
                      預覽公開頁面
                  </Link>
                )}
            </div>
          </div>

        </div>

        {/* Club Members List */}
        <div className="glass rounded-xl p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 border-b cue-border pb-2">
             <h2 className="text-xl font-bold">場館會員 ({clubMembers.length})</h2>
             <button onClick={loadData} className="text-sm accent-blue hover:underline">重新整理</button>
          </div>
          
          {clubMembers.length === 0 ? (
             <div className="cue-muted text-center py-8">暫無會員加入</div>
          ) : (
            <>
              <div className="sm:hidden space-y-2">
                {clubMembers.map((cm: any) => {
                  const name = cm.member?.name || '-';
                  const email = cm.member?.email || '-';
                  const phone = cm.member?.phone || '-';
                  const region = String(cm.member?.region_code ?? cm.member?.regionCode ?? '-') || '-';
                  const district = String(cm.member?.district_code ?? cm.member?.districtCode ?? '-') || '-';
                  const joined = cm.joinedAt ? new Date(cm.joinedAt).toLocaleDateString() : '-';
                  return (
                    <div key={cm.id} className="cue-surface rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{name}</div>
                          <div className="text-xs cue-muted break-words mt-0.5">{email}</div>
                          <div className="text-xs break-words mt-0.5">{phone}</div>
                          <div className="text-xs cue-muted mt-1">地方：{region}　分區：{district}</div>
                          <div className="text-xs cue-muted mt-0.5">加入：{joined}</div>
                        </div>
                        <button
                          type="button"
                          className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold cue-surface-strong hover:brightness-95"
                          onClick={() => {
                            const memId = String(cm.member?.id || cm.memberId || '').trim();
                            if (!memId) return;
                            setMemberLocMemberId(memId);
                            setMemberLocRegionCode(String(cm.member?.region_code ?? cm.member?.regionCode ?? '') || '');
                            setMemberLocDistrictCode(String(cm.member?.district_code ?? cm.member?.districtCode ?? '') || '');
                            setMemberLocOpen(true);
                          }}
                        >
                          更改
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="cue-muted border-b cue-border">
                      <th className="py-2 px-3">名稱</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">電話</th>
                      <th className="py-2 px-3">地方</th>
                      <th className="py-2 px-3">分區</th>
                      <th className="py-2 px-3">加入時間</th>
                      <th className="py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clubMembers.map((cm: any) => (
                      <tr key={cm.id} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-3">{cm.member?.name || '-'}</td>
                        <td className="py-2 px-3 text-sm cue-muted">{cm.member?.email || '-'}</td>
                        <td className="py-2 px-3 text-sm">{cm.member?.phone || '-'}</td>
                        <td className="py-2 px-3 text-sm">{String(cm.member?.region_code ?? cm.member?.regionCode ?? '-') || '-'}</td>
                        <td className="py-2 px-3 text-sm">{String(cm.member?.district_code ?? cm.member?.districtCode ?? '-') || '-'}</td>
                        <td className="py-2 px-3 text-sm cue-muted">{new Date(cm.joinedAt).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded text-xs font-semibold cue-surface-strong hover:brightness-95"
                            onClick={() => {
                              const memId = String(cm.member?.id || cm.memberId || '').trim();
                              if (!memId) return;
                              setMemberLocMemberId(memId);
                              setMemberLocRegionCode(String(cm.member?.region_code ?? cm.member?.regionCode ?? '') || '');
                              setMemberLocDistrictCode(String(cm.member?.district_code ?? cm.member?.districtCode ?? '') || '');
                              setMemberLocOpen(true);
                            }}
                          >
                            更改地方/分區
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {memberLocOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setMemberLocOpen(false)} />
            <div className="relative w-full max-w-lg glass rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg font-bold">更改會員地方／分區</div>
                <button
                  type="button"
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  onClick={() => setMemberLocOpen(false)}
                >
                  關閉
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-sm cue-muted mb-1">地方</div>
                  <select
                    value={memberLocRegionCode}
                    onChange={(e) => setMemberLocRegionCode(String(e.target.value || '').trim().toUpperCase())}
                    className="w-full cue-input rounded px-3 py-2 text-sm"
                    disabled={memberLocLoading}
                  >
                    <option value="">（不設定）</option>
                    {memberLocRegions.map((r) => (
                      <option key={r.code3} value={r.code3}>
                        {r.name} ({r.code3})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-sm cue-muted mb-1">分區</div>
                  <select
                    value={memberLocDistrictCode}
                    onChange={(e) => setMemberLocDistrictCode(String(e.target.value || '').trim().toUpperCase())}
                    className="w-full cue-input rounded px-3 py-2 text-sm"
                    disabled={memberLocLoading || !memberLocRegionCode}
                  >
                    <option value="">{memberLocRegionCode ? '請選擇分區' : '請先選地方'}</option>
                    {memberLocDistricts.map((d) => (
                      <option key={`${d.regionCode || memberLocRegionCode}-${d.code3}`} value={d.code3}>
                        {d.name} ({d.code3})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className={`w-full px-4 py-2 rounded font-semibold ${memberLocLoading ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                  disabled={memberLocLoading}
                  onClick={async () => {
                    const memId = String(memberLocMemberId || '').trim();
                    if (!memId) return;
                    const rc = String(memberLocRegionCode || '').trim().toUpperCase();
                    const dc = String(memberLocDistrictCode || '').trim().toUpperCase();
                    if ((rc && !dc) || (!rc && dc)) {
                      setToast('請同時選擇地方及分區');
                      setTimeout(() => setToast(null), 2500);
                      return;
                    }
                    try {
                      setMemberLocLoading(true);
                      const res = await updateMemberSelf(API_URL, memId, { regionCode: rc ? rc : null, districtCode: dc ? dc : null });
                      const nextMember = (res as any)?.member ?? res;
                      setClubMembers((prev) =>
                        Array.isArray(prev)
                          ? prev.map((x: any) =>
                              String(x?.member?.id || x?.memberId || '') === memId
                                ? { ...x, member: { ...(x.member || {}), ...(nextMember || {}) } }
                                : x,
                            )
                          : prev,
                      );
                      setToast('已更新地方/分區');
                      setTimeout(() => setToast(null), 2000);
                      setMemberLocOpen(false);
                    } catch (e: any) {
                      setToast(e?.message || '更新失敗');
                      setTimeout(() => setToast(null), 3000);
                    } finally {
                      setMemberLocLoading(false);
                    }
                  }}
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        )}

        </>
        )}

        {activeTab === 'qr' && (
        qrEnabled ? (
        <>
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
              <div className="text-xl font-bold">掃碼起鐘</div>
              <button
                type="button"
                className="text-sm accent-blue hover:underline"
                onClick={async () => {
                  try {
                    setSessionsLoading(true);
                    const rows = await getActiveTableSessions(API_URL, operatorId).catch(() => []);
                    setActiveSessions(Array.isArray(rows) ? rows : []);
                  } finally {
                    setSessionsLoading(false);
                  }
                }}
              >
                {sessionsLoading ? '載入中...' : '重新整理'}
              </button>
            </div>
            {activeSessions.length === 0 ? (
              <div className="cue-muted text-sm">暫無進行中台鐘</div>
            ) : (
              <>
                <div className="sm:hidden space-y-2">
                  {activeSessions.map((s: any) => (
                    <div key={s.id} className="cue-surface rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{s.table?.name || '-'}</div>
                          <div className="text-xs cue-muted break-words mt-0.5">{s.startedBy?.name || s.startedBy?.email || '-'}</div>
                          <div className="text-xs cue-muted mt-1">{s.startAt ? new Date(s.startAt).toLocaleString() : '-'}</div>
                        </div>
                        <button
                          type="button"
                          className="flex-shrink-0 px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs"
                          onClick={async () => {
                            if (!window.confirm('確定要為此台落鐘並結算？')) return;
                            try {
                              await endTableSessionAsOperator(API_URL, operatorId, s.id);
                              setToast('已落鐘並結算');
                              setTimeout(() => setToast(null), 2000);
                              await loadData();
                            } catch (e: any) {
                              setToast(e?.message || '落鐘失敗');
                              setTimeout(() => setToast(null), 3000);
                            }
                          }}
                        >
                          落鐘
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">球枱</th>
                        <th className="py-2 px-2">會員</th>
                        <th className="py-2 px-2">開始</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessions.map((s: any) => (
                        <tr key={s.id} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-2">{s.table?.name || '-'}</td>
                          <td className="py-2 px-2">{s.startedBy?.name || s.startedBy?.email || '-'}</td>
                          <td className="py-2 px-2 cue-muted whitespace-nowrap">{s.startAt ? new Date(s.startAt).toLocaleString() : '-'}</td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs"
                              onClick={async () => {
                                if (!window.confirm('確定要為此台落鐘並結算？')) return;
                                try {
                                  await endTableSessionAsOperator(API_URL, operatorId, s.id);
                                  setToast('已落鐘並結算');
                                  setTimeout(() => setToast(null), 2000);
                                  await loadData();
                                } catch (e: any) {
                                  setToast(e?.message || '落鐘失敗');
                                  setTimeout(() => setToast(null), 3000);
                                }
                              }}
                            >
                              落鐘
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="glass rounded-xl p-6">
            <div className="text-xl font-bold mb-4 border-b cue-border pb-2">球枱 QR</div>
            {tables.length === 0 ? (
              <div className="cue-muted text-sm">暫無球枱</div>
            ) : (
              <div className="space-y-2">
                {tables.map((t) => (
                  <div key={t.id} className="cue-surface p-3 rounded flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{t.name}</div>
                      <div className="text-xs cue-muted">{t.qrToken?.token ? '已生成 QR' : '未有 QR'}</div>
                    </div>
                    {t.qrToken?.token ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-white p-1 rounded">
                          <QRCodeSVG
                            id={`table-qr-svg-${t.id}`}
                            value={new URL(`${rawBase}/qr/table/${t.qrToken.token}`, window.location.origin).toString()}
                            size={56}
                            fgColor="#000000"
                            bgColor="#FFFFFF"
                            includeMargin
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                            onClick={() => {
                              const url = new URL(`${rawBase}/qr/table/${t.qrToken.token}`, window.location.origin).toString();
                              navigator.clipboard.writeText(url).then(() => {
                                setToast('已複製球枱 QR 連結');
                                setTimeout(() => setToast(null), 2000);
                              });
                            }}
                          >
                            複製
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                            onClick={async () => {
                              try {
                                const el = document.getElementById(`table-qr-svg-${t.id}`) as any;
                                if (!el) throw new Error('找不到 QR');
                                const fn = `table-${safeFilePart(t.name)}-qr.svg`;
                                downloadSvgElement(el, fn);
                              } catch (e: any) {
                                setToast(e?.message || '下載失敗');
                                setTimeout(() => setToast(null), 3000);
                              }
                            }}
                          >
                            SVG
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                            onClick={async () => {
                              try {
                                const el = document.getElementById(`table-qr-svg-${t.id}`) as any;
                                if (!el) throw new Error('找不到 QR');
                                const fn = `table-${safeFilePart(t.name)}-qr.png`;
                                await downloadSvgAsPng(el, fn, t.name);
                              } catch (e: any) {
                                setToast(e?.message || '下載失敗');
                                setTimeout(() => setToast(null), 3000);
                              }
                            }}
                          >
                            PNG
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs cue-muted">—</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">掃碼起鐘</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )
        )}

        {activeTab === 'points' && (
        pointsEnabled ? (
        <div className="glass rounded-xl p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 border-b cue-border pb-2">
            <h2 className="text-xl font-bold">消費積分</h2>
            <button onClick={loadPointsData} className="text-sm accent-blue hover:underline">重新整理</button>
          </div>

          {pointsLoading ? (
            <div className="cue-muted">載入中...</div>
          ) : (
            <div className="grid gap-6">
              <div>
                <div className="font-semibold mb-2">會員消費積分加減</div>
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-3">
                    <label className="block text-sm mb-1 cue-muted">搜尋會員（名稱/電話/Email/會員編號）</label>
                    <input
                      value={pointsAdjustMemberQuery}
                      onChange={(e) => setPointsAdjustMemberQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded cue-input"
                      placeholder="例如：陳大文 / 9123 / abc@gmail.com / A00123"
                    />
                    {pointsAdjustMemberLoading ? <div className="text-xs cue-muted mt-1">搜尋中...</div> : null}
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-sm mb-1 cue-muted">會員</label>
                    <select value={pointsAdjustMemberId} onChange={(e) => setPointsAdjustMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                      <option value="">請先搜尋並選擇</option>
                      {pointsAdjustMemberOptions.map((r: any) => {
                        const m = r?.member || {};
                        const code = String(m?.member_code || '').trim();
                        const name = String(m?.name || '').trim();
                        const phone = String(m?.phone || m?.phone_e164 || '').trim();
                        const email = String(m?.email || '').trim();
                        const bal = r?.balance ?? 0;
                        const left = `${name || email || r.memberId}${code ? ` [${code}]` : ''}`;
                        const right = phone ? phone : (email ? email : '');
                        const label = `${left}${right ? ` (${right})` : ''}（${bal}）`;
                        return (
                          <option key={r.memberId} value={r.memberId}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 cue-muted">加減分（可負數）</label>
                    <input value={pointsAdjustDelta} onChange={(e) => setPointsAdjustDelta(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：100 或 -50" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm mb-1 cue-muted">原因</label>
                    <input value={pointsAdjustReason} onChange={(e) => setPointsAdjustReason(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：台費抵扣 / 充值" />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded cue-button hover:brightness-95 text-white"
                    onClick={async () => {
                      try {
                        if (!pointsAdjustMemberId) throw new Error('請先選擇會員');
                        const delta = Math.floor(Number(pointsAdjustDelta));
                        if (!Number.isFinite(delta) || delta === 0) throw new Error('請輸入有效加減分');
                        if (!String(pointsAdjustReason || '').trim()) throw new Error('請輸入原因');
                        await adjustClubMemberPoints(API_URL, operatorId, {
                          memberId: pointsAdjustMemberId,
                          deltaPoints: delta,
                          reason: String(pointsAdjustReason).trim(),
                        });
                        setPointsAdjustDelta('');
                        setPointsAdjustReason('');
                        setToast('已更新消費積分');
                        setTimeout(() => setToast(null), 2000);
                        setPointsLedgerMode('detail');
                        setPointsLedgerMemberId(pointsAdjustMemberId);
                        setPointsLedgerFrom('');
                        setPointsLedgerTo('');
                        setPointsLedgerMonth('');
                        try {
                          setPointsLedgerLoading(true);
                          const res = await getClubPointsLedger(API_URL, operatorId, { limit: 50, memberId: pointsAdjustMemberId, includeTotal: true });
                          const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : (Array.isArray(res) ? res : []);
                          const totalDelta = Number((res as any)?.totalDelta ?? 0);
                          setPointsLedgerRows(rows);
                          setPointsLedgerTotalDelta(Number.isFinite(totalDelta) ? totalDelta : 0);
                        } catch {}
                      } catch (e: any) {
                        setToast(e?.message || '更新失敗');
                        setTimeout(() => setToast(null), 3000);
                      } finally {
                        setPointsLedgerLoading(false);
                      }
                    }}
                  >
                    確認更新
                  </button>
                  <div className="text-xs cue-muted mt-1">建議以正數代表加分，負數代表扣分。</div>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">會員消費積分餘額（搜尋）</div>
                <div className="grid gap-3">
                  <div>
                    <label className="block text-sm mb-1 cue-muted">搜尋（名稱/電話/Email/會員編號）</label>
                    <input
                      value={pointsBalanceQuery}
                      onChange={(e) => setPointsBalanceQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded cue-input"
                      placeholder="輸入關鍵字後顯示最多 50 筆"
                    />
                    {pointsBalanceLoading ? <div className="text-xs cue-muted mt-1">載入中...</div> : null}
                  </div>

                  {String(pointsBalanceQuery || '').trim() && pointsBalanceRows.length === 0 && !pointsBalanceLoading ? (
                    <div className="cue-muted text-sm">沒有結果</div>
                  ) : pointsBalanceRows.length === 0 ? (
                    <div className="cue-muted text-sm">輸入關鍵字以查詢指定會員（避免一次列出大量成員）。</div>
                  ) : (
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="cue-muted border-b cue-border">
                            <th className="py-2 px-3">會員</th>
                            <th className="py-2 px-3">電話</th>
                            <th className="py-2 px-3">Email</th>
                            <th className="py-2 px-3">餘額</th>
                            <th className="py-2 px-3">更新</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pointsBalanceRows.map((r: any) => {
                            const m = r?.member || {};
                            const code = String(m?.member_code || '').trim();
                            const name = String(m?.name || '').trim();
                            const phone = String(m?.phone || m?.phone_e164 || '').trim();
                            const email = String(m?.email || '').trim();
                            return (
                              <tr key={r.memberId} className="border-b cue-border hover:brightness-95">
                                <td className="py-2 px-3">{name || '-'}{code ? ` [${code}]` : ''}</td>
                                <td className="py-2 px-3 text-sm">{phone || '-'}</td>
                                <td className="py-2 px-3 text-sm">{email || '-'}</td>
                                <td className="py-2 px-3 font-semibold">{r.balance ?? 0}</td>
                                <td className="py-2 px-3 text-xs cue-muted">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">消費積分流水</div>
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 cue-muted">模式</label>
                    <select value={pointsLedgerMode} onChange={(e) => setPointsLedgerMode(e.target.value as any)} className="w-full px-3 py-2 rounded cue-input">
                      <option value="detail">明細</option>
                      <option value="month">按月</option>
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm mb-1 cue-muted">會員（可選）</label>
                    <select value={pointsLedgerMemberId} onChange={(e) => setPointsLedgerMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                      <option value="">全部會員</option>
                      {pointsAdjustMemberOptions.map((r: any) => {
                        const m = r?.member || {};
                        const code = String(m?.member_code || '').trim();
                        const name = String(m?.name || '').trim();
                        const email = String(m?.email || '').trim();
                        const label = `${name || email || r.memberId}${code ? ` [${code}]` : ''}`;
                        return (
                          <option key={r.memberId} value={r.memberId}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                    <div className="text-xs cue-muted mt-1">如要按會員篩選，可先在上方搜尋會員，然後在這裡選擇。</div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 cue-muted">月份（可選）</label>
                    <input type="month" value={pointsLedgerMonth} onChange={(e) => setPointsLedgerMonth(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 cue-muted">由</label>
                    <input type="date" value={pointsLedgerFrom} onChange={(e) => setPointsLedgerFrom(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 cue-muted">至</label>
                    <input type="date" value={pointsLedgerTo} onChange={(e) => setPointsLedgerTo(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
                  </div>
                  <div className="md:col-span-6">
                    <button
                      type="button"
                      className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
                      disabled={pointsLedgerLoading}
                      onClick={async () => {
                        if (pointsLedgerLoading) return;
                        setPointsLedgerLoading(true);
                        try {
                          const memberId = String(pointsLedgerMemberId || '').trim() || undefined;
                          const month = String(pointsLedgerMonth || '').trim() || undefined;
                          const fromIso = !month && pointsLedgerFrom ? new Date(`${pointsLedgerFrom}T00:00:00`).toISOString() : undefined;
                          const toIso = !month && pointsLedgerTo ? new Date(`${pointsLedgerTo}T23:59:59.999`).toISOString() : undefined;
                          if (pointsLedgerMode === 'month') {
                            const rows = await getClubPointsLedger(API_URL, operatorId, { memberId, month, from: fromIso, to: toIso, groupBy: 'month' });
                            setPointsLedgerRows(Array.isArray(rows) ? rows : []);
                            setPointsLedgerTotalDelta(0);
                          } else {
                            const res = await getClubPointsLedger(API_URL, operatorId, { limit: 200, memberId, month, from: fromIso, to: toIso, includeTotal: true });
                            const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : (Array.isArray(res) ? res : []);
                            const totalDelta = Number((res as any)?.totalDelta ?? 0);
                            setPointsLedgerRows(rows);
                            setPointsLedgerTotalDelta(Number.isFinite(totalDelta) ? totalDelta : 0);
                          }
                        } catch (e: any) {
                          setToast(e?.message || '讀取消費積分流水失敗');
                          setTimeout(() => setToast(null), 3000);
                          setPointsLedgerRows([]);
                          setPointsLedgerTotalDelta(0);
                        } finally {
                          setPointsLedgerLoading(false);
                        }
                      }}
                    >
                      {pointsLedgerLoading ? '載入中...' : '搜尋'}
                    </button>
                  </div>
                </div>

                {pointsLedgerMode === 'detail' ? (
                  <div className="mt-3 text-sm cue-muted">
                    {(() => {
                      const rows = Array.isArray(pointsLedgerRows) ? pointsLedgerRows : [];
                      const totalPlus = rows.reduce((s: number, r: any) => {
                        const v = Number(r?.deltaPoints ?? 0);
                        return Number.isFinite(v) && v > 0 ? s + v : s;
                      }, 0);
                      return (
                        <>
                          總加：<span className="font-semibold">{totalPlus}</span>
                          <span className="mx-2">｜</span>
                          總變動：<span className="font-semibold">{pointsLedgerTotalDelta > 0 ? `+${pointsLedgerTotalDelta}` : String(pointsLedgerTotalDelta)}</span>
                        </>
                      );
                    })()}
                  </div>
                ) : null}

                <div className="mt-3">
                  {pointsLedgerLoading ? (
                    <div className="cue-muted">載入中...</div>
                  ) : pointsLedgerRows.length === 0 ? (
                    <div className="cue-muted">暫無資料</div>
                  ) : pointsLedgerMode === 'month' ? (
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="cue-muted border-b cue-border">
                            <th className="py-2 px-3">月份</th>
                            <th className="py-2 px-3">筆數</th>
                            <th className="py-2 px-3">總變動</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pointsLedgerRows.map((r: any) => (
                            <tr key={r.month} className="border-b cue-border hover:brightness-95">
                              <td className="py-2 px-3">{r.month}</td>
                              <td className="py-2 px-3">{r.count ?? 0}</td>
                              <td className="py-2 px-3 font-semibold">{Number(r.sumDelta) > 0 ? `+${r.sumDelta}` : String(r.sumDelta ?? 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="cue-muted border-b cue-border">
                            <th className="py-2 px-3">時間</th>
                            <th className="py-2 px-3">會員</th>
                            <th className="py-2 px-3">變動</th>
                            <th className="py-2 px-3">原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pointsLedgerRows.map((r: any) => (
                            <tr key={r.id} className="border-b cue-border hover:brightness-95">
                              <td className="py-2 px-3 text-xs cue-muted">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                              <td className="py-2 px-3 text-sm">
                                {r.member?.name || r.member?.email || '-'}
                                {r.member?.member_code ? ` [${r.member.member_code}]` : ''}
                              </td>
                              <td className="py-2 px-3 font-semibold">{r.deltaPoints > 0 ? `+${r.deltaPoints}` : r.deltaPoints}</td>
                              <td className="py-2 px-3 text-sm">{r.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="text-xs cue-muted mt-2">最多顯示 200 筆（如需完整統計可縮窄時間範圍）。</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        ) : (
        <div className="glass rounded-xl p-4 md:p-6">
          <div className="text-xl font-bold mb-2">消費積分</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )
        )}

        {activeTab === 'highbreak' && (
        highbreakEnabled ? (
        <div className="glass rounded-xl p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 border-b cue-border pb-2">
            <h2 className="text-xl font-bold">單杆紀錄</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="month"
                value={breakFilterMonth}
                onChange={(e) => setBreakFilterMonth(e.target.value)}
                className="px-3 py-2 rounded cue-input text-sm"
              />
              <select
                value={breakFilterMember}
                onChange={(e) => setBreakFilterMember(e.target.value)}
                className="px-3 py-2 rounded cue-input text-sm"
              >
                <option value="">全部會員</option>
                {clubMembers.map((cm: any) => (
                  <option key={cm.member?.id || cm.id} value={cm.member?.id || ''}>
                    {cm.member?.name || '-'}{cm.member?.email ? ` (${cm.member.email})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={loadBreakData}
                className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
              >
                重新整理
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">會員</label>
              <select
                value={breakMemberId}
                onChange={(e) => setBreakMemberId(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
              >
                <option value="">選擇會員</option>
                {clubMembers.map((cm: any) => (
                  <option key={cm.member?.id || cm.id} value={cm.member?.id || ''}>
                    {cm.member?.name || '-'}{cm.member?.member_code ? ` [${cm.member.member_code}]` : ''}{cm.member?.email ? ` (${cm.member.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 cue-muted">分數</label>
              <input
                value={breakPoints}
                onChange={(e) => setBreakPoints(e.target.value)}
                type="number"
                min={1}
                className="w-full px-3 py-2 rounded cue-input"
                placeholder="例如 78"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 cue-muted">日期</label>
              <input
                value={breakRecordedAt}
                onChange={(e) => setBreakRecordedAt(e.target.value)}
                type="date"
                className="w-full px-3 py-2 rounded cue-input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">影片連結（可空）</label>
              <input
                value={breakVideoUrl}
                onChange={(e) => setBreakVideoUrl(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-5">
              <label className="block text-sm mb-1 cue-muted">備註（可空）</label>
              <input
                value={breakNote}
                onChange={(e) => setBreakNote(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input"
                placeholder="例如：友誼賽 / 練習"
              />
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                onClick={async () => {
                  try {
                    if (!breakMemberId) throw new Error('請先選擇會員');
                    const p = Number(breakPoints);
                    if (!Number.isFinite(p) || p <= 0) throw new Error('分數無效');
                    await createClubBreak(API_URL, operatorId, {
                      memberId: breakMemberId,
                      points: p,
                      recordedAt: breakRecordedAt,
                      videoUrl: breakVideoUrl.trim() || undefined,
                      note: breakNote.trim() || undefined,
                    });
                    setToast('已新增單杆紀錄');
                    setTimeout(() => setToast(null), 2000);
                    setBreakPoints('');
                    setBreakVideoUrl('');
                    setBreakNote('');
                    await loadBreakData();
                  } catch (e: any) {
                    setToast(e?.message || '新增失敗');
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
                className="w-full px-4 py-2 rounded cue-button hover:brightness-95 text-white font-semibold"
              >
                新增
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="cue-surface rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">歷史最高單杆 Top 10</div>
              </div>
              {leaderHighest.length === 0 ? (
                <div className="text-sm cue-muted">暫無資料</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">會員</th>
                        <th className="py-2 px-2">分數</th>
                        <th className="py-2 px-2">日期</th>
                        <th className="py-2 px-2">影片</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderHighest.map((r: any) => (
                        <tr key={r.id} className="border-b cue-border">
                          <td className="py-2 px-2">{r.member?.name || '-'}</td>
                          <td className="py-2 px-2 font-semibold accent-yellow">{r.points}</td>
                          <td className="py-2 px-2 cue-muted">{r.recorded_at ? new Date(r.recorded_at).toLocaleDateString() : '-'}</td>
                          <td className="py-2 px-2">
                            {normalizeVideoHref(r.video_url) ? (
                              <a href={normalizeVideoHref(r.video_url) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                                影片連結
                              </a>
                            ) : (
                              <span className="cue-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="cue-surface rounded-lg p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div className="font-semibold">本月累計 Top 10</div>
                <input
                  type="month"
                  value={leaderMonth}
                  onChange={(e) => setLeaderMonth(e.target.value)}
                  className="px-3 py-2 rounded cue-input text-sm"
                />
              </div>
              {leaderMonthly.length === 0 ? (
                <div className="text-sm cue-muted">暫無資料</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">會員</th>
                        <th className="py-2 px-2">累計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderMonthly.map((r: any) => (
                        <tr key={r.member?.id || r.member_id} className="border-b cue-border">
                          <td className="py-2 px-2">{r.member?.name || '-'}</td>
                          <td className="py-2 px-2 font-semibold text-emerald-600">{r.totalPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="font-semibold mb-2">紀錄列表</div>
            {breaksLoading ? (
              <div className="text-sm cue-muted">載入中...</div>
            ) : breaks.length === 0 ? (
              <div className="text-sm cue-muted">暫無紀錄</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="cue-muted border-b cue-border">
                      <th className="py-2 px-2">日期</th>
                      <th className="py-2 px-2">會員</th>
                      <th className="py-2 px-2">分數</th>
                      <th className="py-2 px-2">影片</th>
                      <th className="py-2 px-2">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breaks.map((b: any) => (
                      <tr key={b.id} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">{b.recorded_at ? new Date(b.recorded_at).toLocaleDateString() : '-'}</td>
                        <td className="py-2 px-2">{b.member?.name || '-'}</td>
                        <td className="py-2 px-2 font-semibold accent-yellow">{b.points}</td>
                        <td className="py-2 px-2">
                          {normalizeVideoHref(b.video_url) ? (
                            <a href={normalizeVideoHref(b.video_url) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                              連結
                            </a>
                          ) : (
                            <span className="cue-muted">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 cue-muted">{b.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        ) : (
        <div className="glass rounded-xl p-4 md:p-6">
          <div className="text-xl font-bold mb-2">單杆紀錄</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )
        )}

        {activeTab === 'booking' && (
        bookingEnabled ? (
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b cue-border pb-2">預約管理</h2>
          {qrEnabled ? (
            <div className="cue-surface rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-semibold">進行中台鐘</div>
                <button
                  type="button"
                  className="text-sm accent-blue hover:underline"
                  onClick={async () => {
                    try {
                      setSessionsLoading(true);
                      const rows = await getActiveTableSessions(API_URL, operatorId).catch(() => []);
                      setActiveSessions(Array.isArray(rows) ? rows : []);
                    } finally {
                      setSessionsLoading(false);
                    }
                  }}
                >
                  {sessionsLoading ? '載入中...' : '重新整理'}
                </button>
              </div>
              {activeSessions.length === 0 ? (
                <div className="cue-muted text-sm">暫無進行中台鐘</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">球枱</th>
                        <th className="py-2 px-2">會員</th>
                        <th className="py-2 px-2">開始</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessions.map((s: any) => (
                        <tr key={s.id} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-2">{s.table?.name || '-'}</td>
                          <td className="py-2 px-2">{s.startedBy?.name || s.startedBy?.email || '-'}</td>
                          <td className="py-2 px-2 cue-muted whitespace-nowrap">{s.startAt ? new Date(s.startAt).toLocaleString() : '-'}</td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-xs"
                              onClick={async () => {
                                if (!window.confirm('確定要為此台落鐘並結算？')) return;
                                try {
                                  await endTableSessionAsOperator(API_URL, operatorId, s.id);
                                  setToast('已落鐘並結算');
                                  setTimeout(() => setToast(null), 2000);
                                  await loadData();
                                } catch (e: any) {
                                  setToast(e?.message || '落鐘失敗');
                                  setTimeout(() => setToast(null), 3000);
                                }
                              }}
                            >
                              落鐘
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
          <div className="cue-surface rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-semibold">手動預約 / 封鎖時段</div>
              <select
                value={manualMode}
                onChange={(e) => {
                  const v = String(e.target.value || 'BLOCK').toUpperCase();
                  setManualMode(v === 'MEMBER' ? 'MEMBER' : 'BLOCK');
                }}
                className="px-3 py-2 rounded cue-input text-sm"
              >
                <option value="BLOCK">封鎖時段（禁止網上預約）</option>
                <option value="MEMBER">手動預約（指定會員）</option>
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">球枱</label>
                <select
                  value={manualTableId}
                  onChange={(e) => setManualTableId(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                >
                  <option value="">選擇球枱</option>
                  {tables.filter((t: any) => t?.active !== false).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {manualMode === 'MEMBER' && (
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1 cue-muted">會員</label>
                  <select
                    value={manualMemberId}
                    onChange={(e) => setManualMemberId(e.target.value)}
                    className="w-full px-3 py-2 rounded cue-input"
                  >
                    <option value="">選擇會員</option>
                    {clubMembers.map((cm: any) => (
                      <option key={cm.member?.id || cm.id} value={cm.member?.id || ''}>
                        {cm.member?.name || '-'}{cm.member?.email ? ` (${cm.member.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-1">
                <label className="block text-sm mb-1 cue-muted">日期</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm mb-1 cue-muted">開始</label>
                <input
                  type="time"
                  value={manualStart}
                  onChange={(e) => setManualStart(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm mb-1 cue-muted">時數</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={manualHours}
                  onChange={(e) => setManualHours(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                  className="w-full px-3 py-2 rounded cue-input"
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <button
                  type="button"
                  disabled={manualCreating}
                  onClick={async () => {
                    try {
                      if (!operatorId) return;
                      if (!manualTableId) throw new Error('請先選擇球枱');
                      if (manualMode === 'MEMBER' && !manualMemberId) throw new Error('請先選擇會員');
                      if (!manualDate || !manualStart) throw new Error('請選擇日期/開始時間');

                      const [hh, mm] = String(manualStart).split(':').map((x) => parseInt(x, 10));
                      const s = new Date(String(manualDate));
                      s.setHours(hh || 0, mm || 0, 0, 0);
                      const h = Math.max(1, Number(manualHours) || 1);
                      const e = new Date(s.getTime() + h * 60 * 60 * 1000);
                      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || !(e > s)) throw new Error('時間格式不正確');

                      setManualCreating(true);
                      await createManualReservation(API_URL, operatorId, {
                        mode: manualMode,
                        tableId: manualTableId,
                        startAt: s.toISOString(),
                        endAt: e.toISOString(),
                        quantityHours: h,
                        ...(manualMode === 'MEMBER' ? { memberId: manualMemberId } : {}),
                      });
                      setToast(manualMode === 'BLOCK' ? '已封鎖該時段' : '已建立手動預約');
                      setTimeout(() => setToast(null), 2000);
                      await loadData();
                    } catch (e: any) {
                      setToast(e?.message || '建立失敗');
                      setTimeout(() => setToast(null), 3000);
                    } finally {
                      setManualCreating(false);
                    }
                  }}
                  className="w-full px-4 py-2 rounded cue-button hover:brightness-95 text-white font-semibold disabled:opacity-60"
                >
                  {manualCreating ? '處理中...' : (manualMode === 'BLOCK' ? '封鎖' : '建立')}
                </button>
              </div>
            </div>
            <div className="text-xs cue-muted mt-2">
              封鎖時段會直接佔用該球枱時段，網上預約會因衝突而無法提交。
            </div>
          </div>
          <div className="mt-6">
            <h3 className="font-semibold mb-2">待確認預約</h3>
            {pendingReservations.length === 0 ? (
              <div className="cue-muted">暫無待確認預約</div>
            ) : (
              <>
                <div className="sm:hidden space-y-2">
                  {pendingReservations.map((r: any) => (
                    <div key={r.id} className="cue-surface rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold break-words">{r.member?.name || r.member?.email || r.memberId}</div>
                          <div className="text-xs cue-muted mt-0.5">球枱：{r.table?.name || r.tableId}</div>
                          <div className="text-xs cue-muted mt-0.5">{new Date(r.startAt).toLocaleString()} - {new Date(r.endAt).toLocaleTimeString()}</div>
                          <div className="text-xs mt-1">方案：{r.pricingScheme?.title || '-'}</div>
                        </div>
                        <div className="flex-shrink-0 flex flex-col gap-2">
                          <button
                            onClick={async () => {
                              try { await confirmReservation(API_URL, operatorId, r.id); await loadData(); setToast('已確認'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                            }}
                            className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-sm"
                          >
                            確認
                          </button>
                          <button
                            onClick={async () => {
                              try { await cancelReservation(API_URL, operatorId, r.id); await loadData(); setToast('已取消'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                            }}
                            className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-3">會員</th>
                        <th className="py-2 px-3">球枱</th>
                        <th className="py-2 px-3">時間</th>
                        <th className="py-2 px-3">方案</th>
                        <th className="py-2 px-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReservations.map((r: any) => (
                        <tr key={r.id} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-3">{r.member?.name || r.member?.email || r.memberId}</td>
                          <td className="py-2 px-3">{r.table?.name || r.tableId}</td>
                          <td className="py-2 px-3 text-sm cue-muted">{new Date(r.startAt).toLocaleString()} - {new Date(r.endAt).toLocaleTimeString()}</td>
                          <td className="py-2 px-3 text-sm">{r.pricingScheme?.title || '-'}</td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                try { await confirmReservation(API_URL, operatorId, r.id); await loadData(); setToast('已確認'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                              }} className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-sm">確認</button>
                              <button onClick={async () => {
                                try { await cancelReservation(API_URL, operatorId, r.id); await loadData(); setToast('已取消'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                              }} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm">取消</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
          <div className="mt-6">
            <h3 className="font-semibold mb-2">全部預約</h3>
            <div className="grid gap-2 sm:flex sm:items-end sm:justify-between mb-3">
              <label className="grid gap-1">
                <div className="text-xs cue-muted">日期（可選）</div>
                <input
                  type="date"
                  value={allReservationsDate}
                  onChange={(e) => setAllReservationsDate(e.target.value)}
                  className="w-full sm:w-56 px-3 py-2 rounded cue-input text-sm"
                />
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cue-muted">
                  <input
                    type="checkbox"
                    checked={allReservationsShowCompleted}
                    onChange={(e) => setAllReservationsShowCompleted(e.target.checked)}
                  />
                  顯示已完成/已取消
                </label>
                {(allReservationsDate || allReservationsShowCompleted) ? (
                  <button
                    type="button"
                    onClick={() => { setAllReservationsDate(''); setAllReservationsShowCompleted(false); }}
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  >
                    清除
                  </button>
                ) : null}
              </div>
            </div>
            {filteredAllReservations.length === 0 ? (
              <div className="cue-muted">暫無預約</div>
            ) : (
              <>
                <div className="sm:hidden space-y-2">
                  {filteredAllReservations.slice(0, 100).map((r: any) => {
                    const status = String(r?.status || '').toUpperCase();
                    const e = new Date(String(r?.endAt));
                    const ended = Number.isFinite(e.getTime()) && e.getTime() < Date.now() - 60_000;
                    const tag = status === 'PENDING'
                      ? { label: '待確認', cls: 'bg-amber-900 text-white' }
                      : status === 'BLOCKED'
                        ? { label: '封鎖', cls: 'bg-slate-700 text-white' }
                        : status === 'CONFIRMED' && ended
                          ? { label: '已完成', cls: 'bg-emerald-900 text-white' }
                          : status === 'CONFIRMED'
                            ? { label: '已確認', cls: 'bg-blue-800 text-white' }
                            : status === 'CANCELLED'
                              ? { label: '已取消', cls: 'cue-surface-strong cue-muted' }
                              : { label: status || '—', cls: 'cue-surface-strong cue-muted' };
                    const canCancel = status !== 'CANCELLED';
                    return (
                      <div key={r.id} className="cue-surface rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${tag.cls}`}>{tag.label}</span>
                              <div className="font-semibold break-words">{r.member?.name || r.member?.email || r.memberId}</div>
                            </div>
                            <div className="text-xs cue-muted mt-1">球枱：{r.table?.name || r.tableId}</div>
                            <div className="text-xs cue-muted mt-0.5">{new Date(r.startAt).toLocaleString()} - {new Date(r.endAt).toLocaleTimeString()}</div>
                            <div className="text-xs mt-1">方案：{r.pricingScheme?.title || '-'}</div>
                          </div>
                          <button
                            type="button"
                            disabled={!canCancel}
                            className={`flex-shrink-0 px-3 py-1 rounded text-sm ${canCancel ? 'bg-red-700 hover:bg-red-600 text-white' : 'cue-surface-strong cue-muted'}`}
                            onClick={async () => {
                              if (!confirm('確定要刪除此預約（取消）嗎？')) return;
                              try { await cancelReservation(API_URL, operatorId, r.id); await loadData(); setToast('已取消'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                            }}
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredAllReservations.length > 100 && <div className="text-xs cue-muted mt-2">只顯示最近 100 筆</div>}
                </div>

                <div className="hidden sm:block overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-3">狀態</th>
                        <th className="py-2 px-3">會員</th>
                        <th className="py-2 px-3">球枱</th>
                        <th className="py-2 px-3">時間</th>
                        <th className="py-2 px-3">方案</th>
                        <th className="py-2 px-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAllReservations.slice(0, 100).map((r: any) => {
                        const status = String(r?.status || '').toUpperCase();
                        const e = new Date(String(r?.endAt));
                        const ended = Number.isFinite(e.getTime()) && e.getTime() < Date.now() - 60_000;
                        const tag = status === 'PENDING'
                          ? { label: '待確認', cls: 'bg-amber-900 text-white' }
                          : status === 'BLOCKED'
                            ? { label: '封鎖', cls: 'bg-slate-700 text-white' }
                            : status === 'CONFIRMED' && ended
                              ? { label: '已完成', cls: 'bg-emerald-900 text-white' }
                              : status === 'CONFIRMED'
                                ? { label: '已確認', cls: 'bg-blue-800 text-white' }
                                : status === 'CANCELLED'
                                  ? { label: '已取消', cls: 'cue-surface-strong cue-muted' }
                                  : { label: status || '—', cls: 'cue-surface-strong cue-muted' };
                        const canCancel = status !== 'CANCELLED';
                        return (
                          <tr key={r.id} className="border-b cue-border hover:brightness-95">
                            <td className="py-2 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${tag.cls}`}>{tag.label}</span>
                            </td>
                            <td className="py-2 px-3">{r.member?.name || r.member?.email || r.memberId}</td>
                            <td className="py-2 px-3">{r.table?.name || r.tableId}</td>
                            <td className="py-2 px-3 text-sm cue-muted">{new Date(r.startAt).toLocaleString()} - {new Date(r.endAt).toLocaleTimeString()}</td>
                            <td className="py-2 px-3 text-sm">{r.pricingScheme?.title || '-'}</td>
                            <td className="py-2 px-3">
                              <button
                                type="button"
                                disabled={!canCancel}
                                className={`px-3 py-1 rounded text-sm ${canCancel ? 'bg-red-700 hover:bg-red-600 text-white' : 'cue-surface-strong cue-muted'}`}
                                onClick={async () => {
                                  if (!confirm('確定要刪除此預約（取消）嗎？')) return;
                                  try { await cancelReservation(API_URL, operatorId, r.id); await loadData(); setToast('已取消'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                                }}
                              >
                                刪除
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredAllReservations.length > 100 && <div className="text-xs cue-muted mt-2">只顯示最近 100 筆</div>}
                </div>
              </>
            )}
          </div>
          <div className="mt-6 grid gap-6">
            <div>
              <h3 className="font-semibold mb-2">球枱</h3>
              <div className="flex gap-2 mb-3 flex-wrap">
                <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} className="flex-1 min-w-[180px] px-3 py-2 rounded cue-input" placeholder="球枱名稱" />
                <input value={newTableBasePrice} onChange={(e) => setNewTableBasePrice(e.target.value)} type="number" step="0.01" className="w-32 px-3 py-2 rounded cue-input" placeholder="正價/時" />
                <button onClick={async () => {
                  if (!newTableName.trim()) return;
                  await createTable(API_URL, operatorId, { name: newTableName.trim(), notes: newTableNotes.trim() || undefined, basePrice: newTableBasePrice.trim() || undefined });
                  setNewTableName(''); setNewTableNotes(''); setNewTableBasePrice('');
                  await loadData();
                }} className="px-3 py-2 rounded cue-button hover:brightness-95 text-white">新增</button>
              </div>
              <input value={newTableNotes} onChange={(e) => setNewTableNotes(e.target.value)} className="w-full px-3 py-2 rounded cue-input mb-3" placeholder="備註" />
              <div className="space-y-2">
                {tables.map(t => (
                  <div key={t.id} className="flex items-center gap-2 cue-surface p-2 rounded flex-wrap">
                    <input value={t.name} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))} className="flex-1 min-w-[160px] px-2 py-1 rounded cue-input" />
                    <input value={t.basePrice ?? ''} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, basePrice: e.target.value } : x))} type="number" step="0.01" className="w-28 px-2 py-1 rounded cue-input text-sm" placeholder="正價/時" />
                    {qrEnabled ? (
                      <div className="flex items-center gap-2">
                        {t.qrToken?.token ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="bg-white p-1 rounded">
                              <QRCodeSVG
                                id={`table-qr-svg-${t.id}`}
                                value={new URL(`${rawBase}/qr/table/${t.qrToken.token}`, window.location.origin).toString()}
                                size={48}
                                fgColor="#000000"
                                bgColor="#FFFFFF"
                                includeMargin
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <button
                                type="button"
                                className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                                onClick={() => {
                                  const url = new URL(`${rawBase}/qr/table/${t.qrToken.token}`, window.location.origin).toString();
                                  navigator.clipboard.writeText(url).then(() => {
                                    setToast('已複製球枱 QR 連結');
                                    setTimeout(() => setToast(null), 2000);
                                  });
                                }}
                              >
                                複製
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                                onClick={async () => {
                                  try {
                                    const el = document.getElementById(`table-qr-svg-${t.id}`) as any;
                                    if (!el) throw new Error('找不到 QR');
                                    const fn = `table-${safeFilePart(t.name)}-qr.svg`;
                                    downloadSvgElement(el, fn);
                                  } catch (e: any) {
                                    setToast(e?.message || '下載失敗');
                                    setTimeout(() => setToast(null), 3000);
                                  }
                                }}
                              >
                                下載SVG
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                                onClick={async () => {
                                  try {
                                    const el = document.getElementById(`table-qr-svg-${t.id}`) as any;
                                    if (!el) throw new Error('找不到 QR');
                                    const fn = `table-${safeFilePart(t.name)}-qr.png`;
                                    await downloadSvgAsPng(el, fn, t.name);
                                  } catch (e: any) {
                                    setToast(e?.message || '下載失敗');
                                    setTimeout(() => setToast(null), 3000);
                                  }
                                }}
                              >
                                下載PNG
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded cue-surface-strong hover:brightness-95 text-xs"
                                onClick={async () => {
                                  try {
                                    if (!window.confirm('確定要更換此球枱 QR？更換後舊 QR 將失效。')) return;
                                    const ans = window.prompt(`為避免誤按，請輸入球枱名稱以確認更換：\n${t.name}`);
                                    if (String(ans || '').trim() !== String(t.name || '').trim()) {
                                      setToast('已取消更換');
                                      setTimeout(() => setToast(null), 2000);
                                      return;
                                    }
                                    await rotateClubTableQr(API_URL, operatorId, t.id);
                                    setToast('已更換 QR');
                                    setTimeout(() => setToast(null), 2000);
                                    await loadData();
                                  } catch (e: any) {
                                    setToast(e?.message || '更換失敗');
                                    setTimeout(() => setToast(null), 3000);
                                  }
                                }}
                              >
                                更換
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs cue-muted">無 QR</div>
                        )}
                      </div>
                    ) : null}
                    <label className="text-sm flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!t.active}
                        onChange={async (e) => {
                          const nextActive = e.target.checked;
                          const prevActive = !!t.active;
                          setTables(prev => prev.map(x => x.id === t.id ? { ...x, active: nextActive } : x));
                          try {
                            const updated = await updateTable(API_URL, operatorId, t.id, { active: nextActive });
                            setTables(prev => prev.map(x => x.id === t.id ? updated : x));
                            setToast(nextActive ? '球枱已啟用' : '球枱已停用');
                            setTimeout(() => setToast(null), 2000);
                          } catch (err: any) {
                            setTables(prev => prev.map(x => x.id === t.id ? { ...x, active: prevActive } : x));
                            setToast(err?.message || '更新球枱狀態失敗');
                            setTimeout(() => setToast(null), 3000);
                          }
                        }}
                      />
                      啟用
                    </label>
                    <button onClick={async () => {
                      const cur = tables.find(x => x.id === t.id);
                      if (!cur) return;
                      await updateTable(API_URL, operatorId, t.id, { name: cur.name, active: cur.active, displayOrder: cur.displayOrder || 0, notes: cur.notes || null, basePrice: cur.basePrice ?? null });
                      await loadData();
                    }} className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm">儲存</button>
                    <button onClick={async () => {
                      if (!window.confirm('確定要刪除此球枱？（已有預約紀錄的球枱將無法刪除，請改用停用）')) return;
                      try {
                        await deleteTable(API_URL, operatorId, t.id);
                        setTables(prev => prev.filter(x => x.id !== t.id));
                        setToast('球枱已刪除');
                        setTimeout(() => setToast(null), 2000);
                      } catch (e: any) {
                        setToast(e.message || '刪除失敗');
                        setTimeout(() => setToast(null), 3000);
                      }
                    }} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm">刪除</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">收費方案</h3>
              <div className="grid gap-2 mb-3">
                <input value={newPricingTitle} onChange={(e) => setNewPricingTitle(e.target.value)} className="px-3 py-2 rounded cue-input" placeholder="方案標題" />
                <input value={newPricingDesc} onChange={(e) => setNewPricingDesc(e.target.value)} className="px-3 py-2 rounded cue-input" placeholder="方案說明" />
                <input value={newPricingPrice} onChange={(e) => setNewPricingPrice(e.target.value)} type="number" step="0.01" className="px-3 py-2 rounded cue-input" placeholder="價目（例如 180）" />
                <input value={newPricingMinHours} onChange={(e) => setNewPricingMinHours(e.target.value)} type="number" min={1} step={1} className="px-3 py-2 rounded cue-input" placeholder="最低購買時數（例如 2，可空）" />
                <div className="cue-surface rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">生效時間規則</div>
                    <button
                      onClick={() => setNewPricingRules(prev => [...prev, { daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '16:00', pricePerHour: null }])}
                      className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm"
                      type="button"
                    >
                      新增規則
                    </button>
                  </div>
                  {newPricingRules.length === 0 ? (
                    <div className="text-xs cue-muted">不設定規則＝任何時間都可用（若要限定時段，請新增規則）</div>
                  ) : (
                    <div className="grid gap-2">
                      {newPricingRules.map((r, idx) => (
                        <div key={idx} className="cue-surface rounded p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1">
                              {weekDays.map(d => {
                                const active = (r.daysOfWeek || []).includes(d.n);
                                return (
                                  <button
                                    key={d.n}
                                    type="button"
                                    onClick={() => setNewPricingRules(prev => prev.map((x, i) => i === idx ? toggleDayInRule(x, d.n) : x))}
                                    className={`px-2 py-1 rounded text-xs ${active ? 'bg-yellow-500 text-black' : 'cue-surface-strong cue-muted'}`}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={r.start || '09:00'}
                                onChange={(e) => setNewPricingRules(prev => prev.map((x, i) => i === idx ? { ...x, start: e.target.value } : x))}
                                className="px-2 py-1 rounded cue-input text-sm"
                              />
                              <span className="cue-muted text-sm">-</span>
                              <input
                                type="time"
                                value={r.end || '16:00'}
                                onChange={(e) => setNewPricingRules(prev => prev.map((x, i) => i === idx ? { ...x, end: e.target.value } : x))}
                                className="px-2 py-1 rounded cue-input text-sm"
                              />
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={r.pricePerHour ?? ''}
                              onChange={(e) => setNewPricingRules(prev => prev.map((x, i) => i === idx ? { ...x, pricePerHour: e.target.value === '' ? null : Number(e.target.value) } : x))}
                              className="w-32 px-2 py-1 rounded cue-input text-sm"
                              placeholder="$/小時(選填)"
                            />
                            <button
                              type="button"
                              onClick={() => setNewPricingRules(prev => prev.filter((_, i) => i !== idx))}
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                            >
                              刪除規則
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={async () => {
                  if (!newPricingTitle.trim()) return;
                  const minHours = newPricingMinHours.trim() === '' ? null : Math.max(1, parseInt(newPricingMinHours.trim(), 10) || 1);
                  const rulesJson = minHours == null ? newPricingRules : { minHours, rules: newPricingRules };
                  const row = await createPricingScheme(API_URL, operatorId, { title: newPricingTitle.trim(), description: newPricingDesc.trim() || undefined, rulesJson, price: newPricingPrice.trim() || undefined });
                  setPricing([...pricing, row]);
                  setNewPricingTitle(''); setNewPricingDesc(''); setNewPricingPrice(''); setNewPricingMinHours(''); setNewPricingRules([]);
                }} className="px-3 py-2 rounded cue-button hover:brightness-95 text-white">新增方案</button>
              </div>
              <div className="space-y-2">
                {pricing.map(p => (
                  <div key={p.id} className="cue-surface p-2 rounded">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <input value={p.title} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, title: e.target.value } : x))} className="flex-1 min-w-[160px] px-2 py-1 rounded cue-input" />
                      <input value={p.price ?? ''} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, price: e.target.value } : x))} type="number" step="0.01" className="w-28 px-2 py-1 rounded cue-input text-sm" placeholder="價目" />
                      <input
                        value={getMinHours(p.rulesJson) ?? ''}
                        onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, rulesJson: withMinHours(x.rulesJson, e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1)) } : x))}
                        type="number"
                        min={1}
                        step={1}
                        className="w-28 px-2 py-1 rounded cue-input text-sm"
                        placeholder="最低時數"
                      />
                      <select value={p.tableId || ''} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, tableId: e.target.value || null } : x))} className="px-2 py-1 rounded cue-input text-sm">
                        <option value="">全部球枱</option>
                        {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <label className="text-sm flex items-center gap-1">
                        <input type="checkbox" checked={p.active} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, active: e.target.checked } : x))} />
                        啟用
                      </label>
                      <button
                        onClick={async () => {
                          const cur = pricing.find(x => x.id === p.id);
                          if (!cur) return;
                          if (!operatorId) return;
                          setPricingSavingId(p.id);
                          try {
                            const updated = await updatePricingScheme(API_URL, operatorId, p.id, { title: cur.title, description: cur.description || null, rulesJson: cur.rulesJson, active: cur.active, price: cur.price === '' ? null : cur.price, tableId: cur.tableId || null });
                            setPricing(prev => prev.map(x => x.id === p.id ? updated : x));
                            setToast('方案已儲存');
                            setTimeout(() => setToast(null), 2000);
                            await loadData();
                          } catch (e: any) {
                            setToast(e?.message || '儲存失敗');
                            setTimeout(() => setToast(null), 3000);
                          } finally {
                            setPricingSavingId('');
                          }
                        }}
                        disabled={pricingSavingId === p.id}
                        className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {pricingSavingId === p.id ? '儲存中...' : '儲存'}
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm('確定要刪除此方案？（已有預約紀錄的方案將無法刪除，請改用停用）')) return;
                        try {
                          await deletePricingScheme(API_URL, operatorId, p.id);
                          setPricing(prev => prev.filter(x => x.id !== p.id));
                          setToast('方案已刪除');
                          setTimeout(() => setToast(null), 2000);
                        } catch (e: any) {
                          setToast(e.message || '刪除失敗');
                          setTimeout(() => setToast(null), 3000);
                        }
                      }} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm">刪除</button>
                    </div>
                    <div className="cue-surface rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">生效時間規則</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, rulesJson: withRules(x.rulesJson, normalizeRules(x.rulesJson)) } : x))}
                            className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm"
                          >
                            重新整理
                          </button>
                          <button
                            type="button"
                            onClick={() => setPricing(prev => prev.map(x => {
                              if (x.id !== p.id) return x;
                              const curRules = normalizeRules(x.rulesJson);
                              return { ...x, rulesJson: withRules(x.rulesJson, [...curRules, { daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '16:00', pricePerHour: null }]) };
                            }))}
                            className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm"
                          >
                            新增規則
                          </button>
                        </div>
                      </div>
                      {normalizeRules(p.rulesJson).length === 0 ? (
                        <div className="text-xs cue-muted">不設定規則＝任何時間都可用（若要限定時段，請新增規則）</div>
                      ) : (
                        <div className="grid gap-2">
                          {normalizeRules(p.rulesJson).map((r, idx) => (
                            <div key={idx} className="cue-surface rounded p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1">
                                  {weekDays.map(d => {
                                    const active = (r.daysOfWeek || []).includes(d.n);
                                    return (
                                      <button
                                        key={d.n}
                                        type="button"
                                        onClick={() => setPricing(prev => prev.map(x => {
                                          if (x.id !== p.id) return x;
                                          const rules = normalizeRules(x.rulesJson);
                                          rules[idx] = toggleDayInRule(rules[idx], d.n);
                                          return { ...x, rulesJson: withRules(x.rulesJson, rules) };
                                        }))}
                                        className={`px-2 py-1 rounded text-xs ${active ? 'bg-yellow-500 text-black' : 'cue-surface-strong cue-muted'}`}
                                      >
                                        {d.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={r.start || '09:00'}
                                    onChange={(e) => setPricing(prev => prev.map(x => {
                                      if (x.id !== p.id) return x;
                                      const rules = normalizeRules(x.rulesJson);
                                      rules[idx] = { ...rules[idx], start: e.target.value };
                                      return { ...x, rulesJson: withRules(x.rulesJson, rules) };
                                    }))}
                                    className="px-2 py-1 rounded cue-input text-sm"
                                  />
                                  <span className="cue-muted text-sm">-</span>
                                  <input
                                    type="time"
                                    value={r.end || '16:00'}
                                    onChange={(e) => setPricing(prev => prev.map(x => {
                                      if (x.id !== p.id) return x;
                                      const rules = normalizeRules(x.rulesJson);
                                      rules[idx] = { ...rules[idx], end: e.target.value };
                                      return { ...x, rulesJson: withRules(x.rulesJson, rules) };
                                    }))}
                                    className="px-2 py-1 rounded cue-input text-sm"
                                  />
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={r.pricePerHour ?? ''}
                                  onChange={(e) => setPricing(prev => prev.map(x => {
                                    if (x.id !== p.id) return x;
                                    const rules = normalizeRules(x.rulesJson);
                                    rules[idx] = { ...rules[idx], pricePerHour: e.target.value === '' ? null : Number(e.target.value) };
                                    return { ...x, rulesJson: withRules(x.rulesJson, rules) };
                                  }))}
                                  className="w-32 px-2 py-1 rounded cue-input text-sm"
                                  placeholder="$/小時(選填)"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPricing(prev => prev.map(x => {
                                    if (x.id !== p.id) return x;
                                    const rules = normalizeRules(x.rulesJson);
                                    const next = rules.filter((_, i) => i !== idx);
                                    return { ...x, rulesJson: withRules(x.rulesJson, next) };
                                  }))}
                                  className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                                >
                                  刪除規則
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">預約管理</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )
        )}

        {activeTab === 'content' && (
        <>
        {liveEnabled ? (
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b cue-border pb-2">比賽直播通告</h2>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">日期</label>
              <input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">時間</label>
              <input type="time" value={liveTime} onChange={(e) => setLiveTime(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">標題</label>
              <input value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：週末友誼賽直播" />
            </div>
            <div className="md:col-span-5">
              <label className="block text-sm mb-1 cue-muted">直播連結</label>
              <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="https://..." />
              <div className="text-xs cue-muted mt-1">發佈後會同時以「場館訊息」推送，會員可直接點擊連結觀看。</div>
            </div>
            <div className="md:col-span-1 flex items-end">
              <button
                type="button"
                disabled={liveCreating}
                className="w-full px-4 py-2 rounded brand-button text-black transition-colors disabled:opacity-60"
                onClick={async () => {
                  try {
                    if (!operatorId) return;
                    const t = liveTitle.trim();
                    const u = liveUrl.trim();
                    if (!t) throw new Error('請輸入標題');
                    if (!u) throw new Error('請輸入直播連結');
                    if (!liveDate || !liveTime) throw new Error('請選擇日期及時間');
                    const d = new Date(`${liveDate}T${liveTime}:00`);
                    if (!Number.isFinite(d.getTime())) throw new Error('日期/時間格式不正確');
                    setLiveCreating(true);
                    if (editingLiveId) {
                      await updateLiveAnnouncement(API_URL, operatorId, editingLiveId, { title: t, startsAt: d.toISOString(), liveUrl: u });
                      setToast('已更新直播通告');
                    } else {
                      await createLiveAnnouncement(API_URL, operatorId, { title: t, startsAt: d.toISOString(), liveUrl: u });
                      setToast('已發佈直播通告');
                    }
                    setTimeout(() => setToast(null), 2000);
                    setLiveTitle('');
                    setLiveUrl('');
                    setEditingLiveId('');
                    await loadData();
                  } catch (e: any) {
                    setToast(e?.message || '發佈失敗');
                    setTimeout(() => setToast(null), 3000);
                  } finally {
                    setLiveCreating(false);
                  }
                }}
              >
                {liveCreating ? '處理中…' : (editingLiveId ? '更新' : '發佈')}
              </button>
            </div>
          </div>

          <div className="mt-4">
            {liveAnnouncements.length === 0 ? (
              <div className="text-sm cue-muted">暫無直播通告</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="cue-muted border-b cue-border">
                      <th className="py-2 px-2">日期時間</th>
                      <th className="py-2 px-2">標題</th>
                      <th className="py-2 px-2">連結</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveAnnouncements.slice(0, 50).map((it: any) => (
                      <tr key={it.id} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">{it.startsAt ? new Date(it.startsAt).toLocaleString() : '-'}</td>
                        <td className="py-2 px-2 font-semibold">{it.title}</td>
                        <td className="py-2 px-2">
                          {normalizeVideoHref(it.liveUrl) ? (
                            <a href={normalizeVideoHref(it.liveUrl) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                              直播連結
                            </a>
                          ) : (
                            <span className="cue-muted">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                              onClick={() => {
                                setEditingLiveId(String(it.id));
                                setLiveTitle(String(it.title || ''));
                                setLiveUrl(String(it.liveUrl || ''));
                                const d = it.startsAt ? new Date(String(it.startsAt)) : null;
                                if (d && Number.isFinite(d.getTime())) {
                                  setLiveDate(d.toISOString().slice(0, 10));
                                  setLiveTime(d.toTimeString().slice(0, 5));
                                }
                              }}
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                              onClick={async () => {
                                if (!confirm('確定要刪除此直播通告？')) return;
                                try {
                                  await deleteLiveAnnouncement(API_URL, operatorId, String(it.id));
                                  await loadData();
                                  if (editingLiveId && String(it.id) === editingLiveId) {
                                    setEditingLiveId('');
                                    setLiveTitle('');
                                    setLiveUrl('');
                                  }
                                  setToast('已刪除');
                                  setTimeout(() => setToast(null), 2000);
                                } catch (e: any) {
                                  setToast(e?.message || '刪除失敗');
                                  setTimeout(() => setToast(null), 3000);
                                }
                              }}
                            >
                              刪除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {liveAnnouncements.length > 50 && <div className="text-xs cue-muted mt-2">只顯示最近 50 筆</div>}
              </div>
            )}
          </div>
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">比賽直播通告</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )}

        {clubMessagesEnabled ? (
        <div className="glass rounded-xl p-6">
           <h2 className="text-xl font-bold mb-4 border-b cue-border pb-2">發送場館訊息</h2>
           <div className="space-y-4">
              <div>
                 <label className="block text-sm mb-1 cue-muted">標題</label>
                 <input 
                   value={msgTitle}
                   onChange={(e) => setMsgTitle(e.target.value)}
                   className="w-full px-3 py-2 rounded cue-input"
                   placeholder="訊息標題"
                 />
              </div>
              <div>
                 <label className="block text-sm mb-1 cue-muted">內容</label>
                 <textarea 
                   value={msgContent}
                   onChange={(e) => setMsgContent(e.target.value)}
                   className="w-full px-3 py-2 rounded cue-input h-24"
                   placeholder="輸入要發送給所有會員的訊息..."
                 />
              </div>
              <button
                onClick={async () => {
                  if (!msgContent.trim()) {
                    setToast('請填寫內容');
                    setTimeout(() => setToast(null), 2000);
                    return;
                  }
                  try {
                    if (!operatorId) return;
                    if (editingClubMsgId) {
                      await updateClubMessageManage(API_URL, operatorId, editingClubMsgId, { title: msgTitle.trim() || null, content: msgContent });
                      setToast('已更新訊息');
                    } else {
                      if (!msgTitle.trim()) {
                        setToast('請填寫標題');
                        setTimeout(() => setToast(null), 2000);
                        return;
                      }
                      await broadcastClubMessage(API_URL, operatorId, msgTitle, msgContent);
                      setToast('訊息已發送');
                    }
                    setMsgTitle('');
                    setMsgContent('');
                    setEditingClubMsgId('');
                    setTimeout(() => setToast(null), 3000);
                    const rows = await getClubMessagesManage(API_URL, operatorId, 80).catch(() => []);
                    setClubMsgs(Array.isArray(rows) ? rows : []);
                  } catch (err: any) {
                    setToast(err.message || '操作失敗');
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
                className="px-4 py-2 rounded brand-button text-black transition-colors"
              >
                {editingClubMsgId ? '更新訊息' : '發送訊息'}
              </button>
           </div>
           <div className="mt-4">
             {clubMsgsLoading ? (
               <div className="text-sm cue-muted">載入中...</div>
             ) : clubMsgs.length === 0 ? (
               <div className="text-sm cue-muted">暫無已發送訊息</div>
             ) : (
               <div className="overflow-x-auto -mx-2 px-2">
                 <table className="w-full text-left border-collapse text-sm">
                   <thead>
                     <tr className="cue-muted border-b cue-border">
                       <th className="py-2 px-2">日期時間</th>
                       <th className="py-2 px-2">標題</th>
                       <th className="py-2 px-2">內容</th>
                       <th className="py-2 px-2">操作</th>
                     </tr>
                   </thead>
                   <tbody>
                     {clubMsgs.slice(0, 80).map((m: any) => (
                       <tr key={String(m?.id || '')} className="border-b cue-border hover:brightness-95">
                         <td className="py-2 px-2 cue-muted whitespace-nowrap">{m?.createdAt ? new Date(m.createdAt).toLocaleString() : '-'}</td>
                         <td className="py-2 px-2 font-semibold">{String(m?.title || '-')}</td>
                         <td className="py-2 px-2 cue-muted">
                           <div className="max-w-[420px] truncate">{String(m?.content || '')}</div>
                         </td>
                         <td className="py-2 px-2">
                           <div className="flex gap-2">
                             <button
                               type="button"
                               className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                               onClick={() => {
                                 setEditingClubMsgId(String(m.id));
                                 setMsgTitle(String(m?.title || ''));
                                 setMsgContent(String(m?.content || ''));
                               }}
                             >
                               編輯
                             </button>
                             <button
                               type="button"
                               className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                               onClick={async () => {
                                 if (!operatorId) return;
                                 if (!confirm('確定要刪除此訊息？')) return;
                                 try {
                                   await deleteClubMessageManage(API_URL, operatorId, String(m.id));
                                   const rows = await getClubMessagesManage(API_URL, operatorId, 80).catch(() => []);
                                   setClubMsgs(Array.isArray(rows) ? rows : []);
                                   if (editingClubMsgId && String(m.id) === editingClubMsgId) {
                                     setEditingClubMsgId('');
                                     setMsgTitle('');
                                     setMsgContent('');
                                   }
                                   setToast('已刪除');
                                   setTimeout(() => setToast(null), 2000);
                                 } catch (e: any) {
                                   setToast(e?.message || '刪除失敗');
                                   setTimeout(() => setToast(null), 3000);
                                 }
                               }}
                             >
                               刪除
                             </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {clubMsgs.length > 80 && <div className="text-xs cue-muted mt-2">只顯示最近 80 筆</div>}
               </div>
             )}
           </div>
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">發送場館訊息</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )}

        {tournamentsEnabled ? (
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b cue-border pb-2">比賽報名（管理）</h2>

          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-3">
              <label className="block text-sm mb-1 cue-muted">標題</label>
              <input value={tournamentTitle} onChange={(e) => setTournamentTitle(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：週末公開賽" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm mb-1 cue-muted">上限</label>
              <input value={tournamentCapacity} onChange={(e) => setTournamentCapacity(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="32" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">截止日期</label>
              <input type="date" value={tournamentDeadline} onChange={(e) => setTournamentDeadline(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1 cue-muted">比賽時間（可選）</label>
              <input type="datetime-local" value={tournamentStartsAt} onChange={(e) => setTournamentStartsAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm mb-1 cue-muted">比賽詳情</label>
              <textarea value={tournamentDesc} onChange={(e) => setTournamentDesc(e.target.value)} className="w-full px-3 py-2 rounded cue-input h-24" placeholder="輸入比賽詳情..." />
            </div>
            <div className="md:col-span-6">
              <label className="block text-sm mb-1 cue-muted">報名指引 / 流程（會員確認彈窗顯示）</label>
              <textarea value={tournamentGuide} onChange={(e) => setTournamentGuide(e.target.value)} className="w-full px-3 py-2 rounded cue-input h-24" placeholder="例如：已提交報名，待場館確認；確認後請於 X 日前到場繳費..."/>
            </div>
            <div className="md:col-span-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={tournamentCreating}
                className={`px-4 py-2 rounded font-semibold ${tournamentCreating ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
                onClick={async () => {
                  try {
                    if (!operatorId) return;
                    const title = String(tournamentTitle || '').trim();
                    if (!title) throw new Error('請輸入標題');
                    const cap = Number(tournamentCapacity || 32);
                    if (!Number.isFinite(cap) || cap <= 0) throw new Error('上限不正確');
                    const deadlineIso = tournamentDeadline ? new Date(`${tournamentDeadline}T23:59:59`).toISOString() : null;
                    const startsIso = tournamentStartsAt ? new Date(tournamentStartsAt).toISOString() : null;
                    if (tournamentStartsAt && !Number.isFinite(new Date(tournamentStartsAt).getTime())) throw new Error('比賽時間格式不正確');
                    if (tournamentDeadline && !Number.isFinite(new Date(`${tournamentDeadline}T23:59:59`).getTime())) throw new Error('截止日期格式不正確');
                    setTournamentCreating(true);
                    if (tournamentSelectedId) {
                      await updateClubTournament(API_URL, operatorId, tournamentSelectedId, { title, description: tournamentDesc, signupGuide: tournamentGuide, capacity: Math.floor(cap), startsAt: startsIso, signupClosesAt: deadlineIso });
                      setToast('已更新比賽');
                    } else {
                      await createClubTournament(API_URL, operatorId, { title, description: tournamentDesc, signupGuide: tournamentGuide, capacity: Math.floor(cap), startsAt: startsIso, signupClosesAt: deadlineIso });
                      setToast('已建立比賽（草稿）');
                      setTournamentTitle('');
                      setTournamentDesc('');
                      setTournamentGuide('');
                      setTournamentCapacity('32');
                      setTournamentDeadline('');
                      setTournamentStartsAt('');
                    }
                    setTimeout(() => setToast(null), 2000);
                    const rows = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
                    setTournaments(Array.isArray(rows) ? rows : []);
                  } catch (e: any) {
                    setToast(e?.message || '操作失敗');
                    setTimeout(() => setToast(null), 3000);
                  } finally {
                    setTournamentCreating(false);
                  }
                }}
              >
                {tournamentSelectedId ? '更新' : '建立'}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
                onClick={() => {
                  setTournamentSelectedId('');
                  setTournamentTitle('');
                  setTournamentDesc('');
                  setTournamentGuide('');
                  setTournamentCapacity('32');
                  setTournamentDeadline('');
                  setTournamentStartsAt('');
                  setTournamentSignups([]);
                  setTournamentConfirmed([]);
                }}
              >
                清除
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded cue-surface hover:brightness-95 font-semibold"
                onClick={async () => {
                  if (!operatorId) return;
                  setTournamentsLoading(true);
                  try {
                    const rows = await getMyClubTournaments(API_URL, operatorId);
                    setTournaments(Array.isArray(rows) ? rows : []);
                  } finally {
                    setTournamentsLoading(false);
                  }
                }}
              >
                重新整理
              </button>
            </div>
          </div>

          <div className="mt-5">
            {tournamentsLoading ? (
              <div className="text-sm cue-muted">載入中...</div>
            ) : tournaments.length === 0 ? (
              <div className="text-sm cue-muted">暫無比賽</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="cue-muted border-b cue-border">
                      <th className="py-2 px-2">狀態</th>
                      <th className="py-2 px-2">標題</th>
                      <th className="py-2 px-2">上限</th>
                      <th className="py-2 px-2">截止</th>
                      <th className="py-2 px-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournaments.slice(0, 200).map((t: any) => {
                      const id = String(t?.id || '');
                      const status = String(t?.status || '').toUpperCase();
                      const capN = Number(t?.capacity ?? 0);
                      const confirmedN = Number(t?.confirmedCount ?? 0);
                      const cap = capN > 0 ? `${confirmedN}/${capN}` : '-';
                      const closes = t?.signupClosesAt ? new Date(t.signupClosesAt).toLocaleDateString() : '-';
                      const isSelected = tournamentSelectedId && id === tournamentSelectedId;
                      return (
                        <tr
                          key={id}
                          className={`border-b cue-border hover:brightness-95 ${isSelected ? 'bg-white/5' : ''}`}
                        >
                          <td className="py-2 px-2 whitespace-nowrap">{status || '-'}</td>
                          <td className="py-2 px-2 font-semibold">{String(t?.title || '')}</td>
                          <td className="py-2 px-2">{cap}</td>
                          <td className="py-2 px-2">{closes}</td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                                onClick={() => {
                                  setTournamentSelectedId(id);
                                  setTournamentTitle(String(t?.title || ''));
                                  setTournamentDesc(String(t?.description || ''));
                                  setTournamentGuide(String(t?.signupGuide || ''));
                                  setTournamentCapacity(String(t?.capacity ?? 32));
                                  setTournamentDeadline(t?.signupClosesAt ? String(t.signupClosesAt).slice(0, 10) : '');
                                  if (t?.startsAt) {
                                    const d = new Date(String(t.startsAt));
                                    if (Number.isFinite(d.getTime())) {
                                      const y = d.getFullYear();
                                      const m = String(d.getMonth() + 1).padStart(2, '0');
                                      const dd = String(d.getDate()).padStart(2, '0');
                                      const hh = String(d.getHours()).padStart(2, '0');
                                      const mm = String(d.getMinutes()).padStart(2, '0');
                                      setTournamentStartsAt(`${y}-${m}-${dd}T${hh}:${mm}`);
                                    } else {
                                      setTournamentStartsAt('');
                                    }
                                  } else {
                                    setTournamentStartsAt('');
                                  }
                                }}
                              >
                                {isSelected ? '已選擇' : '選擇'}
                              </button>
                              <button
                                type="button"
                                disabled={status === 'PUBLISHED'}
                                className={`px-3 py-1 rounded text-sm font-semibold ${status === 'PUBLISHED' ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                                onClick={async () => {
                                  if (!confirm('確定要上架此比賽？')) return;
                                  try {
                                    await publishClubTournament(API_URL, operatorId, id);
                                    const rows = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
                                    setTournaments(Array.isArray(rows) ? rows : []);
                                    setToast('已上架');
                                    setTimeout(() => setToast(null), 2000);
                                  } catch (e: any) {
                                    setToast(e?.message || '上架失敗');
                                    setTimeout(() => setToast(null), 3000);
                                  }
                                }}
                              >
                                上架
                              </button>
                              <button
                                type="button"
                                disabled={status === 'CLOSED'}
                                className={`px-3 py-1 rounded text-sm font-semibold ${status === 'CLOSED' ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                                onClick={async () => {
                                  if (!confirm('確定要關閉此比賽？')) return;
                                  try {
                                    await closeClubTournament(API_URL, operatorId, id);
                                    const rows = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
                                    setTournaments(Array.isArray(rows) ? rows : []);
                                    setToast('已關閉');
                                    setTimeout(() => setToast(null), 2000);
                                  } catch (e: any) {
                                    setToast(e?.message || '關閉失敗');
                                    setTimeout(() => setToast(null), 3000);
                                  }
                                }}
                              >
                                關閉
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {tournamentSelectedId && (
            <div className="mt-6 cue-surface-strong rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">待確認報名</div>
                <div className="text-xs cue-muted">{tournamentSignupsLoading ? '讀取中…' : `${tournamentSignups.length} 筆`}</div>
              </div>
              {tournamentSignupsLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : tournamentSignups.length === 0 ? (
                <div className="text-sm cue-muted">暫無待確認報名</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">會員</th>
                        <th className="py-2 px-2">報名時間</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentSignups.slice(0, 200).map((s: any) => {
                        const sid = String(s?.id || '');
                        const m = s?.member || {};
                        const who = [String(m?.member_code || '無').trim(), String(m?.name || '').trim()].filter(Boolean).join(' ');
                        return (
                          <tr key={sid} className="border-b cue-border hover:brightness-95">
                            <td className="py-2 px-2 font-semibold">{who || '-'}</td>
                            <td className="py-2 px-2 cue-muted whitespace-nowrap">{s?.createdAt ? new Date(s.createdAt).toLocaleString() : '-'}</td>
                            <td className="py-2 px-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="px-3 py-1 rounded cue-button text-sm font-semibold"
                                  onClick={async () => {
                                    if (!confirm('確定要確認此報名？')) return;
                                    try {
                                      await confirmTournamentSignup(API_URL, operatorId, tournamentSelectedId, sid);
                                      const [pendingRows, confirmedRows] = await Promise.all([
                                        getTournamentSignups(API_URL, operatorId, tournamentSelectedId, 'PENDING').catch(() => []),
                                        getTournamentSignups(API_URL, operatorId, tournamentSelectedId, 'CONFIRMED').catch(() => []),
                                      ]);
                                      setTournamentSignups(Array.isArray(pendingRows) ? pendingRows : []);
                                      setTournamentConfirmed(Array.isArray(confirmedRows) ? confirmedRows : []);
                                      const list = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
                                      setTournaments(Array.isArray(list) ? list : []);
                                      setToast('已確認');
                                      setTimeout(() => setToast(null), 2000);
                                    } catch (e: any) {
                                      setToast(e?.message || '確認失敗');
                                      setTimeout(() => setToast(null), 3000);
                                    }
                                  }}
                                >
                                  確認
                                </button>
                                <button
                                  type="button"
                                  className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
                                  onClick={async () => {
                                    if (!confirm('確定要取消此報名？')) return;
                                    try {
                                      await cancelTournamentSignup(API_URL, operatorId, tournamentSelectedId, sid);
                                      const [pendingRows, confirmedRows] = await Promise.all([
                                        getTournamentSignups(API_URL, operatorId, tournamentSelectedId, 'PENDING').catch(() => []),
                                        getTournamentSignups(API_URL, operatorId, tournamentSelectedId, 'CONFIRMED').catch(() => []),
                                      ]);
                                      setTournamentSignups(Array.isArray(pendingRows) ? pendingRows : []);
                                      setTournamentConfirmed(Array.isArray(confirmedRows) ? confirmedRows : []);
                                      const list = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
                                      setTournaments(Array.isArray(list) ? list : []);
                                      setToast('已取消');
                                      setTimeout(() => setToast(null), 2000);
                                    } catch (e: any) {
                                      setToast(e?.message || '取消失敗');
                                      setTimeout(() => setToast(null), 3000);
                                    }
                                  }}
                                >
                                  取消
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tournamentSelectedId && (
            <div className="mt-4 cue-surface-strong rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">已成功報名（已確認）</div>
                <div className="text-xs cue-muted">{tournamentConfirmedLoading ? '讀取中…' : `${tournamentConfirmed.length} / ${Number(tournamentCapacity || 0) || 32}`}</div>
              </div>
              {tournamentConfirmedLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : tournamentConfirmed.length === 0 ? (
                <div className="text-sm cue-muted">暫無已確認報名</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">會員</th>
                        <th className="py-2 px-2">確認時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentConfirmed.slice(0, 200).map((s: any) => {
                        const sid = String(s?.id || '');
                        const m = s?.member || {};
                        const who = [String(m?.member_code || '無').trim(), String(m?.name || '').trim()].filter(Boolean).join(' ');
                        return (
                          <tr key={sid} className="border-b cue-border hover:brightness-95">
                            <td className="py-2 px-2 font-semibold">{who || '-'}</td>
                            <td className="py-2 px-2 cue-muted whitespace-nowrap">{s?.updatedAt ? new Date(s.updatedAt).toLocaleString() : (s?.createdAt ? new Date(s.createdAt).toLocaleString() : '-')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">比賽報名（管理）</div>
          <div className="cue-muted text-sm">此功能未開通（可於系統功能上架設定中開啟）</div>
        </div>
        )}
        </>
        )}

        {activeTab === 'members' && (
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
              <div className="text-xl font-bold">會員管理</div>
              <button
                type="button"
                className="px-4 py-2 rounded cue-surface hover:brightness-95 font-semibold"
                onClick={async () => {
                  if (!operatorId) return;
                  try {
                    const rows = await getClubMembers(API_URL, operatorId).catch(() => []);
                    setClubMembers(Array.isArray(rows) ? rows : []);
                    setToast('已更新會員列表');
                    setTimeout(() => setToast(null), 2000);
                  } catch (e: any) {
                    setToast(e?.message || '更新失敗');
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
              >
                重新整理
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">搜尋（名稱 / 電話 / Email / 會員編號）</label>
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                  placeholder="輸入關鍵字..."
                />
              </div>
              <div className="md:col-span-1">
                <div className="text-sm cue-muted mb-1">會員數</div>
                <div className="font-semibold">{Array.isArray(clubMembers) ? clubMembers.length : 0}</div>
              </div>
            </div>

            {(() => {
              const kw = memberSearch.trim().toLowerCase();
              const rows = Array.isArray(clubMembers) ? clubMembers : [];
              const filtered = !kw ? rows : rows.filter((r: any) => {
                const m = r?.member || {};
                const hay = [
                  String(m?.member_code || ''),
                  String(m?.name || ''),
                  String(m?.phone || m?.phone_e164 || ''),
                  String(m?.email || ''),
                ].join(' ').toLowerCase();
                return hay.includes(kw);
              });
              return (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">會員編號</th>
                        <th className="py-2 px-2">名稱</th>
                        <th className="py-2 px-2">電話</th>
                        <th className="py-2 px-2">Email</th>
                        <th className="py-2 px-2">評分</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 500).map((r: any) => {
                        const id = String(r?.id || '');
                        const m = r?.member || {};
                        const code = String(m?.member_code || '').trim() || '—';
                        const name = String(m?.name || '').trim() || '—';
                        const phone = String(m?.phone || m?.phone_e164 || '').trim() || '—';
                        const email = String(m?.email || '').trim() || '—';
                        const rating = Number(r?.rating ?? 0);
                        const draft = memberRatingDraft[id];
                        const inputValue = draft != null ? draft : String(Number.isFinite(rating) ? rating : 0);
                        return (
                          <tr key={id} className="border-b cue-border hover:brightness-95">
                            <td className="py-2 px-2 font-semibold whitespace-nowrap">{code}</td>
                            <td className="py-2 px-2">{name}</td>
                            <td className="py-2 px-2 cue-muted whitespace-nowrap">{phone}</td>
                            <td className="py-2 px-2 cue-muted">{email}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center gap-2">
                                <input
                                  value={inputValue}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setMemberRatingDraft((prev) => ({ ...(prev || {}), [id]: v }));
                                  }}
                                  className="w-24 px-3 py-1.5 rounded cue-input"
                                  inputMode="numeric"
                                />
                                <button
                                  type="button"
                                  disabled={memberSavingId === id}
                                  className={`px-3 py-1.5 rounded text-sm font-semibold ${memberSavingId === id ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                                  onClick={async () => {
                                    if (!operatorId) return;
                                    const raw = (memberRatingDraft[id] ?? String(rating)).trim();
                                    const n = Number(raw);
                                    if (!Number.isFinite(n)) {
                                      setToast('評分必須為整數（可負數）');
                                      setTimeout(() => setToast(null), 2500);
                                      return;
                                    }
                                    const v = Math.trunc(n);
                                    setMemberSavingId(id);
                                    try {
                                      await updateClubMemberRating(API_URL, operatorId, id, v);
                                      setClubMembers((prev) => (Array.isArray(prev) ? prev.map((x: any) => (String(x?.id || '') === id ? { ...x, rating: v } : x)) : prev));
                                      setMemberRatingDraft((prev) => {
                                        const next = { ...(prev || {}) };
                                        delete next[id];
                                        return next;
                                      });
                                      setToast('已更新評分');
                                      setTimeout(() => setToast(null), 2000);
                                    } catch (e: any) {
                                      setToast(e?.message || '更新失敗');
                                      setTimeout(() => setToast(null), 3000);
                                    } finally {
                                      setMemberSavingId('');
                                    }
                                  }}
                                >
                                  儲存
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <button
                                type="button"
                                disabled={memberRemovingId === id}
                                className={`px-3 py-1.5 rounded text-sm font-semibold ${memberRemovingId === id ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                                onClick={async () => {
                                  if (!operatorId) return;
                                  if (!confirm('確定要移除該會員在本場館之會員資格？')) return;
                                  if (!confirm('再次確認：移除後該會員將不再屬於本場館會員')) return;
                                  setMemberRemovingId(id);
                                  try {
                                    await removeClubMember(API_URL, operatorId, id);
                                    setClubMembers((prev) => (Array.isArray(prev) ? prev.filter((x: any) => String(x?.id || '') !== id) : prev));
                                    setToast('已移除會員資格');
                                    setTimeout(() => setToast(null), 2000);
                                  } catch (e: any) {
                                    setToast(e?.message || '移除失敗');
                                    setTimeout(() => setToast(null), 3000);
                                  } finally {
                                    setMemberRemovingId('');
                                  }
                                }}
                              >
                                移除
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length > 500 && <div className="text-xs cue-muted mt-2">只顯示前 500 筆</div>}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'home' && (
        <>
        {/* Edit Profile */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">帳戶設定</h3>
          <div className="grid md:grid-cols-2 gap-3">
             <div className="md:col-span-2 cue-muted mb-2">
                當前登入帳號：{operatorName} ({session.email})
             </div>
          </div>
          
          <div className="mt-4 border-t cue-border pt-4">
            <h4 className="text-md font-semibold mb-2">重設密碼</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1 cue-muted">新密碼</label>
                <input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">確認新密碼</label>
                <input type="password" value={resetPwd2} onChange={(e) => setResetPwd2(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
            </div>
            <button
              onClick={async () => {
                if (!resetPwd || resetPwd !== resetPwd2) {
                    setToast('密碼不一致');
                    setTimeout(() => setToast(null), 2000);
                    return;
                }
                try {
                   if (!operatorId) return;
                   // Update backend password
                   await updateMemberSelf(API_URL, operatorId, { password: resetPwd });
                   
                   // Also update local legacy storage if needed (for consistency with MemberProfile)
                   try {
                      const enc = new TextEncoder().encode(resetPwd);
                      const digest = await crypto.subtle.digest('SHA-256', enc);
                      const arr = Array.from(new Uint8Array(digest));
                      const h = arr.map(b => b.toString(16).padStart(2, '0')).join('');
                      const storeRaw = localStorage.getItem('memberPasswords');
                      const store = storeRaw ? JSON.parse(storeRaw) : {};
                      const key = String(session.email || session.id);
                      store[key] = h;
                      localStorage.setItem('memberPasswords', JSON.stringify(store));
                   } catch {}

                   setToast('密碼已重設');
                   setResetPwd('');
                   setResetPwd2('');
                   setTimeout(() => setToast(null), 3000);
                } catch (err: any) {
                   setToast(err.message || '重設失敗');
                   setTimeout(() => setToast(null), 3000);
                }
              }}
              className="mt-3 px-4 py-2 rounded cue-button hover:brightness-95 transition-colors"
            >
              重設密碼
            </button>
          </div>
        </div>
        </>
        )}

        {activeTab === 'scoring' && (
        scoringEnabled ? (
        <>
          <div className="glass rounded-xl p-6">
            <div className="flex justify-between items-center mb-4 border-b cue-border pb-2">
              <h2 className="text-xl font-bold">進行中的房間</h2>
              <span className="text-sm cue-muted">
                {activeRooms.length} / 5
              </span>
            </div>
            
            <p className="cue-muted mb-6 text-sm">
              您最多可以同時建立 5 個進行中的房間。建立後請使用下方連結進行設置或分享。
            </p>
  
            <button
              onClick={handleCreateRoom}
              disabled={creating || activeRooms.length >= 5}
              className={`w-full py-3 rounded-lg font-bold mb-8 transition-colors ${
                creating || activeRooms.length >= 5
                  ? 'cue-surface-strong cursor-not-allowed cue-muted'
                  : 'brand-button hover:brightness-95 text-black'
              }`}
            >
              {creating ? '建立中...' : activeRooms.length >= 5 ? '已達房間上限' : '建立新房間'}
            </button>
  
            {activeRooms.length > 0 ? (
              <div className="space-y-4">
                {activeRooms.map((room) => (
                  <div key={room.id} className="cue-surface p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="cue-surface-strong px-3 py-1 rounded font-mono accent-yellow font-bold">
                        {room.code}
                      </div>
                      <div className="text-lg font-semibold">{room.name}</div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => copyLink(`/room/${room.code}/setup`)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
                      >
                        Copy Setup
                      </button>
                      <button
                        onClick={() => copyLink(`/room/${room.code}/live`)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
                      >
                        Copy Live
                      </button>
                      <button
                        onClick={() => copyLink(`/room/${room.code}/overlay`)}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
                      >
                        Copy Overlay
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        disabled={deletingId === room.id}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          deletingId === room.id
                            ? 'cue-surface-strong cursor-not-allowed cue-muted'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                      >
                        {deletingId === room.id ? '...' : '刪除'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center cue-muted py-8 cue-surface rounded-lg border border-dashed cue-border">
                目前沒有進行中的房間
              </div>
            )}
          </div>

          <details className="glass rounded-xl p-6">
            <summary className="cursor-pointer text-xl font-bold">歷史房間記錄（可展開）</summary>
            <div className="mt-4 flex justify-end">
              <button 
                type="button"
                onClick={loadData}
                className="text-sm cue-surface-strong hover:brightness-95 px-3 py-1 rounded transition-colors"
              >
                重新整理
              </button>
            </div>

            {loading && matches.length === 0 ? (
              <div className="text-center py-8">載入中...</div>
            ) : matches.length === 0 ? (
              <div className="text-center text-gray-500 py-8">尚無記錄</div>
            ) : (
              <>
                <div className="sm:hidden mt-3 space-y-2">
                  {matches.map((m) => {
                    const dateStr = m.startedAt ? new Date(m.startedAt).toLocaleString() : '-';
                    const duration = m.durationSeconds
                      ? `${Math.floor(m.durationSeconds / 60)}分${m.durationSeconds % 60}秒`
                      : '-';
                    const resultCls = m.result === 'In Progress' ? 'bg-yellow-900 text-yellow-200' : 'bg-green-900 text-green-200';
                    return (
                      <div key={m.id} className="cue-surface rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono cue-surface-strong px-2 py-0.5 rounded cue-muted">{m.matchCode || '-'}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${resultCls}`}>{m.result}</span>
                            </div>
                            <div className="font-semibold break-words mt-1">{m.matchName}</div>
                            {m.framesRequired > 1 && (
                              <div className="text-xs cue-muted mt-0.5">{m.framesRequired} 局決</div>
                            )}
                            <div className="text-xs cue-muted mt-1">{dateStr}</div>
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{m.p0.name}</span>
                                {m.p0.handicap !== 0 && (
                                  <span className="text-xs cue-surface-strong px-1.5 rounded cue-muted">{m.p0.handicap > 0 ? '+' : ''}{m.p0.handicap}</span>
                                )}
                                {m.p0.maxBreak > 0 && (
                                  <span className="text-xs text-yellow-400 border border-yellow-400/30 px-1.5 rounded">單杆: {m.p0.maxBreak}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{m.p1.name}</span>
                                {m.p1.handicap !== 0 && (
                                  <span className="text-xs cue-surface-strong px-1.5 rounded cue-muted">{m.p1.handicap > 0 ? '+' : ''}{m.p1.handicap}</span>
                                )}
                                {m.p1.maxBreak > 0 && (
                                  <span className="text-xs text-yellow-400 border border-yellow-400/30 px-1.5 rounded">單杆: {m.p1.maxBreak}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="font-extrabold text-lg">{m.p0.score} - {m.p1.score}</div>
                            <div className="text-xs cue-muted mt-0.5">{duration}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden sm:block overflow-x-auto mt-3">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="cue-muted border-b cue-border">
                      <tr>
                        <th className="py-3 px-4">日期</th>
                        <th className="py-3 px-4">房間/比賽代碼</th>
                        <th className="py-3 px-4">比賽名稱</th>
                        <th className="py-3 px-4">球手資料</th>
                        <th className="py-3 px-4 text-center">比分</th>
                        <th className="py-3 px-4">結果</th>
                        <th className="py-3 px-4">用時</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {matches.map((m) => {
                        const dateStr = m.startedAt ? new Date(m.startedAt).toLocaleString() : '-';
                        const duration = m.durationSeconds 
                          ? `${Math.floor(m.durationSeconds / 60)}分${m.durationSeconds % 60}秒` 
                          : '-';
                        return (
                          <tr key={m.id} className="hover:brightness-95 transition-colors">
                            <td className="py-3 px-4 align-top">{dateStr}</td>
                            <td className="py-3 px-4 align-top">
                              <span className="font-mono cue-surface-strong px-2 py-0.5 rounded cue-muted">
                                {m.matchCode || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-4 align-top">
                              <div className="font-medium">{m.matchName}</div>
                              {m.framesRequired > 1 && (
                                <div className="text-xs text-gray-500 mt-0.5">{m.framesRequired} 局決</div>
                              )}
                            </td>
                            <td className="py-3 px-4 align-top">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{m.p0.name}</span>
                                  {m.p0.handicap !== 0 && (
                                    <span className="text-xs cue-surface-strong px-1.5 rounded cue-muted">
                                      {m.p0.handicap > 0 ? '+' : ''}{m.p0.handicap}
                                    </span>
                                  )}
                                  {m.p0.maxBreak > 0 && (
                                    <span className="text-xs text-yellow-400 border border-yellow-400/30 px-1.5 rounded">
                                      單杆: {m.p0.maxBreak}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{m.p1.name}</span>
                                  {m.p1.handicap !== 0 && (
                                    <span className="text-xs cue-surface-strong px-1.5 rounded cue-muted">
                                      {m.p1.handicap > 0 ? '+' : ''}{m.p1.handicap}
                                    </span>
                                  )}
                                  {m.p1.maxBreak > 0 && (
                                    <span className="text-xs text-yellow-400 border border-yellow-400/30 px-1.5 rounded">
                                      單杆: {m.p1.maxBreak}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-lg align-top">
                              {m.p0.score} - {m.p1.score}
                            </td>
                            <td className="py-3 px-4 align-top">
                              <span className={`px-2 py-1 rounded text-xs ${
                                m.result === 'In Progress' 
                                  ? 'bg-yellow-900 text-yellow-200' 
                                  : 'bg-green-900 text-green-200'
                              }`}>
                                {m.result}
                              </span>
                            </td>
                            <td className="py-3 px-4 align-top text-gray-400">
                              {duration}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </details>
        </>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">進行中的房間</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )
        )}
      </div>
    </div>
  );
};

export default VenueDashboard;
