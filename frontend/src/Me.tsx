import React, { useEffect, useMemo, useState } from 'react';
import BottomNavPublic from './components/BottomNavPublic';
import { API_URL } from './config';
import { getMember, getMemberMatches, getMyJoinedClubs, getPublicLiveAnnouncements } from './lib/api';
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
  const [activeTab, setActiveTab] = useState<'matches' | 'clubs' | 'live' | 'settings'>('clubs');

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
                  <div className="font-semibold text-lg mb-2">設定</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a href={`/member/${memberId}`} className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold">
                      個人資料
                    </a>
                    <a href="/members/login" className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold">
                      切換帳號
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        try { localStorage.removeItem('memberSession'); } catch {}
                        window.location.href = '/me';
                      }}
                      className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold text-left"
                    >
                      登出
                    </button>
                  </div>
                </div>

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
                            {matches.slice(0, 5).map((m, idx) => (
                              <div key={m.id || idx} className="cue-surface rounded-lg px-3 py-2 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">{m.opponentName || '對手'}</div>
                                  <div className="text-xs cue-muted mt-1">{m.duration || ''}</div>
                                </div>
                                <div className="flex-shrink-0 font-semibold accent-yellow">{m.score || '-'}</div>
                              </div>
                            ))}
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
                            {joinedClubs.slice(0, 5).map((r: any, idx: number) => {
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
