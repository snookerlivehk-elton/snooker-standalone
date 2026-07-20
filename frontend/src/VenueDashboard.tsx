import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from './config';
import { updateMemberSelf, getClubProfile, updateClubProfile, getClubMembers, getMyTables, createTable, updateTable, deleteTable, getMyPricingSchemes, createPricingScheme, updatePricingScheme, deletePricingScheme, getPendingReservations, confirmReservation, cancelReservation, getClubReservations, createManualReservation, rotateClubTableQr, getActiveTableSessions, endTableSessionAsOperator, getMember, getMyClubFeatureAccess } from './lib/api';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { useFeatureEnabled } from './lib/features';
import Tabs from './components/Tabs';
import HelpGuide from './components/HelpGuide';
import VenueLiveModule from './venue/modules/VenueLiveModule';
import VenueClubMessagesModule from './venue/modules/VenueClubMessagesModule';
import VenueHighbreakModule from './venue/modules/VenueHighbreakModule';
import VenueTournamentsModule from './venue/modules/VenueTournamentsModule';
import VenueMembersModule from './venue/modules/VenueMembersModule';
import VenuePointsModule from './venue/modules/VenuePointsModule';

type VenueDashboardTab = 'home' | 'booking' | 'qr' | 'points' | 'highbreak' | 'content' | 'members';

type VenueDashboardContentSection = 'live' | 'club_messages' | 'tournaments';

type VenueDashboardProps = {
  forcedTab?: VenueDashboardTab;
  forcedSection?: VenueDashboardContentSection;
  standaloneTitle?: string;
  standaloneDescription?: string;
  standaloneBackTo?: string;
};

type PricingRule = {
  daysOfWeek?: number[];
  start?: string;
  end?: string;
  pricePerHour?: number | null;
};

const VenueDashboard: React.FC<VenueDashboardProps> = ({ forcedTab, forcedSection, standaloneTitle, standaloneDescription, standaloneBackTo }) => {
  const navigate = useNavigate();
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [venueAccessExpiresAt, setVenueAccessExpiresAt] = useState<string | null>(null);
  const [venueAccessDaysLeft, setVenueAccessDaysLeft] = useState<number | null>(null);
  const [clubProfile, setClubProfile] = useState<any>({});
  const [facilitiesDraft, setFacilitiesDraft] = useState('');
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [_msgTitle, _setMsgTitle] = useState('');
  const [_msgContent, _setMsgContent] = useState('');
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

  const [clubFeatureAccess, setClubFeatureAccess] = useState<Record<string, { effectiveEnabled: boolean }>>({});
  const [clubFeatureAccessLoaded, setClubFeatureAccessLoaded] = useState(false);

  const operatorId = session.id;
  const operatorName = session.name || session.email;
  const isOperator = session.role === 'ADMIN' || session.role === 'OPERATOR';

  const { enabled: bookingEnabled } = useFeatureEnabled(API_URL, 'booking');
  const { enabled: liveEnabled } = useFeatureEnabled(API_URL, 'live');
  const { enabled: clubMessagesEnabled } = useFeatureEnabled(API_URL, 'club_messages');
  const { enabled: highbreakEnabled } = useFeatureEnabled(API_URL, 'highbreak');
  const { enabled: pointsGlobalEnabled } = useFeatureEnabled(API_URL, 'points');
  const { enabled: qrEnabled } = useFeatureEnabled(API_URL, 'qr_session');
  const { enabled: tournamentsEnabled } = useFeatureEnabled(API_URL, 'tournaments');
  const pointsEnabled = pointsGlobalEnabled && Boolean(clubFeatureAccess.points?.effectiveEnabled);
  const pointsTabVisible = pointsGlobalEnabled && (!clubFeatureAccessLoaded || pointsEnabled);

  const [activeTab, setActiveTab] = useState<VenueDashboardTab>(forcedTab || 'home');
  const standaloneMode = !!forcedTab;

  const buildDashboardTabPath = useCallback((tab: VenueDashboardTab) => {
    const sp = new URLSearchParams();
    sp.set('tab', tab);
    return `/venue/dashboard?${sp.toString()}`;
  }, []);

  const resolveTab = useCallback((): VenueDashboardTab => {
    if (forcedTab) return forcedTab;
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      if (t === 'home' || t === 'booking' || t === 'qr' || t === 'points' || t === 'highbreak' || t === 'content' || t === 'members') return t;
      return (localStorage.getItem('venueDashboardTab') as any) || 'home';
    } catch {
      return 'home';
    }
  }, [forcedTab]);

  const updateTab = useCallback((t: VenueDashboardTab) => {
    if (forcedTab && t !== forcedTab) {
      navigate(buildDashboardTabPath(t), { replace: true });
      return;
    }
    setActiveTab(t);
    if (forcedTab) return;
    try {
      localStorage.setItem('venueDashboardTab', t);
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [buildDashboardTabPath, forcedTab, navigate]);

  const rawBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
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
  }, [clubProfile?.facilities]);

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
      const [clubProfileRes, clubMembersRes, tablesRes, pricingRes, pendingRes, allRes, featureAccessRes, sessionsRes] = await Promise.all([
        getClubProfile(API_URL, operatorId).catch(() => ({})),
        getClubMembers(API_URL, operatorId).catch(() => []),
        getMyTables(API_URL, operatorId).catch(() => []),
        getMyPricingSchemes(API_URL, operatorId).catch(() => []),
        getPendingReservations(API_URL, operatorId).catch(() => []),
        getClubReservations(API_URL, operatorId).catch(() => []),
        getMyClubFeatureAccess(API_URL, operatorId).catch(() => ({ features: {} })),
        qrEnabled ? getActiveTableSessions(API_URL, operatorId).catch(() => []) : Promise.resolve([]),
      ]);
      setClubProfile(clubProfileRes || {});
      setClubMembers(clubMembersRes || []);
      setTables(tablesRes || []);
      setPricing(pricingRes || []);
      setPendingReservations(pendingRes || []);
      setAllReservations(allRes || []);
      setClubFeatureAccess(((featureAccessRes as any)?.features && typeof (featureAccessRes as any).features === 'object') ? (featureAccessRes as any).features : {});
      setClubFeatureAccessLoaded(true);
      setActiveSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
    } catch (err: any) {
      setError(err.message || '無法載入資料');
      setClubFeatureAccessLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [operatorId, qrEnabled]);

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
  }, [operatorId, isOperator, navigate, loadData, session?.role]);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, [resolveTab]);

  useEffect(() => {
    const contentVisible = clubMessagesEnabled || liveEnabled || tournamentsEnabled;
    if (activeTab === 'booking' && !bookingEnabled) return updateTab('home');
    if (activeTab === 'qr' && !qrEnabled) return updateTab('home');
    if (activeTab === 'points' && clubFeatureAccessLoaded && !pointsEnabled) return updateTab('home');
    if (activeTab === 'highbreak' && !highbreakEnabled) return updateTab('home');
    if (activeTab === 'content' && !contentVisible) return updateTab('home');
  }, [activeTab, bookingEnabled, qrEnabled, pointsEnabled, clubFeatureAccessLoaded, highbreakEnabled, clubMessagesEnabled, liveEnabled, tournamentsEnabled, updateTab]);

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
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words min-w-0">
              {standaloneTitle || 'Cue Aim System - 場館管理後台'} <span className="text-sm font-normal accent-yellow ml-2">v2.1 Club</span>
            </h1>
            {standaloneDescription ? (
              <div className="text-sm cue-muted mt-1">{standaloneDescription}</div>
            ) : null}
          </div>
          <div className="sm:ml-auto flex flex-wrap gap-2">
            {standaloneMode ? (
              <button
                type="button"
                onClick={() => navigate(standaloneBackTo || buildDashboardTabPath(forcedTab || 'home'))}
                className="px-4 py-2 rounded-lg cue-surface-strong hover:brightness-95 transition-colors w-full sm:w-auto"
              >
                返回後台
              </button>
            ) : null}
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

        {!standaloneMode && (
          <div className="glass rounded-xl p-3 sm:p-4">
            <Tabs
              items={[
                { key: 'home', label: '主頁編輯' },
                ...(bookingEnabled ? [{ key: 'booking', label: '預約/球枱' }] : []),
                ...(qrEnabled ? [{ key: 'qr', label: '掃碼起鐘' }] : []),
                ...(pointsTabVisible ? [{ key: 'points', label: '消費積分' }] : []),
                ...(highbreakEnabled ? [{ key: 'highbreak', label: '單杆' }] : []),
                ...((clubMessagesEnabled || liveEnabled || tournamentsEnabled) ? [{ key: 'content', label: '內容管理' }] : []),
                { key: 'members', label: '會員管理' },
              ]}
              activeKey={activeTab}
              onChange={(k) => updateTab(k as any)}
            />
          </div>
        )}

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
          <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
            <h2 className="text-xl font-bold">場館資料管理</h2>
            <HelpGuide
              title="主頁編輯：場館資料管理"
              intro="設定場館公開頁顯示資料、首頁公開設定及場館聯絡資訊，並可在下方預覽。"
              steps={[
                '填寫或修改場館資料（名稱、簡介、電話、Email、地址、Google Map URL）。',
                '如需顯示於首頁「場館列表」，請勾選公開設定中的「公開顯示於首頁場館列表」；其餘選項可控制是否公開單杆數據、比賽入口及直播訊息。',
                '上載 LOGO 或以 URL 設定 LOGO。',
                '上載輪播相片：可一次選多張（最多 12 張），並可「設為封面 / 刪除」。',
                '在「設施」以每行一項輸入（最多 24 項）。',
                '在「政策」輸入多行文字（支援換行）。',
                '完成後按頁面底部「儲存場館資料」。',
              ]}
              tips={[
                '首頁場館列表、首頁龍虎榜與場館公開頁是否顯示，會同時受場館公開設定及 Super Admin 首頁設定影響。',
                'LOGO 建議正方形圖片；輪播相片建議 16:9，系統會自動縮放/壓縮。',
                '封面是輪播第一張，未設定封面時會取你新加入的第一張相片。',
                'Google Map URL 留空時，公開頁會用「地址」自動生成搜尋連結。',
              ]}
              faq={[
                { q: '點解上載後圖片好似變咗質素？', a: '系統會自動縮放與壓縮（方便手機載入），屬正常現象。' },
                { q: '點解公開頁未即時更新？', a: '請先按「儲存場館資料」，再刷新公開頁（或等數秒讓快取更新）。' },
              ]}
            />
          </div>
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
              <label className="block text-sm mb-1 cue-muted">公開設定（主頁 / 公開頁）</label>
              <div className="cue-surface-strong rounded-lg p-3 space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={clubProfile.publicEnabled === true}
                    onChange={(e) => setClubProfile({ ...clubProfile, publicEnabled: e.target.checked })}
                  />
                  <span>公開顯示於首頁「場館列表」</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`flex items-center gap-2 text-sm ${clubProfile.publicEnabled === true ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      disabled={clubProfile.publicEnabled !== true}
                      checked={clubProfile.publicShowHighbreak !== false}
                      onChange={(e) => setClubProfile({ ...clubProfile, publicShowHighbreak: e.target.checked })}
                    />
                    <span>公開單杆數據</span>
                  </label>
                  <label className={`flex items-center gap-2 text-sm ${clubProfile.publicEnabled === true ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      disabled={clubProfile.publicEnabled !== true}
                      checked={clubProfile.publicShowTournaments !== false}
                      onChange={(e) => setClubProfile({ ...clubProfile, publicShowTournaments: e.target.checked })}
                    />
                    <span>公開比賽入口</span>
                  </label>
                  <label className={`flex items-center gap-2 text-sm ${clubProfile.publicEnabled === true ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      disabled={clubProfile.publicEnabled !== true}
                      checked={clubProfile.publicShowLive !== false}
                      onChange={(e) => setClubProfile({ ...clubProfile, publicShowLive: e.target.checked })}
                    />
                    <span>公開直播訊息</span>
                  </label>
                </div>
              </div>
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
                          <div className="text-xs cue-muted mt-1">地方：{region} 分區：{district}</div>
                          <div className="text-xs cue-muted mt-0.5">加入：{joined}</div>
                        </div>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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
            <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
              <div className="text-xl font-bold">球枱 QR</div>
              <HelpGuide
                title="掃碼起鐘：球枱 QR"
                intro="管理每張球枱的 QR，供會員掃碼開台計時。"
                steps={[
                  '先到「預約/球枱」新增球枱，系統會為球枱生成 QR。',
                  '在此頁可查看每張球枱的 QR，並可複製連結或下載 SVG/PNG。',
                  '如需更換 QR（避免舊 QR 被誤用），請到球枱管理區按「更換」。',
                ]}
                tips={['建議把 QR 貼到對應球枱，並定期檢查是否貼錯。']}
              />
            </div>
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
        <VenuePointsModule
          operatorId={String(operatorId || '')}
          enabled={pointsEnabled}
          accessLoaded={clubFeatureAccessLoaded}
        />
        )}

        {activeTab === 'highbreak' && (
        <VenueHighbreakModule
          operatorId={String(operatorId || '')}
          enabled={highbreakEnabled}
        />
        )}

        {activeTab === 'booking' && (
        bookingEnabled ? (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
            <h2 className="text-xl font-bold">預約管理</h2>
            <HelpGuide
              title="預約/球枱：預約管理"
              intro="管理進行中台鐘、手動預約/封鎖時段、待確認預約、全部預約。"
              steps={[
                '「進行中台鐘」可查看現正進行的掃碼起鐘；需要結算可按「落鐘」。',
                '「手動預約 / 封鎖時段」可新增封鎖時段或為指定會員建立預約。',
                '「待確認預約」可一鍵確認或取消。',
                '「全部預約」可按日期查看全部預約記錄。',
              ]}
              tips={[
                '落鐘會即時結算，操作前請先確認球枱及會員資料。',
                '封鎖時段會禁止網上預約，用於包場、維修或活動。',
              ]}
            />
          </div>
          {qrEnabled ? (
            <div className="cue-surface rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-semibold">進行中台鐘</div>
                <div className="flex items-center gap-2">
                  <HelpGuide
                    title="進行中台鐘"
                    intro="查看正在計時的球枱，並可為指定球枱落鐘結算。"
                    steps={[
                      '按「重新整理」取得最新進行中台鐘列表。',
                      '如需結算，按該行的「落鐘」。',
                      '確認提示後會結束計時並結算。',
                    ]}
                    tips={['落鐘屬即時操作，建議先確認球枱/會員無誤。']}
                  />
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
              <div className="flex items-center gap-2">
                <HelpGuide
                  title="手動預約 / 封鎖時段"
                  intro="用於包場/維修等封鎖時段，或為指定會員建立手動預約。"
                  steps={[
                    '選擇模式：封鎖時段 或 手動預約（指定會員）。',
                    '選擇球枱、日期、開始時間及時數。',
                    '手動預約模式需選擇會員；封鎖時段則不需要。',
                    '按「建立」完成新增。',
                  ]}
                  tips={[
                    '封鎖時段會禁止網上預約；適合活動、維修、包場。',
                    '如建立失敗，請檢查球枱是否已停用或時間是否衝突。',
                  ]}
                />
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
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="font-semibold">待確認預約</h3>
              <HelpGuide
                title="待確認預約"
                intro="處理會員提交的預約申請（確認或取消）。"
                steps={[
                  '查看列表內的會員、球枱、時間及方案。',
                  '按「確認」即核准預約；按「取消」即拒絕預約。',
                ]}
                tips={['如需要改時間/改球枱，建議先取消原預約，再用「手動預約」重新建立。']}
              />
            </div>
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
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="font-semibold">全部預約</h3>
              <HelpGuide
                title="全部預約"
                intro="按日期查看全部預約記錄，並可選擇顯示已完成/已取消。"
                steps={[
                  '選擇日期可縮窄查詢範圍（可留空）。',
                  '勾選「顯示已完成/已取消」可包含歷史狀態。',
                  '按「清除」可重置篩選。',
                ]}
                tips={['手機版可用列表方式快速瀏覽；桌面版以表格顯示更多欄位。']}
              />
            </div>
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
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-semibold">球枱</h3>
                <HelpGuide
                  title="球枱管理"
                  intro="新增/編輯球枱、設定正價、啟用/停用、管理球枱 QR。"
                  steps={[
                    '在上方輸入球枱名稱（可選：正價/時、備註）後按「新增」。',
                    '在列表可直接修改球枱名稱/正價，按「儲存」寫入後端。',
                    '用「啟用」開關控制是否可被網上預約（停用後會隱藏/不可預約）。',
                    '如有掃碼起鐘，會顯示 QR：可「複製連結 / 下載SVG / 下載PNG / 更換」。',
                    '如需移除球枱，按「刪除」（已有預約紀錄的球枱可能無法刪除，建議改用停用）。',
                  ]}
                  tips={[
                    '更換 QR 會令舊 QR 失效，避免張貼錯誤 QR。',
                    '手機版列表可能需要上下滑動；桌面版可一次看到更多按鈕。',
                  ]}
                />
              </div>
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
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-semibold">收費方案</h3>
                <HelpGuide
                  title="收費方案"
                  intro="建立不同收費/時段方案，並可套用到預約或球枱。"
                  steps={[
                    '在「方案標題/說明/價目」輸入基本資料。',
                    '如需要限制生效時段，按「新增規則」加入星期/時間/每小時價。',
                    '按「新增方案」建立；建立後可在列表內編輯內容並按「儲存」。',
                    '如要停用某方案，可關閉「啟用」或直接刪除（視乎系統限制）。',
                  ]}
                  tips={[
                    '建議先建立「正價」方案，再按需要新增時段優惠（例如平日早場）。',
                    '若某方案已被預約引用，刪除可能會受限制；可改用停用。',
                  ]}
                />
              </div>
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
        <VenueLiveModule
          operatorId={String(operatorId || '')}
          enabled={liveEnabled}
          className={forcedSection === 'live' ? 'ring-1 ring-[rgba(255,214,10,0.35)]' : ''}
        />
        <VenueClubMessagesModule
          operatorId={String(operatorId || '')}
          enabled={clubMessagesEnabled}
          className={forcedSection === 'club_messages' ? 'ring-1 ring-[rgba(255,214,10,0.35)]' : ''}
        />
        <VenueTournamentsModule
          operatorId={String(operatorId || '')}
          enabled={tournamentsEnabled}
          className={forcedSection === 'tournaments' ? 'ring-1 ring-[rgba(255,214,10,0.35)]' : ''}
        />
        </>
        )}

        {activeTab === 'members' && (
          <VenueMembersModule operatorId={String(operatorId || '')} />
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

      </div>
    </div>
  );
};

export default VenueDashboard;
