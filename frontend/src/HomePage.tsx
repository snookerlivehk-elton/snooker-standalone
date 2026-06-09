import React, { useEffect, useMemo, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import Tabs from './components/Tabs';
import NewsPage from './NewsPage';

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'auth' | 'news'>('auth');

  const tabs = useMemo(() => ([
    { key: 'auth', label: '登入 / 註冊' },
    { key: 'news', label: 'Snooker 新聞' },
  ]), []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      if (t === 'news') setActiveTab('news');
    } catch {}
  }, []);

  const changeTab = (key: string) => {
    const next = key === 'news' ? 'news' : 'auth';
    setActiveTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="SnookerHK Live" showBack={false} />
      <main className="flex-1 px-4 pt-4 pb-10 flex items-start justify-center">
        <div className="w-full max-w-2xl space-y-3">
          <div className="glass rounded-xl p-3">
            <Tabs items={tabs} activeKey={activeTab} onChange={changeTab} />
          </div>

          {activeTab === 'auth' ? (
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
