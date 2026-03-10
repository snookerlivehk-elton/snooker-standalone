import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { API_URL } from './config';
import { getPublicClubProfile, joinClub } from './lib/api';

const ClubPublicPage: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  useEffect(() => {
    if (clubId) {
      loadClub();
    }
  }, [clubId]);

  const loadClub = async () => {
    try {
      setLoading(true);
      const data = await getPublicClubProfile(API_URL, clubId!);
      setClub(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load club');
    } finally {
      setLoading(false);
    }
  };

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
        
        <div style={{ marginTop: 20 }}>
            <Link to="/join" style={{ color: '#aaa' }}>回首頁</Link>
        </div>
      </div>
    </div>
  );
};

export default ClubPublicPage;
