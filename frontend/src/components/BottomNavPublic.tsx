import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const BottomNavPublic: React.FC = () => {
  const loc = useLocation();
  const isActive = (path: string) => loc.pathname === path;
  return (
    <nav className="cue-bottomnav w-full fixed bottom-0 left-0 flex items-center justify-around px-3">
      <Link to="/join" className={`flex-1 mx-1 text-center py-2 text-white ${isActive('/join') ? 'cue-active-tab' : ''}`}>
        加入房間
      </Link>
      <Link to="/rooms" className={`flex-1 mx-1 text-center py-2 text-white ${isActive('/rooms') ? 'cue-active-tab' : ''}`}>
        房間
      </Link>
      <Link to="/me" className={`flex-1 mx-1 text-center py-2 text-white ${isActive('/me') ? 'cue-active-tab' : ''}`}>
        個人
      </Link>
    </nav>
  );
};

export default BottomNavPublic;
