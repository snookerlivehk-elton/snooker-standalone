import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL, SOCKET_URL } from './config';
import { createOperatorRoom, getOperatorMatches, getOperatorActiveRooms, updateMemberSelf, deleteOperatorRoom, getClubProfile, updateClubProfile, getClubMembers, broadcastClubMessage, createLiveAnnouncement, getLiveAnnouncements, deleteLiveAnnouncement, getMyTables, createTable, updateTable, deleteTable, getMyPricingSchemes, createPricingScheme, updatePricingScheme, deletePricingScheme, getPendingReservations, confirmReservation, cancelReservation, getClubReservations, createManualReservation, createClubBreak, getClubBreaks, getClubLeaderboardHighest, getClubLeaderboardMonthly, getClubPointsConfig, updateClubPointsConfig, getClubPointsBalances, getClubPointsLedger, adjustClubMemberPoints, rotateClubTableQr, getActiveTableSessions, endTableSessionAsOperator } from './lib/api';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import TimeFeeCalculator from './components/TimeFeeCalculator';
import { useFeatureEnabled } from './lib/features';

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
  const [matches, setMatches] = useState<any[]>([]);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [clubProfile, setClubProfile] = useState<any>({});
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDate, setLiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [liveTime, setLiveTime] = useState(() => `${String(new Date().getHours()).padStart(2, '0')}:00`);
  const [liveUrl, setLiveUrl] = useState('');
  const [liveCreating, setLiveCreating] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableNotes, setNewTableNotes] = useState('');
  const [newTableBasePrice, setNewTableBasePrice] = useState('');
  const [pricing, setPricing] = useState<any[]>([]);
  const [newPricingTitle, setNewPricingTitle] = useState('');
  const [newPricingDesc, setNewPricingDesc] = useState('');
  const [newPricingPrice, setNewPricingPrice] = useState('');
  const [newPricingMinHours, setNewPricingMinHours] = useState('');
  const [newPricingRules, setNewPricingRules] = useState<PricingRule[]>([]);
  const [pendingReservations, setPendingReservations] = useState<any[]>([]);
  const [allReservations, setAllReservations] = useState<any[]>([]);
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

  const [pointsConfig, setPointsConfig] = useState<any>(null);
  const [pointsBalances, setPointsBalances] = useState<any[]>([]);
  const [pointsLedger, setPointsLedger] = useState<any[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsSaving, setPointsSaving] = useState(false);
  const [pointsCurrency, setPointsCurrency] = useState('HKD');
  const [pointsPerCurrency, setPointsPerCurrency] = useState('1');
  const [pointsRoundingMinutes, setPointsRoundingMinutes] = useState('15');
  const [pointsMinBillableMinutes, setPointsMinBillableMinutes] = useState('0');
  const [pointsAdjustMemberId, setPointsAdjustMemberId] = useState('');
  const [pointsAdjustDelta, setPointsAdjustDelta] = useState('');
  const [pointsAdjustReason, setPointsAdjustReason] = useState('');

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
      setToast(err?.message || '載入單杆資料失敗');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBreaksLoading(false);
    }
  }, [operatorId, clubProfile?.id, breakFilterMonth, breakFilterMember, leaderMonth]);

  const loadPointsData = useCallback(async () => {
    if (!operatorId || !isOperator) return;
    if (!pointsEnabled) return;
    setPointsLoading(true);
    try {
      const [cfg, balances, ledger] = await Promise.all([
        getClubPointsConfig(API_URL, operatorId),
        getClubPointsBalances(API_URL, operatorId),
        getClubPointsLedger(API_URL, operatorId, { limit: 50 }),
      ]);
      setPointsConfig(cfg);
      setPointsBalances(Array.isArray(balances) ? balances : []);
      setPointsLedger(Array.isArray(ledger) ? ledger : []);
      setPointsCurrency(String(cfg?.currencyCode || 'HKD'));
      setPointsPerCurrency(String(cfg?.pointsPerCurrency ?? '1'));
      setPointsRoundingMinutes(String(cfg?.roundingMinutes ?? 15));
      setPointsMinBillableMinutes(String(cfg?.minBillableMinutes ?? 0));
      if (!pointsAdjustMemberId && Array.isArray(balances) && balances[0]?.memberId) setPointsAdjustMemberId(String(balances[0].memberId));
    } catch (err: any) {
      setToast(err?.message || '載入積分資料失敗');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPointsLoading(false);
    }
  }, [operatorId, isOperator, pointsEnabled, pointsAdjustMemberId]);

  useEffect(() => {
    if (!operatorId || !isOperator) {
      navigate('/venue/login');
      return;
    }

    loadData();
  }, [operatorId, isOperator, navigate, loadData]);

  useEffect(() => {
    if (!operatorId || !isOperator) return;
    if (!clubProfile?.id) return;
    loadBreakData();
  }, [operatorId, isOperator, clubProfile?.id, loadBreakData]);

  useEffect(() => {
    if (!operatorId || !isOperator) return;
    if (!pointsEnabled) return;
    loadPointsData();
  }, [operatorId, isOperator, pointsEnabled, loadPointsData]);

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
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Cue Aim System - 場館管理後台 <span className="text-sm font-normal accent-yellow ml-2">v2.1 Club</span></h1>
        <button 
            onClick={() => {
              localStorage.removeItem('memberSession');
              navigate('/members/login');
            }}
            className="px-4 py-2 rounded-lg cue-surface-strong hover:brightness-95 transition-colors"
          >
            登出
          </button>
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
               <label className="block text-sm mb-1 cue-muted">Logo URL</label>
               <input 
                 value={clubProfile.logoUrl || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, logoUrl: e.target.value })} 
                 className="w-full px-3 py-2 rounded cue-input" 
                 placeholder="https://..."
               />
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

          <div className="mt-6">
            <TimeFeeCalculator title="波鐘計算機" />
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
             <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="cue-muted border-b cue-border">
                         <th className="py-2 px-3">名稱</th>
                         <th className="py-2 px-3">Email</th>
                         <th className="py-2 px-3">電話</th>
                         <th className="py-2 px-3">加入時間</th>
                      </tr>
                   </thead>
                   <tbody>
                      {clubMembers.map((cm: any) => (
                         <tr key={cm.id} className="border-b cue-border hover:brightness-95">
                            <td className="py-2 px-3">{cm.member?.name || '-'}</td>
                            <td className="py-2 px-3 text-sm cue-muted">{cm.member?.email || '-'}</td>
                            <td className="py-2 px-3 text-sm">{cm.member?.phone || '-'}</td>
                            <td className="py-2 px-3 text-sm cue-muted">{new Date(cm.joinedAt).toLocaleDateString()}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          )}
        </div>

        {pointsEnabled ? (
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
                <div className="font-semibold mb-2">積分設定（每場館自訂）</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1 cue-muted">貨幣代碼</label>
                    <input value={pointsCurrency} onChange={(e) => setPointsCurrency(e.target.value.toUpperCase())} className="w-full px-3 py-2 rounded cue-input" placeholder="HKD" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 cue-muted">每 1 貨幣可抵扣積分</label>
                    <input value={pointsPerCurrency} onChange={(e) => setPointsPerCurrency(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="1" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 cue-muted">每 X 分鐘進位</label>
                    <input value={pointsRoundingMinutes} onChange={(e) => setPointsRoundingMinutes(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="15" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1 cue-muted">最低計費分鐘</label>
                    <input value={pointsMinBillableMinutes} onChange={(e) => setPointsMinBillableMinutes(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="0" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded cue-button hover:brightness-95 text-white"
                    disabled={pointsSaving}
                    onClick={async () => {
                      if (pointsSaving) return;
                      setPointsSaving(true);
                      try {
                        const payload = {
                          currencyCode: String(pointsCurrency || 'HKD').trim().toUpperCase(),
                          pointsPerCurrency: Number(pointsPerCurrency),
                          roundingMinutes: Number(pointsRoundingMinutes),
                          minBillableMinutes: Number(pointsMinBillableMinutes),
                        };
                        await updateClubPointsConfig(API_URL, operatorId, payload as any);
                        setToast('已更新積分設定');
                        setTimeout(() => setToast(null), 2000);
                        await loadPointsData();
                      } catch (e: any) {
                        setToast(e?.message || '更新失敗');
                        setTimeout(() => setToast(null), 3000);
                      } finally {
                        setPointsSaving(false);
                      }
                    }}
                  >
                    {pointsSaving ? '儲存中...' : '儲存設定'}
                  </button>
                  <div className="text-xs cue-muted">
                    結算時會先按「每 X 分鐘進位」計算分鐘數，再按兌換規則轉為扣分。
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold mb-2">會員積分加減</div>
                <div className="grid md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1 cue-muted">會員</label>
                    <select value={pointsAdjustMemberId} onChange={(e) => setPointsAdjustMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                      <option value="">選擇會員</option>
                      {pointsBalances.map((r: any) => (
                        <option key={r.memberId} value={r.memberId}>
                          {(r.member?.name || r.member?.email || r.memberId) + `（${r.balance ?? 0}）`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 cue-muted">加減分（可負數）</label>
                    <input value={pointsAdjustDelta} onChange={(e) => setPointsAdjustDelta(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：100 或 -50" />
                  </div>
                  <div>
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
                        setToast('已更新積分');
                        setTimeout(() => setToast(null), 2000);
                        await loadPointsData();
                      } catch (e: any) {
                        setToast(e?.message || '更新失敗');
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                  >
                    確認更新
                  </button>
                  <div className="text-xs cue-muted mt-1">建議以正數代表加分，負數代表扣分。</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="font-semibold mb-2">會員餘額</div>
                  {pointsBalances.length === 0 ? (
                    <div className="cue-muted">暫無資料</div>
                  ) : (
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="cue-muted border-b cue-border">
                            <th className="py-2 px-3">會員</th>
                            <th className="py-2 px-3">餘額</th>
                            <th className="py-2 px-3">更新</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pointsBalances.map((r: any) => (
                            <tr key={r.memberId} className="border-b cue-border hover:brightness-95">
                              <td className="py-2 px-3">{r.member?.name || r.member?.email || '-'}</td>
                              <td className="py-2 px-3 font-semibold">{r.balance ?? 0}</td>
                              <td className="py-2 px-3 text-xs cue-muted">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-semibold mb-2">最近 50 筆流水</div>
                  {pointsLedger.length === 0 ? (
                    <div className="cue-muted">暫無資料</div>
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
                          {pointsLedger.map((r: any) => (
                            <tr key={r.id} className="border-b cue-border hover:brightness-95">
                              <td className="py-2 px-3 text-xs cue-muted">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                              <td className="py-2 px-3 text-sm">{r.member?.name || r.member?.email || '-'}</td>
                              <td className="py-2 px-3 font-semibold">{r.deltaPoints > 0 ? `+${r.deltaPoints}` : r.deltaPoints}</td>
                              <td className="py-2 px-3 text-sm">{r.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        ) : null}

        {highbreakEnabled ? (
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
        )}

        {bookingEnabled ? (
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
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">球枱</h3>
              <div className="flex gap-2 mb-3">
                <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} className="flex-1 px-3 py-2 rounded cue-input" placeholder="球枱名稱" />
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
                  <div key={t.id} className="flex items-center gap-2 cue-surface p-2 rounded">
                    <input value={t.name} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))} className="flex-1 px-2 py-1 rounded cue-input" />
                    <input value={t.basePrice ?? ''} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, basePrice: e.target.value } : x))} type="number" step="0.01" className="w-28 px-2 py-1 rounded cue-input text-sm" placeholder="正價/時" />
                    {qrEnabled ? (
                      <div className="flex items-center gap-2">
                        {t.qrToken?.token ? (
                          <div className="flex items-center gap-2">
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
                    <div className="flex items-center gap-2 mb-2">
                      <input value={p.title} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, title: e.target.value } : x))} className="flex-1 px-2 py-1 rounded cue-input" />
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
                      <button onClick={async () => {
                        const cur = pricing.find(x => x.id === p.id);
                        if (!cur) return;
                        const updated = await updatePricingScheme(API_URL, operatorId, p.id, { title: cur.title, description: cur.description || null, rulesJson: cur.rulesJson, active: cur.active, price: cur.price === '' ? null : cur.price, tableId: cur.tableId || null });
                        setPricing(prev => prev.map(x => x.id === p.id ? updated : x));
                      }} className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm">儲存</button>
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
          <div className="mt-6">
            <h3 className="font-semibold mb-2">待確認預約</h3>
            {pendingReservations.length === 0 ? (
              <div className="cue-muted">暫無待確認預約</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
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
            )}
          </div>
          <div className="mt-6">
            <h3 className="font-semibold mb-2">全部預約</h3>
            {allReservations.length === 0 ? (
              <div className="cue-muted">暫無預約</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
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
                    {allReservations.slice(0, 100).map((r: any) => {
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
                {allReservations.length > 100 && <div className="text-xs cue-muted mt-2">只顯示最近 100 筆</div>}
              </div>
            )}
          </div>
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">預約管理</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )}

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
                    await createLiveAnnouncement(API_URL, operatorId, { title: t, startsAt: d.toISOString(), liveUrl: u });
                    setToast('已發佈直播通告');
                    setTimeout(() => setToast(null), 2000);
                    setLiveTitle('');
                    setLiveUrl('');
                    await loadData();
                  } catch (e: any) {
                    setToast(e?.message || '發佈失敗');
                    setTimeout(() => setToast(null), 3000);
                  } finally {
                    setLiveCreating(false);
                  }
                }}
              >
                {liveCreating ? '發佈中…' : '發佈'}
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
                          <button
                            type="button"
                            className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                            onClick={async () => {
                              if (!confirm('確定要刪除此直播通告？')) return;
                              try {
                                await deleteLiveAnnouncement(API_URL, operatorId, String(it.id));
                                await loadData();
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
                    if (!msgTitle || !msgContent) {
                       setToast('請填寫標題和內容');
                       setTimeout(() => setToast(null), 2000);
                       return;
                    }
                    try {
                       if (!operatorId) return;
                       await broadcastClubMessage(API_URL, operatorId, msgTitle, msgContent);
                       setToast('訊息已發送');
                       setMsgTitle('');
                       setMsgContent('');
                       setTimeout(() => setToast(null), 3000);
                    } catch (err: any) {
                       setToast(err.message || '發送失敗');
                       setTimeout(() => setToast(null), 3000);
                    }
                 }}
                 className="px-4 py-2 rounded brand-button text-black transition-colors"
              >
                 發送訊息
              </button>
           </div>
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">發送場館訊息</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )}

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

        {scoringEnabled ? (
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
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">進行中的房間</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )}

        {scoringEnabled ? (
        <div className="glass rounded-xl p-6">
          <div className="flex justify-between items-center mb-4 border-b cue-border pb-2">
            <h2 className="text-xl font-bold">歷史房間記錄</h2>
            <button 
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
            <div className="overflow-x-auto">
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
          )}
        </div>
        ) : (
        <div className="glass rounded-xl p-6">
          <div className="text-xl font-bold mb-2">歷史房間記錄</div>
          <div className="cue-muted text-sm">此功能未開通</div>
        </div>
        )}
      </div>
    </div>
  );
};

export default VenueDashboard;
