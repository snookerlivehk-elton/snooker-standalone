import React from 'react';
import { useNavigate } from 'react-router-dom';

interface TopBarPublicProps {
  title: string;
  showBack?: boolean;
  onToggleLang?: () => void;
  lang?: 'zh' | 'en';
}

const TopBarPublic: React.FC<TopBarPublicProps> = ({ title, showBack = true, onToggleLang, lang = 'zh' }) => {
  const nav = useNavigate();
  return (
    <header className="cue-topbar w-full flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => nav(-1)}
            aria-label="Back"
            className="text-white/90 hover:text-white text-xl"
          >
            ←
          </button>
        )}
        <div className="cue-zh-title text-white text-lg">{title}</div>
      </div>
      <button
        onClick={onToggleLang}
        className="cue-button px-3 py-1 text-sm"
        aria-label="Language Toggle"
      >
        {lang === 'zh' ? 'EN' : '中文'}
      </button>
    </header>
  );
};

export default TopBarPublic;
