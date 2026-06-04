import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from './config';
import { getMember, listMembers, updateMember, getMemberMatches, getMyClubMessages, getMyJoinedClubs, getMyInvites, acceptInvite, getClubMessage, markClubMessageRead, hideClubMessages, getMyReservations, cancelMyReservation, getMyBreaks } from './lib/api';

function normalizeVideoHref(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

function linkifyText(text: any): React.ReactNode {
  const s = String(text ?? '');
  const parts = s.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
  return parts.map((p, idx) => {
    const isUrl = /^https?:\/\//i.test(p) || /^www\./i.test(p);
    if (!isUrl) return p;
    const href = normalizeVideoHref(p);
    if (!href) return p;
    return (
      <a key={idx} href={href} target="_blank" rel="noreferrer" className="accent-blue underline">
        {p}
      </a>
    );
  });
}

const MemberProfile: React.FC = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Record<string, true>>({});
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [joinedClubs, setJoinedClubs] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [breaksLoading, setBreaksLoading] = useState(false);
  const [openMessage, setOpenMessage] = useState<any | null>(null);
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetPwd2, setResetPwd2] = useState('');
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);
  const sessionEmail = (session as any)?.email;
  const sessionId = (session as any)?.id;
  const selfMemberId = sessionId ? String(sessionId) : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        if (!id) {
          if (!sessionEmail && !sessionId) throw new Error('缺少會員識別');
          const resolvedId = sessionId || sessionEmail;
          setMember({ id: resolvedId, email: sessionEmail || resolvedId, name: '-', district_code: '-', created_at: Date.now() });
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
  }, [id, sessionEmail, sessionId]);

  useEffect(() => {
    if (!member?.id) return;
    (async () => {
      setMatchesLoading(true);
      try {
        const isSelfView = !!selfMemberId && (String(member.id) === selfMemberId || String(member.email || '') === String(sessionEmail || ''));
        const memberIdForApi = isSelfView ? selfMemberId : String(member.id);
        const res = await getMemberMatches(API_URL, memberIdForApi);
        setMatches(res.matches || []);
        
        // Load messages and joined clubs if viewing self
        if (isSelfView) {
           getMyClubMessages(API_URL, selfMemberId).then(setMessages).catch(() => {});
           getMyJoinedClubs(API_URL, selfMemberId).then(setJoinedClubs).catch(() => {});
           getMyInvites(API_URL, selfMemberId).then(d => setInvites(d.invites || [])).catch(() => {});
           setBreaksLoading(true);
           getMyBreaks(API_URL, selfMemberId).then((rows) => setBreaks(Array.isArray(rows) ? rows : [])).catch(() => {}).finally(() => setBreaksLoading(false));
        }
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setMatchesLoading(false);
      }
    })();
  }, [member?.id, member?.email, selfMemberId, sessionEmail]);

  useEffect(() => {
    if (!selfMemberId) return;
    const clubs = Array.isArray(joinedClubs) ? joinedClubs : [];
    if (clubs.length === 0) {
      setReservations([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        setReservationsLoading(true);
        const rows = await Promise.all(
          clubs.map(async (j: any) => {
            const clubId = String(j?.clubId || j?.club?.id || '');
            if (!clubId) return [];
            const list = await getMyReservations(API_URL, clubId, selfMemberId).catch(() => []);
            return (Array.isArray(list) ? list : []).map((r: any) => ({ ...r, _club: j?.club || null, _clubId: clubId }));
          })
        );
        const flat = rows.flat();
        flat.sort((a: any, b: any) => new Date(String(b?.startAt)).getTime() - new Date(String(a?.startAt)).getTime());
        if (mounted) setReservations(flat);
      } finally {
        if (mounted) setReservationsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selfMemberId, joinedClubs]);

  if (loading) return <div className="brand-page p-4 cue-muted">載入中...</div>;
  if (error) return <div className="brand-page p-4 text-red-500">{error}</div>;
  if (!member) return <div className="brand-page p-4 cue-muted">查無資料</div>;

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

  return (
    <div className="brand-page p-4 sm:p-6">
      <div className="max-w-3xl mx-auto grid gap-6">
        <div className="glass rounded-xl p-4">
          <h2 className="text-xl font-bold mb-3">會員資料</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div><span className="font-semibold">ID：</span>{String(member.id || '-')}</div>
            <div><span className="font-semibold">姓名：</span>{String(member.name || '-')}</div>
            <div><span className="font-semibold">Email：</span>{String(member.email || '-')}</div>
            <div><span className="font-semibold">會員編碼：</span>{String(member.member_code || '無')}</div>
            <div><span className="font-semibold">建立時間：</span>{member.created_at ? new Date(member.created_at).toLocaleString() : '-'}</div>
            <div><span className="font-semibold">電話：</span>{phoneDisplay}</div>
            <div><span className="font-semibold">出生日期：</span>{birthDisplay}</div>
          </div>
          <div className="text-xs cue-muted mt-2">必填資料不可更改；選填資料可於下方更新</div>
        </div>

        {!!selfMemberId && (String(member.id) === selfMemberId || String(member.email || '') === String(sessionEmail || '')) && (
          <div className="glass rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-lg font-semibold">我的單杆歷史</h3>
              <div className="text-sm cue-muted">{breaksLoading ? '載入中...' : `${breaks.length} 筆`}</div>
            </div>
            {breaksLoading ? (
              <div className="cue-muted text-sm">載入中...</div>
            ) : breaks.length === 0 ? (
              <div className="cue-muted text-sm">暫無紀錄</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="cue-muted border-b cue-border">
                      <th className="py-2 px-2">日期</th>
                      <th className="py-2 px-2">場館</th>
                      <th className="py-2 px-2">分數</th>
                      <th className="py-2 px-2">影片</th>
                      <th className="py-2 px-2">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breaks.map((b: any) => (
                      <tr key={b.id} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">{b.recorded_at ? new Date(b.recorded_at).toLocaleDateString() : '-'}</td>
                        <td className="py-2 px-2">{b.club?.name || '-'}</td>
                        <td className="py-2 px-2 font-semibold accent-yellow">{b.points}</td>
                        <td className="py-2 px-2">
                          {normalizeVideoHref(b.video_url) ? (
                            <a href={normalizeVideoHref(b.video_url) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                              連結
                            </a>
                          ) : (
                            <span className="cue-muted">-</span>
                          )}
                        </td>
                        <td className="py-2 px-2 cue-muted">{b.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Club Messages */}
        {!!selfMemberId && (String(member.id) === selfMemberId || String(member.email || '') === String(sessionEmail || '')) && (
           <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-semibold">場館訊息 ({messages.length})</h3>
                {messages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={deletingMessages || Object.keys(selectedMessageIds).length === 0}
                      className={`px-3 py-1.5 rounded text-sm ${deletingMessages || Object.keys(selectedMessageIds).length === 0 ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                      onClick={async () => {
                        const ids = Object.keys(selectedMessageIds);
                        if (ids.length === 0) return;
                        if (!confirm(`確定要刪除已選 ${ids.length} 則訊息？`)) return;
                        try {
                          setDeletingMessages(true);
                          await hideClubMessages(API_URL, selfMemberId, ids);
                          setMessages(prev => prev.filter(m => !selectedMessageIds[String(m.id)]));
                          setSelectedMessageIds({});
                        } catch (e: any) {
                          alert(e.message || '刪除失敗');
                        } finally {
                          setDeletingMessages(false);
                        }
                      }}
                    >
                      刪除已選
                    </button>
                    <label className="flex items-center gap-2 text-sm cue-muted select-none">
                      <input
                        type="checkbox"
                        checked={messages.length > 0 && Object.keys(selectedMessageIds).length === messages.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const next: Record<string, true> = {};
                            for (const m of messages) next[String(m.id)] = true;
                            setSelectedMessageIds(next);
                          } else {
                            setSelectedMessageIds({});
                          }
                        }}
                      />
                      全選
                    </label>
                  </div>
                )}
              </div>
              {messages.length === 0 ? (
                 <div className="cue-muted text-sm">暫無訊息</div>
              ) : (
                  <ul className="rounded-md border cue-border overflow-hidden">
                    {messages.map((msg: any) => (
                      <li key={msg.id} className="flex items-center justify-between px-3 py-2 border-b cue-border last:border-b-0 hover:brightness-95">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={!!selectedMessageIds[String(msg.id)]}
                            onChange={(e) => setSelectedMessageIds(prev => {
                              const id = String(msg.id);
                              const next = { ...prev };
                              if (e.target.checked) next[id] = true;
                              else delete next[id];
                              return next;
                            })}
                          />
                          {!msg.read && <span className="inline-block w-2 h-2 rounded-full bg-blue-400" aria-label="unread"></span>}
                          <button
                            className={`text-left truncate hover:underline ${msg.read ? 'accent-blue' : 'accent-blue font-semibold'}`}
                            onClick={async () => {
                              try {
                                const full = await getClubMessage(API_URL, selfMemberId, String(msg.id));
                                setOpenMessage(full);
                                if (!msg.read) {
                                  await markClubMessageRead(API_URL, selfMemberId, String(msg.id));
                                  setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
                                }
                              } catch (e: any) {
                                alert(e.message || '讀取失敗');
                              }
                            }}
                            title={String(msg.title || '無標題')}
                          >
                            {String(msg.title || '無標題')}
                          </button>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-xs cue-muted">{msg.club?.name || '未知場館'}</div>
                          <div className="text-xs cue-muted">{new Date(msg.createdAt).toLocaleDateString()}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
              )}
           </div>
        )}

        {!!selfMemberId && (String(member.id) === selfMemberId || String(member.email || '') === String(sessionEmail || '')) && (
          <div className="glass rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-3">我的預約 ({reservations.length})</h3>
            {reservationsLoading ? (
              <div className="cue-muted text-sm">載入中...</div>
            ) : reservations.length === 0 ? (
              <div className="cue-muted text-sm">暫無預約</div>
            ) : (
                  <div className="space-y-2">
                {reservations.slice(0, 50).map((r: any) => {
                  const s = new Date(String(r?.startAt));
                  const e = new Date(String(r?.endAt));
                  const ok = Number.isFinite(s.getTime()) && Number.isFinite(e.getTime());
                  const status = String(r?.status || '').toUpperCase();
                  const ended = Number.isFinite(e.getTime()) && e.getTime() < Date.now() - 60_000;
                  const tag = status === 'PENDING'
                    ? { label: '待確認', bg: '#7c2d12', fg: '#fff' }
                    : status === 'CONFIRMED' && ended
                      ? { label: '已完成', bg: '#065f46', fg: '#fff' }
                      : status === 'CONFIRMED'
                        ? { label: '已確認', bg: '#1d4ed8', fg: '#fff' }
                        : status === 'CANCELLED'
                          ? { label: '已取消', bg: '#444', fg: '#ddd' }
                          : { label: status || '—', bg: '#444', fg: '#ddd' };
                  const clubName = String(r?._club?.name || r?.club?.name || r?._clubId || '');
                  const canCancel = status !== 'CANCELLED' && (!Number.isFinite(s.getTime()) || s.getTime() >= Date.now() - 60_000);
                  return (
                    <div key={String(r.id)} className="cue-surface rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{clubName || '球會'} · {String(r?.table?.name || '球枱')}</div>
                          <div className="text-xs cue-muted mt-1">
                            {ok ? `${s.toLocaleDateString()} ${s.toLocaleTimeString()} - ${e.toLocaleTimeString()}` : '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
                          <button
                            type="button"
                            disabled={!canCancel}
                            className={`px-3 py-1.5 rounded text-sm ${canCancel ? 'bg-red-700 hover:bg-red-600 text-white' : 'cue-surface-strong cue-muted'}`}
                            onClick={async () => {
                              const clubId = String(r?._clubId || r?.clubId || '');
                              if (!clubId) return;
                              if (!confirm('確定要刪除此預約（取消）嗎？')) return;
                              try {
                                await cancelMyReservation(API_URL, clubId, selfMemberId, String(r.id));
                                const clubs = Array.isArray(joinedClubs) ? joinedClubs : [];
                                const rows = await Promise.all(
                                  clubs.map(async (j: any) => {
                                    const cid = String(j?.clubId || j?.club?.id || '');
                                    if (!cid) return [];
                                    const list = await getMyReservations(API_URL, cid, selfMemberId).catch(() => []);
                                    return (Array.isArray(list) ? list : []).map((x: any) => ({ ...x, _club: j?.club || null, _clubId: cid }));
                                  })
                                );
                                const flat = rows.flat();
                                flat.sort((a: any, b: any) => new Date(String(b?.startAt)).getTime() - new Date(String(a?.startAt)).getTime());
                                setReservations(flat);
                              } catch (e: any) {
                                alert(e.message || '刪除失敗');
                              }
                            }}
                          >
                            刪除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {reservations.length > 50 && <div className="text-xs cue-muted">只顯示最近 50 筆</div>}
              </div>
            )}
          </div>
        )}

        {openMessage && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="cue-surface-strong rounded-lg shadow-xl max-w-lg w-full max-h-[85dvh] flex flex-col">
              <div className="px-4 py-3 border-b cue-border flex items-center justify-between">
                <div className="font-semibold truncate">{openMessage.title || '無標題'}</div>
                <button className="cue-muted hover:brightness-95" onClick={() => setOpenMessage(null)}>關閉</button>
              </div>
              <div className="px-4 py-3 space-y-2 overflow-y-auto overscroll-contain">
                <div className="text-xs cue-muted">來自：{openMessage.club?.name || '未知場館'}</div>
                <div className="text-xs cue-muted">{new Date(openMessage.createdAt).toLocaleString()}</div>
                <div className="whitespace-pre-wrap mt-2">{linkifyText(openMessage.content)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Match Invites */}
        {!!selfMemberId && (String(member.id) === selfMemberId || String(member.email || '') === String(sessionEmail || '')) && (
           <div className="glass rounded-xl p-4">
             <h3 className="text-lg font-semibold mb-3">比賽邀請 ({invites.length})</h3>
             {invites.length === 0 ? (
               <div className="cue-muted text-sm">暫無邀請</div>
             ) : (
               <div className="space-y-3">
                 {invites.map((it: any) => (
                   <div key={it.id} className="cue-surface p-3 rounded-lg">
                     <div className="flex items-center justify-between">
                       <div>
                         <div className="font-semibold">房間：{String(it.roomId)}</div>
                         <div className="text-xs cue-muted mt-0.5">狀態：{String(it.status)}</div>
                         {it.operator && (
                           <div className="text-xs cue-muted">邀請人：{it.operator.name || it.operator.email}</div>
                         )}
                       </div>
                       {String(it.status) === 'PENDING' ? (
                         <button
                           className="px-3 py-1.5 rounded bg-green-600 text-white text-sm"
                           onClick={async () => {
                             try {
                               await acceptInvite(API_URL, String(it.token), selfMemberId);
                               setInvites(prev => prev.map(p => p.id === it.id ? { ...p, status: 'ACCEPTED', acceptedAt: Date.now() } : p));
                             } catch (e: any) {
                               alert(e.message || '操作失敗');
                             }
                           }}
                         >
                           確認進入比賽
                         </button>
                       ) : (
                         <span className="text-xs cue-muted">已確認</span>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

        {/* Joined Clubs */}
        {!!selfMemberId && (String(member.id) === selfMemberId || String(member.email || '') === String(sessionEmail || '')) && (
           <div className="glass rounded-xl p-4" id="joined-clubs">
              <h3 className="text-lg font-semibold mb-3">已加入場館 ({joinedClubs.length})</h3>
              {joinedClubs.length === 0 ? (
                 <div className="cue-muted text-sm">尚未加入任何場館</div>
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {joinedClubs.map((jc: any) => (
                       <div key={jc.id} className="cue-surface p-3 rounded-lg flex justify-between items-center">
                          <div>
                             <div className="font-bold">{jc.club?.name || '未命名場館'}</div>
                             <div className="text-xs cue-muted">加入於: {new Date(jc.joinedAt).toLocaleDateString()}</div>
                          </div>
                          <a href={`/club/${jc.club?.id}`} target="_blank" className="accent-blue text-sm hover:underline">查看</a>
                       </div>
                    ))}
                 </div>
              )}
           </div>
        )}

        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">更新選填資料</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">電話</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
            </div>
            <div>
              <label className="block text-sm mb-1">出生日期</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
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
                    
                    // Priority 1: Admin Token (if admin is editing)
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
                        setToast('已同步到後端 (Admin)');
                        setTimeout(() => setToast(null), 3000);
                        // Update local state to reflect changes
                        setMember((prev: any) => ({ ...prev, phone, birth_date: birthDate }));
                        return;
                      }
                    }

                    // Priority 2: Self Update (if member/operator is editing themselves)
                    if (member.id && !String(member.id).includes('@')) {
                         try {
                             await import('./lib/api').then(m => m.updateMemberSelf(API_URL, member.id, { phone, birthDate }));
                             setToast('已同步到後端');
                             setTimeout(() => setToast(null), 3000);
                             setMember((prev: any) => ({ ...prev, phone, birth_date: birthDate }));
                             return;
                         } catch (e) {
                             console.warn('Self update failed, falling back to local storage', e);
                         }
                    }

                  } catch {}
                  try {
                    // Fallback: Local Storage (for pure frontend mode or guests)
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
              className="px-4 py-2 rounded brand-button text-black"
            >
              儲存
            </button>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">重設密碼</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">新密碼</label>
              <input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
            </div>
            <div>
              <label className="block text-sm mb-1">確認新密碼</label>
              <input type="password" value={resetPwd2} onChange={(e) => setResetPwd2(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
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
              className="px-4 py-2 rounded cue-button hover:brightness-95"
            >
              重設密碼
            </button>
          </div>
        </div>

        <div className="glass rounded-xl p-4">
          <h3 className="text-lg font-semibold mb-3">比賽歷史</h3>
          {matchesLoading ? (
            <div>載入中...</div>
          ) : matches.length === 0 ? (
            <div className="cue-muted text-sm">尚無比賽記錄</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="cue-muted border-b cue-border">
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
                    if (!m.players || !Array.isArray(m.players)) return null;
                    const myPlayer = m.players.find((p: any) => p.member?.id === member.id || p.member?.name === member.name) || m.players[0];
                    if (!myPlayer) return null;
                    const opponent = m.players.find((p: any) => p.id !== myPlayer.id);
                    const isWinner = m.winner_member_id === myPlayer.member?.id;
                    const duration = m.started_at && m.ended_at ? Math.round((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 60000) + ' 分鐘' : '-';
                    
                    return (
                      <tr key={m.id} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2">
                          {new Date(m.started_at).toLocaleDateString()}
                          <br/>
                          <span className="text-xs cue-muted">{new Date(m.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-medium">{m.name}</div>
                          <div className="text-xs cue-muted">
                            局數: {m.frames_required}
                            {(m.handicap0 > 0 || m.handicap1 > 0) && ` | 讓分: ${m.handicap0}/${m.handicap1}`}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                           {m.operator?.name || '-'}<br/>
                           <span className="text-xs cue-muted">{m.operator?.club_name || '-'}</span>
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

        {toast && <div className="text-emerald-600">{toast}</div>}
      </div>
    </div>
  );
};

export default MemberProfile;
