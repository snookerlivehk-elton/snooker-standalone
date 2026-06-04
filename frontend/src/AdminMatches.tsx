import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="brand-page min-h-screen text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-4">
        <div className="glass rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="accent-yellow text-xl font-bold">管理員：比賽列表</h2>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/overview" className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm">
              系統概覽
            </Link>
            <button
              onClick={() => {
                const tok = localStorage.getItem('adminToken') || '';
                const url = `${window.location.origin}/admin?apiUrl=${encodeURIComponent(API_URL)}&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}${tok ? `&token=${encodeURIComponent(tok)}` : ''}&v=admin`;
                window.location.href = url;
              }}
              className="px-3 py-2 rounded cue-button text-sm font-semibold"
            >
              Admin Panel
            </button>
          </div>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <div className="glass rounded-xl p-4 space-y-3">
          <div className="grid gap-2 sm:flex sm:items-end sm:justify-between">
            <label className="grid gap-1 sm:w-[360px]">
              <div className="text-xs cue-muted">Member ID（可選）</div>
              <input
                value={memberIdFilter}
                onChange={(e) => setMemberIdFilter(e.target.value)}
                className="w-full px-3 py-2 rounded cue-input text-sm"
                placeholder="輸入 Member ID 過濾"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={() => load(1, memberIdFilter)} className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold">
                搜尋
              </button>
              {memberIdFilter && (
                <button
                  onClick={() => {
                    setMemberIdFilter('');
                    load(1);
                  }}
                  className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
                >
                  清除
                </button>
              )}
            </div>
          </div>
          <div className="text-sm cue-muted">共 {total} 筆</div>
        </div>

        {loading && <div className="glass rounded-xl p-4 cue-muted">載入中...</div>}

        {!loading && (
          <>
            <div className="grid gap-3 md:hidden">
              {matches.map((m) => (
                <div key={m.id} className="rounded-xl cue-surface p-4">
                  <div className="font-semibold text-lg">{m.name}</div>
                  <div className="mt-1 text-xs cue-muted font-mono break-all">ROOM_ID: {m.room_id}</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <div className="cue-muted">Match Code</div>
                      <div className="font-semibold">{m.match_code || '-'}</div>
                    </div>
                    <div className="flex justify-between gap-3">
                      <div className="cue-muted">Frames</div>
                      <div className="font-semibold">{m.frames_required}</div>
                    </div>
                    <div className="flex justify-between gap-3">
                      <div className="cue-muted">Red Balls</div>
                      <div className="font-semibold">{m.red_balls}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="cue-muted">球員</div>
                      <div className="text-sm">{renderPlayers(m)}</div>
                    </div>
                    <div className="grid gap-1">
                      <div className="cue-muted">勝方</div>
                      <div className="text-sm">{renderWinner(m)}</div>
                    </div>
                    <div className="flex justify-between gap-3">
                      <div className="cue-muted">開始</div>
                      <div className="text-sm">{formatDate(m.started_at)}</div>
                    </div>
                    <div className="flex justify-between gap-3">
                      <div className="cue-muted">結束</div>
                      <div className="text-sm">{formatDate(m.ended_at)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {matches.length === 0 && <div className="glass rounded-xl p-4 cue-muted">無資料</div>}
            </div>

            <div className="hidden md:block overflow-auto rounded-xl border cue-border">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead className="bg-black/30">
                  <tr>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">Match ID / ROOM_ID</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">名稱</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">Match Code</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">Frames</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">Red Balls</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">球員</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">勝方</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">開始時間</th>
                    <th className="text-left border-b cue-border px-3 py-2 font-semibold cue-muted">結束時間</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="border-b cue-border">
                      <td className="px-3 py-2">{m.room_id}</td>
                      <td className="px-3 py-2">{m.name}</td>
                      <td className="px-3 py-2">{m.match_code || '-'}</td>
                      <td className="px-3 py-2">{m.frames_required}</td>
                      <td className="px-3 py-2">{m.red_balls}</td>
                      <td className="px-3 py-2">{renderPlayers(m)}</td>
                      <td className="px-3 py-2">{renderWinner(m)}</td>
                      <td className="px-3 py-2">{formatDate(m.started_at)}</td>
                      <td className="px-3 py-2">{formatDate(m.ended_at)}</td>
                    </tr>
                  ))}
                  {matches.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-4 text-center cue-muted">
                        無資料
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="glass rounded-xl p-4 flex items-center justify-between">
              <div className="text-sm cue-muted">
                第 {page} / {totalPages} 頁
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => page > 1 && load(page - 1, memberIdFilter)}
                  disabled={page <= 1}
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 disabled:opacity-60 text-sm font-semibold"
                >
                  上一頁
                </button>
                <button
                  onClick={() => page < totalPages && load(page + 1, memberIdFilter)}
                  disabled={page >= totalPages}
                  className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 disabled:opacity-60 text-sm font-semibold"
                >
                  下一頁
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminMatches;

