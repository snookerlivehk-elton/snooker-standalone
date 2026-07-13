import React from 'react';
import ClubPublicTournamentLiveMatchesSection from './ClubPublicTournamentLiveMatchesSection';
import ClubPublicTournamentReadyMatchesSection from './ClubPublicTournamentReadyMatchesSection';
import ClubPublicTournamentRecentCompletedSection from './ClubPublicTournamentRecentCompletedSection';
import { buildPublicTournamentPosterDataUrl } from './publicTournamentPosterHelpers';

type ClubPublicTournamentLiveBoardCardProps = {
  API_URL: string;
  clubId?: string | null;
  sessionMemberId?: string | null;
  getPublicClubTournament: (apiUrl: string, clubId: string, tournamentId: string, memberId?: string) => Promise<any>;
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
  onPreviewPoster: (poster: { imageUrl: string; title: string }) => void;
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

function isLandscapePosterFormat(format: any, normalizeTournamentFormat: (value: any) => any) {
  return normalizeTournamentFormat(format) !== 'LEAGUE';
}

function getPosterModeLabel(format: any, normalizeTournamentFormat: (value: any) => any) {
  const normalizedFormat = normalizeTournamentFormat(format);
  if (normalizedFormat === 'LEAGUE') return 'LEAGUE MODE POSTER';
  if (normalizedFormat === 'GOLD_SILVER_CUP') return 'GOLD / SILVER CUP POSTER';
  return 'KNOCKOUT MODE POSTER';
}

const ClubPublicTournamentLiveBoardCard: React.FC<ClubPublicTournamentLiveBoardCardProps> = ({
  API_URL,
  clubId,
  sessionMemberId,
  getPublicClubTournament,
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
  onPreviewPoster,
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
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [posterUrl, setPosterUrl] = React.useState('');
  const posterIsLandscape = isLandscapePosterFormat(tournament?.format, normalizeTournamentFormat);
  const posterFrameClassName = posterIsLandscape ? 'aspect-[16/9]' : 'aspect-[1080/1350]';

  React.useEffect(() => {
    let cancelled = false;
    if (!compact || !clubId || !tournament?.id) {
      setPosterUrl('');
      return;
    }
    setDetailLoading(true);
    getPublicClubTournament(API_URL, clubId, String(tournament.id), sessionMemberId || undefined)
      .then((detail) => {
        if (cancelled) return;
        if (!detail) {
          setPosterUrl('');
          return;
        }
        return buildPublicTournamentPosterDataUrl({
          detail,
          formatTournamentParticipantLabel,
          formatTournamentMatchStatusLabel,
        })
          .then((nextPosterUrl) => {
            if (!cancelled) setPosterUrl(nextPosterUrl);
          })
          .catch(() => {
            if (!cancelled) setPosterUrl('');
          });
      })
      .catch(() => {
        if (!cancelled) setPosterUrl('');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    API_URL,
    clubId,
    compact,
    formatTournamentMatchStatusLabel,
    formatTournamentParticipantLabel,
    getPublicClubTournament,
    sessionMemberId,
    tournament?.id,
  ]);

  if (compact) {
    return (
      <div className="cue-surface-strong rounded-2xl border border-white/10 p-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold accent-yellow tracking-wide">
                {getPosterModeLabel(tournament?.format, normalizeTournamentFormat)}
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

        <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-3">
          {detailLoading ? (
            <div className={`flex ${posterFrameClassName} items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-black/20 text-sm cue-muted`}>
              正在生成海報縮圖...
            </div>
          ) : posterUrl ? (
            <button
              type="button"
              onClick={() => onPreviewPoster({
                imageUrl: posterUrl,
                title: `${String(tournament?.title || '比賽')} 海報`,
              })}
              className={`flex w-full ${posterFrameClassName} items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-black/20 transition hover:border-white/20`}
            >
              <img
                src={posterUrl}
                alt={`${String(tournament?.title || '比賽')} 海報縮圖`}
                className="h-full w-full object-contain"
              />
            </button>
          ) : (
            <div className={`flex ${posterFrameClassName} items-center justify-center rounded-[18px] border border-dashed border-white/10 px-4 text-center text-sm cue-muted`}>
              暫時未能生成海報縮圖，請點入完整賽況查看。
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="text-[11px] cue-muted">海報狀態</div>
          <div className="mt-1 text-sm cue-muted leading-6">{highlightLabel}</div>
          {featuredPreviewRow ? (
            <div className="mt-2 text-xs cue-muted">
              焦點對賽：{formatTournamentParticipantLabel(featuredPreviewRow?.player_a_participant)} vs {formatTournamentParticipantLabel(featuredPreviewRow?.player_b_participant)}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs cue-muted">點海報可放大，或進入完整詳情</div>
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
