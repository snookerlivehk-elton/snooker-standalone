import React from 'react';
import ClubPublicTournamentLiveMatchesSection from './ClubPublicTournamentLiveMatchesSection';
import ClubPublicTournamentReadyMatchesSection from './ClubPublicTournamentReadyMatchesSection';
import ClubPublicTournamentRecentCompletedSection from './ClubPublicTournamentRecentCompletedSection';
import ClubPublicTournamentLiveBoardVisual from './ClubPublicTournamentLiveBoardVisual';

type ClubPublicTournamentLiveBoardCardProps = {
  tournament: any;
  tournaments: any[];
  setActiveTab: (value: string) => void;
  setTournamentOpen: (value: any) => void;
  formatTournamentFormatLabel: (value: any) => string;
  formatTournamentWorkflowLabel: (value: any) => string;
  buildPublicTournamentBreakSummary: (row: any) => any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  normalizeTournamentFormat: (value: any) => any;
  buildPublicTournamentLiveProgressLabel: (row: any, bestOfFrames: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
  openPublicBoardParticipantPanel: (tournament: any, participant: any) => void;
  renderPublicBoardParticipantActions: (tournament: any, row: any) => React.ReactNode;
  compact?: boolean;
};

function getTournamentCardUpdatedAtLabel(tournament: any) {
  const candidates = [
    tournament?.updatedAt,
    tournament?.startsAt,
    ...(Array.isArray(tournament?.liveMatches) ? tournament.liveMatches.flatMap((row: any) => [row?.updated_at, row?.started_at, row?.scheduled_at]) : []),
    ...(Array.isArray(tournament?.readyMatches) ? tournament.readyMatches.flatMap((row: any) => [row?.updated_at, row?.scheduled_at]) : []),
    ...(Array.isArray(tournament?.recentCompletedMatches) ? tournament.recentCompletedMatches.flatMap((row: any) => [row?.ended_at, row?.updated_at]) : []),
  ];
  const times = candidates
    .map((value: any) => value ? new Date(String(value)).getTime() : 0)
    .filter((value: number) => Number.isFinite(value) && value > 0)
    .sort((a: number, b: number) => b - a);
  if (times.length === 0) return '更新中';
  return new Date(times[0]).toLocaleString();
}

const ClubPublicTournamentLiveBoardCard: React.FC<ClubPublicTournamentLiveBoardCardProps> = ({
  tournament,
  tournaments,
  setActiveTab,
  setTournamentOpen,
  formatTournamentFormatLabel,
  formatTournamentWorkflowLabel,
  buildPublicTournamentBreakSummary,
  formatPublicTournamentStageLabel,
  normalizeTournamentFormat,
  buildPublicTournamentLiveProgressLabel,
  formatTournamentMatchStatusLabel,
  formatTournamentParticipantLabel,
  openPublicBoardParticipantPanel,
  renderPublicBoardParticipantActions,
  compact = false,
}) => {
  const liveCount = Number(tournament?.summary?.liveMatchCount || 0);
  const readyCount = Number(tournament?.summary?.readyMatchCount || 0);
  const completedCount = Number(tournament?.summary?.completedMatchCount || 0);
  const highlightLabel = liveCount > 0
    ? '目前正有對賽進行中，可直接查看焦點對局。'
    : readyCount > 0
      ? '下一場對賽已排好，可先看對戰組合。'
      : completedCount > 0
        ? '目前以最新公開結果作為主展示。'
        : '目前以賽事海報概覽為主。';
  const previewRows = liveCount > 0
    ? (Array.isArray(tournament?.liveMatches) ? tournament.liveMatches.slice(0, 2) : [])
    : readyCount > 0
      ? (Array.isArray(tournament?.readyMatches) ? tournament.readyMatches.slice(0, 2) : [])
      : (Array.isArray(tournament?.recentCompletedMatches) ? tournament.recentCompletedMatches.slice(0, 2) : []);
  const featuredPreviewRow = previewRows[0] || null;
  const updatedAtLabel = getTournamentCardUpdatedAtLabel(tournament);

  if (compact) {
    return (
      <div className="cue-surface-strong rounded-2xl border border-white/10 p-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold accent-yellow tracking-wide">
              {normalizeTournamentFormat(tournament?.format) === 'LEAGUE' ? 'LEAGUE MODE POSTER' : 'KNOCKOUT MODE POSTER'}
            </div>
            <div className="mt-3 font-semibold text-lg leading-tight">{String(tournament?.title || '比賽')}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold cue-muted">
                {formatTournamentFormatLabel(tournament?.format)}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold cue-muted">
                {formatTournamentWorkflowLabel(tournament?.workflow_status)}
              </div>
            </div>
          </div>
          <div className="text-right text-[11px] cue-muted">
            <div>更新時間</div>
            <div className="mt-1 font-semibold text-white">{updatedAtLabel}</div>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="text-[11px] cue-muted">海報摘要</div>
          <div className="mt-1 text-sm cue-muted leading-6">{highlightLabel}</div>
        </div>

        <div className="mt-3">
          <ClubPublicTournamentLiveBoardVisual
            tournament={tournament}
            variant="mini"
            formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
            normalizeTournamentFormat={normalizeTournamentFormat}
            formatTournamentParticipantLabel={formatTournamentParticipantLabel}
          />
        </div>

        {featuredPreviewRow ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-[11px] cue-muted">焦點對賽</div>
            <div className="mt-2 text-sm font-semibold truncate">
              {formatTournamentParticipantLabel(featuredPreviewRow?.player_a_participant)} vs {formatTournamentParticipantLabel(featuredPreviewRow?.player_b_participant)}
            </div>
            <div className="mt-1 text-xs cue-muted">
              {formatTournamentMatchStatusLabel(featuredPreviewRow?.status)}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs cue-muted">點入查看完整海報與詳情</div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setTournamentOpen(tournaments.find((row: any) => String(row?.id || '') === String(tournament?.id || '')) || tournament);
            }}
            className="px-4 py-2 rounded cue-button text-sm font-semibold"
          >
            查看詳情
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cue-surface-strong rounded-lg p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-lg truncate">{String(tournament?.title || '比賽')}</div>
          <div className="text-xs cue-muted mt-1">
            {formatTournamentFormatLabel(tournament?.format)} · {formatTournamentWorkflowLabel(tournament?.workflow_status)}
            {tournament?.startsAt ? ` · ${new Date(String(tournament.startsAt)).toLocaleString()}` : ''}
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="px-3 py-2 rounded cue-surface">進行中 {liveCount}</div>
          <div className="px-3 py-2 rounded cue-surface">即將上場 {readyCount}</div>
          <div className="px-3 py-2 rounded cue-surface">已完成 {completedCount}</div>
        </div>
      </div>

      <ClubPublicTournamentLiveMatchesSection
        tournament={tournament}
        buildPublicTournamentBreakSummary={buildPublicTournamentBreakSummary}
        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
        normalizeTournamentFormat={normalizeTournamentFormat}
        buildPublicTournamentLiveProgressLabel={buildPublicTournamentLiveProgressLabel}
        formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
        openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
        renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
      />

      <ClubPublicTournamentReadyMatchesSection
        tournament={tournament}
        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
        normalizeTournamentFormat={normalizeTournamentFormat}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
        openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
        renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
      />

      <ClubPublicTournamentRecentCompletedSection
        tournament={tournament}
        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
        normalizeTournamentFormat={normalizeTournamentFormat}
        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
        openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
        renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
      />

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setActiveTab('signup');
            setTournamentOpen(tournaments.find((row: any) => String(row?.id || '') === String(tournament?.id || '')) || tournament);
          }}
          className="px-4 py-2 rounded cue-button text-sm font-semibold"
        >
          查看詳情
        </button>
      </div>
    </div>
  );
};

export default ClubPublicTournamentLiveBoardCard;
