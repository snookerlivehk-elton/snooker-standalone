import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getLang, setLang } from '../lib/i18n';

interface TopBarPublicProps {
  title: string;
  showBack?: boolean;
  onToggleLang?: () => void;
  lang?: 'zh' | 'en';
}

const TopBarPublic: React.FC<TopBarPublicProps> = ({ title, showBack = true, onToggleLang, lang = 'zh' }) => {
  const nav = useNavigate();
  const loc = useLocation();
  const current = useMemo(() => (lang || getLang()), [lang]);
  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('memberSession') || '{}'); } catch { return {}; }
  }, []);
  const showLogout = !!(session && session.id) && !(
    loc.pathname.startsWith('/members/login') ||
    loc.pathname.startsWith('/venue/login') ||
    loc.pathname.startsWith('/members/register') ||
    loc.pathname.startsWith('/members/simple-register') ||
    loc.pathname.startsWith('/onboarding')
  );
  const toggle = () => {
    if (onToggleLang) return onToggleLang();
    const next = (getLang() === 'zh' ? 'en' : 'zh') as 'zh' | 'en';
    setLang(next);
    try { window.location.reload(); } catch {}
  };
  return (
    <header className="cue-topbar w-full flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => nav(-1)}
            aria-label="Back"
            className="cue-muted hover:brightness-95 text-xl"
          >
            ←
          </button>
        )}
        <div className="cue-zh-title text-lg">{title}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="cue-button px-3 py-1 text-sm"
          aria-label="Language Toggle"
        >
          {current === 'zh' ? 'EN' : '中文'}
        </button>
        {showLogout && (
          <button
            onClick={() => { try { localStorage.removeItem('memberSession'); } catch {} nav('/members/login'); }}
            className="px-3 py-1 rounded cue-surface-strong hover:brightness-95 text-sm"
          >
            登出
          </button>
        )}
      </div>
    </header>
  );
};

export default TopBarPublic;
