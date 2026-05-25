import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import AdminBreaks from './AdminBreaks';
import MemberRegisterSimple from './MemberRegisterSimple';
import Rooms from './Rooms';
import Me from './Me';
import Onboarding from './Onboarding';
import AndroidGuide from './AndroidGuide';
import HomePage from './HomePage';
import { GOOGLE_CLIENT_ID } from './config';

// Force frontend redeploy
function LogoutButton() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('theme') === 'light' ? 'light' : 'dark');
    } catch {
      return 'dark';
    }
  });
  const session = (() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  })() as { id?: string };
  const hasSession = !!session?.id;

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2">
      <button
        type="button"
        className="px-3 py-2 rounded cue-surface-strong text-sm font-semibold hover:brightness-95"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      >
        {theme === 'dark' ? '日間' : '夜間'}
      </button>
      {hasSession && (
        <button
          type="button"
          className="px-3 py-2 rounded cue-surface-strong text-sm font-semibold hover:brightness-95"
          onClick={() => {
            localStorage.removeItem('memberSession');
            navigate('/members/login');
          }}
        >
          登出
        </button>
      )}
    </div>
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
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LogoutButton />
      <Routes>
        {/* Public routes for LIVE app */}
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/join" element={<Navigate to="/members/login" replace />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/me" element={<Me />} />
        <Route path="/android" element={<AndroidGuide />} />
        <Route path="/admin" element={<AdminAuth><Admin /></AdminAuth>} />
        <Route path="/admin/overview" element={<AdminAuth><AdminOverview /></AdminAuth>} />
        <Route path="/admin/breaks" element={<AdminAuth><AdminBreaks /></AdminAuth>} />
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
