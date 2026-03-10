import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL, SOCKET_URL } from './config';
import { createOperatorRoom, getOperatorMatches, getOperatorActiveRooms, updateMemberSelf, deleteOperatorRoom, getClubProfile, updateClubProfile, getClubMembers, broadcastClubMessage } from './lib/api';
import { QRCodeSVG } from 'qrcode.react';

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
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const operatorId = session.id;
  const operatorName = session.name || session.email;

  const rawBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const baseUrl = `${window.location.origin}${rawBase}`;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [matchesRes, roomsRes, clubProfileRes, clubMembersRes] = await Promise.all([
        getOperatorMatches(API_URL, operatorId),
        getOperatorActiveRooms(API_URL, operatorId),
        getClubProfile(API_URL, operatorId).catch(() => ({})),
        getClubMembers(API_URL, operatorId).catch(() => [])
      ]);
      setMatches(matchesRes.matches || []);
      setActiveRooms(roomsRes.rooms || []);
      setClubProfile(clubProfileRes || {});
      setClubMembers(clubMembersRes || []);
    } catch (err: any) {
      setError(err.message || '無法載入資料');
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    if (!operatorId) {
      navigate('/venue/login');
      return;
    }

    loadData();
  }, [operatorId, navigate, loadData]);

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

  if (!operatorId) return null;

  return (
    <div className="brand-page text-white p-6">
      <div className="max-w-4xl mx-auto grid gap-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Snooker Live HK - 場館管理後台 <span className="text-sm font-normal text-yellow-500 ml-2">v2.1 Club</span></h1>
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

        {/* Club Profile Management */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">場館資料管理</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 text-gray-400">場館名稱 (Club Name)</label>
               <input 
                 value={clubProfile.name || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, name: e.target.value })} 
                 className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" 
                 placeholder="例如：南華會桌球室"
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 text-gray-400">場館簡介 (Intro)</label>
               <textarea 
                 value={clubProfile.intro || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, intro: e.target.value })} 
                 className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white h-24" 
                 placeholder="簡介..."
               />
            </div>
            <div>
               <label className="block text-sm mb-1 text-gray-400">聯絡電話 (Phone)</label>
               <input 
                 value={clubProfile.phone || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, phone: e.target.value })} 
                 className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" 
               />
            </div>
            <div>
               <label className="block text-sm mb-1 text-gray-400">聯絡 Email</label>
               <input 
                 value={clubProfile.email || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, email: e.target.value })} 
                 className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" 
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 text-gray-400">地址 (Address)</label>
               <input 
                 value={clubProfile.address || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, address: e.target.value })} 
                 className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" 
               />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm mb-1 text-gray-400">Logo URL</label>
               <input 
                 value={clubProfile.logoUrl || ''} 
                 onChange={(e) => setClubProfile({ ...clubProfile, logoUrl: e.target.value })} 
                 className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" 
                 placeholder="https://..."
               />
            </div>
          </div>
          
          <div className="mt-6 flex justify-between items-center">
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
            
            {clubProfile.id && (
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <QRCodeSVG value={`${baseUrl}/club/${clubProfile.id}`} size={64} />
                        <div className="text-xs text-gray-400 mt-1">入會二維碼</div>
                    </div>
                    <Link to={`/club/${clubProfile.id}`} target="_blank" className="text-blue-400 underline text-sm">
                        預覽公開頁面
                    </Link>
                </div>
            )}
          </div>
        </div>

        {/* Club Members List */}
        <div className="glass rounded-xl p-4 md:p-6">
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
             <h2 className="text-xl font-bold">場館會員 ({clubMembers.length})</h2>
             <button onClick={loadData} className="text-sm text-blue-400 hover:text-blue-300">重新整理</button>
          </div>
          
          {clubMembers.length === 0 ? (
             <div className="text-gray-400 text-center py-8">暫無會員加入</div>
          ) : (
             <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="text-gray-400 border-b border-gray-700">
                         <th className="py-2 px-3">名稱</th>
                         <th className="py-2 px-3">Email</th>
                         <th className="py-2 px-3">電話</th>
                         <th className="py-2 px-3">加入時間</th>
                      </tr>
                   </thead>
                   <tbody>
                      {clubMembers.map((cm: any) => (
                         <tr key={cm.id} className="border-b border-gray-800 hover:bg-gray-700/50">
                            <td className="py-2 px-3">{cm.member?.name || '-'}</td>
                            <td className="py-2 px-3 text-sm text-gray-400">{cm.member?.email || '-'}</td>
                            <td className="py-2 px-3 text-sm">{cm.member?.phone || '-'}</td>
                            <td className="py-2 px-3 text-sm text-gray-400">{new Date(cm.joinedAt).toLocaleDateString()}</td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          )}
        </div>

        {/* Broadcast Message */}
        <div className="glass rounded-xl p-6">
           <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">發送場館訊息</h2>
           <div className="space-y-4">
              <div>
                 <label className="block text-sm mb-1 text-gray-400">標題</label>
                 <input 
                   value={msgTitle}
                   onChange={(e) => setMsgTitle(e.target.value)}
                   className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white"
                   placeholder="訊息標題"
                 />
              </div>
              <div>
                 <label className="block text-sm mb-1 text-gray-400">內容</label>
                 <textarea 
                   value={msgContent}
                   onChange={(e) => setMsgContent(e.target.value)}
                   className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white h-24"
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

        {/* Edit Profile */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3">帳戶設定</h3>
          <div className="grid md:grid-cols-2 gap-3">
             <div className="md:col-span-2 text-gray-400 mb-2">
                當前登入帳號：{operatorName} ({session.email})
             </div>
          </div>
          
          <div className="mt-4 border-t border-gray-700 pt-4">
            <h4 className="text-md font-semibold mb-2">重設密碼</h4>
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
              className="mt-3 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              重設密碼
            </button>
          </div>
        </div>

        {/* Active Rooms Management */}
        <div className="glass rounded-xl p-6">
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
                : 'brand-button hover:brightness-95 text-black'
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
                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      disabled={deletingId === room.id}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        deletingId === room.id
                          ? 'bg-gray-600 cursor-not-allowed text-gray-400'
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

export default VenueDashboard;
