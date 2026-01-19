import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from './config';
import { getMember, listMembers, updateMember, renewMembership, getMemberMatches } from './lib/api';

const MemberProfile: React.FC = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const [renewLoading, setRenewLoading] = useState(false);
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        if (!id) {
          if (!session?.email) throw new Error('缺少會員識別');
          setMember({ id: session.email, email: session.email, name: '-', district_code: '-', created_at: Date.now() });
        } else {
          try {
            const data = await getMember(API_URL, id);
            if (mounted) setMember(data.member ?? data);
          } catch (e: any) {
            const idDecoded = decodeURIComponent(String(id));
            if (idDecoded.includes('@')) {
              const optionalRaw = localStorage.getItem('memberOptional') || '{}';
              let optional = {};
              try { optional = JSON.parse(optionalRaw); } catch {}
              const opt = (optional as any)[idDecoded] || {};
              let districtCodeLocal: string | undefined;
              let memberCodeLocal: string | undefined;
              let nameLocal: string | undefined;
              try {
                const dirRaw = localStorage.getItem('memberDirectory') || '{}';
                const dir = JSON.parse(dirRaw);
                if (dir[idDecoded]) {
                  nameLocal = dir[idDecoded].name;
                  districtCodeLocal = dir[idDecoded].districtCode;
                  memberCodeLocal = dir[idDecoded].memberCode;
                }
              } catch {}
              if (!memberCodeLocal || !districtCodeLocal) {
                try {
                  const pendRaw = localStorage.getItem('pendingRegistrations') || '[]';
                  const pend = JSON.parse(pendRaw);
                  const found = (pend as any[]).find((p) => String(p.email) === idDecoded);
                  if (found) {
                    nameLocal = nameLocal || found.name;
                    districtCodeLocal = districtCodeLocal || found.districtCode;
                    memberCodeLocal = memberCodeLocal || found.memberCode;
                  }
                } catch {}
              }
              if (mounted) {
                setMember({
                  id: idDecoded,
                  email: idDecoded,
                  name: nameLocal || '-',
                  district_code: districtCodeLocal || '-',
                  created_at: Date.now(),
                  member_code: memberCodeLocal || null,
                  optional: opt,
                });
                setError(null);
              }
            } else {
              throw e;
            }
          }
        }
      } catch (err: any) {
        if (mounted) setError(err.message || '載入失敗');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (!member?.id) return;
    (async () => {
      setMatchesLoading(true);
      try {
        const res = await getMemberMatches(API_URL, String(member.id));
        setMatches(res.matches || []);
      } catch (e) {
        console.error('Failed to load matches', e);
      } finally {
        setMatchesLoading(false);
      }
    })();
  }, [member?.id]);

  if (loading) return <div style={{ padding: 16 }}>載入中...</div>;
  if (error) return <div style={{ padding: 16, color: 'red' }}>{error}</div>;
  if (!member) return <div style={{ padding: 16 }}>查無資料</div>;

  const optionalDisplay = (() => {
    try {
      const key = String(member.email || member.id || '');
      const raw = localStorage.getItem('memberOptional') || '{}';
      const store = JSON.parse(raw);
      return store[key] || {};
    } catch { return {}; }
  })();
  const phoneDisplay = String((member.phone ?? optionalDisplay.phone ?? '') || '') || '-';
  const birthDisplay = String((member.birthDate ?? optionalDisplay.birthDate ?? '') || '') || '-';
  const membershipExpiryDisplay = (() => {
    const raw = (member.membership_expires_at || member.membershipExpiresAt) as string | undefined;
    if (!raw) return '-';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleDateString();
  })();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-3xl mx-auto grid gap-6">
        <div className="bg-gray-800 rounded-xl p-4">
          <h2 className="text-xl font-bold mb-3">會員資料</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div><span className="font-semibold">ID：</span>{String(member.id || '-')}</div>
            <div><span className="font-semibold">姓名：</span>{String(member.name || '-')}</div>
            <div><span className="font-semibold">Email：</span>{String(member.email || '-')}</div>
            <div><span className="font-semibold">會員編碼：</span>{String(member.member_code || '無')}</div>
            <div><span className="font-semibold">地區代碼：</span>{String(member.district_code || '未設定')}</div>
            <div><span className="font-semibold">建立時間：</span>{member.created_at ? new Date(member.created_at).toLocaleString() : '-'}</div>
            <div><span className="font-semibold">電話：</span>{phoneDisplay}</div>
            <div><span className="font-semibold">出生日期：</span>{birthDisplay}</div>
            <div><span className="font-semibold">會員有效期：</span>{membershipExpiryDisplay}</div>
          </div>
          <div className="text-xs text-gray-400 mt-2">必填資料不可更改；選填資料可於下方更新</div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">會員有效期與續期</h3>
          <div className="mb-3">
            <div><span className="font-semibold">目前有效期：</span>{membershipExpiryDisplay}</div>
          </div>
          <button
            disabled={renewLoading || !member.id}
            onClick={async () => {
              try {
                setRenewLoading(true);
                const targetId = String(member.id);
                const res = await renewMembership(API_URL, targetId);
                const updated = res.member ?? res;
                setMember((prev: any) => ({ ...(prev || member), ...updated }));
                setToast('續期申請成功，已延長 3 年');
                setTimeout(() => setToast(null), 3000);
              } catch (e: any) {
                setToast(e?.message || '續期申請失敗');
                setTimeout(() => setToast(null), 3000);
              } finally {
                setRenewLoading(false);
              }
            }}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renewLoading ? '申請中...' : '申請續期（+3 年）'}
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">更新選填資料</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">電話</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
            <div>
              <label className="block text-sm mb-1">出生日期</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={() => {
                (async () => {
                  try {
                    const params = new URLSearchParams(window.location.search);
                    const tokenFromUrl = params.get('token') || '';
                    const tokenSaved = localStorage.getItem('adminToken') || '';
                    const adminToken = tokenFromUrl || tokenSaved;
                    if (adminToken) {
                      let targetId: any = member.id;
                      const idStr = String(targetId || '');
                      if (idStr.includes('@')) {
                        try {
                          const data = await listMembers(API_URL, adminToken);
                          const found = (data?.members || []).find((m: any) => String(m.email || '').trim() === String(member.email || '').trim());
                          if (found) targetId = found.id;
                        } catch {}
                      }
                      if (targetId && !String(targetId).includes('@')) {
                        await updateMember(API_URL, adminToken, targetId, { phone, birthDate });
                        setToast('已同步到後端');
                        setTimeout(() => setToast(null), 3000);
                        return;
                      }
                    }
                  } catch {}
                  try {
                    const storeRaw = localStorage.getItem('memberOptional');
                    const store = storeRaw ? JSON.parse(storeRaw) : {};
                    const key = String(member.email || member.id);
                    store[key] = { phone, birthDate, updatedAt: Date.now() };
                    localStorage.setItem('memberOptional', JSON.stringify(store));
                    setToast('已更新（本地）');
                    setTimeout(() => setToast(null), 3000);
                  } catch {}
                })();
              }}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
            >
              儲存
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">重設密碼</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">新密碼</label>
              <input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
            <div>
              <label className="block text-sm mb-1">確認新密碼</label>
              <input type="password" value={resetPwd2} onChange={(e) => setResetPwd2(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white" />
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={async () => {
                if (!resetPwd || resetPwd !== resetPwd2) { setToast('密碼不一致'); setTimeout(() => setToast(null), 2000); return; }
                try {
                  const enc = new TextEncoder().encode(resetPwd);
                  const digest = await crypto.subtle.digest('SHA-256', enc);
                  const arr = Array.from(new Uint8Array(digest));
                  const h = arr.map(b => b.toString(16).padStart(2, '0')).join('');
                  const storeRaw = localStorage.getItem('memberPasswords');
                  const store = storeRaw ? JSON.parse(storeRaw) : {};
                  const key = String(member.email || member.id);
                  store[key] = h;
                  localStorage.setItem('memberPasswords', JSON.stringify(store));
                  setToast('已重設密碼（本地）');
                  setTimeout(() => setToast(null), 3000);
                } catch {}
              }}
              className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700"
            >
              重設密碼
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">比賽歷史</h3>
          {matchesLoading ? (
            <div>載入中...</div>
          ) : matches.length === 0 ? (
            <div className="text-gray-400 text-sm">尚無比賽記錄</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-gray-400 border-b border-gray-700">
                  <tr>
                    <th className="py-2 px-2">日期</th>
                    <th className="py-2 px-2">賽事</th>
                    <th className="py-2 px-2">操作員</th>
                    <th className="py-2 px-2">比分</th>
                    <th className="py-2 px-2">對手</th>
                    <th className="py-2 px-2">結果</th>
                    <th className="py-2 px-2">最高單杆</th>
                    <th className="py-2 px-2">用時</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => {
                    const myPlayer = m.players.find((p: any) => p.member.id === member.id || p.member.name === member.name) || m.players[0];
                    const opponent = m.players.find((p: any) => p.id !== myPlayer.id);
                    const isWinner = m.winner_member_id === myPlayer.member.id;
                    const duration = m.started_at && m.ended_at ? Math.round((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 60000) + ' 分鐘' : '-';
                    
                    return (
                      <tr key={m.id} className="border-b border-gray-700 hover:bg-gray-750">
                        <td className="py-2 px-2">
                          {new Date(m.started_at).toLocaleDateString()}
                          <br/>
                          <span className="text-xs text-gray-400">{new Date(m.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs text-gray-400">
                            局數: {m.frames_required}
                            {(m.handicap0 > 0 || m.handicap1 > 0) && ` | 讓分: ${m.handicap0}/${m.handicap1}`}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                           {m.operator?.name || '-'}<br/>
                           <span className="text-xs text-gray-400">{m.operator?.club_name || '-'}</span>
                        </td>
                        <td className="py-2 px-2 font-bold">
                          {myPlayer.frames_won} - {opponent?.frames_won || 0}
                        </td>
                        <td className="py-2 px-2">
                          {opponent?.member?.name || '-'}<br/>
                          {/* <span className="text-xs text-gray-400">讓分: ?</span> */}
                        </td>
                        <td className="py-2 px-2">
                          <span className={isWinner ? 'text-green-400' : 'text-red-400'}>
                            {isWinner ? '勝' : '負'}
                          </span>
                        </td>
                        <td className="py-2 px-2">{myPlayer.max_break_points}</td>
                        <td className="py-2 px-2">{duration}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {toast && <div className="text-green-400">{toast}</div>}
      </div>
    </div>
  );
};

export default MemberProfile;
