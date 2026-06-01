import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, SOCKET_PATH, SOCKET_URL } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { setCodeForRoom, getCodeForRoom } from './lib/roomCode';
import NavBar from './components/NavBar';
import Tabs from './components/Tabs';

interface Room {
  id: string;
  name: string;
  code?: string;
}

const Admin: React.FC = () => {
  function resolveBasePath(): string {
    const rawBase = (import.meta.env.BASE_URL || '/');
    let base = rawBase.replace(/\/+$/, '');
    try {
      const p = window.location.pathname;
      const m = p.match(/^(.*)\/admin(?:\/.*)?$/);
      if (m && m[1] !== '') base = m[1];
    } catch {}
    return base;
  }

  function resolveToken(): string {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || localStorage.getItem('adminToken') || '';
    } catch {
      return localStorage.getItem('adminToken') || '';
    }
  }

  function resolveTab(): 'rooms' | 'simple' | 'create' | 'nav' {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = String(params.get('tab') || '').trim();
      if (t === 'rooms' || t === 'simple' || t === 'create' || t === 'nav') return t;
      return (localStorage.getItem('adminLegacyTab') as any) || 'rooms';
    } catch {
      return 'rooms';
    }
  }

  function updateTab(t: 'rooms' | 'simple' | 'create' | 'nav') {
    setActiveTab(t);
    try {
      localStorage.setItem('adminLegacyTab', t);
    } catch {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }

  const base = resolveBasePath();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rooms' | 'simple' | 'create' | 'nav'>('rooms');

  useEffect(() => {
    let cancelled = false;
    async function fetchRooms() {
      try {
        if (!cancelled) setRoomsLoading(true);
        const res = await fetch(`${API_URL}/api/rooms`, { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = (data as any)?.error || `讀取 Rooms 失敗 (${res.status})`;
          throw new Error(msg);
        }
        if (!Array.isArray(data)) throw new Error('讀取 Rooms 失敗：回傳格式錯誤');
        if (!cancelled) setRooms(data);
      } catch (err: any) {
        if (import.meta.env.DEV && typeof window !== 'undefined') {
          const host = window.location.hostname;
          if (host === 'localhost' || host === '127.0.0.1') {
            if (!cancelled) setRooms([{ id: 'dev-1', name: 'Dev Room', code: 'AAAAA0001' }]);
            return;
          }
        }
        if (!cancelled) setError(err?.message || '讀取 Rooms 失敗');
      } finally {
        if (!cancelled) setRoomsLoading(false);
      }
    }
    fetchRooms();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveTab(resolveTab());
  }, []);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newRoomName }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Failed to create room' }));
          throw new Error(errData.error || 'Failed to create room');
        }
        return res.json();
      })
      .then((newRoom) => {
        setRooms([...rooms, newRoom]);
        try {
          if (newRoom.code) {
            setCodeForRoom(newRoom.id, newRoom.code);
          }
        } catch {}
        setNewRoomName('');
        setError(null);
      })
      .catch((error) => {
        console.error(error);
        setError(error.message);
      });
  };

  const handleDeleteRoom = (roomId: string) => {
      fetch(`${API_URL}/api/rooms/${roomId}`, {
          method: 'DELETE',
      })
      .then(response => {
          if (response.ok) {
              setRooms(rooms.filter(room => room.id !== roomId));
          }
      });
  };

  return (
    <div className="brand-page min-h-screen">
      <NavBar />
      <div className="p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-5xl mx-auto glass rounded-xl p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold accent-yellow">系統管理（舊版後台）</h1>
              <div className="text-sm cue-muted mt-1">Rooms / Simple Mode 等舊流程入口（已對齊新 UI 排版）</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                onClick={() => {
                  const tok = resolveToken();
                  window.location.href = `${window.location.origin}${base}/admin/overview${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
                }}
              >
                新UI
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                onClick={() => updateTab('nav')}
              >
                管理頁
              </button>
            </div>
          </div>

          <div className="mt-4">
            <Tabs
              items={[
                { key: 'rooms', label: 'Rooms' },
                { key: 'simple', label: 'Simple Mode' },
                { key: 'create', label: '建立房間' },
                { key: 'nav', label: '管理頁' },
              ]}
              activeKey={activeTab}
              onChange={(k) => updateTab(k as any)}
            />
          </div>

          {activeTab === 'nav' && (
            <div className="mt-5 space-y-6">
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="text-lg font-bold">管理頁入口</div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold text-left"
                    onClick={() => {
                      const tok = resolveToken();
                      window.location.href = `${window.location.origin}${base}/admin/overview${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
                    }}
                  >
                    系統概覽（新UI）
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold text-left"
                    onClick={() => {
                      const tok = resolveToken();
                      window.location.href = `${window.location.origin}${base}/admin/members${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
                    }}
                  >
                    會員管理
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold text-left"
                    onClick={() => {
                      const tok = resolveToken();
                      window.location.href = `${window.location.origin}${base}/admin/breaks${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
                    }}
                  >
                    單杆管理
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold text-left"
                    onClick={() => {
                      const tok = resolveToken();
                      window.location.href = `${window.location.origin}${base}/admin/matches${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
                    }}
                  >
                    比賽管理
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold text-left"
                    onClick={() => {
                      const tok = resolveToken();
                      window.location.href = `${window.location.origin}${base}/admin/regions${tok ? `?token=${encodeURIComponent(tok)}` : ''}`;
                    }}
                  >
                    地區管理
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'simple' && (
            <div className="mt-5 space-y-6">
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="text-lg font-bold">Simple Mode</div>
                <div className="text-sm cue-muted mt-1">單一計分版與 OBS 連結（不需建立房間）</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => {
                      const url = `${window.location.origin}${base}/room/default?simple=true&enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                      navigator.clipboard.writeText(url).then(() => alert(`已複製簡化模式 Scoreboard 連結：\n${url}`));
                    }}
                  >
                    複製 Scoreboard
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => {
                      const url = `${window.location.origin}${base}/room/default/overlay?simple=true&enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                      navigator.clipboard.writeText(url).then(() => alert(`已複製簡化模式 Overlay 連結：\n${url}`));
                    }}
                  >
                    複製 Overlay
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="mt-5 space-y-6">
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-bold">Rooms</div>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => updateTab('create')}
                  >
                    建立房間
                  </button>
                </div>
                {roomsLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
                {!roomsLoading && rooms.length === 0 && !error && <div className="text-sm cue-muted mt-2">暫時未有房間</div>}
                {!roomsLoading && error && <div className="text-sm text-red-500 mt-2">{error}</div>}
                <div className="mt-3 space-y-3">
                  {rooms.map((room) => {
                    const displayId = room.code || getCodeForRoom(room.id) || room.id;
                    return (
                      <div key={room.id} className="bg-black/30 border border-white/10 rounded p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <Link to={`/room/${displayId}`} className="text-base font-semibold hover:text-[var(--brand-blue)] transition-colors break-all">
                              {displayId !== room.name ? `[${displayId}] ${room.name}` : room.name}
                            </Link>
                            <div className="text-xs cue-muted break-all mt-1">ID: {displayId}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <button
                              type="button"
                              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                              onClick={() => {
                                const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
                                const url = `${window.location.origin}${base}/room/${displayId}/setup${params}`;
                                navigator.clipboard.writeText(url).then(() => alert(`已複製房間 Setup 連結：\n${url}`));
                              }}
                            >
                              複製 Setup
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                              onClick={() => {
                                const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
                                const url = `${window.location.origin}${base}/room/${displayId}/live${params}`;
                                navigator.clipboard.writeText(url).then(() => alert(`已複製 Live 連結：\n${url}`));
                              }}
                            >
                              複製 Live
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                              onClick={() => {
                                const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
                                const url = `${window.location.origin}${base}/room/${displayId}/overlay${params}`;
                                navigator.clipboard.writeText(url).then(() => alert(`已複製 Overlay 連結：\n${url}`));
                              }}
                            >
                              複製 Overlay
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                              onClick={() => {
                                if (confirm(`確定清空本地暫存（房間 ${room.id}）？此動作不會影響後端，只會清除這台瀏覽器的暫存資料。`)) {
                                  try { RoomStorage.clearRoom(room.id); alert('已清空本地暫存'); } catch {}
                                }
                              }}
                            >
                              清空暫存
                            </button>
                            <button
                              type="button"
                              className="px-3 py-2 rounded bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold"
                              onClick={() => handleDeleteRoom(room.id)}
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'create' && (
            <div className="mt-5 space-y-6">
              <div className="bg-black/40 border border-white/10 rounded p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-bold">建立房間</div>
                  <button
                    type="button"
                    className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    onClick={() => updateTab('rooms')}
                  >
                    返回 Rooms
                  </button>
                </div>
                <form onSubmit={handleCreateRoom} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => {
                      setNewRoomName(e.target.value);
                      setError(null);
                    }}
                    className="flex-1 bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]"
                    placeholder="輸入新房間名稱"
                  />
                  <button type="submit" className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold">
                    建立
                  </button>
                </form>
                {error && <div className="text-sm text-red-500 mt-2">{error}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
