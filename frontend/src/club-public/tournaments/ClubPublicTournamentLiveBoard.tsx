import React from 'react';
import ClubPublicTournamentLiveBoardCard from './ClubPublicTournamentLiveBoardCard';

type ClubPublicTournamentLiveBoardProps = {
  tournamentLiveBoardLoading: boolean;
  tournamentLiveBoard: any[];
  tournamentLiveBoardError: string;
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

const ClubPublicTournamentLiveBoard: React.FC<ClubPublicTournamentLiveBoardProps> = ({
  tournamentLiveBoardLoading,
  tournamentLiveBoard,
  tournamentLiveBoardError,
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
    <div className="mt-5 space-y-6">
      <div className="cue-surface rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="font-semibold text-lg">公開賽況</div>
            <div className="text-xs cue-muted mt-1">集中顯示目前可公開查看的 tournament 進度、即將上場與最近完成場次</div>
          </div>
          <div className="text-xs cue-muted">
            {tournamentLiveBoardLoading ? '讀取中…' : `共 ${tournamentLiveBoard.length} 個賽事項目`}
          </div>
        </div>

        {tournamentLiveBoardError && <div className="text-sm text-rose-300 mb-2">{tournamentLiveBoardError}</div>}
        {tournamentLiveBoardLoading && <div className="text-sm cue-muted">讀取中…</div>}
        {!tournamentLiveBoardLoading && tournamentLiveBoard.length === 0 && (
          <div className="text-sm cue-muted">目前未有可公開顯示的 tournament 賽況。</div>
        )}
        {!tournamentLiveBoardLoading && tournamentLiveBoard.length > 0 && (
          <div className="space-y-4">
            {tournamentLiveBoard.map((tournament: any) => (
              <ClubPublicTournamentLiveBoardCard
                key={String(tournament?.id || Math.random())}
                tournament={tournament}
                tournaments={tournaments}
                setActiveTab={setActiveTab}
                setTournamentOpen={setTournamentOpen}
                formatTournamentFormatLabel={formatTournamentFormatLabel}
                formatTournamentWorkflowLabel={formatTournamentWorkflowLabel}
                buildPublicTournamentBreakSummary={buildPublicTournamentBreakSummary}
                formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
                normalizeTournamentFormat={normalizeTournamentFormat}
                buildPublicTournamentLiveProgressLabel={buildPublicTournamentLiveProgressLabel}
                formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
                formatTournamentParticipantLabel={formatTournamentParticipantLabel}
                openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
                renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubPublicTournamentLiveBoard;
