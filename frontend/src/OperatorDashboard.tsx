import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from './config';
import { createOperatorRoom, getOperatorMatches } from './lib/api';

const OperatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  const operatorId = session.id;

  useEffect(() => {
    if (!operatorId) {
      navigate('/members/login');
      return;
    }
    
    loadMatches();
  }, [operatorId, navigate]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      const res = await getOperatorMatches(API_URL, operatorId);
      setMatches(res.matches || []);
    } catch (err: any) {
      setError(err.message || '無法載入歷史記錄');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createOperatorRoom(API_URL, operatorId);
      // Redirect to setup page for the new room
      navigate(`/room/${res.roomCode}/setup`);
    } catch (err: any) {
      setError(err.message || '建立房間失敗');
    } finally {
      setCreating(false);
    }
  };

  if (!operatorId) return null;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>操作員介面</h1>
        <button 
          onClick={() => {
            localStorage.removeItem('memberSession');
            navigate('/members/login');
          }}
          style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #444', background: '#333', color: '#fff', cursor: 'pointer' }}
        >
          登出
        </button>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div style={{ background: '#1f2937', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #374151' }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>建立新房間</h2>
        <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
          您最多可以同時建立 5 個進行中的房間。建立後請完成賽事設置以開始比賽。
        </p>
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: creating ? '#4b5563' : '#2563eb',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: creating ? 'not-allowed' : 'pointer',
            width: '100%',
            maxWidth: '300px'
          }}
        >
          {creating ? '建立中...' : '建立新房間'}
        </button>
      </div>

      <div style={{ background: '#1f2937', padding: '24px', borderRadius: '12px', border: '1px solid #374151' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>歷史房間記錄</h2>
          <button 
            onClick={loadMatches}
            style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '4px', border: '1px solid #4b5563', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
          >
            重新整理
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>載入中...</div>
        ) : matches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>尚無記錄</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #374151', color: '#9ca3af', textAlign: 'left' }}>
                  <th style={{ padding: '12px 8px' }}>日期時間</th>
                  <th style={{ padding: '12px 8px' }}>房間代碼</th>
                  <th style={{ padding: '12px 8px' }}>比賽名稱</th>
                  <th style={{ padding: '12px 8px' }}>雙方球手 (讓分)</th>
                  <th style={{ padding: '12px 8px', textAlign: 'center' }}>比分</th>
                  <th style={{ padding: '12px 8px' }}>結果</th>
                  <th style={{ padding: '12px 8px' }}>用時</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const dateStr = m.startedAt ? new Date(m.startedAt).toLocaleString() : '-';
                  const duration = m.durationSeconds 
                    ? `${Math.floor(m.durationSeconds / 60)}分${m.durationSeconds % 60}秒` 
                    : '-';
                  
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #374151' }}>
                      <td style={{ padding: '12px 8px' }}>{dateStr}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontFamily: 'monospace', background: '#374151', padding: '2px 6px', borderRadius: '4px' }}>
                          {m.matchCode || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {m.matchName}
                        {m.framesRequired > 1 && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>({m.framesRequired}局)</span>}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ marginBottom: '4px' }}>
                          {m.p0.name} {m.p0.handicap ? `(${m.p0.handicap > 0 ? '+' : ''}${m.p0.handicap})` : ''}
                          {m.p0.maxBreak > 0 && <span style={{ fontSize: '12px', color: '#fbbf24', marginLeft: '6px' }}>單杆: {m.p0.maxBreak}</span>}
                        </div>
                        <div>
                          {m.p1.name} {m.p1.handicap ? `(${m.p1.handicap > 0 ? '+' : ''}${m.p1.handicap})` : ''}
                          {m.p1.maxBreak > 0 && <span style={{ fontSize: '12px', color: '#fbbf24', marginLeft: '6px' }}>單杆: {m.p1.maxBreak}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold' }}>
                        {m.p0.score} - {m.p1.score}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          color: m.result.includes('Win') ? '#34d399' : '#9ca3af',
                          fontWeight: m.result.includes('Win') ? 'bold' : 'normal'
                        }}>
                          {m.result}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>{duration}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorDashboard;
