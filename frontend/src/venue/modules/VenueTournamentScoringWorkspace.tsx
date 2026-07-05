import React from 'react';
import VenueTournamentBreaksPanel from './VenueTournamentBreaksPanel';
import VenueTournamentScoringMainPanel from './VenueTournamentScoringMainPanel';
import type { TournamentScoringWorkspace } from './VenueTournamentScoringTypes';

type VenueTournamentScoringWorkspaceProps = {
  workspace: TournamentScoringWorkspace;
};

const VenueTournamentScoringWorkspace: React.FC<VenueTournamentScoringWorkspaceProps> = ({ workspace }) => {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <VenueTournamentScoringMainPanel workspace={workspace} />
      <VenueTournamentBreaksPanel workspace={workspace} />
    </div>
  );
};

export default VenueTournamentScoringWorkspace;
