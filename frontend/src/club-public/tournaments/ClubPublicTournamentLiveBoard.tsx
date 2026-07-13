import React from 'react';
import ClubPublicTournamentLiveBoardCard from './ClubPublicTournamentLiveBoardCard';
import ClubPublicTournamentLiveBoardVisual from './ClubPublicTournamentLiveBoardVisual';

type ClubPublicTournamentLiveBoardProps = {
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
  const featuredPreviewRows = featuredTournament
    ? featuredBucket === 'live'
      ? (Array.isArray(featuredTournament?.liveMatches) ? featuredTournament.liveMatches.slice(0, 2) : [])
      : featuredBucket === 'ready'
        ? (Array.isArray(featuredTournament?.readyMatches) ? featuredTournament.readyMatches.slice(0, 2) : [])
        : (Array.isArray(featuredTournament?.recentCompletedMatches) ? featuredTournament.recentCompletedMatches.slice(0, 2) : [])
    : [];
  const featuredParticipantCount = Number(featuredTournament?.summary?.participantCount || 0);
  const featuredUpdatedAtLabel = getTournamentBoardUpdatedAtLabel(featuredTournament);

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
                <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch">
                  <div className="xl:w-[38%]">
                    <div className="text-xs font-extrabold accent-yellow tracking-wide">
                      {normalizeTournamentFormat(featuredTournament?.format) === 'LEAGUE' ? 'LEAGUE MODE POSTER' : 'KNOCKOUT MODE POSTER'}
                    </div>
                    <div className="font-semibold text-3xl mt-3 leading-tight">{String(featuredTournament?.title || '比賽')}</div>
                    <div className="text-sm cue-muted mt-2">{heroTitle}</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold cue-muted">
                        {formatTournamentFormatLabel(featuredTournament?.format)}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold cue-muted">
                        {formatTournamentWorkflowLabel(featuredTournament?.workflow_status)}
                      </div>
                    </div>
                    <div className="text-sm cue-muted mt-3 leading-6">{heroSummary}</div>
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
                      <div className="text-[11px] cue-muted">更新時間</div>
                      <div className="mt-1 text-sm font-semibold">{featuredUpdatedAtLabel}</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
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
                      <div className="px-3 py-2 rounded cue-surface text-xs cue-muted">
                        {heroContent.hint}
                      </div>
                    </div>
                  </div>

                  <div className="xl:flex-1 grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <ClubPublicTournamentLiveBoardVisual
                        tournament={featuredTournament}
                        variant="hero"
                        formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
                        normalizeTournamentFormat={normalizeTournamentFormat}
                        formatTournamentParticipantLabel={formatTournamentParticipantLabel}
                      />
                    </div>
                    {featuredPreviewRows.map((row: any) => (
                      <div key={String(row?.id || Math.random())} className="rounded-xl cue-surface p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs cue-muted">
                              {formatPublicTournamentStageLabel(row, normalizeTournamentFormat(featuredTournament?.format), featuredParticipantCount)}
                            </div>
                            <div className="text-xs cue-muted mt-1">
                              {buildPublicTournamentLiveProgressLabel(row, featuredTournament?.bestOfFrames)}
                            </div>
                          </div>
                          <div className="text-xs font-semibold accent-yellow">
                            {formatTournamentMatchStatusLabel(row?.status)}
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <button
                            type="button"
                            onClick={() => openPublicBoardParticipantPanel(featuredTournament, row?.player_a_participant)}
                            className="font-semibold text-left hover:underline"
                          >
                            {formatTournamentParticipantLabel(row?.player_a_participant)}
                          </button>
                          <div className="text-sm cue-muted">
                            {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                          </div>
                          <button
                            type="button"
                            onClick={() => openPublicBoardParticipantPanel(featuredTournament, row?.player_b_participant)}
                            className="font-semibold text-left hover:underline"
                          >
                            {formatTournamentParticipantLabel(row?.player_b_participant)}
                          </button>
                        </div>
                        {renderPublicBoardParticipantActions(featuredTournament, row)}
                      </div>
                    ))}
                    {featuredPreviewRows.length === 0 ? (
                      <div className="rounded-xl cue-surface p-4 text-sm cue-muted md:col-span-2">
                        目前焦點賽事暫未有可展示的即時對局，請點入詳情查看完整賽程與參賽資訊。
                      </div>
                    ) : null}
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
