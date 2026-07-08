import React from 'react';

type ClubPublicTournamentReadyMatchesSectionProps = {
  tournament: any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  normalizeTournamentFormat: (value: any) => any;
  formatTournamentParticipantLabel: (participant: any) => string;
  openPublicBoardParticipantPanel: (tournament: any, participant: any) => void;
  renderPublicBoardParticipantActions: (tournament: any, row: any) => React.ReactNode;
};

const ClubPublicTournamentReadyMatchesSection: React.FC<ClubPublicTournamentReadyMatchesSectionProps> = ({
  tournament,
  formatPublicTournamentStageLabel,
  normalizeTournamentFormat,
  formatTournamentParticipantLabel,
  openPublicBoardParticipantPanel,
  renderPublicBoardParticipantActions,
}) => {
  if (!Array.isArray(tournament?.readyMatches) || tournament.readyMatches.length <= 0) return null;

  return (
    <div className="mt-4">
      <div className="font-semibold mb-2">即將上場</div>
      <div className="grid gap-2 lg:grid-cols-2">
        {tournament.readyMatches.map((row: any) => (
          <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
              <span>{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</span>
              <span>{row?.scheduled_at ? new Date(String(row.scheduled_at)).toLocaleString() : '待定時間'}</span>
            </div>
            <button
              type="button"
              onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_a_participant)}
              className="font-semibold text-left hover:underline"
            >
              {formatTournamentParticipantLabel(row?.player_a_participant)}
            </button>
            <div className="text-xs cue-muted my-1">vs</div>
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

export default ClubPublicTournamentReadyMatchesSection;
