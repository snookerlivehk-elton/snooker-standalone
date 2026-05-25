import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNavPublic: React.FC = () => {
  const loc = useLocation();
  const isActive = (path: string) => loc.pathname === path;
  return (
    <nav className="cue-bottomnav w-full fixed bottom-0 left-0 flex items-center justify-around px-3">
      <Link to="/onboarding" className={`flex-1 mx-1 text-center py-2 text-sm font-semibold ${isActive('/onboarding') ? 'cue-active-tab text-[var(--brand-fg)]' : 'cue-muted'}`}>
        開始
      </Link>
      <Link to="/rooms" className={`flex-1 mx-1 text-center py-2 text-sm font-semibold ${isActive('/rooms') ? 'cue-active-tab text-[var(--brand-fg)]' : 'cue-muted'}`}>
        房間
      </Link>
      <Link to="/me" className={`flex-1 mx-1 text-center py-2 text-sm font-semibold ${isActive('/me') ? 'cue-active-tab text-[var(--brand-fg)]' : 'cue-muted'}`}>
        個人
      </Link>
    </nav>
  );
};

export default BottomNavPublic;
