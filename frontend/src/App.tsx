import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import AdminAuth from './AdminAuth';
import MemberRegister from './MemberRegister';
import AdminRegions from './AdminRegions';
import AdminVenues from './AdminVenues';
import AdminClubFeatures from './AdminClubFeatures';
import AdminNewsSources from './AdminNewsSources';
import MemberLogin from './MemberLogin';
import VenueDashboard from './VenueDashboard';
import VenueModulePage from './VenueModulePage';
import TableQrPage from './TableQrPage';
import ClubPublicPage from './ClubPublicPage';
import AdminOverview from './AdminOverview';
import AdminModuleSettingsPage from './AdminModuleSettingsPage';
import AdminBreaks from './AdminBreaks';
import NewsPage from './NewsPage';
import MemberRegisterSimple from './MemberRegisterSimple';
import Me from './Me';
import Onboarding from './Onboarding';
import HomePage from './HomePage';
import { API_URL, GOOGLE_CLIENT_ID } from './config';
import { FeatureKey, type ModuleCode, useFeatureEnabled, useModuleVisible } from './lib/features';

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

function ModuleVisibilityGate({
  moduleCode,
  scope = 'public',
  redirectTo = '/members/login',
  children,
}: {
  moduleCode: ModuleCode;
  scope?: 'public' | 'home';
  redirectTo?: string;
  children: React.ReactElement;
}) {
  const { loading, visible } = useModuleVisible(API_URL, moduleCode, scope);
  if (loading) {
    return <div className="min-h-screen brand-page p-8">載入中...</div>;
  }
  if (!visible) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}

function RootEntry() {
  const { loading, visible } = useModuleVisible(API_URL, 'system_portal', 'public');
  if (loading) {
    return <div className="min-h-screen brand-page p-8">載入中...</div>;
  }
  return <Navigate to={visible ? '/home' : '/members/login'} replace />;
}

function AdminOverviewRedirect({ tab }: { tab: string }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', tab);
  return <Navigate to={`/admin/overview?${params.toString()}`} replace />;
}


function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LogoutButton />
      <Routes>
        {/* Public routes for LIVE app */}
        <Route path="/" element={<RootEntry />} />
        <Route path="/home" element={<ModuleVisibilityGate moduleCode="system_portal" scope="home"><HomePage /></ModuleVisibilityGate>} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/join" element={<Navigate to="/members/login" replace />} />
        <Route path="/me" element={<FeatureGate feature="member_portal"><Me /></FeatureGate>} />
        <Route path="/news" element={<ModuleVisibilityGate moduleCode="content" scope="public"><NewsPage /></ModuleVisibilityGate>} />
        <Route path="/admin" element={<AdminAuth><AdminOverviewRedirect tab="system" /></AdminAuth>} />
        <Route path="/admin/overview" element={<AdminAuth><AdminOverview /></AdminAuth>} />
        <Route path="/admin/modules" element={<AdminAuth><AdminOverviewRedirect tab="system" /></AdminAuth>} />
        <Route path="/admin/modules/:moduleCode/settings" element={<AdminAuth><AdminModuleSettingsPage /></AdminAuth>} />
        <Route path="/admin/breaks" element={<AdminAuth><FeatureGate feature="highbreak"><AdminBreaks /></FeatureGate></AdminAuth>} />
        <Route path="/members/register" element={<MemberRegister />} />
        <Route path="/members/simple-register" element={<MemberRegisterSimple />} />
        <Route path="/members/login" element={<MemberLogin />} />
        <Route path="/operator/login" element={<Navigate to="/venue/login" replace />} />
        <Route path="/operator/dashboard" element={<Navigate to="/venue/dashboard" replace />} />
        <Route path="/venue/login" element={<MemberLogin />} />
        <Route path="/member/:id" element={<Navigate to="/me" replace />} />
        <Route path="/venue/dashboard" element={<FeatureGate feature="club_dashboard"><VenueDashboard /></FeatureGate>} />
        <Route path="/venue/modules" element={<FeatureGate feature="club_dashboard"><Navigate to="/venue/dashboard" replace /></FeatureGate>} />
        <Route path="/venue/manage/:moduleCode" element={<FeatureGate feature="club_dashboard"><VenueModulePage /></FeatureGate>} />
        <Route path="/club/:clubId" element={<ModuleVisibilityGate moduleCode="system_portal" scope="public"><ClubPublicPage /></ModuleVisibilityGate>} />
        <Route path="/qr/table/:token" element={<FeatureGate feature="qr_session"><TableQrPage /></FeatureGate>} />
        <Route path="/admin/members" element={<AdminAuth><AdminOverviewRedirect tab="members" /></AdminAuth>} />
        <Route path="/admin/regions" element={<AdminAuth><AdminRegions /></AdminAuth>} />
        <Route path="/admin/venues" element={<AdminAuth><AdminVenues /></AdminAuth>} />
        <Route path="/admin/club-features" element={<AdminAuth><AdminClubFeatures /></AdminAuth>} />
        <Route path="/admin/news-sources" element={<AdminAuth><AdminNewsSources /></AdminAuth>} />
        {/* Fallback: any unknown route goes to Admin */}
        <Route path="*" element={<Navigate to="/members/login" replace />} />
      </Routes>
    </GoogleOAuthProvider>
  );
}

export default App;

