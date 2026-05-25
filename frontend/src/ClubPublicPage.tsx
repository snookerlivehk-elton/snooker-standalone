import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from './config';
import { getPublicClubProfile, joinClub, getPublicTables, getPublicPricing, getAvailability, getMyReservations, createReservation, cancelMyReservation, getClubLeaderboardHighest, getClubLeaderboardMonthly } from './lib/api';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';
import TimeFeeCalculator from './components/TimeFeeCalculator';

const ClubPublicPage: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
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

  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderHighest, setLeaderHighest] = useState<any[]>([]);
  const [leaderMonthly, setLeaderMonthly] = useState<any[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  const pad2 = useCallback((n: number) => String(n).padStart(2, '0'), []);
  const minDate = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, [pad2]);

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
    if (!clubId || !selTable || !date || !start || !hours) {
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
  }, [clubId, selTable, date, start, hours, isPastStartTime]);

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

  if (loading) return <div className="brand-page p-6 text-center cue-muted">載入中...</div>;
  if (error) return <div className="brand-page p-6 text-center text-red-500">錯誤：{error}</div>;
  if (!club) return <div className="brand-page p-6 text-center cue-muted">找不到場館</div>;

  const logoSrc = (() => {
    const raw = String((club as any)?.logoUrl || (club as any)?.logo_url || '').trim();
    if (!raw) return null;
    if (/^data:/i.test(raw)) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${API_URL}${raw}`;
    return raw;
  })();

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title={String((club as any)?.name || '場館')} />
      <main className="flex-1 px-4 pt-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <div className="cue-card p-5 sm:p-6">
            <div className="flex justify-center mb-5">
              <div className="bg-white p-3 rounded-xl w-[230px] h-[230px] flex items-center justify-center">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt="Club Logo"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    className="w-[200px] h-[200px] object-contain"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-700 font-bold">
                    未設定 LOGO
                  </div>
                )}
              </div>
            </div>

            {!joined ? (
              <button
                onClick={handleJoin}
                className="w-full cue-button py-3 rounded-full font-bold text-lg mb-6"
              >
                加入場館
              </button>
            ) : (
              <div className="w-full cue-surface rounded-lg p-3 text-center font-semibold text-emerald-600 mb-6">
                已加入此場館
              </div>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold accent-yellow text-center">
              {club.name || '未命名場館'}
            </h1>

            {club.intro && (
              <p className="mt-3 text-sm sm:text-base cue-muted whitespace-pre-wrap text-center">
                {club.intro}
              </p>
            )}

            <div className="mt-6">
              <TimeFeeCalculator title="波鐘計算機" />
            </div>

            <div className="mt-6 cue-surface rounded-lg p-4 text-left">
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

            <div className="mt-6 cue-surface rounded-lg p-4 text-left">
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

            <div className="mt-6 cue-surface rounded-lg p-4 text-left">
              <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">預約</div>
              {club.paymentInfo && (
                <div className="mb-3 cue-surface-strong rounded-lg p-3 text-sm whitespace-pre-wrap">
                  <div className="font-semibold accent-yellow mb-1">付款方式</div>
                  <div className="cue-muted">{String(club.paymentInfo)}</div>
                </div>
              )}

              {!session.id ? (
                <div className="text-sm cue-muted">
                  需登入才能預約。<a href="/members/login" className="accent-yellow underline">登入</a>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 mb-3">
                    <label className="grid gap-1">
                      <div className="text-xs cue-muted">球枱</div>
                      <select value={selTable} onChange={(e) => setSelTable(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                        <option value="">請選擇</option>
                        {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <div className="text-xs cue-muted">日期</div>
                      <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
                    </label>
                    <label className="grid gap-1">
                      <div className="text-xs cue-muted">開始時間</div>
                      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
                    </label>
                    <label className="grid gap-1">
                      <div className="text-xs cue-muted">時數</div>
                      <input type="number" min={1} step={1} value={hours} onChange={(e) => setHours(Math.max(1, parseInt(e.target.value || '1', 10) || 1))} className="w-full px-3 py-2 rounded cue-input" />
                    </label>
                    <label className="grid gap-1 sm:col-span-2">
                      <div className="text-xs cue-muted">優惠方案</div>
                      <select value={selScheme} onChange={(e) => setSelScheme(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                        <option value="">一般</option>
                        {schemes.map(s => {
                          const perHour = Number((s as any).effectivePricePerHour ?? (s as any).price);
                          const mh = Number((s as any).minHours ?? (s as any).rulesJson?.minHours ?? (s as any).rulesJson?.minQuantityHours);
                          const minText = Number.isFinite(mh) && mh >= 1 ? `（最少${Math.floor(mh)}小時）` : '';
                          const label = Number.isFinite(perHour) ? `${s.title} · $${fmtMoney(perHour)}/小時${minText}` : `${s.title} · 未設定價錢${minText}`;
                          return <option key={s.id} value={s.id} disabled={!Number.isFinite(perHour)}>{label}</option>;
                        })}
                      </select>
                    </label>
                  </div>

                  <div className="cue-surface-strong rounded-lg p-3 mb-3">
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
                    {unitPricePerHour == null && (
                      <div className="mt-2 text-xs text-red-500">
                        此球枱未設定正價，且此時段沒有可用方案／方案價錢未設定，暫時無法提交預約。
                      </div>
                    )}
                    {unitPricePerHour != null && schemes.length === 0 && (
                      <div className="mt-2 text-xs cue-muted">
                        此時段沒有可用方案，將以正價計算。
                      </div>
                    )}
                    {minHoursNotMet && (
                      <div className="mt-2 text-xs text-red-500">
                        此方案需最少購買 {schemeMinHours} 小時。
                      </div>
                    )}
                    {isPastStartTime && (
                      <div className="mt-2 text-xs text-red-500">
                        不能預約已過去的時間，請選擇將來的日期/時間。
                      </div>
                    )}
                  </div>

                  <button
                    onClick={async () => {
                      if (!selTable || !date || !start) { alert('請選擇球枱/日期/時間'); return; }
                      if (unitPricePerHour == null) { alert('此時段未設定價錢，無法預約'); return; }
                      if (minHoursNotMet) { alert(`此方案需最少購買 ${schemeMinHours} 小時`); return; }
                      if (!selectedStartAt || !selectedEndAt) { alert('時間格式不正確'); return; }
                      if (selectedStartAt.getTime() < Date.now() - 60_000) { alert('不能預約已過去的時間'); return; }
                      try {
                        const created = await createReservation(API_URL, club.id, session.id, { tableId: selTable, startAt: selectedStartAt.toISOString(), endAt: selectedEndAt.toISOString(), quantityHours: hours, schemeId: selScheme || undefined });
                        const quote = created?.priceQuote != null ? Number(created.priceQuote) : null;
                        const quoteText = Number.isFinite(quote) ? `\n報價：$${fmtMoney(quote as number)}` : '';
                        alert(`已送出，待場館確認${quoteText}`);
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
                    disabled={unitPricePerHour == null || minHoursNotMet || isPastStartTime}
                    className="w-full cue-button py-2.5 rounded-lg font-semibold disabled:opacity-60"
                  >
                    送出預約
                  </button>
                </>
              )}
            </div>

            <div className="mt-6 cue-surface rounded-lg p-4 text-left">
              <div className="font-semibold text-lg mb-3 pb-2 border-b cue-border">當日時間表</div>
              {!selTable || !date ? (
                <div className="text-sm cue-muted">請先選擇球枱及日期，即可查看該日已預約/空閒時段。</div>
              ) : availLoading ? (
                <div className="text-sm cue-muted">載入中...</div>
              ) : availError ? (
                <div className="text-sm text-red-500">{availError}</div>
              ) : (
                <>
                  <div className="text-xs cue-muted mb-3">按空閒時段可自動填入「開始時間」。紅色=已預約，綠色=空閒。</div>
                  <div className="grid grid-cols-4 gap-2">
                    {daySlotButtons.map((b) => {
                      const disabled = b.busy || b.isPast;
                      const cls = b.busy
                        ? 'bg-red-700 text-white'
                        : b.isPast
                          ? 'cue-surface-strong cue-muted'
                          : 'bg-emerald-700 text-white hover:brightness-95';
                      return (
                        <button
                          key={b.hour}
                          type="button"
                          disabled={disabled}
                          onClick={() => setStart(b.label)}
                          className={`px-2 py-2 rounded-lg text-sm border cue-border ${cls} disabled:opacity-80`}
                        >
                          {b.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs cue-muted">
                    已預約時段：
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
                      <span className="ml-2">（暫無）</span>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 cue-surface rounded-lg p-4 text-left">
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
                  return (
                    <div className="grid gap-2">
                      {list.slice(0, 50).map((r: any) => {
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
                          <div key={r.id} className="cue-surface-strong rounded-lg p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold truncate">{tableName || '球枱'}</div>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
                            </div>
                            <div className="text-sm cue-muted mt-1">{ymd} · {time}{quoteText ? ` · ${quoteText}` : ''}</div>
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
                      {list.length > 50 && <div className="text-xs cue-muted">只顯示最近 50 筆</div>}
                    </div>
                  );
                })()
              )}
            </div>

            <div className="mt-6 text-center">
              <Link to="/me" className="accent-blue underline">回首頁</Link>
            </div>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default ClubPublicPage;
