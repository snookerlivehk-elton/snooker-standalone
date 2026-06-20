import React from 'react';
import { useNavigate } from 'react-router-dom';

type VenueModuleStandaloneLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const VenueModuleStandaloneLayout: React.FC<VenueModuleStandaloneLayoutProps> = ({
  title,
  description,
  children,
}) => {
  const navigate = useNavigate();

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6">
      <div className="w-full max-w-6xl mx-auto space-y-4">
        <div className="glass rounded-xl p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words min-w-0">
                {title} <span className="text-sm font-normal accent-yellow ml-2">v2.1 Club</span>
              </h1>
              {description ? <div className="text-sm cue-muted mt-1">{description}</div> : null}
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => navigate('/venue/modules')}
                className="px-4 py-2 rounded-lg cue-surface-strong hover:brightness-95 transition-colors w-full sm:w-auto"
              >
                返回模組中心
              </button>
              <button
                type="button"
                onClick={() => navigate('/venue/dashboard')}
                className="px-4 py-2 rounded-lg cue-surface hover:brightness-95 transition-colors w-full sm:w-auto"
              >
                返回後台
              </button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};

export default VenueModuleStandaloneLayout;
