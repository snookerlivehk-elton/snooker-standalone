import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Admin from './Admin';
import Scoreboard from './Scoreboard';
import Setup from './Setup';
import AdminAuth from './AdminAuth';
import LiveView from './LiveView';
import { State } from './lib/State';
import Overlay from './Overlay';

function App() {
  const [gameState, setGameState] = useState<State | null>(null);

  const handleStartMatch = (settings: any) => {
    // 以物件參數建立 State，避免建構子參數數量錯誤
    const newGameState = new State({
      playersInfo: settings.playersInfo,
      settings: settings.settings,
      startingPlayerIndex: settings.startingPlayerIndex,
    });
    setGameState(newGameState);
  };

  return (
      <Routes>
        {/* Home route: redirect to Admin Login to avoid blank page */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminAuth><Admin /></AdminAuth>} />
        <Route path="/room/:roomId" element={<Scoreboard gameState={gameState} setGameState={setGameState} />} />
        <Route path="/room/:roomId/setup" element={<Setup onStartMatch={handleStartMatch} />} />
        <Route path="/room/:roomId/live" element={<LiveView />} />
        <Route path="/room/:roomId/overlay" element={<Overlay />} />
        {/* Fallback: any unknown route goes to Admin */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
  );
}

export default App;