import React from 'react';
import ClubPublicTournamentLiveMatchesSection from './ClubPublicTournamentLiveMatchesSection';
import ClubPublicTournamentReadyMatchesSection from './ClubPublicTournamentReadyMatchesSection';
import ClubPublicTournamentRecentCompletedSection from './ClubPublicTournamentRecentCompletedSection';

type ClubPublicTournamentLiveBoardCardProps = {
  tournament: any;
  tournaments: any[];
  setActiveTab: (value: string) => void;
  setTournamentOpen: (value: any) => void;
  formatTournamentFormatLabel: (value: any) => string;
  formatTournamentWorkflowLabel: (value: any) => string;
  buildPublicTournamentBreakSummary: (row: any) => any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  normalizeTournamentFormat: (value: any) => any;
  buildPublicTournamentLiveProgressLabel: (row: any, bestOfFrames: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
  openPublicBoardParticipantPanel: (tournament: any, participant: any) => void;
  renderPublicBoardParticipantActions: (tournament: any, row: any) => React.ReactNode;
};

const ClubPublicTournamentLiveBoardCard: React.FC<ClubPublicTournamentLiveBoardCardProps> = ({
  tournament,
  tournaments,
  setActiveTab,
  setTournamentOpen,
  formatTournamentFormatLabel,
  formatTournamentWorkflowLabel,
  buildPublicTournamentBreakSummary,
  formatPublicTournamentStageLabel,
  normalizeTournamentFormat,
  buildPublicTournamentLiveProgressLabel,
  formatTournamentMatchStatusLabel,
  formatTournamentParticipantLabel,
  openPublicBoardParticipantPanel,
  renderPublicBoardParticipantActions,
}) => {
  return (
    <div className="cue-surface-strong rounded-lg p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-lg truncate">{String(tournament?.title || '比賽')}</div>
          <div className="text-xs cue-muted mt-1">
            {formatTournamentFormatLabel(tournament?.format)} · {formatTournamentWorkflowLabel(tournament?.workflow_status)}
            {tournament?.startsAt ? ` · ${new Date(String(tournament.startsAt)).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="px-3 py-2 rounded cue-surface">進行中 {Number(tournament?.summary?.liveMatchCount || 0)}</div>
          <div className="px-3 py-2 rounded cue-surface">即將上場 {Number(tournament?.summary?.readyMatchCount || 0)}</div>
          <div className="px-3 py-2 rounded cue-surface">已完成 {Number(tournament?.summary?.completedMatchCount || 0)}</div>
        </div>
      </div>

      <ClubPublicTournamentLiveMatchesSection
        tournament={tournament}
        buildPublicTournamentBreakSummary={buildPublicTournamentBreakSummary}
        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
        normalizeTournamentFormat={normalizeTournamentFormat}
        buildPublicTournamentLiveProgressLabel={buildPublicTournamentLiveProgressLabel}
        formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
        openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
        renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
      />

      <ClubPublicTournamentReadyMatchesSection
        tournament={tournament}
        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
        normalizeTournamentFormat={normalizeTournamentFormat}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
        openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
        renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
      />

      <ClubPublicTournamentRecentCompletedSection
        tournament={tournament}
        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
        normalizeTournamentFormat={normalizeTournamentFormat}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
        openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
        renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
      />

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setActiveTab('signup');
            setTournamentOpen(tournaments.find((row: any) => String(row?.id || '') === String(tournament?.id || '')) || tournament);
          }}
          className="px-4 py-2 rounded cue-button text-sm font-semibold"
        >
          查看詳情
        </button>
      </div>
    </div>
  );
};

export default ClubPublicTournamentLiveBoardCard;
