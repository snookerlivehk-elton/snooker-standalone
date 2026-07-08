import React from 'react';
import VenueTournamentLeagueWorkflowInsights from './VenueTournamentLeagueWorkflowInsights';
import VenueTournamentLeagueStandingsPanel from './VenueTournamentLeagueStandingsPanel';
import VenueTournamentScheduleBracketPanel from './VenueTournamentScheduleBracketPanel';
import type { MatchQuickFilterKey, MatchStatusFilterKey } from './VenueTournamentMatchesFilters';
import VenueTournamentWorkspaceSectionCard from './VenueTournamentWorkspaceSectionCard';

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
  const [expandedSections, setExpandedSections] = React.useState({
    insights: true,
    standings: false,
    schedule: true,
  });
  const [scheduleFilterPreset, setScheduleFilterPreset] = React.useState<{
    token: string;
    quickFilter?: MatchQuickFilterKey;
    statusFilter?: MatchStatusFilterKey;
    focusedRoundLabel?: string;
  } | null>(null);

  const updateExpandedSection = React.useCallback((key: 'insights' | 'standings' | 'schedule', expanded: boolean) => {
    setExpandedSections((prev) => ({ ...prev, [key]: expanded }));
  }, []);

  const handleJumpToMatch = React.useCallback((row: any) => {
    updateExpandedSection('schedule', true);
    selectMatchForScoring(row);
  }, [selectMatchForScoring, updateExpandedSection]);

  const handleApplyScheduleFocus = React.useCallback((preset: {
    quickFilter?: MatchQuickFilterKey;
    statusFilter?: MatchStatusFilterKey;
    focusedRoundLabel?: string;
  }) => {
    updateExpandedSection('schedule', true);
    setScheduleFilterPreset({ token: `${Date.now()}-${Math.random()}`, ...preset });
  }, [updateExpandedSection]);

  const insightsSummary = matchesRows.length > 0
    ? `共 ${matchesRows.length} 場對局，先看目前輪次、未排時間與可記分入口。`
    : '尚未生成賽程時，可先查看流程提示與下一步建議。';
  const standingsSummary = standingsRows.length > 0
    ? `共 ${standingsRows.length} 位球手，屬查閱型資訊，預設收合以縮短頁面。`
    : '暫未有 standings 資料，待賽程與賽果逐步形成後再查看。';
  const scheduleSummary = matchesLoading
    ? '賽程載入中...'
    : leagueRounds.length > 0
      ? `共 ${leagueRounds.length} 個輪次，預設展開並優先聚焦目前要處理的 rounds。`
      : '尚未生成 League 賽程。';

  return (
    <div className="space-y-4">
      <VenueTournamentWorkspaceSectionCard
        title="League 流程摘要"
        summary={insightsSummary}
        priorityLabel="先看這裡"
        expanded={expandedSections.insights}
        onToggle={() => updateExpandedSection('insights', !expandedSections.insights)}
      >
        <VenueTournamentLeagueWorkflowInsights
          leagueRounds={leagueRounds}
          matchesRows={matchesRows}
          onJumpToMatch={handleJumpToMatch}
          onApplyScheduleFocus={handleApplyScheduleFocus}
          selectedMatchId={selectedMatchId}
        />
      </VenueTournamentWorkspaceSectionCard>

      <VenueTournamentWorkspaceSectionCard
        title="League 賽程"
        summary={scheduleSummary}
        priorityLabel="主要工作區"
        expanded={expandedSections.schedule}
        onToggle={() => updateExpandedSection('schedule', !expandedSections.schedule)}
      >
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
      </VenueTournamentWorkspaceSectionCard>

      <VenueTournamentWorkspaceSectionCard
        title="League Standings"
        summary={standingsSummary}
        expanded={expandedSections.standings}
        onToggle={() => updateExpandedSection('standings', !expandedSections.standings)}
      >
        <VenueTournamentLeagueStandingsPanel
          matchesRows={matchesRows}
          pointsDraw={pointsDraw}
          pointsLoss={pointsLoss}
          pointsWin={pointsWin}
          standingsRows={standingsRows}
          tournamentTitle={tournamentTitle}
          formatParticipantLabel={formatParticipantLabel}
        />
      </VenueTournamentWorkspaceSectionCard>
    </div>
  );
};

export default VenueTournamentLeagueWorkspaceMainContent;
