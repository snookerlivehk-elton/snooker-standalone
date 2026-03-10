import React, { useEffect, useState } from 'react';
import TopBarPublic from './components/TopBarPublic';
import BottomNavPublic from './components/BottomNavPublic';
import { API_URL } from './config';
import { createOperatorRoom, deleteOperatorRoom, getOperatorActiveRooms } from './lib/api';

interface RoomItem {
  id?: string;
  code?: string;
  name?: string;
  createdAt?: string;
}

const Rooms: React.FC = () => {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  })() as { id?: string; role?: string };
  const isOperator = session?.role === 'ADMIN' || session?.role === 'OPERATOR' || session?.role === 'Operator';
  const operatorId = session?.id;

  const refresh = async () => {
    if (!operatorId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getOperatorActiveRooms(API_URL, operatorId);
      setRooms(res.rooms || []);
    } catch (e: any) {
      setError(e.message || '讀取房間失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isOperator && operatorId) void refresh(); }, []);

  const onCreate = async () => {
    if (!operatorId) return;
    setLoading(true);
    setError(null);
    try {
      await createOperatorRoom(API_URL, operatorId);
      await refresh();
    } catch (e: any) {
      setError(e.message || '建立房間失敗');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (roomId: string) => {
    if (!confirm('確定刪除此房間？')) return;
    setLoading(true);
    setError(null);
    try {
      await deleteOperatorRoom(API_URL, roomId);
      await refresh();
    } catch (e: any) {
      setError(e.message || '刪除失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brand-page min-h-screen flex flex-col">
      <TopBarPublic title="房間" />
      <main className="flex-1 px-4 pt-4 pb-20">
        <div className="max-w-3xl mx-auto space-y-4">
          {!isOperator && (
            <div className="cue-card p-4">
              <div className="font-bold mb-1">僅場館/球會可管理房間</div>
              <div className="text-sm text-gray-300">請以場館身份登入以建立/管理房間</div>
              <div className="mt-3 flex gap-2">
                <a href="/venue/login" className="cue-button px-4 py-2 rounded">場館登入</a>
                <a href="/members/login" className="px-4 py-2 rounded bg-gray-700 text-white">會員登入</a>
              </div>
            </div>
          )}

          {isOperator && (
            <div className="cue-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="cue-zh-title">我的房間</div>
                  <div className="cue-en-sub">Active Rooms</div>
                </div>
                <div className="flex gap-2">
                  <a href="/android" className="px-4 py-2 rounded bg-gray-700 text-white">Android 串接指引</a>
                  <button disabled={loading} onClick={onCreate} className="cue-button px-4 py-2 rounded">
                    建立房間
                  </button>
                  <a href="/venue/dashboard" className="px-4 py-2 rounded bg-gray-600 text-white">
                    回到管理後台
                  </a>
                </div>
              </div>
            </div>
          )}

          {error && <div className="p-3 rounded bg-red-900/40 border border-red-800/50 text-red-300">{error}</div>}

          <div className="grid md:grid-cols-2 gap-3">
            {(rooms || []).map((r, idx) => (
              <div key={r.id || r.code || idx} className="cue-card p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold">{r.name || r.code || r.id}</div>
                  <div className="text-xs text-gray-300">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                </div>
                <div className="flex gap-2">
                  <a
                    className="flex-1 cue-button py-2 text-center rounded"
                    href={r.code ? `/room/${encodeURIComponent(r.code)}` : (r.id ? `/room/${encodeURIComponent(r.id)}` : '#')}
                  >
                    主持
                  </a>
                  <a
                    className="flex-1 px-3 py-2 text-center rounded bg-gray-700 text-white"
                    href={r.code ? `/room/${encodeURIComponent(r.code)}/live` : (r.id ? `/room/${encodeURIComponent(r.id)}/live` : '#')}
                  >
                    觀眾
                  </a>
                  {isOperator && (r.id || r.code) && (
                    <button onClick={() => onDelete((r.id || r.code)!)} className="px-3 py-2 rounded bg-red-800 text-white">
                      刪除
                    </button>
                  )}
                </div>
                {(r.id || r.code) && (
                  <div className="text-xs text-gray-300 break-all">
                    Overlay：{window.location.origin}/room/{encodeURIComponent(r.code || r.id!)}/overlay
                  </div>
                )}
              </div>
            ))}
          </div>
          {isOperator && rooms.length === 0 && (
            <div className="text-sm text-gray-300 text-center">尚無房間，點擊「建立房間」新增</div>
          )}
        </div>
      </main>
      <BottomNavPublic />
    </div>
  );
};

export default Rooms;
