import React from 'react';
import ClubPublicTournamentLiveMatchesSection from './ClubPublicTournamentLiveMatchesSection';
import ClubPublicTournamentReadyMatchesSection from './ClubPublicTournamentReadyMatchesSection';
import ClubPublicTournamentRecentCompletedSection from './ClubPublicTournamentRecentCompletedSection';

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
    ? `目前有 ${liveCount} 場正在進行，適合優先查看即時比分。`
    : readyCount > 0
      ? `目前有 ${readyCount} 場即將上場，可先查看對戰組合。`
      : completedCount > 0
        ? `最近已完成 ${completedCount} 場，可回看最新結果。`
        : '目前以賽事概覽為主。';
  const previewRows = liveCount > 0
    ? (Array.isArray(tournament?.liveMatches) ? tournament.liveMatches.slice(0, 2) : [])
    : readyCount > 0
      ? (Array.isArray(tournament?.readyMatches) ? tournament.readyMatches.slice(0, 2) : [])
      : (Array.isArray(tournament?.recentCompletedMatches) ? tournament.recentCompletedMatches.slice(0, 2) : []);

  if (compact) {
    return (
      <div className="cue-surface-strong rounded-lg p-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{String(tournament?.title || '比賽')}</div>
            <div className="text-xs cue-muted mt-1">
              {formatTournamentFormatLabel(tournament?.format)} · {formatTournamentWorkflowLabel(tournament?.workflow_status)}
            </div>
          </div>
          <div className="rounded-full px-2 py-1 text-[11px] font-semibold cue-surface">
            {liveCount > 0 ? '焦點中' : readyCount > 0 ? '即將上場' : '最近完成'}
          </div>
        </div>

        <div className="mt-3 grid gap-2 grid-cols-3 text-xs">
          <div className="cue-surface rounded-lg p-2 text-center">
            <div className="cue-muted">進行中</div>
            <div className="font-semibold mt-1">{liveCount}</div>
          </div>
          <div className="cue-surface rounded-lg p-2 text-center">
            <div className="cue-muted">即將上場</div>
            <div className="font-semibold mt-1">{readyCount}</div>
          </div>
          <div className="cue-surface rounded-lg p-2 text-center">
            <div className="cue-muted">已完成</div>
            <div className="font-semibold mt-1">{completedCount}</div>
          </div>
        </div>

        <div className="mt-3 text-sm cue-muted">{highlightLabel}</div>

        {previewRows.length > 0 ? (
          <div className="mt-3 space-y-2">
            {previewRows.map((row: any) => (
              <div key={String(row?.id || Math.random())} className="rounded-lg cue-surface p-2">
                <div className="text-[11px] cue-muted">
                  {formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}
                </div>
                <div className="mt-1 text-sm font-semibold truncate">
                  {formatTournamentParticipantLabel(row?.player_a_participant)} vs {formatTournamentParticipantLabel(row?.player_b_participant)}
                </div>
              </div>
            ))}
          </div>
        ) : null}

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
