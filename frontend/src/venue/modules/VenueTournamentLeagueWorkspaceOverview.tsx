import React from 'react';

type VenueTournamentLeagueWorkspaceOverviewProps = {
  bestOfFrames: string;
  formatTournamentFormatLabel: (value: any) => string;
  formatWorkflowStatusLabel: (value: any) => string;
  leagueRoundRobinMode: string;
  leagueSummary: any;
  note: string;
  pointsDraw: string;
  pointsLoss: string;
  pointsWin: string;
  tournamentFormat: any;
  workflowStatus: string;
};

const VenueTournamentLeagueWorkspaceOverview: React.FC<VenueTournamentLeagueWorkspaceOverviewProps> = ({
  bestOfFrames,
  formatTournamentFormatLabel,
  formatWorkflowStatusLabel,
  leagueRoundRobinMode,
  leagueSummary,
  note,
  pointsDraw,
  pointsLoss,
  pointsWin,
  tournamentFormat,
  workflowStatus,
}) => (
  <>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mb-4">
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">Workflow</div>
        <div className="font-semibold mt-1">{formatWorkflowStatusLabel(workflowStatus)}</div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">賽制</div>
        <div className="font-semibold mt-1">{formatTournamentFormatLabel(tournamentFormat)}</div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">正式參賽者 / 輪次</div>
        <div className="font-semibold mt-1">{`${leagueSummary.participantCount || 0} / ${leagueSummary.totalRounds || '-'}`}</div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">循環 / Best Of / 計分</div>
        <div className="font-semibold mt-1">
          {`${leagueRoundRobinMode === 'DOUBLE' ? '雙循環' : '單循環'} / BO${bestOfFrames || '-'} / ${pointsWin}-${pointsDraw}-${pointsLoss}`}
        </div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">賽程進度</div>
        <div className="font-semibold mt-1">
          {`${leagueSummary.completedCount} 完成 / ${leagueSummary.readyCount} 就緒 / ${leagueSummary.pendingCount} 待定`}
        </div>
      </div>
    </div>
    <div className="text-xs cue-muted mb-4">{note}</div>
  </>
);

export default VenueTournamentLeagueWorkspaceOverview;
