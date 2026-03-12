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
      getPublicPricing(API_URL, clubId).then(setSchemes).catch(() => setSchemes([]));
    }
  }, [clubId, loadClub]);

  useEffect(() => {
    if (clubId && selTable) {
      getPublicPricing(API_URL, clubId, selTable).then(setSchemes).catch(() => setSchemes([]));
    }
  }, [clubId, selTable]);

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
                  <input type="number" min={1} step={1} value={hours} onChange={(e) => setHours(parseInt(e.target.value || '1', 10))} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }} />
                </label>
                <label>
                  <div style={{ fontSize: 12, color: '#aaa' }}>方案</div>
                  <select value={selScheme} onChange={(e) => setSelScheme(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, background: '#222', color: '#fff', border: '1px solid #555' }}>
                    <option value="">一般</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </label>
              </div>
              <button
                onClick={async () => {
                  if (!selTable || !date || !start) { alert('請選擇球枱/日期/時間'); return; }
                  const [h, m] = start.split(':').map(x => parseInt(x, 10));
                  const s = new Date(date); s.setHours(h, m || 0, 0, 0);
                  const e = new Date(s.getTime() + hours * 60 * 60 * 1000);
                  try {
                    await createReservation(API_URL, club.id, session.id, { tableId: selTable, startAt: s.toISOString(), quantityHours: hours, schemeId: selScheme || undefined });
                    alert('已送出，待場館確認');
                  } catch (err: any) {
                    alert(err.message || '預約失敗');
                  }
                }}
                style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}
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
