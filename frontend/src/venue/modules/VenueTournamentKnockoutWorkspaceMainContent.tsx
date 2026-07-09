import React from 'react';
import VenueTournamentKnockoutWorkflowInsights from './VenueTournamentKnockoutWorkflowInsights';
import VenueTournamentScheduleBracketPanel from './VenueTournamentScheduleBracketPanel';
import VenueTournamentWorkspaceSectionCard from './VenueTournamentWorkspaceSectionCard';

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
  thirdPlaceMatch: any;
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
  thirdPlaceMatch,
  tournamentTitle,
}) => {
  const [expandedSections, setExpandedSections] = React.useState({
    insights: false,
    schedule: true,
  });

  const updateExpandedSection = React.useCallback((key: 'insights' | 'schedule', expanded: boolean) => {
    setExpandedSections((prev) => ({ ...prev, [key]: expanded }));
  }, []);

  const handleJumpToMatch = React.useCallback((row: any) => {
    updateExpandedSection('schedule', true);
    selectMatchForScoring(row);
  }, [selectMatchForScoring, updateExpandedSection]);

  const insightsSummary = matchesRows.length > 0
    ? `共 ${matchesRows.length} 場對局，可在需要追查 blocked 與下一場記分時再展開。`
    : '尚未生成進級表時，可先查看流程提示與推進方向。';
  const scheduleSummary = matchesLoading
    ? '進級表載入中...'
    : bracketColumns.length > 0
      ? `共 ${bracketColumns.length} 個輪次欄位，淘汰賽模式主視圖以進級表為核心。`
      : '尚未生成淘汰賽模式進級表。';

  return (
    <div className="space-y-4">
      <VenueTournamentWorkspaceSectionCard
        title="淘汰賽模式進級表"
        summary={scheduleSummary}
        priorityLabel="主要展示"
        expanded={expandedSections.schedule}
        onToggle={() => updateExpandedSection('schedule', !expandedSections.schedule)}
      >
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
          thirdPlaceMatch={thirdPlaceMatch}
          tournamentTitle={tournamentTitle}
        />
      </VenueTournamentWorkspaceSectionCard>

      <VenueTournamentWorkspaceSectionCard
        title="淘汰賽模式流程摘要"
        summary={insightsSummary}
        priorityLabel="輔助資訊"
        expanded={expandedSections.insights}
        onToggle={() => updateExpandedSection('insights', !expandedSections.insights)}
      >
        <VenueTournamentKnockoutWorkflowInsights
          matchesRows={matchesRows}
          onJumpToMatch={handleJumpToMatch}
          participantsCount={participantsCount}
          selectedMatchId={selectedMatchId}
        />
      </VenueTournamentWorkspaceSectionCard>
    </div>
  );
};

export default VenueTournamentKnockoutWorkspaceMainContent;
