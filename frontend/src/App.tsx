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
import AdminMembers from './AdminMembers';
import AdminMatches from './AdminMatches';
import AdminRegions from './AdminRegions';
import AdminVenues from './AdminVenues';
import MemberLogin from './MemberLogin';
import VenueDashboard from './VenueDashboard';
import TableQrPage from './TableQrPage';
import ClubPublicPage from './ClubPublicPage';
import AdminOverview from './AdminOverview';
import AdminBreaks from './AdminBreaks';
import MemberRegisterSimple from './MemberRegisterSimple';
import Rooms from './Rooms';
import Me from './Me';
import Onboarding from './Onboarding';
import AndroidGuide from './AndroidGuide';
import HomePage from './HomePage';
import { API_URL, GOOGLE_CLIENT_ID } from './config';
import { FeatureKey, useFeatureEnabled } from './lib/features';

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
    <div className="fixed right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-2">
      <button
        type="button"
        className="px-3 py-2 rounded cue-surface-strong text-sm font-semibold hover:brightness-95"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      >
        {theme === 'dark' ? '日間' : '夜間'}
      </button>
    </div>
  );
}

function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactElement }) {
  const { loading, enabled } = useFeatureEnabled(API_URL, feature);
  if (loading) {
    return <div className="min-h-screen brand-page p-8">載入中...</div>;
  }
  if (!enabled) {
    return <Navigate to="/" replace />;
  }
  return children;
}


function App() {
  const [gameState, setGameState] = useState<State | null>(null);
  const handleStartMatch = (settings: any) => {
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
        <Route path="/rooms" element={<FeatureGate feature="scoring"><Rooms /></FeatureGate>} />
        <Route path="/me" element={<FeatureGate feature="member_portal"><Me /></FeatureGate>} />
        <Route path="/android" element={<AndroidGuide />} />
        <Route path="/admin" element={<AdminAuth><Navigate to="/admin/overview" replace /></AdminAuth>} />
        <Route path="/admin/overview" element={<AdminAuth><AdminOverview /></AdminAuth>} />
        <Route path="/admin/legacy" element={<AdminAuth><FeatureGate feature="scoring"><Admin /></FeatureGate></AdminAuth>} />
        <Route path="/admin/breaks" element={<AdminAuth><FeatureGate feature="highbreak"><AdminBreaks /></FeatureGate></AdminAuth>} />
        <Route path="/members/register" element={<MemberRegister />} />
        <Route path="/members/simple-register" element={<MemberRegisterSimple />} />
        <Route path="/members/login" element={<MemberLogin mode="member" />} />
        <Route path="/operator/login" element={<Navigate to="/venue/login" replace />} />
        <Route path="/operator/dashboard" element={<Navigate to="/venue/dashboard" replace />} />
        <Route path="/venue/login" element={<MemberLogin mode="venue" />} />
        <Route path="/member/:id" element={<Navigate to="/me" replace />} />
        <Route path="/venue/dashboard" element={<FeatureGate feature="club_dashboard"><VenueDashboard /></FeatureGate>} />
        <Route path="/club/:clubId" element={<ClubPublicPage />} />
        <Route path="/qr/table/:token" element={<FeatureGate feature="qr_session"><TableQrPage /></FeatureGate>} />
        <Route path="/admin/members" element={<AdminAuth><AdminMembers /></AdminAuth>} />
        <Route path="/admin/matches" element={<AdminAuth><FeatureGate feature="scoring"><AdminMatches /></FeatureGate></AdminAuth>} />
        <Route path="/admin/regions" element={<AdminAuth><AdminRegions /></AdminAuth>} />
        <Route path="/admin/venues" element={<AdminAuth><AdminVenues /></AdminAuth>} />
        <Route path="/room/:roomId" element={<FeatureGate feature="scoring"><Scoreboard gameState={gameState} setGameState={setGameState} /></FeatureGate>} />
        <Route path="/room/:roomId/setup" element={<FeatureGate feature="scoring"><Setup onStartMatch={handleStartMatch} /></FeatureGate>} />
        <Route path="/room/:roomId/live" element={<FeatureGate feature="live"><LiveView /></FeatureGate>} />
        <Route path="/room/:roomId/overlay" element={<FeatureGate feature="scoring"><Overlay /></FeatureGate>} />
        {/* Fallback: any unknown route goes to Admin */}
        <Route path="*" element={<Navigate to="/members/login" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  );
}

export default App;

