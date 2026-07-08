import React from 'react';

type ClubPublicTournamentRecentCompletedSectionProps = {
  tournament: any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  normalizeTournamentFormat: (value: any) => any;
  formatTournamentParticipantLabel: (participant: any) => string;
  openPublicBoardParticipantPanel: (tournament: any, participant: any) => void;
  renderPublicBoardParticipantActions: (tournament: any, row: any) => React.ReactNode;
};

const ClubPublicTournamentRecentCompletedSection: React.FC<ClubPublicTournamentRecentCompletedSectionProps> = ({
  tournament,
  formatPublicTournamentStageLabel,
  normalizeTournamentFormat,
  formatTournamentParticipantLabel,
  openPublicBoardParticipantPanel,
  renderPublicBoardParticipantActions,
}) => {
  if (!Array.isArray(tournament?.recentCompletedMatches) || tournament.recentCompletedMatches.length <= 0) return null;

  return (
    <div className="mt-4">
      <div className="font-semibold mb-2">最近完成</div>
      <div className="grid gap-2 lg:grid-cols-3">
        {tournament.recentCompletedMatches.map((row: any) => (
          <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
            <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</div>
            <button
              type="button"
              onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_a_participant)}
              className="font-semibold mt-2 text-left hover:underline"
            >
              {formatTournamentParticipantLabel(row?.player_a_participant)}
            </button>
            <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
            <button
              type="button"
              onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_b_participant)}
              className="font-semibold text-left hover:underline"
            >
              {formatTournamentParticipantLabel(row?.player_b_participant)}
            </button>
            {renderPublicBoardParticipantActions(tournament, row)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClubPublicTournamentRecentCompletedSection;
