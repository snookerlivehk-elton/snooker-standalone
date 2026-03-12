import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from './config';
import { getPublicClubProfile, joinClub, getPublicTables, getPublicPricing, createReservation } from './lib/api';

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
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

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
    if (!clubId || !selTable || !date || !start || !hours) {
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
  }, [clubId, selTable, date, start, hours]);

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
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }} />
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
              </div>
              <button
                onClick={async () => {
                  if (!selTable || !date || !start) { alert('請選擇球枱/日期/時間'); return; }
                  if (unitPricePerHour == null) { alert('此時段未設定價錢，無法預約'); return; }
                  if (minHoursNotMet) { alert(`此方案需最少購買 ${schemeMinHours} 小時`); return; }
                  const [h, m] = start.split(':').map(x => parseInt(x, 10));
                  const s = new Date(date); s.setHours(h, m || 0, 0, 0);
                  const e = new Date(s.getTime() + hours * 60 * 60 * 1000);
                  try {
                    const created = await createReservation(API_URL, club.id, session.id, { tableId: selTable, startAt: s.toISOString(), endAt: e.toISOString(), quantityHours: hours, schemeId: selScheme || undefined });
                    const quote = created?.priceQuote != null ? Number(created.priceQuote) : null;
                    const quoteText = Number.isFinite(quote) ? `\n報價：$${fmtMoney(quote as number)}` : '';
                    alert(`已送出，待場館確認${quoteText}`);
                  } catch (err: any) {
                    alert(err.message || '預約失敗');
                  }
                }}
                disabled={unitPricePerHour == null || minHoursNotMet}
                style={{ background: unitPricePerHour == null || minHoursNotMet ? '#777' : '#4caf50', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: unitPricePerHour == null || minHoursNotMet ? 'not-allowed' : 'pointer' }}
              >
                送出預約
              </button>
            </>
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
