import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, SOCKET_PATH, SOCKET_URL } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { setCodeForRoom, getCodeForRoom } from './lib/roomCode';
import NavBar from './components/NavBar';

interface Room {
  id: string;
  name: string;
  code?: string;
}

const Admin: React.FC = () => {
  const rawBase = (import.meta.env.BASE_URL || '/');
  let base = rawBase.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const p = window.location.pathname;
    const m = p.match(/^(.*)\/admin(?:\/.*)?$/);
    if (m && m[1] !== '') {
      base = m[1];
    }
  }
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch((err) => {
        console.error('Failed to load rooms:', err);
        if (import.meta.env.DEV && typeof window !== 'undefined') {
          const host = window.location.hostname;
          if (host === 'localhost' || host === '127.0.0.1') {
            setRooms([
              { id: 'dev-1', name: 'Dev Room', code: 'AAAAA0001' },
            ]);
          }
        }
      });
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
        // Stay on Admin page after creating a room; no redirect.
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
    <div className="brand-page flex flex-col">
      <NavBar />
      <div className="p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-6 text-center accent-yellow">系統管理員後台</h1>
        <div className="w-full flex justify-end mb-4 gap-2">
          <button
            onClick={() => {
              const tok = localStorage.getItem('adminToken') || '';
              const url = `${window.location.origin}${base}/admin/members${tok ? `?token=${encodeURIComponent(tok)}&v=members` : '?v=members'}`;
              window.location.href = url;
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded transition-colors"
          >
            Members
          </button>
          <button
            onClick={() => {
              const tok = localStorage.getItem('adminToken') || '';
              const url = `${window.location.origin}${base}/admin/matches${tok ? `?token=${encodeURIComponent(tok)}&v=matches` : '?v=matches'}`;
              window.location.href = url;
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded transition-colors"
          >
            Matches
          </button>
          <button
            onClick={() => {
              const tok = localStorage.getItem('adminToken') || '';
              const url = `${window.location.origin}${base}/admin/regions${tok ? `?token=${encodeURIComponent(tok)}&v=regions` : '?v=regions'}`;
              window.location.href = url;
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded transition-colors"
          >
            Regions
          </button>
        </div>
        {/* Simple Mode: one scoreboard + one overlay, no room creation */}
        <div className="glass rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Simple Mode</h2>
          <p className="text-sm text-gray-300/80 mb-4">單一計分版與 OBS 連結（不需建立房間）。</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const url = `${window.location.origin}${base}/room/default?simple=true&enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                navigator.clipboard.writeText(url).then(() => {
                  alert(`已複製簡化模式 Scoreboard 連結：\n${url}`);
                });
              }}
              className="brand-button text-black font-bold py-2 px-3 rounded transition-colors"
            >
              Copy Simple Scoreboard Link
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}${base}/room/default/overlay?simple=true&enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                navigator.clipboard.writeText(url).then(() => {
                  alert(`已複製簡化模式 Overlay 連結：\n${url}`);
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded transition-colors"
            >
              Copy Simple Overlay Link
            </button>
          </div>
        </div>
        <div className="glass rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Rooms</h2>
          <ul className="space-y-4">
            {rooms.map((room) => {
              const displayId = room.code || getCodeForRoom(room.id) || room.id;
              return (
              <li key={room.id} className="flex justify-between items-center bg-black/40 border border-white/10 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <Link to={`/room/${displayId}`} className="text-lg hover:text-blue-400 transition-colors">
                    {displayId !== room.name ? `[${displayId}] ${room.name}` : room.name}
                  </Link>
                  <span className="text-sm text-gray-300">(ID: {displayId})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
                      const url = `${window.location.origin}${base}/room/${displayId}/setup${params}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert(`已複製房間 Setup 連結：\n${url}`);
                      });
                    }}
                    className="brand-button text-black font-bold py-2 px-3 rounded transition-colors"
                  >
                    Copy Room Link
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定清空本地暫存（房間 ${room.id}）？此動作不會影響後端，只會清除這台瀏覽器的暫存資料。`)) {
                        try { RoomStorage.clearRoom(room.id); alert('已清空本地暫存'); } catch {}
                      }
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Clear Local Cache
                  </button>
                  <button
                    onClick={() => {
                      const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
                      const url = `${window.location.origin}${base}/room/${displayId}/live${params}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert(`已複製 Live 連結：\n${url}`);
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Copy Live Link
                  </button>
                  <button
                    onClick={() => {
                      const params = `?enableSocket=1&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
                      const url = `${window.location.origin}${base}/room/${displayId}/overlay${params}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert(`已複製 Overlay 連結：\n${url}`);
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Copy Overlay Link
                  </button>
                  <button onClick={() => handleDeleteRoom(room.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">Delete</button>
                </div>
              </li>
            )})}
          </ul>
        </div>
        <div className="glass rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Create a new room</h2>
          <form onSubmit={handleCreateRoom} className="flex space-x-4">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => {
                setNewRoomName(e.target.value);
                setError(null);
              }}
              className="flex-grow bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]"
              placeholder="Enter new room name"
            />
            <button type="submit" className="brand-button text-black font-bold py-2 px-4 rounded transition-colors">Create</button>
          </form>
          {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Admin;
