import React from 'react';
import VenueTournamentBreaksPanel from './VenueTournamentBreaksPanel';
import VenueTournamentScoringMainPanel from './VenueTournamentScoringMainPanel';
import type { TournamentScoringWorkspace } from './VenueTournamentScoringTypes';

type VenueTournamentScoringWorkspaceProps = {
  workspace: TournamentScoringWorkspace;
};

const VenueTournamentScoringWorkspace: React.FC<VenueTournamentScoringWorkspaceProps> = ({ workspace }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const didMountRef = React.useRef(false);

  React.useEffect(() => {
    if (!workspace?.selectedMatch?.id) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [workspace?.selectedMatch?.id]);

  return (
    <div ref={containerRef} className="mt-4">
      <div className="mb-3 rounded-lg border border-violet-400/25 bg-violet-500/10 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-200">記分定位</div>
        <div className="mt-1 text-sm text-violet-50">{workspace.selectedMatchBreadcrumbLabel}</div>
        <div className="mt-1 text-xs cue-muted">
          已自動對應到目前選中的對局來源，方便來回查看 Schedule / Bracket 與記分區。
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <VenueTournamentScoringMainPanel workspace={workspace} />
        <VenueTournamentBreaksPanel workspace={workspace} />
      </div>
    </div>
  );
};

export default VenueTournamentScoringWorkspace;
