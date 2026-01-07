import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, SOCKET_PATH, SOCKET_URL } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { nextRoomCode, setCodeForRoom, getCodeForRoom } from './lib/roomCode';

interface Room {
  id: string;
  name: string;
}

const Admin: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/rooms`)
      .then((res) => res.json())
      .then((data) => setRooms(data));
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
          const code = nextRoomCode();
          setCodeForRoom(newRoom.id, code);
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
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-6 text-center">Admin Panel</h1>
        <div className="w-full flex justify-end mb-4">
          <button
            onClick={() => {
              const tok = localStorage.getItem('adminToken') || '';
              const url = `${window.location.origin}/admin/members?apiUrl=${encodeURIComponent(API_URL)}&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}${tok ? `&token=${encodeURIComponent(tok)}` : ''}&v=members`;
              window.location.href = url;
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded transition-colors"
          >
            Members
          </button>
        </div>
        {/* Simple Mode: one scoreboard + one overlay, no room creation */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Simple Mode</h2>
          <p className="text-sm text-gray-300 mb-4">單一計分版與 OBS 連結（不需建立房間）。</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const url = `${window.location.origin}/room/default?simple=true&enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                navigator.clipboard.writeText(url).then(() => {
                  alert(`已複製簡化模式 Scoreboard 連結：\n${url}`);
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded transition-colors"
            >
              Copy Simple Scoreboard Link
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/room/default/overlay?simple=true&enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                navigator.clipboard.writeText(url).then(() => {
                  alert(`已複製簡化模式 Overlay 連結：\n${url}`);
                });
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded transition-colors"
            >
              Copy Simple Overlay Link
            </button>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Rooms</h2>
          <ul className="space-y-4">
            {rooms.map((room) => (
              <li key={room.id} className="flex justify-between items-center bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <Link to={`/room/${getCodeForRoom(room.id) || room.id}`} className="text-lg hover:text-blue-400 transition-colors">
                    {getCodeForRoom(room.id) ? `[${getCodeForRoom(room.id)}] ${room.name}` : room.name}
                  </Link>
                  <span className="text-sm text-gray-300">(ID: {getCodeForRoom(room.id) || room.id})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // 將 socket 參數一併帶入 Setup 連結，確保從 Setup 進入 Scoreboard 時不會丟失設定
                      const rid = getCodeForRoom(room.id) || room.id;
                      const url = `${window.location.origin}/room/${rid}/setup?enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert(`已複製房間 Setup 連結：\n${url}`);
                      });
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Copy Room Link
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`確定清空本地暫存（房間 ${room.id}）？此動作不會影響後端，只會清除這台瀏覽器的暫存資料。`)) {
                        try { RoomStorage.clearRoom(room.id); alert('已清空本地暫存'); } catch {}
                      }
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Clear Local Cache
                  </button>
                  <button
                    onClick={() => {
                      const rid = getCodeForRoom(room.id) || room.id;
                      const url = `${window.location.origin}/room/${rid}/live?enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert(`已複製 Live 連結：\n${url}`);
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Copy Live Link
                  </button>
                  <button
                    onClick={() => {
                      const rid = getCodeForRoom(room.id) || room.id;
                      const url = `${window.location.origin}/room/${rid}/overlay?enableSocket=true&socketUrl=${encodeURIComponent(SOCKET_URL)}&apiUrl=${encodeURIComponent(API_URL)}&socketPath=${encodeURIComponent(SOCKET_PATH)}`;
                      navigator.clipboard.writeText(url).then(() => {
                        alert(`已複製 Overlay 連結：\n${url}`);
                      });
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded transition-colors"
                  >
                    Copy Overlay Link
                  </button>
                  <button onClick={() => handleDeleteRoom(room.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Create a new room</h2>
          <form onSubmit={handleCreateRoom} className="flex space-x-4">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => {
                setNewRoomName(e.target.value);
                setError(null);
              }}
              className="flex-grow bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new room name"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">Create</button>
          </form>
          {error && <p className="text-red-500 mt-4">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default Admin;
