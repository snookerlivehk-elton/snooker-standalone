import React, { useEffect, useMemo, useRef, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import Tabs from './components/Tabs';
import NewsPage from './NewsPage';
import { API_URL } from './config';
import { getLeaderboardClubsHighest, getLeaderboardClubsMonthly, getLeaderboardMembersHighest, getLeaderboardMembersMonthly, getPublicClubs, getSiteNotice, listMemberDistricts, listMemberRegions } from './lib/api';

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'clubs' | 'auth' | 'news'>('leaderboard');
  const [notice, setNotice] = useState<any>(null);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [leaderScope, setLeaderScope] = useState<'members' | 'clubs'>('members');
  const [leaderMode, setLeaderMode] = useState<'highest' | 'monthly'>('highest');
  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderRows, setLeaderRows] = useState<any[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Array<{ code3: string; name: string }>>([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [leaderRegionCode, setLeaderRegionCode] = useState('');
  const [leaderDistricts, setLeaderDistricts] = useState<Array<{ code3: string; name: string; regionCode?: string }>>([]);
  const [leaderDistrictLoading, setLeaderDistrictLoading] = useState(false);
  const [leaderDistrictCode, setLeaderDistrictCode] = useState('');
  const [clubRegionCode, setClubRegionCode] = useState('');
  const [clubDistricts, setClubDistricts] = useState<Array<{ code3: string; name: string; regionCode?: string }>>([]);
  const [clubDistrictLoading, setClubDistrictLoading] = useState(false);
  const [clubDistrictCode, setClubDistrictCode] = useState('');
  const [clubQuery, setClubQuery] = useState('');
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const clubFetchSeq = useRef(0);
  const showLeaderboard = notice?.homeShowLeaderboard !== false;
  const showClubList = notice?.homeShowClubList !== false;

  const tabs = useMemo(() => {
    const items: Array<{ key: 'leaderboard' | 'clubs' | 'auth' | 'news'; label: string }> = [];
    if (showLeaderboard) items.push({ key: 'leaderboard', label: '綜合單杆龍虎榜' });
    if (showClubList) items.push({ key: 'clubs', label: '場館列表' });
    items.push({ key: 'auth', label: '登入 / 註冊' });
    items.push({ key: 'news', label: 'Snooker 新聞' });
    return items;
  }, [showLeaderboard, showClubList]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      const hs = String(params.get('homeTab') || '').trim();
      if (t === 'news') setActiveTab('news');
      else if (t === 'auth') setActiveTab('auth');
      else if (t === 'clubs') setActiveTab('clubs');
      else if (t === 'leaderboard') setActiveTab('leaderboard');
      else if (t === 'home') setActiveTab(hs === 'clubs' ? 'clubs' : 'leaderboard');
    } catch {}
  }, []);

  const changeTab = (key: string) => {
    const next =
      key === 'news'
        ? 'news'
        : key === 'auth'
          ? 'auth'
          : key === 'clubs'
            ? 'clubs'
            : 'leaderboard';
    setActiveTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      url.searchParams.delete('homeTab');
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
    let mounted = true;
    if (!leaderRegionCode) {
      setLeaderDistricts([]);
      setLeaderDistrictCode('');
      setLeaderDistrictLoading(false);
      return () => { mounted = false; };
    }
    setLeaderDistrictLoading(true);
    listMemberDistricts(API_URL, leaderRegionCode)
      .then((res) => {
        if (!mounted) return;
        const arr = Array.isArray((res as any)?.districts) ? (res as any).districts : [];
        setLeaderDistricts(arr);
      })
      .catch(() => {
        if (!mounted) return;
        setLeaderDistricts([]);
      })
      .finally(() => {
        if (mounted) setLeaderDistrictLoading(false);
      });
    return () => { mounted = false; };
  }, [leaderRegionCode]);

  useEffect(() => {
    let mounted = true;
    if (!clubRegionCode) {
      setClubDistricts([]);
      setClubDistrictCode('');
      setClubDistrictLoading(false);
      return () => { mounted = false; };
    }
    setClubDistrictLoading(true);
    listMemberDistricts(API_URL, clubRegionCode)
      .then((res) => {
        if (!mounted) return;
        const arr = Array.isArray((res as any)?.districts) ? (res as any).districts : [];
        setClubDistricts(arr);
      })
      .catch(() => {
        if (!mounted) return;
        setClubDistricts([]);
      })
      .finally(() => {
        if (mounted) setClubDistrictLoading(false);
      });
    return () => { mounted = false; };
  }, [clubRegionCode]);

  useEffect(() => {
    if (noticeLoading) return;
    if (notice && notice.homeShowLeaderboard === false) return;
    let mounted = true;
    (async () => {
      setLeaderLoading(true);
      setLeaderError(null);
      try {
        const rows =
          leaderScope === 'clubs'
            ? (
              leaderMode === 'monthly'
                ? await getLeaderboardClubsMonthly(API_URL, leaderMonth, 10, {
                    regionCode: leaderRegionCode || undefined,
                    districtCode: leaderDistrictCode || undefined,
                  })
                : await getLeaderboardClubsHighest(API_URL, 10, {
                    regionCode: leaderRegionCode || undefined,
                    districtCode: leaderDistrictCode || undefined,
                  })
            )
            : (
              leaderMode === 'monthly'
                ? await getLeaderboardMembersMonthly(API_URL, leaderMonth, 10, {
                    regionCode: leaderRegionCode || undefined,
                    districtCode: leaderDistrictCode || undefined,
                  })
                : await getLeaderboardMembersHighest(API_URL, 10, {
                    regionCode: leaderRegionCode || undefined,
                    districtCode: leaderDistrictCode || undefined,
                  })
            );
        if (mounted) setLeaderRows(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) {
          setLeaderError(String(e?.message || (leaderScope === 'clubs' ? '讀取場館榜失敗' : '讀取會員榜失敗')));
          setLeaderRows([]);
        }
      } finally {
        if (mounted) setLeaderLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [noticeLoading, notice, leaderScope, leaderMode, leaderMonth, leaderRegionCode, leaderDistrictCode]);

  useEffect(() => {
    if (noticeLoading) return;
    if (notice && notice.homeShowClubList === false) return;
    const seq = ++clubFetchSeq.current;
    const t = window.setTimeout(async () => {
      setClubsLoading(true);
      setClubsError(null);
      try {
        const out = await getPublicClubs(API_URL, {
          q: clubQuery.trim() || undefined,
          regionCode: clubRegionCode || undefined,
          districtCode: clubDistrictCode || undefined,
          limit: 200,
        });
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
  }, [noticeLoading, notice, clubQuery, clubRegionCode, clubDistrictCode]);

  useEffect(() => {
    if (noticeLoading) return;
    const visibleTabs = tabs.map((item) => item.key);
    if (visibleTabs.includes(activeTab)) return;
    const fallback =
      (showLeaderboard ? 'leaderboard' : null) ||
      (showClubList ? 'clubs' : null) ||
      'auth';
    setActiveTab(fallback);
  }, [noticeLoading, tabs, activeTab, showLeaderboard, showClubList]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      url.searchParams.delete('homeTab');
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }, [activeTab]);

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

          {activeTab === 'leaderboard' ? (
            <div className="glass rounded-xl p-4 space-y-4">
              {noticeLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : null}
              {showLeaderboard ? (
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-lg">綜合單杆龍虎榜</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${leaderScope === 'members' ? 'cue-button' : 'cue-surface-strong hover:brightness-95'}`}
                        onClick={() => setLeaderScope('members')}
                      >
                        會員榜
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded text-sm font-semibold ${leaderScope === 'clubs' ? 'cue-button' : 'cue-surface-strong hover:brightness-95'}`}
                        onClick={() => setLeaderScope('clubs')}
                      >
                        場館榜
                      </button>
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
                      <select
                        value={leaderRegionCode}
                        onChange={(e) => {
                          setLeaderRegionCode(String(e.target.value || '').trim().toUpperCase());
                          setLeaderDistrictCode('');
                        }}
                        className="h-10 rounded cue-surface-strong px-3 text-sm"
                        disabled={regionLoading}
                      >
                        <option value="">全部地區</option>
                        {regions.map((r) => (
                          <option key={r.code3} value={r.code3}>{r.name} ({r.code3})</option>
                        ))}
                      </select>
                      <select
                        value={leaderDistrictCode}
                        onChange={(e) => setLeaderDistrictCode(String(e.target.value || '').trim().toUpperCase())}
                        className="h-10 rounded cue-surface-strong px-3 text-sm"
                        disabled={!leaderRegionCode || leaderDistrictLoading}
                      >
                        <option value="">{leaderRegionCode ? '全部分區' : '先選地區'}</option>
                        {leaderDistricts.map((d) => (
                          <option key={d.code3} value={d.code3}>{d.name} ({d.code3})</option>
                        ))}
                      </select>
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
                        <div key={`${r?.memberId || r?.clubId || idx}`} className="cue-surface-strong rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 text-center font-extrabold accent-yellow">{idx + 1}</div>
                            <div className="min-w-0">
                              {leaderScope === 'clubs' ? (
                                <>
                                  <div className="font-semibold truncate">{String(r?.club?.name || '—')}</div>
                                  <div className="text-xs cue-muted truncate">{String(r?.clubId || '')}</div>
                                </>
                              ) : (
                                <>
                                  <div className="font-semibold truncate">{String(r?.member?.name || '—')}</div>
                                  <div className="text-xs cue-muted truncate">{String(r?.member?.member_code || '')}</div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="font-extrabold text-lg">{Number(r?.points || 0)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="cue-surface rounded-lg p-4 text-sm cue-muted">綜合單杆龍虎榜已隱藏</div>
              )}
            </div>
          ) : activeTab === 'clubs' ? (
            <div className="glass rounded-xl p-4 space-y-4">
              {noticeLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : null}
              {showClubList ? (
                <div className="cue-surface rounded-lg p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold text-lg">場館列表</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={clubRegionCode}
                        onChange={(e) => {
                          setClubRegionCode(String(e.target.value || '').trim().toUpperCase());
                          setClubDistrictCode('');
                        }}
                        className="h-10 rounded cue-surface-strong px-3 text-sm"
                        disabled={regionLoading}
                      >
                        <option value="">全部地區</option>
                        {regions.map((r) => (
                          <option key={r.code3} value={r.code3}>{r.name} ({r.code3})</option>
                        ))}
                      </select>
                      <select
                        value={clubDistrictCode}
                        onChange={(e) => setClubDistrictCode(String(e.target.value || '').trim().toUpperCase())}
                        className="h-10 rounded cue-surface-strong px-3 text-sm"
                        disabled={!clubRegionCode || clubDistrictLoading}
                      >
                        <option value="">{clubRegionCode ? '全部分區' : '先選地區'}</option>
                        {clubDistricts.map((d) => (
                          <option key={d.code3} value={d.code3}>{d.name} ({d.code3})</option>
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
              ) : (
                <div className="cue-surface rounded-lg p-4 text-sm cue-muted">場館列表已隱藏</div>
              )}
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
