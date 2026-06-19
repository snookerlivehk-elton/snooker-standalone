import React from 'react';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';

const Onboarding: React.FC = () => {
  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="開始使用" showBack={false} />
      <main className="flex-1 px-4 pt-4 pb-20">
        <div className="max-w-xl mx-auto grid gap-4">
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-1">Cue Track LIVE</div>
            <div className="cue-en-sub">Choose your path</div>
            <div className="text-sm cue-muted mt-2">系統已移除舊版房間計分與 LiveView 流程，現時可直接進入場館管理、會員入口或內容頁面。</div>
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <a href="/venue/dashboard" className="cue-button py-3 text-center rounded">場館管理</a>
              <a href="/me" className="px-4 py-3 text-center rounded bg-gray-700 text-white">會員中心</a>
              <a href="/news" className="px-4 py-3 text-center rounded bg-gray-700 text-white">Snooker 新聞</a>
            </div>
          </div>
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-2">使用指引（概要）</div>
            <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
              <li>場館管理員登入後可維護場館資料、內容、預約與會員資料</li>
              <li>會員可在會員中心查看個人資料、球會資訊與相關內容</li>
              <li>首頁會集中展示排行榜、場館列表與最新新聞</li>
              <li>如日後重建計分功能，將以全新流程重新設計，不再沿用舊房間模式</li>
            </ul>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Onboarding;
