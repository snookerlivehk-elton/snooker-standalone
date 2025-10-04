import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';

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
        <h1 className="text-4xl font-bold mb-8 text-center">Admin Panel</h1>
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Rooms</h2>
          <ul className="space-y-4">
            {rooms.map((room) => (
              <li key={room.id} className="flex justify-between items-center bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <Link to={`/room/${room.id}`} className="text-lg hover:text-blue-400 transition-colors">{room.name}</Link>
                  <span className="text-sm text-gray-300">(ID: {room.id})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/room/${room.id}/setup`;
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
                      const url = `${window.location.origin}/room/${room.id}/live?enableSocket=true&socketUrl=${encodeURIComponent(API_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
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
                      const url = `${window.location.origin}/room/${room.id}/overlay?enableSocket=true&socketUrl=${encodeURIComponent(API_URL)}&apiUrl=${encodeURIComponent(API_URL)}`;
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