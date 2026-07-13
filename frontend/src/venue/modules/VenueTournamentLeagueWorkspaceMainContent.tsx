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
  venueName?: string;
  venueLogoUrl?: string;
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
  venueName,
  venueLogoUrl,
}) => {
  const [expandedSections, setExpandedSections] = React.useState({
    insights: false,
    standings: true,
    schedule: false,
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
    ? `共 ${matchesRows.length} 場對局，可在需要安排或記分時再展開。`
    : '尚未生成賽程時，可先查看流程提示與下一步建議。';
  const standingsSummary = standingsRows.length > 0
    ? `共 ${standingsRows.length} 位球手，聯賽模式主視圖以積分榜為核心。`
    : '暫未有 standings 資料，待賽程與賽果逐步形成後再查看。';
  const scheduleSummary = matchesLoading
    ? '賽程載入中...'
    : leagueRounds.length > 0
      ? `共 ${leagueRounds.length} 個輪次，屬次要工作區，可在需要排程或追蹤單輪對賽時展開。`
      : '尚未生成聯賽模式賽程。';

  return (
    <div className="space-y-4">
      <VenueTournamentWorkspaceSectionCard
        title="聯賽模式流程摘要"
        summary={insightsSummary}
        priorityLabel="輔助資訊"
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
        title="聯賽模式積分榜"
        summary={standingsSummary}
        priorityLabel="主要展示"
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
          venueName={venueName}
          venueLogoUrl={venueLogoUrl}
          formatParticipantLabel={formatParticipantLabel}
        />
      </VenueTournamentWorkspaceSectionCard>

      <VenueTournamentWorkspaceSectionCard
        title="聯賽模式賽程"
        summary={scheduleSummary}
        priorityLabel="次要工作區"
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
          venueName={venueName}
          venueLogoUrl={venueLogoUrl}
        />
      </VenueTournamentWorkspaceSectionCard>
    </div>
  );
};

export default VenueTournamentLeagueWorkspaceMainContent;
