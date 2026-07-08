import React from 'react';

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
  return (
    <div className="mt-5 space-y-6">
      <div className="cue-surface rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="font-semibold text-lg">公開賽況</div>
            <div className="text-xs cue-muted mt-1">集中顯示目前可公開查看的 tournament 進度、即將上場與最近完成場次</div>
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
            {tournamentLiveBoard.map((tournament: any) => (
              <div key={String(tournament?.id || Math.random())} className="cue-surface-strong rounded-lg p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-lg truncate">{String(tournament?.title || '比賽')}</div>
                    <div className="text-xs cue-muted mt-1">
                      {formatTournamentFormatLabel(tournament?.format)} · {formatTournamentWorkflowLabel(tournament?.workflow_status)}
                      {tournament?.startsAt ? ` · ${new Date(String(tournament.startsAt)).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <div className="px-3 py-2 rounded cue-surface">進行中 {Number(tournament?.summary?.liveMatchCount || 0)}</div>
                    <div className="px-3 py-2 rounded cue-surface">即將上場 {Number(tournament?.summary?.readyMatchCount || 0)}</div>
                    <div className="px-3 py-2 rounded cue-surface">已完成 {Number(tournament?.summary?.completedMatchCount || 0)}</div>
                  </div>
                </div>

                {Array.isArray(tournament?.liveMatches) && tournament.liveMatches.length > 0 ? (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">進行中場次</div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {tournament.liveMatches.map((row: any) => {
                        const breakSummary = buildPublicTournamentBreakSummary(row);
                        return (
                          <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</div>
                                <div className="text-xs cue-muted mt-1">{buildPublicTournamentLiveProgressLabel(row, tournament?.bestOfFrames)}</div>
                              </div>
                              <div className="text-xs font-semibold accent-yellow">{formatTournamentMatchStatusLabel(row?.status)}</div>
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_a_participant)}
                                className="font-semibold text-left hover:underline"
                              >
                                {formatTournamentParticipantLabel(row?.player_a_participant)}
                              </button>
                              <div className="text-sm cue-muted my-1">
                                {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                              </div>
                              <button
                                type="button"
                                onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_b_participant)}
                                className="font-semibold text-left hover:underline"
                              >
                                {formatTournamentParticipantLabel(row?.player_b_participant)}
                              </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                              <div className="cue-surface-strong rounded-lg p-2">{breakSummary.topLabel}</div>
                              <div className="cue-surface-strong rounded-lg p-2">{breakSummary.countLabel}</div>
                              <div className="cue-surface-strong rounded-lg p-2">已完成 {Array.isArray(row?.frames) ? row.frames.length : 0} 局</div>
                            </div>
                            <div className="text-xs cue-muted mt-3">{breakSummary.latestLabel}</div>
                            {renderPublicBoardParticipantActions(tournament, row)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(tournament?.readyMatches) && tournament.readyMatches.length > 0 ? (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">即將上場</div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      {tournament.readyMatches.map((row: any) => (
                        <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                            <span>{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</span>
                            <span>{row?.scheduled_at ? new Date(String(row.scheduled_at)).toLocaleString() : '待定時間'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_a_participant)}
                            className="font-semibold text-left hover:underline"
                          >
                            {formatTournamentParticipantLabel(row?.player_a_participant)}
                          </button>
                          <div className="text-xs cue-muted my-1">vs</div>
                          <button
                            type="button"
                            onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_b_participant)}
                            className="font-semibold text-left hover:underline"
                          >
                            {formatTournamentParticipantLabel(row?.player_b_participant)}
                          </button>
                          {renderPublicBoardParticipantActions(tournament, row)}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(tournament?.recentCompletedMatches) && tournament.recentCompletedMatches.length > 0 ? (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">最近完成</div>
                    <div className="grid gap-2 lg:grid-cols-3">
                      {tournament.recentCompletedMatches.map((row: any) => (
                        <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                          <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, normalizeTournamentFormat(tournament?.format), 0)}</div>
                          <button
                            type="button"
                            onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_a_participant)}
                            className="font-semibold mt-2 text-left hover:underline"
                          >
                            {formatTournamentParticipantLabel(row?.player_a_participant)}
                          </button>
                          <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                          <button
                            type="button"
                            onClick={() => openPublicBoardParticipantPanel(tournament, row?.player_b_participant)}
                            className="font-semibold text-left hover:underline"
                          >
                            {formatTournamentParticipantLabel(row?.player_b_participant)}
                          </button>
                          {renderPublicBoardParticipantActions(tournament, row)}
                        </div>
                      ))}
                    </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClubPublicTournamentLiveBoard;
