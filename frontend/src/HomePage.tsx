import React, { useEffect, useMemo, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';
import { API_URL } from './config';
import {
  getLeaderboardClubsHighest,
  getLeaderboardClubsMonthly,
  getLeaderboardMembersHighest,
  getLeaderboardMembersMonthly,
  getPublicClubs,
  getPublicLiveAnnouncements,
  getSiteNotice,
} from './lib/api';

function normalizeHttpUrl(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

function defaultMonthLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isSafeYoutubeEmbedUrl(raw: any): string | null {
  const href = normalizeHttpUrl(raw);
  if (!href) return null;
  try {
    const u = new URL(href);
    if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (host !== 'www.youtube.com' && host !== 'youtube.com') return null;
    if (!u.pathname.startsWith('/embed/')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const HomePage: React.FC = () => {
  const session = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('memberSession') || '{}');
    } catch {
      return {};
    }
  }, []) as { id?: string };
  const hasSession = !!session?.id;

  const [month, setMonth] = useState(defaultMonthLocal());

  const [notice, setNotice] = useState<any>(null);
  const [noticeLoading, setNoticeLoading] = useState(false);

  const [q, setQ] = useState('');
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  const [memberHighest, setMemberHighest] = useState<any[]>([]);
  const [memberMonthly, setMemberMonthly] = useState<any[]>([]);
  const [clubHighest, setClubHighest] = useState<any[]>([]);
  const [clubMonthly, setClubMonthly] = useState<any[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setNoticeLoading(true);
      try {
        const row = await getSiteNotice(API_URL);
        if (mounted) setNotice(row);
      } catch {
        if (mounted) setNotice(null);
      } finally {
        if (mounted) setNoticeLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const loadClubs = async (keyword?: string) => {
    setClubsLoading(true);
    try {
      const rows = await getPublicClubs(API_URL, { q: (keyword ?? q).trim(), limit: 100 });
      setClubs(Array.isArray(rows) ? rows : []);
    } catch {
      setClubs([]);
    } finally {
      setClubsLoading(false);
    }
  };

  useEffect(() => {
    loadClubs('');
  }, []);

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
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setBoardLoading(true);
      try {
        const [mh, mm, ch, cm] = await Promise.all([
          getLeaderboardMembersHighest(API_URL, 10).catch(() => []),
          getLeaderboardMembersMonthly(API_URL, month, 10).catch(() => []),
          getLeaderboardClubsHighest(API_URL, 10).catch(() => []),
          getLeaderboardClubsMonthly(API_URL, month, 10).catch(() => []),
        ]);
        if (!mounted) return;
        setMemberHighest(Array.isArray(mh) ? mh : []);
        setMemberMonthly(Array.isArray(mm) ? mm : []);
        setClubHighest(Array.isArray(ch) ? ch : []);
        setClubMonthly(Array.isArray(cm) ? cm : []);
      } finally {
        if (mounted) setBoardLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [month]);

  const youtubeEmbed = isSafeYoutubeEmbedUrl(notice?.youtubeEmbedUrl);
  const showNotice = notice && notice.enabled !== false && String(notice.message || '').trim();

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="主頁" />
      <main className="flex-1 px-4 pt-4 pb-20">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="cue-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="cue-zh-title">SnookerHK Live</div>
                <div className="cue-en-sub">Clubs · Breaks · Live</div>
              </div>
              <div className="flex gap-2">
                <a href="/members/login" className="cue-button px-4 py-2 rounded">
                  會員登入
                </a>
                <a href="/venue/login" className="px-4 py-2 rounded cue-surface-strong hover:brightness-95">
                  場館登入
                </a>
              </div>
            </div>
            {hasSession && (
              <div className="mt-3 text-sm cue-muted">
                已登入，可到 <a href="/me" className="accent-blue underline">個人</a> / <a href={`/member/${encodeURIComponent(session.id as string)}`} className="accent-blue underline">我的頁面</a>
              </div>
            )}
          </div>

          <div className="cue-card p-4">
            <div className="cue-zh-title mb-2">全站公告</div>
            {noticeLoading && <div className="text-sm cue-muted">讀取中…</div>}
            {!noticeLoading && !showNotice && <div className="text-sm cue-muted">暫無公告</div>}
            {!noticeLoading && showNotice && (
              <div className="text-sm whitespace-pre-wrap">{String(notice.message || '')}</div>
            )}
            {youtubeEmbed && (
              <div className="mt-3">
                <div className="aspect-video w-full cue-surface rounded overflow-hidden">
                  <iframe
                    src={youtubeEmbed}
                    title="YouTube Live"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>

          <div className="cue-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="cue-zh-title">場館搜尋</div>
              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="關鍵字（場館名 / 地址 / 電話）"
                  className="cue-input rounded px-3 py-2 text-sm w-64 max-w-[70vw]"
                />
                <button
                  type="button"
                  onClick={() => loadClubs()}
                  className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                  disabled={clubsLoading}
                >
                  搜尋
                </button>
              </div>
            </div>
            <div className="mt-3">
              {clubsLoading && <div className="text-sm cue-muted">讀取中…</div>}
              {!clubsLoading && clubs.length === 0 && <div className="text-sm cue-muted">找不到場館</div>}
              {!clubsLoading && clubs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {clubs.map((c: any) => (
                    <a
                      key={c.id}
                      href={`/club/${encodeURIComponent(c.id)}`}
                      className="cue-surface rounded p-3 hover:brightness-95 transition"
                    >
                      <div className="flex items-center gap-3">
                        {normalizeHttpUrl(c.logoUrl) ? (
                          <img
                            src={normalizeHttpUrl(c.logoUrl) as string}
                            alt={c.name || 'club'}
                            className="w-12 h-12 rounded object-cover cue-surface-strong"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded cue-surface-strong flex items-center justify-center font-bold">
                            {(String(c.name || '?').trim().slice(0, 1) || '?').toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{c.name || '場館'}</div>
                          <div className="text-xs cue-muted truncate">{c.address || c.phone || ''}</div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="cue-card p-4">
            <div className="cue-zh-title mb-2">直播排程</div>
            {liveLoading && <div className="text-sm cue-muted">讀取中…</div>}
            {!liveLoading && liveAnnouncements.length === 0 && <div className="text-sm cue-muted">暫無通告</div>}
            {!liveLoading && liveAnnouncements.length > 0 && (
              <div className="space-y-2">
                {liveAnnouncements.slice(0, 10).map((it: any) => (
                  <div key={it.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{it.title}</div>
                      <div className="text-xs cue-muted">
                        {it.club?.name ? `${it.club.name} · ` : ''}
                        {it.startsAt ? new Date(it.startsAt).toLocaleString() : ''}
                      </div>
                    </div>
                    {normalizeHttpUrl(it.liveUrl) && (
                      <a
                        href={normalizeHttpUrl(it.liveUrl) as string}
                        target="_blank"
                        rel="noreferrer"
                        className="accent-blue underline flex-shrink-0"
                      >
                        觀看
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cue-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="cue-zh-title">龍虎榜</div>
              <div className="flex items-center gap-2 text-sm">
                <div className="cue-muted">月份</div>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="cue-input rounded px-3 py-2"
                />
              </div>
            </div>
            {boardLoading && <div className="mt-2 text-sm cue-muted">讀取中…</div>}
            <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="cue-surface rounded p-3">
                <div className="font-semibold mb-2">會員 · 歷史最高單杆</div>
                {memberHighest.length === 0 && <div className="text-sm cue-muted">暫無資料</div>}
                {memberHighest.length > 0 && (
                  <div className="space-y-1 text-sm">
                    {memberHighest.map((r: any, idx: number) => (
                      <div key={r.memberId || idx} className="flex items-center justify-between gap-3">
                        <div className="truncate">{idx + 1}. {r.member?.name || '會員'}</div>
                        <div className="font-semibold">{r.points}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cue-surface rounded p-3">
                <div className="font-semibold mb-2">會員 · 本月累計</div>
                {memberMonthly.length === 0 && <div className="text-sm cue-muted">暫無資料</div>}
                {memberMonthly.length > 0 && (
                  <div className="space-y-1 text-sm">
                    {memberMonthly.map((r: any, idx: number) => (
                      <div key={r.memberId || idx} className="flex items-center justify-between gap-3">
                        <div className="truncate">{idx + 1}. {r.member?.name || '會員'}</div>
                        <div className="font-semibold">{r.points}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cue-surface rounded p-3">
                <div className="font-semibold mb-2">場館 · 歷史最高單杆</div>
                {clubHighest.length === 0 && <div className="text-sm cue-muted">暫無資料</div>}
                {clubHighest.length > 0 && (
                  <div className="space-y-1 text-sm">
                    {clubHighest.map((r: any, idx: number) => (
                      <div key={r.clubId || idx} className="flex items-center justify-between gap-3">
                        <div className="truncate">{idx + 1}. {r.club?.name || '場館'}</div>
                        <div className="font-semibold">{r.points}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cue-surface rounded p-3">
                <div className="font-semibold mb-2">場館 · 本月累計</div>
                {clubMonthly.length === 0 && <div className="text-sm cue-muted">暫無資料</div>}
                {clubMonthly.length > 0 && (
                  <div className="space-y-1 text-sm">
                    {clubMonthly.map((r: any, idx: number) => (
                      <div key={r.clubId || idx} className="flex items-center justify-between gap-3">
                        <div className="truncate">{idx + 1}. {r.club?.name || '場館'}</div>
                        <div className="font-semibold">{r.points}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default HomePage;
