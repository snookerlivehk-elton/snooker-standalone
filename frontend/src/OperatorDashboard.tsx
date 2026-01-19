import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL, SOCKET_URL, SOCKET_PATH } from './config';
import { createOperatorRoom, getOperatorMatches, getOperatorActiveRooms, updateMemberSelf } from './lib/api';

const OperatorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  const [phone, setPhone] = useState(session.phone || '');
  const [birthDate, setBirthDate] = useState(session.birthDate || session.birth_date ? new Date(session.birthDate || session.birth_date).toISOString().split('T')[0] : '');
  const [clubName, setClubName] = useState(session.clubName || session.club_name || '');
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const operatorId = session.id;
  const operatorName = session.name || session.email;

  const rawBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const baseUrl = `${window.location.origin}${rawBase}`;

  useEffect(() => {
    if (!operatorId) {
      navigate('/members/login');
      return;
    }
    
    loadData();
  }, [operatorId, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matchesRes, roomsRes] = await Promise.all([
        getOperatorMatches(API_URL, operatorId),
        getOperatorActiveRooms(API_URL, operatorId)
      ]);
      setMatches(matchesRes.matches || []);
      setActiveRooms(roomsRes.rooms || []);
    } catch (err: any) {
      setError(err.message || '無法載入資料');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      await createOperatorRoom(API_URL, operatorId);
      // Refresh active rooms list instead of navigating
      const roomsRes = await getOperatorActiveRooms(API_URL, operatorId);
      setActiveRooms(roomsRes.rooms || []);
    } catch (err: any) {
      setError(err.message || '建立房間失敗');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (path: string) => {
    const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
    const url = `${baseUrl}${path}${params}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`連結已複製：\n${url}`);
    });
  };

  if (!operatorId) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto grid gap-6">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Snooker Live HK - 操作員介面</h1>
          <button 
            onClick={() => {
              localStorage.removeItem('memberSession');
              navigate('/members/login');
            }}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            登出
          </button>
        </div>

        {error && (
          <div className="bg-red-900 text-red-200 p-3 rounded-lg">
            {error}
          </div>
        )}

        {toast && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50">
            {toast}
          </div>
        )}

        {/* Operator Info */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">操作員資料</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div><span className="text-gray-400">名稱：</span>{operatorName}</div>
            <div><span className="text-gray-400">Email：</span>{session.email}</div>
            <div><span className="text-gray-400">所屬球會：</span>{clubName || '未設定'}</div>
            <div><span className="text-gray-400">電話：</span>{phone || '-'}</div>
          </div>
        </div>

        {/* Edit Profile */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-3">更新資料</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-gray-400">電話</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">出生日期</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">所屬球會</label>
              <input value={clubName} onChange={(e) => setClubName(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={async () => {
                try {
                   if (!operatorId) return;
                   const res = await updateMemberSelf(API_URL, operatorId, { phone, birthDate, clubName });
                   const updated = res.member;
                   // Update local session
                   const newSession = { ...session, ...updated, clubName: updated.club_name, birthDate: updated.birth_date };
                   localStorage.setItem('memberSession', JSON.stringify(newSession));
                   setToast('資料已更新');
                   setTimeout(() => setToast(null), 3000);
                } catch (err: any) {
                   setToast(err.message || '更新失敗');
                   setTimeout(() => setToast(null), 3000);
                }
              }}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 transition-colors"
            >
              儲存資料
            </button>
          </div>
        </div>

        {/* Reset Password */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-3">重設密碼</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-gray-400">新密碼</label>
              <input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-400">確認新密碼</label>
              <input type="password" value={resetPwd2} onChange={(e) => setResetPwd2(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
          </div>
          <div className="mt-4">
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
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              重設密碼
            </button>
          </div>
        </div>

        {/* Active Rooms Management */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
            <h2 className="text-xl font-bold">進行中的房間</h2>
            <span className="text-sm text-gray-400">
              {activeRooms.length} / 5
            </span>
          </div>
          
          <p className="text-gray-400 mb-6 text-sm">
            您最多可以同時建立 5 個進行中的房間。建立後請使用下方連結進行設置或分享。
          </p>

          <button
            onClick={handleCreateRoom}
            disabled={creating || activeRooms.length >= 5}
            className={`w-full py-3 rounded-lg font-bold mb-8 transition-colors ${
              creating || activeRooms.length >= 5
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {creating ? '建立中...' : activeRooms.length >= 5 ? '已達房間上限' : '建立新房間'}
          </button>

          {activeRooms.length > 0 ? (
            <div className="space-y-4">
              {activeRooms.map((room) => (
                <div key={room.id} className="bg-gray-700 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-900 px-3 py-1 rounded font-mono text-yellow-400 font-bold">
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8 bg-gray-900/50 rounded-lg border border-gray-700 border-dashed">
              目前沒有進行中的房間
            </div>
          )}
        </div>

        {/* Historical Room Records */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
            <h2 className="text-xl font-bold">歷史房間記錄</h2>
            <button 
              onClick={loadData}
              className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition-colors"
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
                <thead className="text-gray-400 bg-gray-900/50 border-b border-gray-700">
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
                      <tr key={m.id} className="hover:bg-gray-700/50 transition-colors">
                        <td className="py-3 px-4 align-top">{dateStr}</td>
                        <td className="py-3 px-4 align-top">
                          <span className="font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-300">
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
                                <span className="text-xs bg-gray-600 px-1.5 rounded">
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
                                <span className="text-xs bg-gray-600 px-1.5 rounded">
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
      </div>
    </div>
  );
};

export default OperatorDashboard;
