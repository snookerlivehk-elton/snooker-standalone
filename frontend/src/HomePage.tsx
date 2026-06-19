import React, { useEffect, useMemo, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import { API_URL } from './config';
import { getLeaderboardClubsHighest, getLeaderboardMembersHighest, getNewsItems, getPublicClubs, getPublicLiveAnnouncements, getSiteAds, getSiteNotice } from './lib/api';

const HomePage: React.FC = () => {
  const [notice, setNotice] = useState<any>(null);
  const [noticeLoading, setNoticeLoading] = useState(true);
  const [heroAds, setHeroAds] = useState<any[]>([]);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const [memberLeaders, setMemberLeaders] = useState<any[]>([]);
  const [clubLeaders, setClubLeaders] = useState<any[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderError, setLeaderError] = useState<string | null>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubsError, setClubsError] = useState<string | null>(null);
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [liveAnnouncements, setLiveAnnouncements] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const showLeaderboard = notice?.homeShowLeaderboard !== false;
  const showClubList = notice?.homeShowClubList !== false;

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
      try {
        setHeroLoading(true);
        const res = await getSiteAds(API_URL, 'system');
        if (!mounted) return;
        const ads = Array.isArray(res?.ads) ? res.ads : [];
        setHeroAds(ads);
      } catch {
        if (mounted) setHeroAds([]);
      } finally {
        if (mounted) setHeroLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLeaderLoading(true);
      setLeaderError(null);
      try {
        const [members, clubsHighest] = await Promise.all([
          getLeaderboardMembersHighest(API_URL, 5),
          getLeaderboardClubsHighest(API_URL, 5),
        ]);
        if (!mounted) return;
        setMemberLeaders(Array.isArray(members) ? members : []);
        setClubLeaders(Array.isArray(clubsHighest) ? clubsHighest : []);
      } catch (e: any) {
        if (mounted) {
          setLeaderError(String(e?.message || '讀取排行榜失敗'));
          setMemberLeaders([]);
          setClubLeaders([]);
        }
      } finally {
        if (mounted) setLeaderLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setClubsLoading(true);
      setClubsError(null);
      try {
        const out = await getPublicClubs(API_URL, {
          limit: 6,
        });
        if (mounted) setClubs(Array.isArray(out) ? out : []);
      } catch (e: any) {
        if (mounted) {
          setClubsError(String(e?.message || '讀取場館列表失敗'));
          setClubs([]);
        }
      } finally {
        if (mounted) setClubsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const res = await getNewsItems(API_URL, { limit: 8 });
        if (mounted) setNewsItems(Array.isArray(res?.items) ? res.items : []);
      } catch (e: any) {
        if (mounted) {
          setNewsError(String(e?.message || '讀取新聞失敗'));
          setNewsItems([]);
        }
      } finally {
        if (mounted) setNewsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const rows = await getPublicLiveAnnouncements(API_URL, 6);
        if (mounted) setLiveAnnouncements(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (mounted) {
          setLiveError(String(e?.message || '讀取直播通告失敗'));
          setLiveAnnouncements([]);
        }
      } finally {
        if (mounted) setLiveLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!heroAds.length) return;
    const displaySeconds = Math.max(3, Number(heroAds[heroIndex]?.displaySeconds || heroAds[0]?.displaySeconds || 6));
    const timer = window.setTimeout(() => {
      setHeroIndex((current) => (current + 1) % heroAds.length);
    }, displaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [heroAds, heroIndex]);

  useEffect(() => {
    if (!heroAds.length) {
      setHeroIndex(0);
      return;
    }
    if (heroIndex >= heroAds.length) setHeroIndex(0);
  }, [heroAds, heroIndex]);

  const heroItem = heroAds[heroIndex] || null;
  const quickLinks = useMemo(() => {
    const items = [
      { label: '最新新聞', href: '#news' },
      { label: '直播排程', href: '#live' },
      { label: '排行榜', href: '#leaderboard' },
      { label: '場館資訊', href: '#clubs' },
    ];
    return items;
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString('zh-HK');
  };

  const heroTitle = String(heroItem?.title || '').trim() || 'SnookerHK Live';
  const heroSubtitle = String(heroItem?.subtitle || '').trim() || '精選焦點內容、最新消息與場館資訊，一頁掌握。';
  const heroCtaLabel = String(heroItem?.ctaLabel || '').trim() || '立即查看';

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="SnookerHK Live" showBack={false} />
      <main className="flex-1 px-4 pt-4 pb-10 flex items-start justify-center">
        <div className="w-full max-w-7xl space-y-6">
          <section className="grid gap-4 lg:grid-cols-[1.65fr_0.9fr]">
            <div className="glass rounded-2xl overflow-hidden">
              <div className="relative min-h-[240px] sm:min-h-[360px] lg:min-h-[460px]">
                {heroLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center cue-muted">輪播載入中…</div>
                ) : heroItem ? (
                  <>
                    <a href={String(heroItem.linkUrl || '#')} target="_blank" rel="noreferrer" className="absolute inset-0 block">
                      <img
                        src={String(heroItem.imageUrl || '')}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-black/30" />
                      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                        <div className="max-w-2xl">
                          <div className="text-xs uppercase tracking-[0.3em] text-amber-300/90">Featured</div>
                          <div className="mt-2 text-2xl sm:text-4xl font-black cue-zh-title">{heroTitle}</div>
                          <div className="mt-2 text-sm sm:text-base cue-muted">
                            {heroSubtitle}
                          </div>
                          <div className="mt-4 inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-sm font-extrabold text-slate-950">
                            {heroCtaLabel}
                          </div>
                        </div>
                      </div>
                    </a>
                    {heroAds.length > 1 ? (
                      <>
                        <button
                          type="button"
                          aria-label="上一張"
                          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-white hover:bg-black/65"
                          onClick={() => setHeroIndex((current) => (current - 1 + heroAds.length) % heroAds.length)}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          aria-label="下一張"
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/45 px-3 py-2 text-white hover:bg-black/65"
                          onClick={() => setHeroIndex((current) => (current + 1) % heroAds.length)}
                        >
                          →
                        </button>
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                          {heroAds.map((_: any, idx: number) => (
                            <button
                              key={`hero-dot-${idx}`}
                              type="button"
                              aria-label={`切換到第 ${idx + 1} 張`}
                              className={`h-2.5 rounded-full transition-all ${idx === heroIndex ? 'w-7 bg-amber-300' : 'w-2.5 bg-white/55 hover:bg-white/80'}`}
                              onClick={() => setHeroIndex(idx)}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="text-2xl sm:text-4xl font-black cue-zh-title">SnookerHK Live</div>
                    <div className="max-w-xl text-sm sm:text-base cue-muted">
                      這裡將展示由 Super Admin 設定的首頁輪播內容。現在可以先到後台上載圖片並設定投放。
                    </div>
                    <a href="/admin/overview" className="brand-button rounded-full px-5 py-2 font-bold">
                      前往管理設定
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass rounded-2xl p-5">
                <div className="text-xs uppercase tracking-[0.25em] accent-yellow">Portal</div>
                <div className="mt-2 text-2xl font-black cue-zh-title">內容首頁</div>
                <div className="mt-2 text-sm cue-muted">
                  參照內容平台式首頁設計，把焦點輪播、直播排程、新聞、排行榜與場館精選集中展示。
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {quickLinks.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="cue-surface-strong rounded-xl px-3 py-3 text-sm font-semibold hover:brightness-95"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-5">
                <div className="text-sm font-bold">快速入口</div>
                <div className="mt-3 grid gap-2">
                  <a href="/members/login" className="cue-button rounded-xl px-4 py-3 text-center text-sm font-bold">會員登入</a>
                  <a href="/members/register" className="cue-surface-strong rounded-xl px-4 py-3 text-center text-sm font-bold hover:brightness-95">會員註冊</a>
                  <a href="/news" className="cue-surface-strong rounded-xl px-4 py-3 text-center text-sm font-bold hover:brightness-95">全部新聞</a>
                </div>
              </div>
            </div>
          </section>

          {!noticeLoading && notice?.enabled && notice?.message ? (
            <section className="glass rounded-2xl px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] accent-yellow">Notice</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm sm:text-base">{String(notice.message)}</div>
                </div>
                {notice?.youtubeEmbedUrl ? (
                  <a
                    href={String(notice.youtubeEmbedUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold accent-blue"
                  >
                    打開相關影片
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}

          <section id="news" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] accent-yellow">Latest</div>
                <h2 className="text-2xl font-black cue-zh-title">最新新聞</h2>
              </div>
              <a href="/news" className="text-sm font-semibold accent-blue">查看全部</a>
            </div>
            {newsLoading ? (
              <div className="glass rounded-2xl p-4 cue-muted">讀取中…</div>
            ) : newsError ? (
              <div className="glass rounded-2xl p-4 text-red-300">{newsError}</div>
            ) : newsItems.length === 0 ? (
              <div className="glass rounded-2xl p-4 cue-muted">暫時未有新聞</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {newsItems.slice(0, 8).map((item: any) => {
                  const img = item?.imageUrl ? `${API_URL.replace(/\/+$/, '')}/api/news/image?url=${encodeURIComponent(String(item.imageUrl))}` : '';
                  return (
                    <a
                      key={String(item?.id || item?.url)}
                      href={String(item?.url || '#')}
                      target="_blank"
                      rel="noreferrer"
                      className="glass rounded-2xl overflow-hidden hover:brightness-95"
                    >
                      <div className="aspect-[16/9] bg-black/30">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                            onError={(e) => { try { (e.currentTarget as HTMLImageElement).style.display = 'none'; } catch {} }}
                          />
                        ) : null}
                      </div>
                      <div className="p-4">
                        <div className="text-xs cue-muted">{String(item?.source?.name || 'Snooker 新聞')}</div>
                        <div className="mt-2 line-clamp-2 font-bold">{String(item?.title || '')}</div>
                        <div className="mt-2 text-xs cue-muted">{formatDate(item?.publishedAt)}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <section id="live" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] accent-yellow">Live</div>
                <h2 className="text-2xl font-black cue-zh-title">各球館直播排程</h2>
              </div>
            </div>
            {liveLoading ? (
              <div className="glass rounded-2xl p-4 cue-muted">讀取中…</div>
            ) : liveError ? (
              <div className="glass rounded-2xl p-4 text-red-300">{liveError}</div>
            ) : liveAnnouncements.length === 0 ? (
              <div className="glass rounded-2xl p-4 cue-muted">暫時未有公開直播排程</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {liveAnnouncements.slice(0, 6).map((item: any) => (
                  <a
                    key={String(item?.id || '')}
                    href={String(item?.liveUrl || '#')}
                    target="_blank"
                    rel="noreferrer"
                    className="glass rounded-2xl p-4 hover:brightness-95"
                  >
                    <div className="flex items-start gap-3">
                      {item?.club?.logoUrl ? (
                        <img src={String(item.club.logoUrl)} alt="" className="h-12 w-12 rounded-xl object-cover cue-surface shrink-0" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl cue-surface text-xs font-black accent-yellow">LIVE</div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs cue-muted truncate">{String(item?.club?.name || '球館直播')}</div>
                        <div className="mt-1 font-bold line-clamp-2">{String(item?.title || '直播節目')}</div>
                        <div className="mt-2 text-xs cue-muted">{formatDate(item?.startsAt)}</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>

          {showLeaderboard ? (
            <section id="leaderboard" className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] accent-yellow">Rankings</div>
                <h2 className="text-2xl font-black cue-zh-title">最新排行榜</h2>
              </div>
              {leaderLoading ? (
                <div className="glass rounded-2xl p-4 cue-muted">讀取中…</div>
              ) : leaderError ? (
                <div className="glass rounded-2xl p-4 text-red-300">{leaderError}</div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="glass rounded-2xl p-4">
                    <div className="mb-3 text-lg font-bold">會員最高單杆</div>
                    <div className="space-y-2">
                      {memberLeaders.slice(0, 5).map((row: any, idx: number) => (
                        <div key={String(row?.memberId || idx)} className="cue-surface-strong rounded-xl px-3 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 text-center text-lg font-black accent-yellow">{idx + 1}</div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{String(row?.member?.name || '—')}</div>
                              <div className="truncate text-xs cue-muted">{String(row?.member?.member_code || '')}</div>
                            </div>
                          </div>
                          <div className="text-xl font-black">{Number(row?.points || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <div className="mb-3 text-lg font-bold">場館最高單杆</div>
                    <div className="space-y-2">
                      {clubLeaders.slice(0, 5).map((row: any, idx: number) => (
                        <div key={String(row?.clubId || idx)} className="cue-surface-strong rounded-xl px-3 py-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-7 text-center text-lg font-black accent-yellow">{idx + 1}</div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{String(row?.club?.name || '—')}</div>
                              <div className="truncate text-xs cue-muted">{String(row?.clubId || '')}</div>
                            </div>
                          </div>
                          <div className="text-xl font-black">{Number(row?.points || 0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {showClubList ? (
            <section id="clubs" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] accent-yellow">Venues</div>
                  <h2 className="text-2xl font-black cue-zh-title">精選場館</h2>
                </div>
              </div>
              {clubsLoading ? (
                <div className="glass rounded-2xl p-4 cue-muted">讀取中…</div>
              ) : clubsError ? (
                <div className="glass rounded-2xl p-4 text-red-300">{clubsError}</div>
              ) : clubs.length === 0 ? (
                <div className="glass rounded-2xl p-4 cue-muted">暫時未有公開場館</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {clubs.map((club: any) => (
                    <a
                      key={String(club?.id || '')}
                      href={`/club/${encodeURIComponent(String(club?.id || ''))}`}
                      className="glass rounded-2xl p-4 hover:brightness-95"
                    >
                      <div className="flex items-start gap-3">
                        {club?.logoUrl ? (
                          <img src={String(club.logoUrl)} alt="" className="h-14 w-14 rounded-xl object-cover cue-surface shrink-0" />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl cue-surface text-xs font-black accent-yellow">CLUB</div>
                        )}
                        <div className="min-w-0">
                          <div className="font-black accent-yellow truncate">{String(club?.name || club?.member?.name || '—')}</div>
                          {club?.address ? <div className="mt-1 text-xs cue-muted line-clamp-2">{String(club.address)}</div> : null}
                          <div className="mt-2 text-xs cue-muted truncate">
                            {String(club?.email || club?.member?.email || '')}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default HomePage;
