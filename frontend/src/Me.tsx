import React, { useEffect, useMemo, useState } from 'react';
import BottomNavPublic from './components/BottomNavPublic';
import { API_URL } from './config';
import { getMember, getMemberMatches, getMyJoinedClubs, getPublicLiveAnnouncements, updateMemberSelf } from './lib/api';
import Tabs from './components/Tabs';

function normalizeHttpUrl(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

const Me: React.FC = () => {
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  })() as { id?: string; email?: string };
  const memberId = session?.id;
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [joinedClubs, setJoinedClubs] = useState<any[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'clubs' | 'live' | 'history' | 'settings'>('clubs');
  const [editMode, setEditMode] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editClubName, setEditClubName] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editNewPassword2, setEditNewPassword2] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const displayName = useMemo(() => String(profile?.name || 'Member'), [profile?.name]);
  const avatarText = useMemo(() => {
    const s = String(profile?.name || session?.email || 'M').trim();
    return (s.slice(0, 1) || 'M').toUpperCase();
  }, [profile?.name, session?.email]);

  useEffect(() => {
    (async () => {
      if (!memberId) return;
      setLoading(true);
      try {
        const m = await getMember(API_URL, memberId);
        setProfile(m);
        const list = await getMemberMatches(API_URL, memberId);
        setMatches(list.matches || []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [memberId]);

  useEffect(() => {
    if (!memberId || !profile) return;
    setEditPhone(String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? '') || '');
    setEditClubName(String(profile?.club_name ?? profile?.clubName ?? profile?.club?.name ?? '') || '');
    const bd = profile?.birthDate ?? profile?.birth_date;
    if (bd) {
      const d = new Date(bd);
      if (!Number.isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setEditBirthDate(`${d.getFullYear()}-${mm}-${dd}`);
      }
    }
  }, [memberId, profile]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!memberId) return;
      setClubsLoading(true);
      try {
        const rows = await getMyJoinedClubs(API_URL, memberId);
        if (mounted) setJoinedClubs(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setJoinedClubs([]);
      } finally {
        if (mounted) setClubsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [memberId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLiveLoading(true);
      try {
        const rows = await getPublicLiveAnnouncements(API_URL, 20);
        if (mounted) setLiveAnnouncements(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setLiveAnnouncements([]);
      } finally {
        if (mounted) setLiveLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <main
        className="flex-1 pb-24"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))',
        }}
      >
        <div className="relative">
          <div className="h-40 sm:h-56 w-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950" />
          </div>
          <div className="-mt-8 px-4">
            <div className="max-w-2xl mx-auto glass rounded-xl p-4 sm:p-5">
              {!memberId ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold accent-yellow">尚未登入</div>
                    <div className="text-sm cue-muted mt-1">請先登入或註冊</div>
                  </div>
                  <div className="flex gap-2">
                    <a href="/members/login" className="cue-button px-4 py-2 rounded">登入</a>
                    <a href="/members/register" className="px-4 py-2 rounded cue-surface-strong hover:brightness-95">註冊</a>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-white/90 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <div className="text-slate-800 font-extrabold">{avatarText}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl sm:text-2xl font-extrabold accent-yellow truncate">
                        {profile?.name || 'Member'}
                      </div>
                      <div className="text-sm cue-muted truncate">{profile?.email || session?.email}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 mt-4">
          <div className="max-w-2xl mx-auto">
            {!!memberId && (
              <Tabs
                items={[
                  { key: 'matches', label: '比賽' },
                  { key: 'clubs', label: '場館' },
                  { key: 'live', label: '直播' },
                  { key: 'history', label: '歷史記錄' },
                  { key: 'settings', label: '設定' },
                ]}
                activeKey={activeTab}
                onChange={(k) => setActiveTab(k as any)}
              />
            )}

            {!!memberId && activeTab === 'matches' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="font-semibold text-lg mb-2">最近比賽</div>
                  {loading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!loading && matches.length === 0 && <div className="text-sm cue-muted">暫無資料</div>}
                  {!loading && matches.length > 0 && (
                    <div className="space-y-2">
                      {matches.slice(0, 20).map((m, idx) => (
                        <div key={m.id || idx} className="cue-surface-strong rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{m.opponentName || '對手'}</div>
                            <div className="text-xs cue-muted mt-1">{m.duration || ''}</div>
                          </div>
                          <div className="flex-shrink-0 font-semibold accent-yellow">{m.score || '-'}</div>
                        </div>
                      ))}
                      {matches.length > 20 && <div className="text-xs cue-muted">只顯示最近 20 筆</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!!memberId && activeTab === 'clubs' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="font-semibold text-lg mb-2">已加入場館</div>
                  {clubsLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!clubsLoading && joinedClubs.length === 0 && <div className="text-sm cue-muted">暫未加入任何場館</div>}
                  {!clubsLoading && joinedClubs.length > 0 && (
                    <div className="space-y-2">
                      {joinedClubs.slice(0, 20).map((r: any, idx: number) => {
                        const c = r?.club || {};
                        const id = String(r?.clubId || c?.id || '');
                        return (
                          <a
                            key={r.id || `${id}-${idx}`}
                            href={id ? `/club/${id}` : '#'}
                            className="block cue-surface-strong rounded-lg p-3 hover:brightness-95"
                          >
                            <div className="font-semibold truncate">{c?.name || '場館'}</div>
                            <div className="text-xs cue-muted mt-1 truncate">{c?.address || ''}</div>
                          </a>
                        );
                      })}
                      {joinedClubs.length > 20 && <div className="text-xs cue-muted">只顯示最近 20 筆</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!!memberId && activeTab === 'live' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="font-semibold text-lg mb-2">直播通告</div>
                  {liveLoading && <div className="text-sm cue-muted">讀取中…</div>}
                  {!liveLoading && liveAnnouncements.length === 0 && <div className="text-sm cue-muted">暫無通告</div>}
                  {!liveLoading && liveAnnouncements.length > 0 && (
                    <div className="space-y-2">
                      {liveAnnouncements.slice(0, 20).map((it: any) => (
                        <div key={it.id} className="cue-surface-strong rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{it.title}</div>
                            <div className="text-xs cue-muted mt-1">
                              {it.club?.name ? `${it.club.name} · ` : ''}
                              {it.startsAt ? new Date(it.startsAt).toLocaleString() : ''}
                            </div>
                          </div>
                          {normalizeHttpUrl(it.liveUrl) && (
                            <a href={normalizeHttpUrl(it.liveUrl) as string} target="_blank" rel="noreferrer" className="accent-blue underline flex-shrink-0">
                              觀看
                            </a>
                          )}
                        </div>
                      ))}
                      {liveAnnouncements.length > 20 && <div className="text-xs cue-muted">只顯示最近 20 筆</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!!memberId && activeTab === 'settings' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold text-lg">會員資料</div>
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={() => {
                        setToast(null);
                        setEditMode((v) => !v);
                      }}
                      className={`px-3 py-1 rounded text-sm font-semibold ${savingProfile ? 'cue-surface-strong cue-muted' : 'cue-surface-strong hover:brightness-95'}`}
                    >
                      {editMode ? '取消編輯' : '編輯資料'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">ID</div>
                      <div className="text-sm font-semibold text-right">{String(memberId || '-')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">姓名</div>
                      <div className="text-sm font-semibold text-right">{String(profile?.name || '-')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">Email</div>
                      <div className="text-sm font-semibold text-right">{String(profile?.email || session?.email || '-')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">會員編碼</div>
                      <div className="text-sm font-semibold text-right">{String(profile?.member_code || profile?.memberCode || '無')}</div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">建立時間</div>
                      <div className="text-sm font-semibold text-right">
                        {profile?.created_at
                          ? new Date(profile.created_at).toLocaleString()
                          : profile?.createdAt
                            ? new Date(profile.createdAt).toLocaleString()
                            : '-'}
                      </div>
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">電話</div>
                      {editMode ? (
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="例如：61234567 或 +85261234567"
                          className="w-64 max-w-[65%] px-3 py-1.5 rounded cue-surface text-sm"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(() => {
                            try {
                              const key = String(profile?.email || memberId || '');
                              const raw = localStorage.getItem('memberOptional') || '{}';
                              const store = JSON.parse(raw);
                              const opt = store[key] || {};
                              const v = String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? opt.phone ?? '') || '-';
                              return v || '-';
                            } catch {
                              return String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? '-') || '-';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">出生日期</div>
                      {editMode ? (
                        <input
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className="w-64 max-w-[65%] px-3 py-1.5 rounded cue-surface text-sm"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {(() => {
                            try {
                              const key = String(profile?.email || memberId || '');
                              const raw = localStorage.getItem('memberOptional') || '{}';
                              const store = JSON.parse(raw);
                              const opt = store[key] || {};
                              const v = String(profile?.birthDate ?? profile?.birth_date ?? opt.birthDate ?? '') || '-';
                              return v || '-';
                            } catch {
                              return String(profile?.birthDate ?? profile?.birth_date ?? '-') || '-';
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="cue-surface-strong rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                      <div className="text-sm cue-muted">所屬球會</div>
                      {editMode ? (
                        <input
                          value={editClubName}
                          onChange={(e) => setEditClubName(e.target.value)}
                          placeholder="未設定"
                          className="w-64 max-w-[65%] px-3 py-1.5 rounded cue-surface text-sm"
                        />
                      ) : (
                        <div className="text-sm font-semibold text-right">
                          {String(profile?.club_name || profile?.clubName || profile?.club?.name || '未設定')}
                        </div>
                      )}
                    </div>
                  </div>
                  {toast && <div className="mt-3 text-sm cue-muted">{toast}</div>}
                  {editMode && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={async () => {
                          if (!memberId) return;
                          try {
                            setSavingProfile(true);
                            const res = await updateMemberSelf(API_URL, memberId, {
                              phone: String(editPhone || '').trim(),
                              birthDate: String(editBirthDate || '').trim(),
                              clubName: String(editClubName || '').trim(),
                            });
                            const next = (res as any)?.member ?? res;
                            setProfile(next);
                            try {
                              const key = String(next?.email || memberId || '');
                              const raw = localStorage.getItem('memberOptional') || '{}';
                              const store = JSON.parse(raw);
                              store[key] = { ...(store[key] || {}), phone: String(editPhone || '').trim(), birthDate: String(editBirthDate || '').trim() };
                              localStorage.setItem('memberOptional', JSON.stringify(store));
                            } catch {}
                            setToast('已更新資料');
                            setEditMode(false);
                          } catch (e: any) {
                            setToast(String(e?.message || '更新失敗'));
                          } finally {
                            setSavingProfile(false);
                          }
                        }}
                        className={`px-4 py-2 rounded font-semibold ${savingProfile ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                      >
                        儲存
                      </button>
                      <button
                        type="button"
                        disabled={savingProfile}
                        onClick={() => {
                          setEditMode(false);
                          setToast(null);
                          setEditPhone(String(profile?.phone ?? profile?.phone_e164 ?? profile?.phoneE164 ?? '') || '');
                          setEditClubName(String(profile?.club_name ?? profile?.clubName ?? profile?.club?.name ?? '') || '');
                          setEditBirthDate('');
                          const bd = profile?.birthDate ?? profile?.birth_date;
                          if (bd) {
                            const d = new Date(bd);
                            if (!Number.isNaN(d.getTime())) {
                              const mm = String(d.getMonth() + 1).padStart(2, '0');
                              const dd = String(d.getDate()).padStart(2, '0');
                              setEditBirthDate(`${d.getFullYear()}-${mm}-${dd}`);
                            }
                          }
                        }}
                        className="px-4 py-2 rounded font-semibold cue-surface-strong hover:brightness-95"
                      >
                        取消
                      </button>
                    </div>
                  )}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        try { localStorage.removeItem('memberSession'); } catch {}
                        window.location.href = '/me';
                      }}
                      className="w-full px-4 py-2 rounded bg-red-700 hover:bg-red-600 text-white font-semibold"
                    >
                      登出
                    </button>
                  </div>
                </div>

                <details className="cue-surface rounded-lg p-4">
                  <summary className="cursor-pointer font-semibold text-lg">更改密碼</summary>
                  <div className="mt-3 space-y-2">
                    <input
                      type="password"
                      value={editNewPassword}
                      onChange={(e) => setEditNewPassword(e.target.value)}
                      placeholder="新密碼（至少 6 位）"
                      className="w-full px-3 py-2 rounded cue-surface-strong"
                    />
                    <input
                      type="password"
                      value={editNewPassword2}
                      onChange={(e) => setEditNewPassword2(e.target.value)}
                      placeholder="再次輸入新密碼"
                      className="w-full px-3 py-2 rounded cue-surface-strong"
                    />
                    <button
                      type="button"
                      disabled={savingPassword}
                      onClick={async () => {
                        if (!memberId) return;
                        const p1 = String(editNewPassword || '');
                        const p2 = String(editNewPassword2 || '');
                        if (p1.length < 6) return setToast('新密碼至少 6 位');
                        if (p1 !== p2) return setToast('兩次新密碼不一致');
                        try {
                          setSavingPassword(true);
                          const res = await updateMemberSelf(API_URL, memberId, { password: p1 });
                          const next = (res as any)?.member ?? res;
                          setProfile(next);
                          setEditNewPassword('');
                          setEditNewPassword2('');
                          setToast('已更新密碼');
                        } catch (e: any) {
                          setToast(String(e?.message || '更新失敗'));
                        } finally {
                          setSavingPassword(false);
                        }
                      }}
                      className={`w-full px-4 py-2 rounded font-semibold ${savingPassword ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                    >
                      更新密碼
                    </button>
                  </div>
                </details>
              </div>
            )}

            {!!memberId && activeTab === 'history' && (
              <div className="mt-5 space-y-6">
                <div className="cue-surface rounded-lg p-4">
                  <div className="font-semibold text-lg mb-2">歷史記錄</div>
                  <div className="space-y-3">
                    <details className="cue-surface-strong rounded-lg px-3 py-2">
                      <summary className="cursor-pointer font-semibold">最近比賽</summary>
                      <div className="mt-2 space-y-2">
                        {loading && <div className="text-sm cue-muted">讀取中…</div>}
                        {!loading && matches.length === 0 && <div className="text-sm cue-muted">暫無資料</div>}
                        {!loading && matches.length > 0 && (
                          <div className="space-y-2">
                            {matches.slice(0, 20).map((m, idx) => (
                              <div key={m.id || idx} className="cue-surface rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{m.opponentName || '對手'}</div>
                                  <div className="text-xs cue-muted mt-1">{m.duration || ''}</div>
                                </div>
                                <div className="flex-shrink-0 font-semibold accent-yellow">{m.score || '-'}</div>
                              </div>
                            ))}
                            {matches.length > 20 && <div className="text-xs cue-muted">只顯示最近 20 筆</div>}
                          </div>
                        )}
                      </div>
                    </details>

                    <details className="cue-surface-strong rounded-lg px-3 py-2">
                      <summary className="cursor-pointer font-semibold">已加入場館</summary>
                      <div className="mt-2 space-y-2">
                        {clubsLoading && <div className="text-sm cue-muted">讀取中…</div>}
                        {!clubsLoading && joinedClubs.length === 0 && <div className="text-sm cue-muted">暫未加入任何場館</div>}
                        {!clubsLoading && joinedClubs.length > 0 && (
                          <div className="space-y-2">
                            {joinedClubs.slice(0, 20).map((r: any, idx: number) => {
                              const c = r?.club || {};
                              const id = String(r?.clubId || c?.id || '');
                              return (
                                <a
                                  key={r.id || `${id}-${idx}`}
                                  href={id ? `/club/${id}` : '#'}
                                  className="block cue-surface rounded-lg px-3 py-2 hover:brightness-95"
                                >
                                  <div className="font-semibold truncate">{c?.name || '場館'}</div>
                                  <div className="text-xs cue-muted mt-1 truncate">{c?.address || ''}</div>
                                </a>
                              );
                            })}
                            {joinedClubs.length > 20 && <div className="text-xs cue-muted">只顯示最近 20 筆</div>}
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Me;
