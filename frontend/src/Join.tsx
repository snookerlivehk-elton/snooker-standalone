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
          <div className="mt-6 text-center">
            <div className="mb-2 text-sm cue-muted">或掃描 QR 加入</div>
            <div className="flex items-center justify-center">
              <div className="bg-white p-3 rounded" aria-label="QR placeholder">
                <div style={{ width: 168, height: 168, background: '#eee' }} />
              </div>
            </div>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Join;
