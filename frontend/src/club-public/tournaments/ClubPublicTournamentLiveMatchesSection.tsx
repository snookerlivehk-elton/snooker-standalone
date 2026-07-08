import React from 'react';

type ClubPublicTournamentLiveMatchesSectionProps = {
  tournament: any;
  buildPublicTournamentBreakSummary: (row: any) => any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  normalizeTournamentFormat: (value: any) => any;
  buildPublicTournamentLiveProgressLabel: (row: any, bestOfFrames: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
  openPublicBoardParticipantPanel: (tournament: any, participant: any) => void;
  renderPublicBoardParticipantActions: (tournament: any, row: any) => React.ReactNode;
};

const ClubPublicTournamentLiveMatchesSection: React.FC<ClubPublicTournamentLiveMatchesSectionProps> = ({
  tournament,
  buildPublicTournamentBreakSummary,
  formatPublicTournamentStageLabel,
  normalizeTournamentFormat,
  buildPublicTournamentLiveProgressLabel,
  formatTournamentMatchStatusLabel,
  formatTournamentParticipantLabel,
  openPublicBoardParticipantPanel,
  renderPublicBoardParticipantActions,
}) => {
  if (!Array.isArray(tournament?.liveMatches) || tournament.liveMatches.length <= 0) return null;

  return (
    <div className="mt-4">
      <div className="font-semibold mb-2">進行中場次</div>
      <div className="grid gap-3 xl:grid-cols-2">
        {tournament.liveMatches.map((row: any) => {
          const breakSummary = buildPublicTournamentBreakSummary(row);
          return (
            <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</div>
                  <div className="text-xs cue-muted mt-1">{buildPublicTournamentLiveProgressLabel(row, tournament?.bestOfFrames)}</div>
                </div>
                <div className="text-xs font-semibold accent-yellow">{formatTournamentMatchStatusLabel(row?.status)}</div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_a_participant)}
                  className="font-semibold text-left hover:underline"
                >
                  {formatTournamentParticipantLabel(row?.player_a_participant)}
                </button>
                <div className="text-sm cue-muted my-1">
                  {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                </div>
                <button
                  type="button"
                  onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_b_participant)}
                  className="font-semibold text-left hover:underline"
                >
                  {formatTournamentParticipantLabel(row?.player_b_participant)}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                <div className="cue-surface-strong rounded-lg p-2">{breakSummary.topLabel}</div>
                <div className="cue-surface-strong rounded-lg p-2">{breakSummary.countLabel}</div>
                <div className="cue-surface-strong rounded-lg p-2">已完成 {Array.isArray(row?.frames) ? row.frames.length : 0} 局</div>
              </div>
              <div className="text-xs cue-muted mt-3">{breakSummary.latestLabel}</div>
              {renderPublicBoardParticipantActions(tournament, row)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClubPublicTournamentLiveMatchesSection;
