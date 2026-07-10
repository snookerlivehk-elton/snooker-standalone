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
    const aScore = (Number(a?.summary?.liveMatchCount || 0) * 100)
      + (Number(a?.summary?.readyMatchCount || 0) * 10)
      + Number(a?.summary?.completedMatchCount || 0);
    const bScore = (Number(b?.summary?.liveMatchCount || 0) * 100)
      + (Number(b?.summary?.readyMatchCount || 0) * 10)
      + Number(b?.summary?.completedMatchCount || 0);
    return bScore - aScore;
  });
  const featuredTournament = sortedBoard[0] || null;
  const remainingTournaments = sortedBoard.slice(1);

  const heroTitle = featuredTournament
    ? Number(featuredTournament?.summary?.liveMatchCount || 0) > 0
      ? '本日焦點賽事'
      : Number(featuredTournament?.summary?.readyMatchCount || 0) > 0
        ? '即將上場焦點'
        : '最新公開結果'
    : '公開賽況';
  const heroSummary = featuredTournament
    ? Number(featuredTournament?.summary?.liveMatchCount || 0) > 0
      ? '主視覺先顯示正在推進的賽事，讓訪客一進頁就先看最需要追蹤的對局。'
      : Number(featuredTournament?.summary?.readyMatchCount || 0) > 0
        ? '若暫時未有 live 對局，首屏改為提醒即將上場的焦點賽事。'
        : '若現場已沒有進行中對局，首屏則回落到最近完成的公開賽果。'
    : '集中顯示目前可公開查看的賽事進度、即將上場與最近完成場次。';
  const featuredPreviewRows = featuredTournament
    ? Number(featuredTournament?.summary?.liveMatchCount || 0) > 0
      ? (Array.isArray(featuredTournament?.liveMatches) ? featuredTournament.liveMatches.slice(0, 2) : [])
      : Number(featuredTournament?.summary?.readyMatchCount || 0) > 0
        ? (Array.isArray(featuredTournament?.readyMatches) ? featuredTournament.readyMatches.slice(0, 2) : [])
        : (Array.isArray(featuredTournament?.recentCompletedMatches) ? featuredTournament.recentCompletedMatches.slice(0, 2) : [])
    : [];
  const featuredParticipantCount = Number(featuredTournament?.summary?.participantCount || 0);

  return (
    <div className="mt-5 space-y-6">
      <div className="cue-surface rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="font-semibold text-lg">公開賽況</div>
            <div className="text-xs cue-muted mt-1">改成焦點賽事 + 其餘賽事列表，先讓訪客一眼看懂今天最值得追的公開對局。</div>
          </div>
          <div className="text-xs cue-muted">
            {tournamentLiveBoardLoading ? '讀取中…' : `共 ${tournamentLiveBoard.length} 個賽事項目`}
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
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold accent-yellow tracking-wide">
                      {heroTitle}
                    </div>
                    <div className="font-semibold text-3xl mt-3 leading-tight">{String(featuredTournament?.title || '比賽')}</div>
                    <div className="text-sm cue-muted mt-2">
                      {formatTournamentFormatLabel(featuredTournament?.format)} · {formatTournamentWorkflowLabel(featuredTournament?.workflow_status)}
                      {featuredTournament?.startsAt ? ` · ${new Date(String(featuredTournament.startsAt)).toLocaleString()}` : ''}
                    </div>
                    <div className="text-sm cue-muted mt-3 leading-6">{heroSummary}</div>
                    <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                      <div className="rounded-lg cue-surface p-3">
                        <div className="text-xs cue-muted">進行中</div>
                        <div className="font-semibold mt-1">{Number(featuredTournament?.summary?.liveMatchCount || 0)}</div>
                      </div>
                      <div className="rounded-lg cue-surface p-3">
                        <div className="text-xs cue-muted">即將上場</div>
                        <div className="font-semibold mt-1">{Number(featuredTournament?.summary?.readyMatchCount || 0)}</div>
                      </div>
                      <div className="rounded-lg cue-surface p-3">
                        <div className="text-xs cue-muted">已完成</div>
                        <div className="font-semibold mt-1">{Number(featuredTournament?.summary?.completedMatchCount || 0)}</div>
                      </div>
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
                        以首屏先看焦點，再往下看其餘賽事
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
                    <div className="font-semibold">其餘公開賽況</div>
                    <div className="text-xs cue-muted mt-1">其餘賽事收斂成摘要卡，避免首屏被長列表拉得過高。</div>
                  </div>
                  <div className="text-xs cue-muted">{remainingTournaments.length} 場</div>
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
