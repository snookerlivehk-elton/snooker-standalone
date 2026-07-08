import React from 'react';
import VenueTournamentKnockoutWorkflowInsights from './VenueTournamentKnockoutWorkflowInsights';
import VenueTournamentScheduleBracketPanel from './VenueTournamentScheduleBracketPanel';

type VenueTournamentKnockoutWorkspaceMainContentProps = {
  bracketColumns: any[];
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  formatDisplayDateTime: (value: any) => string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  leagueRounds: any[];
  matchesLoading: boolean;
  matchesRows: any[];
  participantsCount: number;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
  selectMatchForScoring: (row: any) => void;
  tournamentTitle?: string;
};

const VenueTournamentKnockoutWorkspaceMainContent: React.FC<VenueTournamentKnockoutWorkspaceMainContentProps> = ({
  bracketColumns,
  buildMatchProgressSummary,
  formatDisplayDateTime,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  leagueRounds,
  matchesLoading,
  matchesRows,
  participantsCount,
  selectedMatchId,
  selectedTournamentBestOf,
  selectMatchForScoring,
  tournamentTitle,
}) => (
  <div>
    <VenueTournamentKnockoutWorkflowInsights
      matchesRows={matchesRows}
      onJumpToMatch={selectMatchForScoring}
      participantsCount={participantsCount}
      selectedMatchId={selectedMatchId}
    />
    <VenueTournamentScheduleBracketPanel
      bracketColumns={bracketColumns}
      buildMatchProgressSummary={buildMatchProgressSummary}
      formatDisplayDateTime={formatDisplayDateTime}
      formatMatchResultTypeLabel={formatMatchResultTypeLabel}
      formatParticipantLabel={formatParticipantLabel}
      isLeague={false}
      leagueRounds={leagueRounds}
      matchesLoading={matchesLoading}
      matchesRows={matchesRows}
      participantsCount={participantsCount}
      selectedMatchId={selectedMatchId}
      selectedTournamentBestOf={selectedTournamentBestOf}
      selectMatchForScoring={selectMatchForScoring}
      tournamentTitle={tournamentTitle}
    />
  </div>
);

export default VenueTournamentKnockoutWorkspaceMainContent;
