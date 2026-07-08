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
}) => {
  const [expandedSections, setExpandedSections] = React.useState({
    insights: true,
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
    ? `共 ${matchesRows.length} 場對局，先看 blocked 與下一場可記分對局。`
    : '尚未生成 bracket 時，可先查看流程提示與推進方向。';
  const scheduleSummary = matchesLoading
    ? 'Bracket 載入中...'
    : bracketColumns.length > 0
      ? `共 ${bracketColumns.length} 個 bracket 輪次欄位，預設展開以便直接推進賽事。`
      : '尚未生成 Knockout bracket。';

  return (
    <div className="space-y-4">
      <VenueTournamentWorkspaceSectionCard
        title="Knockout 流程摘要"
        summary={insightsSummary}
        priorityLabel="先看這裡"
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

      <VenueTournamentWorkspaceSectionCard
        title="Knockout Bracket / Schedule"
        summary={scheduleSummary}
        priorityLabel="主要工作區"
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
          tournamentTitle={tournamentTitle}
        />
      </VenueTournamentWorkspaceSectionCard>
    </div>
  );
};

export default VenueTournamentKnockoutWorkspaceMainContent;
