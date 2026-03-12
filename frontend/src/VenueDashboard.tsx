import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL, SOCKET_URL } from './config';
import { createOperatorRoom, getOperatorMatches, getOperatorActiveRooms, updateMemberSelf, deleteOperatorRoom, getClubProfile, updateClubProfile, getClubMembers, broadcastClubMessage, getMyTables, createTable, updateTable, deleteTable, getMyPricingSchemes, createPricingScheme, updatePricingScheme, deletePricingScheme, getPendingReservations, confirmReservation, cancelReservation } from './lib/api';
import { QRCodeSVG } from 'qrcode.react';

type PricingRule = {
  daysOfWeek?: number[];
  start?: string;
  end?: string;
  pricePerHour?: number | null;
};

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
  const [tables, setTables] = useState<any[]>([]);
  const [newTableName, setNewTableName] = useState('');
  const [newTableNotes, setNewTableNotes] = useState('');
  const [newTableBasePrice, setNewTableBasePrice] = useState('');
  const [pricing, setPricing] = useState<any[]>([]);
  const [newPricingTitle, setNewPricingTitle] = useState('');
  const [newPricingDesc, setNewPricingDesc] = useState('');
  const [newPricingPrice, setNewPricingPrice] = useState('');
  const [newPricingRules, setNewPricingRules] = useState<PricingRule[]>([]);
  const [pendingReservations, setPendingReservations] = useState<any[]>([]);
  
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const operatorId = session.id;
  const operatorName = session.name || session.email;
  const isOperator = session.role === 'ADMIN' || session.role === 'OPERATOR';

  const rawBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const baseUrl = `${window.location.origin}${rawBase}`;

  const weekDays = useMemo(() => ([
    { n: 1, label: '一' },
    { n: 2, label: '二' },
    { n: 3, label: '三' },
    { n: 4, label: '四' },
    { n: 5, label: '五' },
    { n: 6, label: '六' },
    { n: 7, label: '日' },
  ]), []);

  const normalizeRules = (rulesJson: any): PricingRule[] => {
    const arr = Array.isArray(rulesJson) ? rulesJson : [];
    return arr.map((r: any) => ({
      daysOfWeek: Array.isArray(r?.daysOfWeek) ? r.daysOfWeek.filter((x: any) => typeof x === 'number') : [],
      start: typeof r?.start === 'string' ? r.start : '09:00',
      end: typeof r?.end === 'string' ? r.end : '16:00',
      pricePerHour: r?.pricePerHour == null || r?.pricePerHour === '' ? null : Number(r.pricePerHour),
    }));
  };

  const toggleDayInRule = (rule: PricingRule, day: number): PricingRule => {
    const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek : [];
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
    return { ...rule, daysOfWeek: next };
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [matchesRes, roomsRes, clubProfileRes, clubMembersRes, tablesRes, pricingRes, pendingRes] = await Promise.all([
        getOperatorMatches(API_URL, operatorId),
        getOperatorActiveRooms(API_URL, operatorId),
        getClubProfile(API_URL, operatorId).catch(() => ({})),
        getClubMembers(API_URL, operatorId).catch(() => []),
        getMyTables(API_URL, operatorId).catch(() => []),
        getMyPricingSchemes(API_URL, operatorId).catch(() => []),
        getPendingReservations(API_URL, operatorId).catch(() => [])
      ]);
      setMatches(matchesRes.matches || []);
      setActiveRooms(roomsRes.rooms || []);
      setClubProfile(clubProfileRes || {});
      setClubMembers(clubMembersRes || []);
      setTables(tablesRes || []);
      setPricing(pricingRes || []);
      setPendingReservations(pendingRes || []);
    } catch (err: any) {
      setError(err.message || '無法載入資料');
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    if (!operatorId || !isOperator) {
      navigate('/venue/login');
      return;
    }

    loadData();
  }, [operatorId, isOperator, navigate, loadData]);

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

  if (!operatorId || !isOperator) return null;

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

        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">預約管理</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">球枱</h3>
              <div className="flex gap-2 mb-3">
                <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} className="flex-1 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" placeholder="球枱名稱" />
                <input value={newTableBasePrice} onChange={(e) => setNewTableBasePrice(e.target.value)} type="number" step="0.01" className="w-32 px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" placeholder="正價/時" />
                <button onClick={async () => {
                  if (!newTableName.trim()) return;
                  const row = await createTable(API_URL, operatorId, { name: newTableName.trim(), notes: newTableNotes.trim() || undefined, basePrice: newTableBasePrice.trim() || undefined });
                  setTables([...tables, row]);
                  setNewTableName(''); setNewTableNotes(''); setNewTableBasePrice('');
                }} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">新增</button>
              </div>
              <input value={newTableNotes} onChange={(e) => setNewTableNotes(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white mb-3" placeholder="備註" />
              <div className="space-y-2">
                {tables.map(t => (
                  <div key={t.id} className="flex items-center gap-2 bg-gray-800 p-2 rounded">
                    <input value={t.name} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))} className="flex-1 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white" />
                    <input value={t.basePrice ?? ''} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, basePrice: e.target.value } : x))} type="number" step="0.01" className="w-28 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm" placeholder="正價/時" />
                    <label className="text-sm flex items-center gap-1">
                      <input type="checkbox" checked={t.active} onChange={(e) => setTables(prev => prev.map(x => x.id === t.id ? { ...x, active: e.target.checked } : x))} />
                      啟用
                    </label>
                    <button onClick={async () => {
                      const cur = tables.find(x => x.id === t.id);
                      if (!cur) return;
                      const updated = await updateTable(API_URL, operatorId, t.id, { name: cur.name, active: cur.active, displayOrder: cur.displayOrder || 0, notes: cur.notes || null, basePrice: cur.basePrice ?? null });
                      setTables(prev => prev.map(x => x.id === t.id ? updated : x));
                    }} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">儲存</button>
                    <button onClick={async () => {
                      if (!window.confirm('確定要刪除此球枱？（已有預約紀錄的球枱將無法刪除，請改用停用）')) return;
                      try {
                        await deleteTable(API_URL, operatorId, t.id);
                        setTables(prev => prev.filter(x => x.id !== t.id));
                        setToast('球枱已刪除');
                        setTimeout(() => setToast(null), 2000);
                      } catch (e: any) {
                        setToast(e.message || '刪除失敗');
                        setTimeout(() => setToast(null), 3000);
                      }
                    }} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm">刪除</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">收費方案</h3>
              <div className="grid gap-2 mb-3">
                <input value={newPricingTitle} onChange={(e) => setNewPricingTitle(e.target.value)} className="px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" placeholder="方案標題" />
                <input value={newPricingDesc} onChange={(e) => setNewPricingDesc(e.target.value)} className="px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" placeholder="方案說明" />
                <input value={newPricingPrice} onChange={(e) => setNewPricingPrice(e.target.value)} type="number" step="0.01" className="px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" placeholder="價目（例如 180）" />
                <div className="bg-gray-900/40 border border-gray-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">生效時間規則</div>
                    <button
                      onClick={() => setNewPricingRules(prev => [...prev, { daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '16:00', pricePerHour: null }])}
                      className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                      type="button"
                    >
                      新增規則
                    </button>
                  </div>
                  {newPricingRules.length === 0 ? (
                    <div className="text-xs text-gray-400">不設定規則＝任何時間都可用（若要限定時段，請新增規則）</div>
                  ) : (
                    <div className="grid gap-2">
                      {newPricingRules.map((r, idx) => (
                        <div key={idx} className="bg-gray-800 rounded p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1">
                              {weekDays.map(d => {
                                const active = (r.daysOfWeek || []).includes(d.n);
                                return (
                                  <button
                                    key={d.n}
                                    type="button"
                                    onClick={() => setNewPricingRules(prev => prev.map((x, i) => i === idx ? toggleDayInRule(x, d.n) : x))}
                                    className={`px-2 py-1 rounded text-xs ${active ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-200'}`}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={r.start || '09:00'}
                                onChange={(e) => setNewPricingRules(prev => prev.map((x, i) => i === idx ? { ...x, start: e.target.value } : x))}
                                className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              />
                              <span className="text-gray-400 text-sm">-</span>
                              <input
                                type="time"
                                value={r.end || '16:00'}
                                onChange={(e) => setNewPricingRules(prev => prev.map((x, i) => i === idx ? { ...x, end: e.target.value } : x))}
                                className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              />
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              value={r.pricePerHour ?? ''}
                              onChange={(e) => setNewPricingRules(prev => prev.map((x, i) => i === idx ? { ...x, pricePerHour: e.target.value === '' ? null : Number(e.target.value) } : x))}
                              className="w-32 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              placeholder="$/小時(選填)"
                            />
                            <button
                              type="button"
                              onClick={() => setNewPricingRules(prev => prev.filter((_, i) => i !== idx))}
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                            >
                              刪除規則
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={async () => {
                  if (!newPricingTitle.trim()) return;
                  const row = await createPricingScheme(API_URL, operatorId, { title: newPricingTitle.trim(), description: newPricingDesc.trim() || undefined, rulesJson: newPricingRules, price: newPricingPrice.trim() || undefined });
                  setPricing([...pricing, row]);
                  setNewPricingTitle(''); setNewPricingDesc(''); setNewPricingPrice(''); setNewPricingRules([]);
                }} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700">新增方案</button>
              </div>
              <div className="space-y-2">
                {pricing.map(p => (
                  <div key={p.id} className="bg-gray-800 p-2 rounded">
                    <div className="flex items-center gap-2 mb-2">
                      <input value={p.title} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, title: e.target.value } : x))} className="flex-1 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white" />
                      <input value={p.price ?? ''} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, price: e.target.value } : x))} type="number" step="0.01" className="w-28 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm" placeholder="價目" />
                      <select value={p.tableId || ''} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, tableId: e.target.value || null } : x))} className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm">
                        <option value="">全部球枱</option>
                        {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <label className="text-sm flex items-center gap-1">
                        <input type="checkbox" checked={p.active} onChange={(e) => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, active: e.target.checked } : x))} />
                        啟用
                      </label>
                      <button onClick={async () => {
                        const cur = pricing.find(x => x.id === p.id);
                        if (!cur) return;
                        const updated = await updatePricingScheme(API_URL, operatorId, p.id, { title: cur.title, description: cur.description || null, rulesJson: cur.rulesJson, active: cur.active, price: cur.price === '' ? null : cur.price, tableId: cur.tableId || null });
                        setPricing(prev => prev.map(x => x.id === p.id ? updated : x));
                      }} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">儲存</button>
                      <button onClick={async () => {
                        if (!window.confirm('確定要刪除此方案？（已有預約紀錄的方案將無法刪除，請改用停用）')) return;
                        try {
                          await deletePricingScheme(API_URL, operatorId, p.id);
                          setPricing(prev => prev.filter(x => x.id !== p.id));
                          setToast('方案已刪除');
                          setTimeout(() => setToast(null), 2000);
                        } catch (e: any) {
                          setToast(e.message || '刪除失敗');
                          setTimeout(() => setToast(null), 3000);
                        }
                      }} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm">刪除</button>
                    </div>
                    <div className="bg-gray-900/40 border border-gray-700 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold">生效時間規則</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPricing(prev => prev.map(x => x.id === p.id ? { ...x, rulesJson: normalizeRules(x.rulesJson) } : x))}
                            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                          >
                            重新整理
                          </button>
                          <button
                            type="button"
                            onClick={() => setPricing(prev => prev.map(x => {
                              if (x.id !== p.id) return x;
                              const curRules = normalizeRules(x.rulesJson);
                              return { ...x, rulesJson: [...curRules, { daysOfWeek: [1, 2, 3, 4, 5], start: '09:00', end: '16:00', pricePerHour: null }] };
                            }))}
                            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
                          >
                            新增規則
                          </button>
                        </div>
                      </div>
                      {normalizeRules(p.rulesJson).length === 0 ? (
                        <div className="text-xs text-gray-400">不設定規則＝任何時間都可用（若要限定時段，請新增規則）</div>
                      ) : (
                        <div className="grid gap-2">
                          {normalizeRules(p.rulesJson).map((r, idx) => (
                            <div key={idx} className="bg-gray-800 rounded p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1">
                                  {weekDays.map(d => {
                                    const active = (r.daysOfWeek || []).includes(d.n);
                                    return (
                                      <button
                                        key={d.n}
                                        type="button"
                                        onClick={() => setPricing(prev => prev.map(x => {
                                          if (x.id !== p.id) return x;
                                          const rules = normalizeRules(x.rulesJson);
                                          rules[idx] = toggleDayInRule(rules[idx], d.n);
                                          return { ...x, rulesJson: rules };
                                        }))}
                                        className={`px-2 py-1 rounded text-xs ${active ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-200'}`}
                                      >
                                        {d.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={r.start || '09:00'}
                                    onChange={(e) => setPricing(prev => prev.map(x => {
                                      if (x.id !== p.id) return x;
                                      const rules = normalizeRules(x.rulesJson);
                                      rules[idx] = { ...rules[idx], start: e.target.value };
                                      return { ...x, rulesJson: rules };
                                    }))}
                                    className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                                  />
                                  <span className="text-gray-400 text-sm">-</span>
                                  <input
                                    type="time"
                                    value={r.end || '16:00'}
                                    onChange={(e) => setPricing(prev => prev.map(x => {
                                      if (x.id !== p.id) return x;
                                      const rules = normalizeRules(x.rulesJson);
                                      rules[idx] = { ...rules[idx], end: e.target.value };
                                      return { ...x, rulesJson: rules };
                                    }))}
                                    className="px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                                  />
                                </div>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={r.pricePerHour ?? ''}
                                  onChange={(e) => setPricing(prev => prev.map(x => {
                                    if (x.id !== p.id) return x;
                                    const rules = normalizeRules(x.rulesJson);
                                    rules[idx] = { ...rules[idx], pricePerHour: e.target.value === '' ? null : Number(e.target.value) };
                                    return { ...x, rulesJson: rules };
                                  }))}
                                  className="w-32 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                                  placeholder="$/小時(選填)"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPricing(prev => prev.map(x => {
                                    if (x.id !== p.id) return x;
                                    const rules = normalizeRules(x.rulesJson);
                                    const next = rules.filter((_, i) => i !== idx);
                                    return { ...x, rulesJson: next };
                                  }))}
                                  className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                                >
                                  刪除規則
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6">
            <h3 className="font-semibold mb-2">待確認預約</h3>
            {pendingReservations.length === 0 ? (
              <div className="text-gray-400">暫無待確認預約</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="py-2 px-3">會員</th>
                      <th className="py-2 px-3">球枱</th>
                      <th className="py-2 px-3">時間</th>
                      <th className="py-2 px-3">方案</th>
                      <th className="py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReservations.map((r: any) => (
                      <tr key={r.id} className="border-b border-gray-800">
                        <td className="py-2 px-3">{r.member?.name || r.member?.email || r.memberId}</td>
                        <td className="py-2 px-3">{r.table?.name || r.tableId}</td>
                        <td className="py-2 px-3 text-sm text-gray-300">{new Date(r.startAt).toLocaleString()} - {new Date(r.endAt).toLocaleTimeString()}</td>
                        <td className="py-2 px-3 text-sm">{r.pricingScheme?.title || '-'}</td>
                        <td className="py-2 px-3">
                          <div className="flex gap-2">
                            <button onClick={async () => {
                              try { await confirmReservation(API_URL, operatorId, r.id); setPendingReservations(prev => prev.filter(x => x.id !== r.id)); setToast('已確認'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                            }} className="px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-sm">確認</button>
                            <button onClick={async () => {
                              try { await cancelReservation(API_URL, operatorId, r.id); setPendingReservations(prev => prev.filter(x => x.id !== r.id)); setToast('已取消'); setTimeout(() => setToast(null), 2000); } catch (e: any) { setToast(e.message || '失敗'); setTimeout(() => setToast(null), 2000); }
                            }} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm">取消</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
