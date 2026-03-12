import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from './config';
import { getPublicClubProfile, joinClub, getPublicTables, getPublicPricing, getAvailability, getMyReservations, createReservation } from './lib/api';

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

  if (loading) return <div style={{ padding: 20, color: '#fff', textAlign: 'center' }}>載入中...</div>;
  if (error) return <div style={{ padding: 20, color: 'red', textAlign: 'center' }}>錯誤: {error}</div>;
  if (!club) return <div style={{ padding: 20, color: '#fff', textAlign: 'center' }}>找不到場館</div>;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1a1a1a',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: 600,
        width: '100%',
        background: '#2a2a2a',
        borderRadius: 12,
        padding: 30,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        textAlign: 'center'
      }}>
        {club.logoUrl && (
          <img 
            src={club.logoUrl} 
            alt="Club Logo" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: '50%', marginBottom: 20, background: '#fff' }} 
          />
        )}
        
        {/* QR Code Section */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ background: '#fff', padding: 15, borderRadius: 12 }}>
            <QRCodeSVG value={window.location.href} size={200} />
          </div>
        </div>

        {!joined ? (
          <button 
            onClick={handleJoin}
            style={{
              background: '#f5d000',
              color: '#000',
              border: 'none',
              padding: '12px 30px',
              fontSize: 18,
              fontWeight: 'bold',
              borderRadius: 30,
              cursor: 'pointer',
              width: '100%',
              marginBottom: 30
            }}
          >
            加入場館
          </button>
        ) : (
          <div style={{ 
            background: '#4caf50', 
            color: '#fff', 
            padding: 15, 
            borderRadius: 8, 
            fontWeight: 'bold',
            marginBottom: 30
          }}>
            已加入此場館 ✅
          </div>
        )}

        <h1 style={{ margin: '0 0 10px 0', fontSize: 32, color: '#f5d000' }}>{club.name || '未命名場館'}</h1>
        
        {club.intro && (
          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#ccc', marginBottom: 30, whiteSpace: 'pre-wrap' }}>
            {club.intro}
          </p>
        )}

        <div style={{ textAlign: 'left', background: '#333', padding: 20, borderRadius: 8, marginBottom: 30 }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: 10 }}>聯絡資訊</h3>
          {club.address && <div style={{ marginBottom: 10 }}>📍 {club.address}</div>}
          {club.phone && <div style={{ marginBottom: 10 }}>📞 {club.phone}</div>}
          {club.email && <div style={{ marginBottom: 10 }}>✉️ {club.email}</div>}
        </div>
        
        <div style={{ textAlign: 'left', background: '#333', padding: 20, borderRadius: 8, marginBottom: 30 }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: 10 }}>預約</h3>
          {!session.id ? (
            <div style={{ color: '#ccc' }}>
              需登入才能預約。<a href="/members/login" style={{ color: '#f5d000' }}>登入</a>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
                <label>
                  <div style={{ fontSize: 12, color: '#aaa' }}>球枱</div>
                  <select value={selTable} onChange={(e) => setSelTable(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }}>
                    <option value="">請選擇</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#aaa' }}>日期</div>
                  <input type="date" value={date} min={minDate} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#aaa' }}>開始時間</div>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#aaa' }}>時數</div>
                  <input type="number" min={1} step={1} value={hours} onChange={(e) => setHours(Math.max(1, parseInt(e.target.value || '1', 10) || 1))} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#aaa' }}>方案</div>
                  <select value={selScheme} onChange={(e) => setSelScheme(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }}>
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
              <div style={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                  <div style={{ color: '#aaa' }}>每小時</div>
                  <div style={{ fontWeight: 700 }}>
                    {unitPricePerHour == null ? '未設定' : `$${fmtMoney(unitPricePerHour)}`}
                    <span style={{ marginLeft: 8, color: '#aaa', fontWeight: 400 }}>
                      {selScheme ? (selectedScheme ? `（${selectedScheme.title}）` : '') : '（正價）'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, marginTop: 6 }}>
                  <div style={{ color: '#aaa' }}>總價</div>
                  <div style={{ fontWeight: 700 }}>{totalPrice == null ? '—' : `$${fmtMoney(totalPrice)}`}</div>
                </div>
                {unitPricePerHour == null && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#ffb4b4' }}>
                    此球枱未設定正價，且此時段沒有可用方案／方案價錢未設定，暫時無法提交預約。
                  </div>
                )}
                {unitPricePerHour != null && schemes.length === 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
                    此時段沒有可用方案，將以正價計算。
                  </div>
                )}
                {minHoursNotMet && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#ffb4b4' }}>
                    此方案需最少購買 {schemeMinHours} 小時。
                  </div>
                )}
                {isPastStartTime && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#ffb4b4' }}>
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
                style={{ background: unitPricePerHour == null || minHoursNotMet || isPastStartTime ? '#777' : '#4caf50', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: unitPricePerHour == null || minHoursNotMet || isPastStartTime ? 'not-allowed' : 'pointer' }}
              >
                送出預約
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: 'left', background: '#333', padding: 20, borderRadius: 8, marginBottom: 30 }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: 10 }}>當日時間表</h3>
          {!selTable || !date ? (
            <div style={{ color: '#ccc', fontSize: 13 }}>請先選擇球枱及日期，即可查看該日已預約/空閒時段。</div>
          ) : availLoading ? (
            <div style={{ color: '#ccc', fontSize: 13 }}>載入中...</div>
          ) : availError ? (
            <div style={{ color: '#ffb4b4', fontSize: 13 }}>{availError}</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>按空閒時段可自動填入「開始時間」。紅色=已預約，綠色=空閒。</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {daySlotButtons.map((b) => {
                  const disabled = b.busy || b.isPast;
                  const bg = b.busy ? '#7f1d1d' : (b.isPast ? '#444' : '#14532d');
                  const fg = b.busy ? '#fff' : (b.isPast ? '#bbb' : '#fff');
                  return (
                    <button
                      key={b.hour}
                      type="button"
                      disabled={disabled}
                      onClick={() => setStart(b.label)}
                      style={{ padding: '10px 8px', borderRadius: 8, border: '1px solid #444', background: bg, color: fg, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 13 }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#aaa' }}>
                已預約時段：
                {Array.isArray(dayReservations) && dayReservations.length > 0 ? (
                  <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
                    {dayReservations.map((r: any) => {
                      const s = new Date(String(r?.startAt));
                      const e = new Date(String(r?.endAt));
                      const ok = Number.isFinite(s.getTime()) && Number.isFinite(e.getTime());
                      const label = ok ? `${pad2(s.getHours())}:${pad2(s.getMinutes())} - ${pad2(e.getHours())}:${pad2(e.getMinutes())}` : '—';
                      return <div key={r.id} style={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 8, padding: '8px 10px' }}>{label}</div>;
                    })}
                  </div>
                ) : (
                  <span style={{ marginLeft: 6, color: '#ccc' }}>（暫無）</span>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: 'left', background: '#333', padding: 20, borderRadius: 8, marginBottom: 30 }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: 10 }}>我的預約（此場館）</h3>
          {!session.id ? (
            <div style={{ color: '#ccc', fontSize: 13 }}>需登入才能查看。</div>
          ) : myResLoading ? (
            <div style={{ color: '#ccc', fontSize: 13 }}>載入中...</div>
          ) : myResError ? (
            <div style={{ color: '#ffb4b4', fontSize: 13 }}>{myResError}</div>
          ) : (
            (() => {
              const now = Date.now() - 60_000;
              const upcoming = (Array.isArray(myReservations) ? myReservations : []).filter((r: any) => {
                const s = new Date(String(r?.startAt));
                return Number.isFinite(s.getTime()) && s.getTime() >= now;
              });
              if (upcoming.length === 0) return <div style={{ color: '#ccc', fontSize: 13 }}>（暫無）</div>;
              return (
                <div style={{ display: 'grid', gap: 8 }}>
                  {upcoming.slice(0, 20).map((r: any) => {
                    const s = new Date(String(r?.startAt));
                    const e = new Date(String(r?.endAt));
                    const ok = Number.isFinite(s.getTime()) && Number.isFinite(e.getTime());
                    const ymd = ok ? `${s.getFullYear()}-${pad2(s.getMonth() + 1)}-${pad2(s.getDate())}` : '—';
                    const time = ok ? `${pad2(s.getHours())}:${pad2(s.getMinutes())} - ${pad2(e.getHours())}:${pad2(e.getMinutes())}` : '—';
                    const tableName = String(r?.table?.name || '');
                    const status = String(r?.status || '');
                    return (
                      <div key={r.id} style={{ background: '#2a2a2a', border: '1px solid #444', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ fontWeight: 700 }}>{tableName || '球枱'}</div>
                          <div style={{ fontSize: 12, color: '#aaa' }}>{status}</div>
                        </div>
                        <div style={{ fontSize: 13, color: '#ddd', marginTop: 6 }}>{ymd} · {time}</div>
                      </div>
                    );
                  })}
                  {upcoming.length > 20 && <div style={{ fontSize: 12, color: '#aaa' }}>只顯示最近 20 筆</div>}
                </div>
              );
            })()
          )}
        </div>
        
        <div style={{ marginTop: 20 }}>
            <Link to="/me" style={{ color: '#aaa' }}>回首頁</Link>
        </div>
      </div>
    </div>
  );
};

export default ClubPublicPage;
