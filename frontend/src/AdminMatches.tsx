import React, { useCallback, useEffect, useState } from 'react';
import { API_URL, SOCKET_URL, SOCKET_PATH } from './config';
import { listAdminMatches } from './lib/api';

interface MatchPlayerSummary {
  member_id: string;
  member: {
    id: string;
    name: string | null;
    member_code: string | null;
  } | null;
}

interface MatchSummary {
  id: string;
  room_id: string;
  name: string;
  match_code: string | null;
  frames_required: number;
  red_balls: number;
  started_at: string | null;
  ended_at: string | null;
  winner_member_id: string | null;
  winner_member?: {
    id: string;
    name: string | null;
    member_code: string | null;
  } | null;
  players: MatchPlayerSummary[];
}

const AdminMatches: React.FC = () => {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberIdFilter, setMemberIdFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const resolveAdminToken = useCallback((): string => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token') || '';
    const tokenSaved = typeof window !== 'undefined' ? (localStorage.getItem('adminToken') || '') : '';
    const token = tokenFromUrl || tokenSaved;
    if (tokenFromUrl && typeof window !== 'undefined') localStorage.setItem('adminToken', tokenFromUrl);
    return token;
  }, []);

  const load = useCallback(async (pageToLoad: number, memberId?: string) => {
    setError(null);
    setLoading(true);
    try {
      const token = resolveAdminToken();
      if (!token) throw new Error('缺少系統管理員密鑰');
      const data = await listAdminMatches(API_URL, token, {
        memberId: memberId ? memberId.trim() || undefined : undefined,
        page: pageToLoad,
        pageSize,
      });
      setMatches((data.matches || []) as MatchSummary[]);
      setTotal(Number(data.total || 0));
      setPage(Number(data.page || pageToLoad));
    } catch (err: any) {
      setError(err.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [pageSize, resolveAdminToken]);

  useEffect(() => {
    load(1);
  }, [load]);

  function formatDate(value: string | null) {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  function renderPlayers(m: MatchSummary) {
    if (!Array.isArray(m.players) || m.players.length === 0) return '-';
    return m.players.map((p) => {
      const name = p.member?.name || '-';
      const code = p.member?.member_code || '';
      const id = p.member_id;
      const parts = [name];
      if (code) parts.push(`(${code})`);
      parts.push(`[${id}]`);
      return parts.join(' ');
    }).join(' / ');
  }

  function renderWinner(m: MatchSummary) {
    if (!m.winner_member_id) return '-';
    const w = m.winner_member;
    if (!w) return m.winner_member_id;
    const parts = [w.name || '-'];
    if (w.member_code) parts.push(`(${w.member_code})`);
    parts.push(`[${w.id}]`);
    return parts.join(' ');
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="brand-page text-white" style={{ maxWidth: 1000, margin: '40px auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }} className="accent-yellow">管理員：比賽列表</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              const tok = localStorage.getItem('adminToken') || '';
              const url = `${window.location.origin}/admin?apiUrl=${encodeURIComponent(API_URL)}&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}${tok ? `&token=${encodeURIComponent(tok)}` : ''}&v=admin`;
              window.location.href = url;
            }}
            style={{ padding: '6px 10px', borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none' }}
          >
            Admin Panel
          </button>
        </div>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 14 }}>
          Member ID：
          <input
            value={memberIdFilter}
            onChange={(e) => setMemberIdFilter(e.target.value)}
            style={{ marginLeft: 4, padding: 4, borderRadius: 4, border: '1px solid #ccc', minWidth: 200 }}
            placeholder="輸入 Member ID 過濾"
          />
        </label>
        <button
          onClick={() => load(1, memberIdFilter)}
          style={{ padding: '6px 10px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none' }}
        >
          搜尋
        </button>
        {memberIdFilter && (
          <button
            onClick={() => {
              setMemberIdFilter('');
              load(1);
            }}
            style={{ padding: '6px 10px', borderRadius: 6, background: '#6b7280', color: '#fff', border: 'none' }}
          >
            清除
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#444' }}>
          共 {total} 筆，比賽 ID = ROOM_ID / MATCH_ID
        </div>
      </div>
      {loading && <div>載入中...</div>}
      {!loading && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Match ID / ROOM_ID</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>名稱</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Match Code</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Frames</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>Red Balls</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>球員</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>勝方</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>開始時間</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: 6 }}>結束時間</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.room_id}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.name}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.match_code || '-'}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.frames_required}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{m.red_balls}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{renderPlayers(m)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{renderWinner(m)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{formatDate(m.started_at)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 6 }}>{formatDate(m.ended_at)}</td>
                </tr>
              ))}
              {matches.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 10, textAlign: 'center', color: '#666' }}>
                    無資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#444' }}>
              第 {page} / {totalPages} 頁
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => page > 1 && load(page - 1, memberIdFilter)}
                disabled={page <= 1}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: page <= 1 ? '#e5e7eb' : '#fff',
                  cursor: page <= 1 ? 'default' : 'pointer',
                }}
              >
                上一頁
              </button>
              <button
                onClick={() => page < totalPages && load(page + 1, memberIdFilter)}
                disabled={page >= totalPages}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: page >= totalPages ? '#e5e7eb' : '#fff',
                  cursor: page >= totalPages ? 'default' : 'pointer',
                }}
              >
                下一頁
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMatches;

