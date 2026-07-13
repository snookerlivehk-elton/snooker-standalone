import React from 'react';
import ClubPublicTournamentLiveBoardCard from './ClubPublicTournamentLiveBoardCard';
import {
  buildKnockoutBracketShareCardDataUrl,
  buildLeagueStandingsShareCardDataUrl,
} from '../../venue/modules/TournamentShareCards';

type ClubPublicTournamentLiveBoardProps = {
  API_URL: string;
  clubId?: string | null;
  sessionMemberId?: string | null;
  getPublicClubTournament: (apiUrl: string, clubId: string, tournamentId: string, memberId?: string) => Promise<any>;
  tournamentLiveBoardLoading: boolean;
  tournamentLiveBoard: any[];
  tournamentLiveBoardError: string;
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
};

function getTournamentBoardPriorityScore(tournament: any) {
  return (Number(tournament?.summary?.liveMatchCount || 0) * 100)
    + (Number(tournament?.summary?.readyMatchCount || 0) * 10)
    + Number(tournament?.summary?.completedMatchCount || 0);
}

function getTournamentBoardBucket(tournament: any) {
  if (Number(tournament?.summary?.liveMatchCount || 0) > 0) return 'live';
  if (Number(tournament?.summary?.readyMatchCount || 0) > 0) return 'ready';
  if (Number(tournament?.summary?.completedMatchCount || 0) > 0) return 'completed';
  return 'quiet';
}

function getTournamentBoardUpdatedAtLabel(tournament: any) {
  const candidates = [
    tournament?.updatedAt,
    tournament?.startsAt,
    ...(Array.isArray(tournament?.liveMatches) ? tournament.liveMatches.flatMap((row: any) => [row?.updated_at, row?.started_at, row?.scheduled_at]) : []),
    ...(Array.isArray(tournament?.readyMatches) ? tournament.readyMatches.flatMap((row: any) => [row?.updated_at, row?.scheduled_at]) : []),
    ...(Array.isArray(tournament?.recentCompletedMatches) ? tournament.recentCompletedMatches.flatMap((row: any) => [row?.ended_at, row?.updated_at, row?.started_at]) : []),
  ];
  const times = candidates
    .map((value: any) => value ? new Date(String(value)).getTime() : 0)
    .filter((value: number) => Number.isFinite(value) && value > 0)
    .sort((a: number, b: number) => b - a);
  if (times.length === 0) return '更新中';
  return new Date(times[0]).toLocaleString();
}

function buildLeaguePosterRows(detail: any, formatTournamentParticipantLabel: (participant: any) => string) {
  const standings = Array.isArray(detail?.standings) ? detail.standings : [];
  return standings.slice(0, 8).map((row: any, index: number) => ({
    position: Number(row?.position || index + 1),
    label: String(row?.label || formatTournamentParticipantLabel(row?.participant) || '-'),
    played: Number(row?.played || 0),
    won: Number(row?.won || 0),
    drawn: Number(row?.drawn || 0),
    lost: Number(row?.lost || 0),
    matchPoints: Number(row?.matchPoints || 0),
    frameDiff: Number(row?.frameDiff || 0),
    breaks20Plus: Number(row?.breaks20Plus || 0),
    maxBreak: Number(row?.maxBreak || 0),
  }));
}

function buildKnockoutPosterRounds(
  detail: any,
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string,
  formatTournamentParticipantLabel: (participant: any) => string,
  formatTournamentMatchStatusLabel: (value: any) => string,
) {
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const participantCount = Math.max(0, Number(detail?.summary?.participantCount || detail?.participants?.length || 0));
  const groups = new Map<string, { label: string; roundNo: number; items: any[] }>();
  for (const row of matches) {
    const label = formatPublicTournamentStageLabel(row, 'KNOCKOUT', participantCount);
    const key = `${Number(row?.round_no || 0)}-${label}`;
    const winnerId = String(row?.winner_participant_id || '');
    const aId = String(row?.player_a_participant_id || '');
    const bId = String(row?.player_b_participant_id || '');
    const item = {
      matchNo: Math.max(1, Number(row?.match_no || 1)),
      statusLabel: formatTournamentMatchStatusLabel(row?.status),
      playerALabel: formatTournamentParticipantLabel(row?.player_a_participant),
      playerBLabel: formatTournamentParticipantLabel(row?.player_b_participant),
      playerAFrames: Number(row?.player_a_frames_won || 0),
      playerBFrames: Number(row?.player_b_frames_won || 0),
      winnerSide: winnerId && winnerId === aId ? 'A' : winnerId && winnerId === bId ? 'B' : null,
    };
    const existing = groups.get(key) || {
      label,
      roundNo: Number(row?.round_no || 0),
      items: [],
    };
    existing.items.push(item);
    groups.set(key, existing);
  }
  return [...groups.values()]
    .sort((a, b) => a.roundNo - b.roundNo)
    .map((group) => ({
      label: group.label,
      total: group.items.length,
      completedCount: group.items.filter((item) => String(item?.statusLabel || '').includes('完成')).length,
      items: group.items.sort((a, b) => a.matchNo - b.matchNo),
    }));
}

function buildKnockoutPosterSummaryCards(detail: any, formatTournamentParticipantLabel: (participant: any) => string) {
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const highestBreakCandidate = matches.reduce((best: any, row: any) => {
    const aBreak = Number(row?.player_a_max_break || 0);
    const bBreak = Number(row?.player_b_max_break || 0);
    const next = aBreak >= bBreak
      ? { breakValue: aBreak, detail: formatTournamentParticipantLabel(row?.player_a_participant) || '未有紀錄' }
      : { breakValue: bBreak, detail: formatTournamentParticipantLabel(row?.player_b_participant) || '未有紀錄' };
    return Number(next.breakValue || 0) > Number(best?.breakValue || 0) ? next : best;
  }, null);
  const highestScoringMatch = matches.reduce((best: any, row: any) => {
    const totalFrames = Number(row?.player_a_frames_won || 0) + Number(row?.player_b_frames_won || 0);
    if (totalFrames <= Number(best?.totalFrames || -1)) return best;
    return {
      totalFrames,
      value: `${Number(row?.player_a_frames_won || 0)}:${Number(row?.player_b_frames_won || 0)}`,
      detail: `${formatTournamentParticipantLabel(row?.player_a_participant)} vs ${formatTournamentParticipantLabel(row?.player_b_participant)}`,
    };
  }, null);
  const largestMarginMatch = matches.reduce((best: any, row: any) => {
    const diff = Math.abs(Number(row?.player_a_frames_won || 0) - Number(row?.player_b_frames_won || 0));
    if (diff <= Number(best?.diff || -1)) return best;
    return {
      diff,
      value: `${diff} 局`,
      detail: `${formatTournamentParticipantLabel(row?.player_a_participant)} ${Number(row?.player_a_frames_won || 0)}:${Number(row?.player_b_frames_won || 0)} ${formatTournamentParticipantLabel(row?.player_b_participant)}`,
    };
  }, null);
  return [
    { label: '最高單杆', value: highestBreakCandidate?.breakValue ? String(highestBreakCandidate.breakValue) : '-', detail: highestBreakCandidate?.detail || '未有紀錄' },
    { label: '最高得分', value: highestScoringMatch?.value || '-', detail: highestScoringMatch?.detail || '未有紀錄' },
    { label: '最高得失局', value: largestMarginMatch?.value || '-', detail: largestMarginMatch?.detail || '未有紀錄' },
  ];
}

function getHeroContent(bucket: string) {
  if (bucket === 'live') {
    return {
      title: '本日焦點賽事海報',
      summary: '主頁只保留最需要看的焦點對賽與進度版型，詳細數據下沉到完整賽況。',
      hint: '海報式主視覺已鎖定進行中賽事',
    };
  }
  if (bucket === 'ready') {
    return {
      title: '即將上場焦點海報',
      summary: '主頁改為先展示下一場最值得等待的對戰組合，不再先堆疊複雜數字。',
      hint: '海報式主視覺已鎖定即將上場賽事',
    };
  }
  return {
    title: '最新公開結果海報',
    summary: '若現場暫時沒有 live 對局，首頁直接回到最新結果海報，讓訪客快速掃讀。',
    hint: '海報式主視覺已鎖定最新結果',
  };
}

const ClubPublicTournamentLiveBoard: React.FC<ClubPublicTournamentLiveBoardProps> = ({
  API_URL,
  clubId,
  sessionMemberId,
  getPublicClubTournament,
  tournamentLiveBoardLoading,
  tournamentLiveBoard,
  tournamentLiveBoardError,
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
}) => {
  const [featuredTournamentDetail, setFeaturedTournamentDetail] = React.useState<any | null>(null);
  const [featuredTournamentDetailLoading, setFeaturedTournamentDetailLoading] = React.useState(false);
  const [featuredPosterUrl, setFeaturedPosterUrl] = React.useState('');
  const sortedBoard = [...(Array.isArray(tournamentLiveBoard) ? tournamentLiveBoard : [])].sort((a: any, b: any) => {
    return getTournamentBoardPriorityScore(b) - getTournamentBoardPriorityScore(a);
  });
  const featuredTournament = sortedBoard[0] || null;
  const remainingTournaments = sortedBoard.slice(1);
  const featuredBucket = featuredTournament ? getTournamentBoardBucket(featuredTournament) : 'quiet';
  const heroContent = getHeroContent(featuredBucket);
  const heroTitle = featuredTournament ? heroContent.title : '公開賽況';
  const heroSummary = featuredTournament
    ? heroContent.summary
    : '集中顯示目前可公開查看的賽事進度、即將上場與最近完成場次。';
  const featuredUpdatedAtLabel = getTournamentBoardUpdatedAtLabel(featuredTournament);

  React.useEffect(() => {
    let cancelled = false;
    if (!clubId || !featuredTournament?.id) {
      setFeaturedTournamentDetail(null);
      setFeaturedPosterUrl('');
      return;
    }
    setFeaturedTournamentDetailLoading(true);
    getPublicClubTournament(API_URL, clubId, String(featuredTournament.id), sessionMemberId || undefined)
      .then((detail) => {
        if (cancelled) return;
        setFeaturedTournamentDetail(detail && typeof detail === 'object' ? detail : null);
      })
      .catch(() => {
        if (cancelled) return;
        setFeaturedTournamentDetail(null);
      })
      .finally(() => {
        if (!cancelled) setFeaturedTournamentDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [API_URL, clubId, featuredTournament?.id, getPublicClubTournament, sessionMemberId]);

  React.useEffect(() => {
    if (!featuredTournamentDetail) {
      setFeaturedPosterUrl('');
      return;
    }
    try {
      const isLeague = String(featuredTournamentDetail?.format || '').trim().toUpperCase() === 'LEAGUE';
      if (isLeague) {
        const rows = buildLeaguePosterRows(featuredTournamentDetail, formatTournamentParticipantLabel);
        if (rows.length <= 0) {
          setFeaturedPosterUrl('');
          return;
        }
        setFeaturedPosterUrl(buildLeagueStandingsShareCardDataUrl({
          title: String(featuredTournamentDetail?.title || '聯賽模式積分榜'),
          dimensionLabel: '整個聯賽',
          pointsRuleLabel: `勝 ${Number(featuredTournamentDetail?.points_win ?? 3)} / 和 ${Number(featuredTournamentDetail?.points_draw ?? 1)} / 負 ${Number(featuredTournamentDetail?.points_loss ?? 0)}`,
          rows,
        }));
        return;
      }
      const rounds = buildKnockoutPosterRounds(
        featuredTournamentDetail,
        formatPublicTournamentStageLabel,
        formatTournamentParticipantLabel,
        formatTournamentMatchStatusLabel,
      );
      if (rounds.length <= 0) {
        setFeaturedPosterUrl('');
        return;
      }
      setFeaturedPosterUrl(buildKnockoutBracketShareCardDataUrl({
        title: String(featuredTournamentDetail?.title || '淘汰賽模式進級表'),
        focusLabel: '全部輪次',
        rounds,
        summaryCards: buildKnockoutPosterSummaryCards(featuredTournamentDetail, formatTournamentParticipantLabel),
      }));
    } catch {
      setFeaturedPosterUrl('');
    }
  }, [
    featuredTournamentDetail,
    formatPublicTournamentStageLabel,
    formatTournamentMatchStatusLabel,
    formatTournamentParticipantLabel,
  ]);

  return (
    <div className="mt-5 space-y-6">
      <div className="cue-surface rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="font-semibold text-lg">公開賽況</div>
            <div className="text-xs cue-muted mt-1">改成海報式首頁展示，先看焦點賽事海報，再視需要進入完整賽況。</div>
          </div>
          <div className="text-xs cue-muted">
            {tournamentLiveBoardLoading ? '讀取中…' : '海報模式'}
          </div>
        </div>

        {tournamentLiveBoardError && <div className="text-sm text-rose-300 mb-2">{tournamentLiveBoardError}</div>}
        {tournamentLiveBoardLoading && <div className="text-sm cue-muted">讀取中…</div>}
        {!tournamentLiveBoardLoading && tournamentLiveBoard.length === 0 && (
          <div className="text-sm cue-muted">目前未有可公開顯示的 tournament 賽況。</div>
        )}
        {!tournamentLiveBoardLoading && tournamentLiveBoard.length > 0 && (
          <div className="space-y-4">
            {featuredTournament ? (
              <div className="cue-surface-strong rounded-2xl p-5 border border-white/10">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-extrabold accent-yellow tracking-wide">
                      {normalizeTournamentFormat(featuredTournament?.format) === 'LEAGUE' ? 'LEAGUE MODE POSTER' : 'KNOCKOUT MODE POSTER'}
                    </div>
                    <div className="font-semibold text-2xl mt-2 leading-tight">{String(featuredTournament?.title || '比賽')}</div>
                    <div className="text-sm cue-muted mt-2">{heroSummary}</div>
                    <div className="text-xs cue-muted mt-2">更新時間：{featuredUpdatedAtLabel}</div>
                  </div>

                  {featuredTournamentDetailLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-10 text-sm cue-muted">
                      正在生成海報預覽...
                    </div>
                  ) : featuredPosterUrl ? (
                    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                      <img
                        src={featuredPosterUrl}
                        alt={`${String(featuredTournament?.title || '比賽')} 海報`}
                        className="w-full rounded-[20px] border border-white/10 bg-black/20"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-8 text-sm cue-muted">
                      目前未能生成與後台一致的海報預覽，請先點入完整賽況查看。
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="px-3 py-2 rounded cue-surface text-xs cue-muted">
                      這裡直接顯示與後台分享卡相同的海報結果
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('signup');
                        setTournamentOpen(tournaments.find((row: any) => String(row?.id || '') === String(featuredTournament?.id || '')) || featuredTournament);
                      }}
                      className="px-4 py-2 rounded cue-button text-sm font-semibold"
                    >
                      查看完整賽況
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {remainingTournaments.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">其餘賽事海報</div>
                    <div className="text-xs cue-muted mt-1">其餘賽事統一收成海報牆，先看版型，再決定是否進入完整詳情。</div>
                  </div>
                  <div className="text-xs cue-muted">向下掃讀</div>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {remainingTournaments.map((tournament: any) => (
                    <ClubPublicTournamentLiveBoardCard
                      key={String(tournament?.id || Math.random())}
                      tournament={tournament}
                      tournaments={tournaments}
                      setActiveTab={setActiveTab}
                      setTournamentOpen={setTournamentOpen}
                      formatTournamentFormatLabel={formatTournamentFormatLabel}
                      formatTournamentWorkflowLabel={formatTournamentWorkflowLabel}
                      buildPublicTournamentBreakSummary={buildPublicTournamentBreakSummary}
                      formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
                      normalizeTournamentFormat={normalizeTournamentFormat}
                      buildPublicTournamentLiveProgressLabel={buildPublicTournamentLiveProgressLabel}
                      formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
                      formatTournamentParticipantLabel={formatTournamentParticipantLabel}
                      openPublicBoardParticipantPanel={openPublicBoardParticipantPanel}
                      renderPublicBoardParticipantActions={renderPublicBoardParticipantActions}
                      compact
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubPublicTournamentLiveBoard;
