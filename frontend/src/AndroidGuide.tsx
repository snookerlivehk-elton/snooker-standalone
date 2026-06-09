import React, { useMemo, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';

const AndroidGuide: React.FC = () => {
  const [room, setRoom] = useState('');
  const base = (import.meta.env.BASE_URL || '/') as string;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const overlayUrl = useMemo(() => {
    const r = encodeURIComponent(room.trim() || 'ROOM_ID');
    return `${origin}${base}room/${r}/overlay?style=compact&socketTransport=polling&enablePoll=1`;
  }, [room, origin, base]);
  const [rtmp, setRtmp] = useState('rtmp://your-ingest/live/stream-key');
  const onCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); alert('已複製'); } catch {}
  };
  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="Android 串接指引" />
      <main className="flex-1 px-4 pt-4 pb-20">
        <div className="max-w-2xl mx-auto grid gap-4">
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-1">Overlay URL</div>
            <div className="cue-en-sub mb-3">For Android overlay composition</div>
            <div className="text-sm cue-muted mb-3">先在「房間」或場館後台「計分 / 房間」建立房間，再輸入房間碼 / 房間 ID 產生 Overlay URL。</div>
            <label className="block text-sm mb-1">房間ID/碼</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="例如 ABCDE1234"
              className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 mb-3"
            />
            <div className="flex gap-2">
              <input readOnly value={overlayUrl} className="flex-1 px-3 py-2 rounded bg-gray-900 text-white border border-gray-700" />
              <button onClick={() => onCopy(overlayUrl)} className="cue-button px-4 py-2 rounded">複製</button>
            </div>
            <div className="mt-4 flex items-center justify-center">
              <div className="bg-white p-3 rounded">
                <div style={{ width: 180, height: 180, background: '#eee' }} />
              </div>
            </div>
          </div>
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-1">RTMP 推流（展示）</div>
            <div className="cue-en-sub mb-3">Enter on Android app</div>
            <div className="flex gap-2">
              <input value={rtmp} onChange={(e) => setRtmp(e.target.value)} className="flex-1 px-3 py-2 rounded bg-gray-800 text-white border border-gray-700" />
              <button onClick={() => onCopy(rtmp)} className="px-4 py-2 rounded bg-gray-700 text-white">複製</button>
            </div>
          </div>
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-2">建議設定</div>
            <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1">
              <li>影像：720p 30fps，2–3 Mbps</li>
              <li>音訊：AAC 128 kbps</li>
              <li>方向：自動旋轉開啟</li>
              <li>Overlay：style=compact，socketTransport=polling，enablePoll=1</li>
            </ul>
          </div>
          <div className="cue-card p-6">
            <div className="cue-zh-title mb-2">流程摘要</div>
            <ol className="text-sm text-gray-200 list-decimal pl-5 space-y-1">
              <li>在「房間」或場館後台「計分 / 房間」建立房間，取得房間碼 / ID</li>
              <li>輸入房間碼 / ID 產生 Overlay URL 並複製</li>
              <li>Android App 輸入 Overlay 與 RTMP，開始推流</li>
              <li>主持端記分，觀眾頁與 Overlay 即時同步</li>
            </ol>
          </div>
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default AndroidGuide;
