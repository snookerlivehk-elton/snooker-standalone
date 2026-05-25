import { useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
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
import AdminVenues from './AdminVenues';
import MemberLogin from './MemberLogin';
import VenueDashboard from './VenueDashboard';
import ClubPublicPage from './ClubPublicPage';
import AdminOverview from './AdminOverview';
import MemberRegisterSimple from './MemberRegisterSimple';
import Rooms from './Rooms';
import Me from './Me';
import Onboarding from './Onboarding';
import AndroidGuide from './AndroidGuide';

// Force frontend redeploy
function LogoutButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  })() as { id?: string };
  const hasSession = !!session?.id;
  const hide =
    location.pathname.startsWith('/members/login') ||
    location.pathname.startsWith('/venue/login') ||
    location.pathname.startsWith('/members/register') ||
    location.pathname.startsWith('/members/simple-register') ||
    location.pathname.startsWith('/onboarding');
  if (!hasSession || hide) return null;
  return (
    <button
      className="fixed top-3 right-3 z-50 px-3 py-2 rounded bg-gray-700/90 hover:bg-gray-600 text-white text-sm"
      onClick={() => {
        localStorage.removeItem('memberSession');
        navigate('/members/login');
      }}
    >
      登出
    </button>
  );
}

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
    <GoogleOAuthProvider clientId="216977203711-pm37tm2vr3h178qgdnaj8v4n72k5hps9.apps.googleusercontent.com">
      <LogoutButton />
      <Routes>
        {/* Public routes for LIVE app */}
        <Route path="/" element={<Navigate to="/members/login" replace />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/join" element={<Navigate to="/members/login" replace />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/me" element={<Me />} />
        <Route path="/android" element={<AndroidGuide />} />
        <Route path="/admin" element={<AdminAuth><Admin /></AdminAuth>} />
        <Route path="/admin/overview" element={<AdminAuth><AdminOverview /></AdminAuth>} />
        <Route path="/members/register" element={<MemberRegister />} />
        <Route path="/members/simple-register" element={<MemberRegisterSimple />} />
        <Route path="/members/login" element={<MemberLogin mode="member" />} />
        <Route path="/operator/login" element={<Navigate to="/venue/login" replace />} />
        <Route path="/operator/dashboard" element={<Navigate to="/venue/dashboard" replace />} />
        <Route path="/venue/login" element={<MemberLogin mode="venue" />} />
        <Route path="/member/:id" element={<MemberProfile />} />
        <Route path="/venue/dashboard" element={<VenueDashboard />} />
        <Route path="/club/:clubId" element={<ClubPublicPage />} />
        <Route path="/admin/members" element={<AdminAuth><AdminMembers /></AdminAuth>} />
        <Route path="/admin/matches" element={<AdminAuth><AdminMatches /></AdminAuth>} />
        <Route path="/admin/regions" element={<AdminAuth><AdminRegions /></AdminAuth>} />
        <Route path="/admin/venues" element={<AdminAuth><AdminVenues /></AdminAuth>} />
        <Route path="/room/:roomId" element={<Scoreboard gameState={gameState} setGameState={setGameState} />} />
        <Route path="/room/:roomId/setup" element={<Setup onStartMatch={handleStartMatch} />} />
        <Route path="/room/:roomId/live" element={<LiveView />} />
        <Route path="/room/:roomId/overlay" element={<Overlay />} />
        {/* Fallback: any unknown route goes to Admin */}
        <Route path="*" element={<Navigate to="/members/login" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  );
}

export default App;
