import React from 'react';

type VenueTournamentSummaryPanelProps = {
  bestOfFrames: string;
  hasParticipants: boolean;
  hasPlayedMatches: boolean;
  hasSchedule: boolean;
  isLeague: boolean;
  leagueRoundRobinMode: string;
  leagueSummary: any;
  knockoutSummary: any;
  note: string;
  podiumSummary: {
    champion: any;
    runnerUp: any;
    semiFinalists: any[];
  };
  pointsDraw: string;
  pointsLoss: string;
  pointsWin: string;
  tournamentFormat: any;
  workflowStatus: string;
  formatParticipantLabel: (participant: any) => string;
  formatTournamentFormatLabel: (value: any) => string;
  formatWorkflowStatusLabel: (value: any) => string;
};

const VenueTournamentSummaryPanel: React.FC<VenueTournamentSummaryPanelProps> = ({
  bestOfFrames,
  hasParticipants,
  hasPlayedMatches,
  hasSchedule,
  isLeague,
  leagueRoundRobinMode,
  leagueSummary,
  knockoutSummary,
  note,
  podiumSummary,
  pointsDraw,
  pointsLoss,
  pointsWin,
  tournamentFormat,
  workflowStatus,
  formatParticipantLabel,
  formatTournamentFormatLabel,
  formatWorkflowStatusLabel,
}) => (
  <>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">Workflow</div>
        <div className="font-semibold mt-1">{formatWorkflowStatusLabel(workflowStatus)}</div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">賽制</div>
        <div className="font-semibold mt-1">{formatTournamentFormatLabel(tournamentFormat)}</div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">{isLeague ? '正式參賽者 / 輪次' : '正式參賽者 / 籤表'}</div>
        <div className="font-semibold mt-1">
          {isLeague
            ? `${leagueSummary.participantCount || 0} / ${leagueSummary.totalRounds || '-'}`
            : `${knockoutSummary.participantCount || 0} / ${knockoutSummary.bracketSize || '-'}`
          }
        </div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">{isLeague ? 'Best Of / 計分' : '輪空 Bye'}</div>
        <div className="font-semibold mt-1">
          {isLeague
            ? `${leagueRoundRobinMode === 'DOUBLE' ? '雙循環' : '單循環'} / BO${bestOfFrames || '-'} / ${pointsWin}-${pointsDraw}-${pointsLoss}`
            : knockoutSummary.byeCount}
        </div>
      </div>
      <div className="cue-surface rounded-lg p-3">
        <div className="text-xs cue-muted">賽程進度</div>
        <div className="font-semibold mt-1">
          {isLeague
            ? `${leagueSummary.completedCount} 完成 / ${leagueSummary.readyCount} 就緒 / ${leagueSummary.pendingCount} 待定`
            : `${knockoutSummary.completedCount} 完成 / ${knockoutSummary.readyCount} 就緒 / ${knockoutSummary.pendingCount} 待定`
          }
        </div>
      </div>
    </div>
    {!isLeague && (podiumSummary.champion || podiumSummary.runnerUp || podiumSummary.semiFinalists.length > 0) ? (
      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div className="cue-surface rounded-lg p-3">
          <div className="text-xs cue-muted">冠軍</div>
          <div className="font-semibold mt-1">{podiumSummary.champion ? formatParticipantLabel(podiumSummary.champion) : '-'}</div>
        </div>
        <div className="cue-surface rounded-lg p-3">
          <div className="text-xs cue-muted">亞軍</div>
          <div className="font-semibold mt-1">{podiumSummary.runnerUp ? formatParticipantLabel(podiumSummary.runnerUp) : '-'}</div>
        </div>
        <div className="cue-surface rounded-lg p-3">
          <div className="text-xs cue-muted">四強</div>
          <div className="font-semibold mt-1">
            {podiumSummary.semiFinalists.length > 0
              ? podiumSummary.semiFinalists.map((row: any) => formatParticipantLabel(row)).join(' / ')
              : '-'}
          </div>
        </div>
      </div>
    ) : null}
    <div className="text-xs cue-muted mb-4">{note}</div>
  </>
);

export default VenueTournamentSummaryPanel;
