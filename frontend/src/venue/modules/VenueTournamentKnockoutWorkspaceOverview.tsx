import React from 'react';

type VenueTournamentKnockoutWorkspaceOverviewProps = {
  formatParticipantLabel: (participant: any) => string;
  formatTournamentFormatLabel: (value: any) => string;
  formatWorkflowStatusLabel: (value: any) => string;
  knockoutSummary: any;
  note: string;
  podiumSummary: {
    champion: any;
    runnerUp: any;
    thirdPlace: any;
    fourthPlace: any;
    semiFinalists: any[];
  };
  tournamentFormat: any;
  workflowStatus: string;
};

const VenueTournamentKnockoutWorkspaceOverview: React.FC<VenueTournamentKnockoutWorkspaceOverviewProps> = ({
  formatParticipantLabel,
  formatTournamentFormatLabel,
  formatWorkflowStatusLabel,
  knockoutSummary,
  note,
  podiumSummary,
  tournamentFormat,
  workflowStatus,
}) => {
  const hasThirdPlaceMatchResult = !!podiumSummary.thirdPlace || !!podiumSummary.fourthPlace;

  return (
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
          <div className="text-xs cue-muted">正式參賽者 / 籤表</div>
          <div className="font-semibold mt-1">{`${knockoutSummary.participantCount || 0} / ${knockoutSummary.bracketSize || '-'}`}</div>
        </div>
        <div className="cue-surface rounded-lg p-3">
          <div className="text-xs cue-muted">輪空 Bye</div>
          <div className="font-semibold mt-1">{knockoutSummary.byeCount}</div>
        </div>
        <div className="cue-surface rounded-lg p-3">
          <div className="text-xs cue-muted">賽程進度</div>
          <div className="font-semibold mt-1">
            {`${knockoutSummary.completedCount} 完成 / ${knockoutSummary.readyCount} 就緒 / ${knockoutSummary.pendingCount} 待定`}
          </div>
        </div>
      </div>
      {(podiumSummary.champion || podiumSummary.runnerUp || podiumSummary.semiFinalists.length > 0 || podiumSummary.thirdPlace || podiumSummary.fourthPlace) ? (
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
            <div className="text-xs cue-muted">{hasThirdPlaceMatchResult ? '季軍 / 殿軍' : '四強'}</div>
            <div className="font-semibold mt-1">
              {hasThirdPlaceMatchResult
                ? `${podiumSummary.thirdPlace ? formatParticipantLabel(podiumSummary.thirdPlace) : '-'} / ${podiumSummary.fourthPlace ? formatParticipantLabel(podiumSummary.fourthPlace) : '-'}`
                : (podiumSummary.semiFinalists.length > 0
                    ? podiumSummary.semiFinalists.map((row: any) => formatParticipantLabel(row)).join(' / ')
                    : '-')}
            </div>
          </div>
        </div>
      ) : null}
      <div className="text-xs cue-muted mb-4">{note}</div>
    </>
  );
};

export default VenueTournamentKnockoutWorkspaceOverview;
