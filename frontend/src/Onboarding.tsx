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
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <a href="/rooms" className="cue-button py-3 text-center rounded">我要開播 / 主持</a>
              <a href="/join" className="px-4 py-3 text-center rounded bg-gray-700 text-white">只觀戰</a>
              <a href="/android" className="px-4 py-3 text-center rounded bg-gray-700 text-white">Android 串接指引</a>
            </div>
          </div>
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-2">直播指引（概要）</div>
            <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
              <li>建立房間，取得 Overlay URL 與 QR</li>
              <li>Android App 輸入 Overlay URL，開始合成</li>
              <li>按「開始比賽」設定選手、讓分與局數</li>
              <li>主持端控制記分，觀眾即時同步</li>
            </ul>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Onboarding;
