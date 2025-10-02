import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Admin from './Admin';
import Scoreboard from './Scoreboard';
import Setup from './Setup';
import AdminAuth from './AdminAuth';
import LiveView from './LiveView';
import { State } from './lib/State';
import Overlay from './Overlay';

function App() {
  const [gameState, setGameState] = useState<State | null>(null);
  const navigate = useNavigate();

  const handleStartMatch = (settings: any) => {
    const newGameState = new State(
      settings.playersInfo.map((p: any) => p.name),
      settings.settings
    );
    newGameState.players[0].name = settings.playersInfo[0].name;
    newGameState.players[0].memberId = settings.playersInfo[0].memberId;
    newGameState.players[1].name = settings.playersInfo[1].name;
    newGameState.players[1].memberId = settings.playersInfo[1].memberId;
    newGameState.currentPlayerIndex = settings.startingPlayerIndex;
    setGameState(newGameState);
  };

  return (
      <Routes>
        <Route path="/admin" element={<AdminAuth><Admin /></AdminAuth>} />
        <Route path="/room/:roomId" element={<Scoreboard gameState={gameState} setGameState={setGameState} />} />
        <Route path="/room/:roomId/setup" element={<Setup onStartMatch={handleStartMatch} />} />
        <Route path="/room/:roomId/live" element={<LiveView />} />
        <Route path="/room/:roomId/overlay" element={<Overlay />} />
      </Routes>
  );
}

export default App;