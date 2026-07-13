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
    isGoldSilverCup?: boolean;
    goldCup?: any;
    silverCup?: any;
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
  const renderPodiumBlock = (title: string, block: any) => {
    const hasThirdPlaceResult = !!block?.thirdPlace || !!block?.fourthPlace;
    const semiFinalists = Array.isArray(block?.semiFinalists) ? block.semiFinalists : [];
    if (!block?.champion && !block?.runnerUp && !hasThirdPlaceResult && semiFinalists.length <= 0) return null;
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold mb-3">{title}</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="cue-surface rounded-lg p-3">
            <div className="text-xs cue-muted">冠軍</div>
            <div className="font-semibold mt-1">{block?.champion ? formatParticipantLabel(block.champion) : '-'}</div>
          </div>
          <div className="cue-surface rounded-lg p-3">
            <div className="text-xs cue-muted">亞軍</div>
            <div className="font-semibold mt-1">{block?.runnerUp ? formatParticipantLabel(block.runnerUp) : '-'}</div>
          </div>
          <div className="cue-surface rounded-lg p-3">
            <div className="text-xs cue-muted">{hasThirdPlaceResult ? '季軍 / 殿軍' : '四強'}</div>
            <div className="font-semibold mt-1">
              {hasThirdPlaceResult
                ? `${block?.thirdPlace ? formatParticipantLabel(block.thirdPlace) : '-'} / ${block?.fourthPlace ? formatParticipantLabel(block.fourthPlace) : '-'}`
                : (semiFinalists.length > 0
                    ? semiFinalists.map((row: any) => formatParticipantLabel(row)).join(' / ')
                    : '-')}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
      {podiumSummary?.isGoldSilverCup ? (
        <div className="grid gap-3 mb-4">
          {renderPodiumBlock('金杯三甲', podiumSummary.goldCup)}
          {renderPodiumBlock('銀杯三甲', podiumSummary.silverCup)}
        </div>
      ) : ((podiumSummary.champion || podiumSummary.runnerUp || podiumSummary.semiFinalists.length > 0 || podiumSummary.thirdPlace || podiumSummary.fourthPlace) ? (
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
      ) : null)}
      <div className="text-xs cue-muted mb-4">{note}</div>
    </>
  );
};

export default VenueTournamentKnockoutWorkspaceOverview;
