import React from 'react';
import VenueTournamentBreaksPanel from './VenueTournamentBreaksPanel';
import VenueTournamentScoringMainPanel from './VenueTournamentScoringMainPanel';

type VenueTournamentScoringWorkspaceProps = {
  workspace: any;
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
