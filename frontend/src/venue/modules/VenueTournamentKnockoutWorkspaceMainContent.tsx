import React from 'react';
import { buildKnockoutBracketColumns } from './useTournamentStageViewData';
import VenueTournamentKnockoutWorkflowInsights from './VenueTournamentKnockoutWorkflowInsights';
import VenueTournamentScheduleBracketPanel from './VenueTournamentScheduleBracketPanel';
import VenueTournamentWorkspaceSectionCard from './VenueTournamentWorkspaceSectionCard';

type VenueTournamentKnockoutWorkspaceMainContentProps = {
  bracketColumns: any[];
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  formatDisplayDateTime: (value: any) => string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  modeLabel?: string;
  leagueRounds: any[];
  matchesLoading: boolean;
  matchesRows: any[];
  participantsCount: number;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
  selectMatchForScoring: (row: any) => void;
  thirdPlaceMatch: any;
  tournamentTitle?: string;
  venueName?: string;
  venueLogoUrl?: string;
};

const VenueTournamentKnockoutWorkspaceMainContent: React.FC<VenueTournamentKnockoutWorkspaceMainContentProps> = ({
  bracketColumns,
  buildMatchProgressSummary,
  formatDisplayDateTime,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  modeLabel = '淘汰賽',
  leagueRounds,
  matchesLoading,
  matchesRows,
  participantsCount,
  selectedMatchId,
  selectedTournamentBestOf,
  selectMatchForScoring,
  thirdPlaceMatch,
  tournamentTitle,
  venueName,
  venueLogoUrl,
}) => {
  const [expandedSections, setExpandedSections] = React.useState({
    insights: false,
    schedule: true,
    gold: true,
    silver: true,
  });

  const isGoldSilverCup = React.useMemo(
    () => matchesRows.some((row: any) => {
      const stageCode = String(row?.stage_code || '').trim().toUpperCase();
      return stageCode.startsWith('GOLD_') || stageCode.startsWith('SILVER_');
    }),
    [matchesRows],
  );

  const goldMatchesRows = React.useMemo(
    () => matchesRows.filter((row: any) => String(row?.stage_code || '').trim().toUpperCase().startsWith('GOLD_')),
    [matchesRows],
  );
  const silverMatchesRows = React.useMemo(
    () => matchesRows.filter((row: any) => String(row?.stage_code || '').trim().toUpperCase().startsWith('SILVER_')),
    [matchesRows],
  );
  const goldBracketColumns = React.useMemo(
    () => buildKnockoutBracketColumns(goldMatchesRows, participantsCount),
    [goldMatchesRows, participantsCount],
  );
  const silverBracketColumns = React.useMemo(
    () => buildKnockoutBracketColumns(silverMatchesRows, participantsCount),
    [silverMatchesRows, participantsCount],
  );
  const goldThirdPlaceMatch = React.useMemo(
    () => goldMatchesRows.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'GOLD_THIRD_PLACE') || null,
    [goldMatchesRows],
  );
  const silverThirdPlaceMatch = React.useMemo(
    () => silverMatchesRows.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'SILVER_THIRD_PLACE') || null,
    [silverMatchesRows],
  );
  const goldSummary = React.useMemo(() => ({
    total: goldMatchesRows.length,
    ready: goldMatchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY').length,
    live: goldMatchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'LIVE').length,
    completed: goldMatchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED').length,
  }), [goldMatchesRows]);
  const silverSummary = React.useMemo(() => ({
    total: silverMatchesRows.length,
    ready: silverMatchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY').length,
    live: silverMatchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'LIVE').length,
    completed: silverMatchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED').length,
  }), [silverMatchesRows]);

  const updateExpandedSection = React.useCallback((key: 'insights' | 'schedule' | 'gold' | 'silver', expanded: boolean) => {
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
      ? `共 ${bracketColumns.length} 個輪次欄位，${modeLabel}主視圖以進級表為核心。`
      : `尚未生成${modeLabel}進級表。`;

  return (
    <div className="space-y-4">
      {isGoldSilverCup ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-amber-400/25 bg-amber-500/10 p-4">
              <div className="text-xs text-amber-200/80">金杯</div>
              <div className="mt-1 text-sm text-amber-50">
                共 {goldSummary.total} 場，{goldSummary.live} 場進行中，{goldSummary.ready} 場就緒，{goldSummary.completed} 場已完成
              </div>
            </div>
            <div className="rounded-lg border border-slate-300/20 bg-slate-400/10 p-4">
              <div className="text-xs text-slate-200/80">銀杯</div>
              <div className="mt-1 text-sm text-slate-100">
                共 {silverSummary.total} 場，{silverSummary.live} 場進行中，{silverSummary.ready} 場就緒，{silverSummary.completed} 場已完成
              </div>
            </div>
          </div>

          <VenueTournamentWorkspaceSectionCard
            title="金杯進級表"
            summary={matchesLoading ? '金杯載入中...' : goldBracketColumns.length > 0 ? `共 ${goldBracketColumns.length} 個金杯輪次欄位。` : '尚未生成金杯進級表。'}
            priorityLabel="主要展示"
            expanded={expandedSections.gold}
            onToggle={() => updateExpandedSection('gold', !expandedSections.gold)}
          >
            <VenueTournamentScheduleBracketPanel
              bracketColumns={goldBracketColumns}
              buildMatchProgressSummary={buildMatchProgressSummary}
              formatDisplayDateTime={formatDisplayDateTime}
              formatMatchResultTypeLabel={formatMatchResultTypeLabel}
              formatParticipantLabel={formatParticipantLabel}
              isLeague={false}
              leagueRounds={leagueRounds}
              matchesLoading={matchesLoading}
              matchesRows={goldMatchesRows}
              participantsCount={participantsCount}
              selectedMatchId={selectedMatchId}
              selectedTournamentBestOf={selectedTournamentBestOf}
              selectMatchForScoring={selectMatchForScoring}
              thirdPlaceMatch={goldThirdPlaceMatch}
              tournamentTitle={tournamentTitle ? `${tournamentTitle} - 金杯` : '金杯賽程'}
              venueName={venueName}
              venueLogoUrl={venueLogoUrl}
            />
          </VenueTournamentWorkspaceSectionCard>

          <VenueTournamentWorkspaceSectionCard
            title="銀杯進級表"
            summary={matchesLoading ? '銀杯載入中...' : silverBracketColumns.length > 0 ? `共 ${silverBracketColumns.length} 個銀杯輪次欄位。` : '尚未生成銀杯進級表。'}
            priorityLabel="主要展示"
            expanded={expandedSections.silver}
            onToggle={() => updateExpandedSection('silver', !expandedSections.silver)}
          >
            <VenueTournamentScheduleBracketPanel
              bracketColumns={silverBracketColumns}
              buildMatchProgressSummary={buildMatchProgressSummary}
              formatDisplayDateTime={formatDisplayDateTime}
              formatMatchResultTypeLabel={formatMatchResultTypeLabel}
              formatParticipantLabel={formatParticipantLabel}
              isLeague={false}
              leagueRounds={leagueRounds}
              matchesLoading={matchesLoading}
              matchesRows={silverMatchesRows}
              participantsCount={participantsCount}
              selectedMatchId={selectedMatchId}
              selectedTournamentBestOf={selectedTournamentBestOf}
              selectMatchForScoring={selectMatchForScoring}
              thirdPlaceMatch={silverThirdPlaceMatch}
              tournamentTitle={tournamentTitle ? `${tournamentTitle} - 銀杯` : '銀杯賽程'}
              venueName={venueName}
              venueLogoUrl={venueLogoUrl}
            />
          </VenueTournamentWorkspaceSectionCard>
        </>
      ) : (
      <VenueTournamentWorkspaceSectionCard
        title={`${modeLabel}進級表`}
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
          venueName={venueName}
          venueLogoUrl={venueLogoUrl}
        />
      </VenueTournamentWorkspaceSectionCard>
      )}

      <VenueTournamentWorkspaceSectionCard
        title={`${modeLabel}流程摘要`}
        summary={insightsSummary}
        priorityLabel="輔助資訊"
        expanded={expandedSections.insights}
        onToggle={() => updateExpandedSection('insights', !expandedSections.insights)}
      >
        <VenueTournamentKnockoutWorkflowInsights
          matchesRows={matchesRows}
          modeLabel={modeLabel}
          onJumpToMatch={handleJumpToMatch}
          participantsCount={participantsCount}
          selectedMatchId={selectedMatchId}
        />
      </VenueTournamentWorkspaceSectionCard>
    </div>
  );
};

export default VenueTournamentKnockoutWorkspaceMainContent;
