import React, { useEffect, useMemo, useRef, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import Tabs from './components/Tabs';
import NewsPage from './NewsPage';
import { API_URL } from './config';
import { getLeaderboardMembersHighest, getLeaderboardMembersMonthly, getPublicClubs, getSiteNotice, listMemberRegions } from './lib/api';

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'auth' | 'news'>('home');
  const [homeSubTab, setHomeSubTab] = useState<'leaderboard' | 'clubs'>('leaderboard');
  const [notice, setNotice] = useState<any>(null);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [leaderMode, setLeaderMode] = useState<'highest' | 'monthly'>('highest');
  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderRows, setLeaderRows] = useState<any[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Array<{ code3: string; name: string }>>([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionCode, setRegionCode] = useState('');
  const [clubQuery, setClubQuery] = useState('');
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const clubFetchSeq = useRef(0);
  const showLeaderboard = notice?.homeShowLeaderboard !== false;
  const showClubList = notice?.homeShowClubList !== false;

  const homeTabLabel = useMemo(() => {
    if (showLeaderboard && showClubList) return '龍虎榜 / 場館列表';
    if (showLeaderboard) return '綜合單杆龍虎榜';
    if (showClubList) return '場館列表';
    return '首頁';
  }, [showLeaderboard, showClubList]);

  const homeSubTabs = useMemo(() => {
    const items: Array<{ key: 'leaderboard' | 'clubs'; label: string }> = [];
    if (showLeaderboard) items.push({ key: 'leaderboard', label: '綜合單杆龍虎榜' });
    if (showClubList) items.push({ key: 'clubs', label: '場館列表' });
    return items;
  }, [showLeaderboard, showClubList]);

  const tabs = useMemo(() => ([
    { key: 'home', label: homeTabLabel },
    { key: 'auth', label: '登入 / 註冊' },
    { key: 'news', label: 'Snooker 新聞' },
  ]), [homeTabLabel]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      const hs = String(params.get('homeTab') || '').trim();
      if (t === 'news') setActiveTab('news');
      else if (t === 'auth') setActiveTab('auth');
      else if (t === 'home') setActiveTab('home');
      if (hs === 'clubs') setHomeSubTab('clubs');
      else if (hs === 'leaderboard') setHomeSubTab('leaderboard');
    } catch {}
  }, []);

  const changeTab = (key: string) => {
    const next = key === 'news' ? 'news' : (key === 'auth' ? 'auth' : 'home');
    setActiveTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      if (next !== 'home') url.searchParams.delete('homeTab');
      else url.searchParams.set('homeTab', homeSubTab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  const changeHomeSubTab = (key: string) => {
    const next = key === 'clubs' ? 'clubs' : 'leaderboard';
    setHomeSubTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'home');
      url.searchParams.set('homeTab', next);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

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
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setRegionLoading(true);
      try {
        const res = await listMemberRegions(API_URL);
        const arr = Array.isArray((res as any)?.regions) ? (res as any).regions : [];
        if (mounted) setRegions(arr);
      } catch {
        if (mounted) setRegions([]);
      } finally {
        if (mounted) setRegionLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (noticeLoading) return;
    if (notice && notice.homeShowLeaderboard === false) return;
    let mounted = true;
    (async () => {
      setLeaderLoading(true);
      setLeaderError(null);
      try {
        const rows =
          leaderMode === 'monthly'
            ? await getLeaderboardMembersMonthly(API_URL, leaderMonth, 10)
            : await getLeaderboardMembersHighest(API_URL, 10);
        if (mounted) setLeaderRows(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) {
          setLeaderError(String(e?.message || '讀取龍虎榜失敗'));
          setLeaderRows([]);
        }
      } finally {
        if (mounted) setLeaderLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [noticeLoading, notice, leaderMode, leaderMonth]);

  useEffect(() => {
    if (noticeLoading) return;
    if (notice && notice.homeShowClubList === false) return;
    const seq = ++clubFetchSeq.current;
    const t = window.setTimeout(async () => {
      setClubsLoading(true);
      setClubsError(null);
      try {
        const out = await getPublicClubs(API_URL, { q: clubQuery.trim() || undefined, regionCode: regionCode || undefined, limit: 200 });
        if (clubFetchSeq.current === seq) setClubs(Array.isArray(out) ? out : []);
      } catch (e: any) {
        if (clubFetchSeq.current === seq) {
          setClubsError(String(e?.message || '讀取場館列表失敗'));
          setClubs([]);
        }
      } finally {
        if (clubFetchSeq.current === seq) setClubsLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [noticeLoading, notice, clubQuery, regionCode]);

  useEffect(() => {
    if (showLeaderboard && showClubList) return;
    if (showLeaderboard && homeSubTab !== 'leaderboard') {
      setHomeSubTab('leaderboard');
      return;
    }
    if (showClubList && homeSubTab !== 'clubs') {
      setHomeSubTab('clubs');
    }
  }, [showLeaderboard, showClubList, homeSubTab]);

  useEffect(() => {
    if (activeTab !== 'home') return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'home');
      url.searchParams.set('homeTab', homeSubTab);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [activeTab, homeSubTab]);

  const clubsByRegion = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const c of Array.isArray(clubs) ? clubs : []) {
      const rc = String(c?.member?.region_code || '').trim().toUpperCase() || '—';
      const arr = map.get(rc) || [];
      arr.push(c);
      map.set(rc, arr);
    }
    const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return keys.map((k) => ({ regionCode: k, items: map.get(k) || [] }));
  }, [clubs]);

  const regionLabel = (code: string) => {
    if (!code || code === '—') return code || '—';
    const hit = regions.find((r) => r.code3 === code);
    return hit ? `${hit.name} (${hit.code3})` : code;
  };

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="SnookerHK Live" showBack={false} />
      <main className="flex-1 px-4 pt-4 pb-10 flex items-start justify-center">
        <div className="w-full max-w-2xl space-y-3">
          <div className="glass rounded-xl p-3">
            <Tabs items={tabs} activeKey={activeTab} onChange={changeTab} />
          </div>

          {activeTab === 'home' ? (
            <div className="glass rounded-xl p-4 space-y-4">
              {noticeLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : null}

              {homeSubTabs.length > 1 ? (
                <div className="cue-surface rounded-lg p-2">
                  <Tabs items={homeSubTabs} activeKey={homeSubTab} onChange={changeHomeSubTab} />
                </div>
              ) : null}

              {!showLeaderboard && !showClubList ? (
                <div className="cue-surface rounded-lg p-4 text-sm cue-muted">首頁內容暫時隱藏</div>
              ) : null}

              {showLeaderboard && homeSubTab === 'leaderboard' ? (
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-lg">綜合單杆龍虎榜</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${leaderMode === 'highest' ? 'cue-button' : 'cue-surface-strong hover:brightness-95'}`}
                        onClick={() => setLeaderMode('highest')}
                      >
                        最高單杆
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${leaderMode === 'monthly' ? 'cue-button' : 'cue-surface-strong hover:brightness-95'}`}
                        onClick={() => setLeaderMode('monthly')}
                      >
                        本月累計
                      </button>
                      {leaderMode === 'monthly' ? (
                        <input
                          value={leaderMonth}
                          onChange={(e) => setLeaderMonth(String(e.target.value || '').slice(0, 7))}
                          className="w-28 px-3 py-1.5 rounded cue-surface-strong text-sm"
                          placeholder="YYYY-MM"
                        />
                      ) : null}
                    </div>
                  </div>
                  {leaderLoading ? (
                    <div className="text-sm cue-muted mt-3">讀取中…</div>
                  ) : leaderError ? (
                    <div className="text-sm text-red-400 mt-3">{leaderError}</div>
                  ) : leaderRows.length === 0 ? (
                    <div className="text-sm cue-muted mt-3">（暫無公開資料）</div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {leaderRows.slice(0, 10).map((r: any, idx: number) => (
                        <div key={`${r?.memberId || idx}`} className="cue-surface-strong rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 text-center font-extrabold accent-yellow">{idx + 1}</div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{String(r?.member?.name || '—')}</div>
                              <div className="text-xs cue-muted truncate">{String(r?.member?.member_code || '')}</div>
                            </div>
                          </div>
                          <div className="font-extrabold text-lg">{Number(r?.points || 0)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {showClubList && homeSubTab === 'clubs' ? (
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-lg">場館列表</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={regionCode}
                        onChange={(e) => setRegionCode(String(e.target.value || '').trim().toUpperCase())}
                        className="h-10 rounded cue-surface-strong px-3 text-sm"
                        disabled={regionLoading}
                      >
                        <option value="">全部地區</option>
                        {regions.map((r) => (
                          <option key={r.code3} value={r.code3}>{r.name} ({r.code3})</option>
                        ))}
                      </select>
                      <input
                        value={clubQuery}
                        onChange={(e) => setClubQuery(e.target.value)}
                        className="h-10 rounded cue-surface-strong px-3 text-sm"
                        placeholder="搜尋：場館名 / Email / 電話 / 地址"
                      />
                    </div>
                  </div>
                  {clubsLoading ? (
                    <div className="text-sm cue-muted mt-3">讀取中…</div>
                  ) : clubsError ? (
                    <div className="text-sm text-red-400 mt-3">{clubsError}</div>
                  ) : clubs.length === 0 ? (
                    <div className="text-sm cue-muted mt-3">（暫無符合條件的公開場館）</div>
                  ) : (
                    <div className="mt-3 space-y-4">
                      {clubsByRegion.map((g) => (
                        <div key={g.regionCode} className="space-y-2">
                          <div className="text-sm cue-muted">{regionLabel(g.regionCode)}</div>
                          <div className="space-y-2">
                            {g.items.map((c: any) => (
                              <a
                                key={String(c?.id || '')}
                                href={`/club/${encodeURIComponent(String(c?.id || ''))}`}
                                className="block cue-surface-strong rounded-lg px-3 py-3 hover:brightness-95"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-extrabold accent-yellow truncate">{String(c?.name || c?.member?.name || '—')}</div>
                                    {c?.address ? <div className="text-xs cue-muted truncate mt-1">{String(c.address)}</div> : null}
                                    <div className="text-xs cue-muted truncate mt-1">
                                      {String(c?.email || c?.member?.email || '')}
                                      {(c?.phone || c?.member?.phone || c?.member?.phone_e164) ? ` · ${String(c?.phone || c?.member?.phone || c?.member?.phone_e164)}` : ''}
                                    </div>
                                  </div>
                                  <div className="text-xs cue-muted flex-shrink-0">查看</div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : activeTab === 'auth' ? (
            <div className="glass rounded-xl p-6">
              <div className="text-center">
                <div className="text-2xl font-extrabold accent-yellow">SnookerHK Live</div>
                <div className="text-sm cue-muted mt-1">登入 / 註冊</div>
              </div>
              <div className="mt-6 grid gap-3">
                <a href="/members/login" className="cue-button px-4 py-3 rounded text-center font-bold">
                  登入
                </a>
                <a href="/members/register" className="px-4 py-3 rounded cue-surface-strong hover:brightness-95 text-center font-bold">
                  註冊
                </a>
                <a
                  href="https://www.snookerhk.live/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 rounded bg-amber-400 text-slate-950 font-extrabold text-center shadow-lg ring-2 ring-amber-200 hover:brightness-95 active:brightness-90"
                >
                  www.snookerhk.live
                </a>
              </div>
            </div>
          ) : (
            <div className="glass rounded-xl">
              <NewsPage embedded />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
