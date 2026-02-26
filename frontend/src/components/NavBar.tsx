import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavBar: React.FC = () => {
  const loc = useLocation();
  const active = (path: string) => loc.pathname.startsWith(path) ? 'bg-gray-700' : 'bg-gray-800';
  return (
    <nav className="w-full bg-black/60 backdrop-blur border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold tracking-wider accent-yellow">SL18-APP</div>
          <div className="text-sm text-gray-300/80">管理後台</div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/overview" className={`px-3 py-2 rounded ${active('/admin/overview')} hover:bg-white/10`}>概覽</Link>
          <Link to="/admin/members" className={`px-3 py-2 rounded ${active('/admin/members')} hover:bg-white/10`}>會員</Link>
          <Link to="/admin/matches" className={`px-3 py-2 rounded ${active('/admin/matches')} hover:bg-white/10`}>比賽</Link>
          <Link to="/admin/regions" className={`px-3 py-2 rounded ${active('/admin/regions')} hover:bg-white/10`}>地區</Link>
          <Link to="/admin" className={`px-3 py-2 rounded ${active('/admin')} hover:bg-white/10`}>房間</Link>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
