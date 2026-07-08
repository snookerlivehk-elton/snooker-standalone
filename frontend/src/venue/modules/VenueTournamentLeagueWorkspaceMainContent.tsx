import React from 'react';
import VenueTournamentLeagueWorkflowInsights from './VenueTournamentLeagueWorkflowInsights';
import VenueTournamentLeagueStandingsPanel from './VenueTournamentLeagueStandingsPanel';
import VenueTournamentScheduleBracketPanel from './VenueTournamentScheduleBracketPanel';
import type { MatchQuickFilterKey, MatchStatusFilterKey } from './VenueTournamentMatchesFilters';

type VenueTournamentLeagueWorkspaceMainContentProps = {
  bracketColumns: any[];
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  formatDisplayDateTime: (value: any) => string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  leagueRounds: any[];
  matchesLoading: boolean;
  matchesRows: any[];
  participantsCount: number;
  pointsDraw: number;
  pointsLoss: number;
  pointsWin: number;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
  selectMatchForScoring: (row: any) => void;
  standingsRows: any[];
  tournamentTitle?: string;
};

const VenueTournamentLeagueWorkspaceMainContent: React.FC<VenueTournamentLeagueWorkspaceMainContentProps> = ({
  bracketColumns,
  buildMatchProgressSummary,
  formatDisplayDateTime,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  leagueRounds,
  matchesLoading,
  matchesRows,
  participantsCount,
  pointsDraw,
  pointsLoss,
  pointsWin,
  selectedMatchId,
  selectedTournamentBestOf,
  selectMatchForScoring,
  standingsRows,
  tournamentTitle,
}) => {
  const [scheduleFilterPreset, setScheduleFilterPreset] = React.useState<{
    token: string;
    quickFilter?: MatchQuickFilterKey;
    statusFilter?: MatchStatusFilterKey;
    focusedRoundLabel?: string;
  } | null>(null);

  return (
    <div>
      <VenueTournamentLeagueWorkflowInsights
        leagueRounds={leagueRounds}
        matchesRows={matchesRows}
        onJumpToMatch={selectMatchForScoring}
        onApplyScheduleFocus={(preset) => setScheduleFilterPreset({ token: `${Date.now()}-${Math.random()}`, ...preset })}
        selectedMatchId={selectedMatchId}
      />
      <VenueTournamentLeagueStandingsPanel
        matchesRows={matchesRows}
        pointsDraw={pointsDraw}
        pointsLoss={pointsLoss}
        pointsWin={pointsWin}
        standingsRows={standingsRows}
        tournamentTitle={tournamentTitle}
        formatParticipantLabel={formatParticipantLabel}
      />
      <VenueTournamentScheduleBracketPanel
        bracketColumns={bracketColumns}
        buildMatchProgressSummary={buildMatchProgressSummary}
        externalFilterPreset={scheduleFilterPreset}
        formatDisplayDateTime={formatDisplayDateTime}
        formatMatchResultTypeLabel={formatMatchResultTypeLabel}
        formatParticipantLabel={formatParticipantLabel}
        isLeague={true}
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
};

export default VenueTournamentLeagueWorkspaceMainContent;
