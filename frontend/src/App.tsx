import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Admin from './Admin';
import Scoreboard from './Scoreboard';
import Setup from './Setup';
import AdminAuth from './AdminAuth';
import LiveView from './LiveView';
import { State } from './lib/State';
import Overlay from './Overlay';
import MemberRegister from './MemberRegister';
import MemberProfile from './MemberProfile';
import AdminMembers from './AdminMembers';
import AdminMatches from './AdminMatches';
import AdminRegions from './AdminRegions';
import MemberLogin from './MemberLogin';
import OperatorDashboard from './OperatorDashboard';
import AdminOverview from './AdminOverview';
import MemberRegisterSimple from './MemberRegisterSimple';
import Join from './Join';
import Rooms from './Rooms';
import Me from './Me';
import Onboarding from './Onboarding';
import AndroidGuide from './AndroidGuide';

// Force frontend redeploy
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
        {/* Public routes for LIVE app */}
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/join" element={<Join />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/me" element={<Me />} />
        <Route path="/android" element={<AndroidGuide />} />
        <Route path="/admin" element={<AdminAuth><Admin /></AdminAuth>} />
        <Route path="/admin/overview" element={<AdminAuth><AdminOverview /></AdminAuth>} />
        <Route path="/members/register" element={<MemberRegister />} />
        <Route path="/members/simple-register" element={<MemberRegisterSimple />} />
        <Route path="/members/login" element={<MemberLogin mode="member" />} />
        <Route path="/operator/login" element={<MemberLogin mode="operator" />} />
        <Route path="/member/:id" element={<MemberProfile />} />
        <Route path="/operator/dashboard" element={<OperatorDashboard />} />
        <Route path="/admin/members" element={<AdminAuth><AdminMembers /></AdminAuth>} />
        <Route path="/admin/matches" element={<AdminAuth><AdminMatches /></AdminAuth>} />
        <Route path="/admin/regions" element={<AdminAuth><AdminRegions /></AdminAuth>} />
        <Route path="/room/:roomId" element={<Scoreboard gameState={gameState} setGameState={setGameState} />} />
        <Route path="/room/:roomId/setup" element={<Setup onStartMatch={handleStartMatch} />} />
        <Route path="/room/:roomId/live" element={<LiveView />} />
        <Route path="/room/:roomId/overlay" element={<Overlay />} />
        {/* Fallback: any unknown route goes to Admin */}
        <Route path="*" element={<Navigate to="/join" replace />} />
      </Routes>
  );
}

export default App;
