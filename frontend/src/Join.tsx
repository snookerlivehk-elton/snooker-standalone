import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';

const Join: React.FC = () => {
  const [code, setCode] = useState('');
  const nav = useNavigate();
  const onJoin = () => {
    const c = code.trim();
    if (!c) return;
    nav(`/room/${encodeURIComponent(c)}/live`);
  };
  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="加入房間" />
      <main className="flex-1 px-4 pt-4 pb-20">
        <div className="max-w-md mx-auto cue-card p-6">
          <div className="text-center mb-4">
            <div className="cue-zh-title text-xl">Cue Track LIVE</div>
            <div className="cue-en-sub">Join a Room</div>
            <div className="text-sm cue-muted mt-2">輸入主持提供的房間碼 / 短鏈後加入；如果你已收到完整直播連結，亦可直接開啟連結觀看。</div>
          </div>
          <div className="mb-4">
            <label className="block text-sm mb-1">房間碼 / 短鏈</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例如：ABCD1234 或房間ID"
              className="w-full px-3 py-2 rounded cue-input"
            />
          </div>
          <button onClick={onJoin} className="w-full cue-button py-3 font-bold rounded">
            加入
          </button>
          <div className="mt-6 cue-surface rounded-lg p-4 text-sm">
            <div className="font-semibold mb-2">使用方式</div>
            <div className="space-y-1 cue-muted">
              <div>1. 輸入房間碼或短鏈。</div>
              <div>2. 按「加入」進入該房間的觀眾直播頁。</div>
              <div>3. 如房間未開始或房間碼錯誤，請向主持重新確認。</div>
            </div>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Join;
