import React from 'react';
import ClubPublicTournamentParticipantPanel from './ClubPublicTournamentParticipantPanel';

type ClubPublicTournamentDetailModalProps = {
  tournamentOpen: any;
  openedTournament: any;
  tournamentDetailLoading: boolean;
  tournamentDetailError: string;
  openedTournamentFormat: any;
  openedTournamentParticipants: any[];
  openedTournamentMatches: any[];
  openedTournamentLiveMatches: any[];
  openedTournamentReadyMatches: any[];
  openedTournamentRecentCompletedMatches: any[];
  openedTournamentStandings: any[];
  openedTournamentBracketColumns: any[];
  openedTournamentLeagueRounds: any[];
  tournamentOpenLoading: boolean;
  setTournamentOpen: (value: any) => void;
  handleTournamentSignup: () => Promise<void>;
  formatTournamentFormatLabel: (value: any) => string;
  formatTournamentWorkflowLabel: (value: any) => string;
  buildPublicTournamentBreakSummary: (row: any) => any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  buildPublicTournamentLiveProgressLabel: (row: any, bestOfFrames: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentResultTypeLabel: (value: any) => string;
  formatPublicKnockoutRoundLabel: (row: any, participantCount: number) => string;
  PUBLIC_BRACKET_CONNECTOR_HALF_GAP: number;
  PUBLIC_BRACKET_CARD_HEIGHT: number;
  participantPanelProps: any;
};

const ClubPublicTournamentDetailModal: React.FC<ClubPublicTournamentDetailModalProps> = ({
  tournamentOpen,
  openedTournament,
  tournamentDetailLoading,
  tournamentDetailError,
  openedTournamentFormat,
  openedTournamentParticipants,
  openedTournamentMatches,
  openedTournamentLiveMatches,
  openedTournamentReadyMatches,
  openedTournamentRecentCompletedMatches,
  openedTournamentStandings,
  openedTournamentBracketColumns,
  openedTournamentLeagueRounds,
  tournamentOpenLoading,
  setTournamentOpen,
  handleTournamentSignup,
  formatTournamentFormatLabel,
  formatTournamentWorkflowLabel,
  buildPublicTournamentBreakSummary,
  formatPublicTournamentStageLabel,
  buildPublicTournamentLiveProgressLabel,
  formatTournamentMatchStatusLabel,
  formatTournamentParticipantLabel,
  formatTournamentResultTypeLabel,
  formatPublicKnockoutRoundLabel,
  PUBLIC_BRACKET_CONNECTOR_HALF_GAP,
  PUBLIC_BRACKET_CARD_HEIGHT,
  participantPanelProps,
}) => {
  if (!tournamentOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={() => setTournamentOpen(null)} />
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto cue-surface rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-extrabold accent-yellow truncate">{String(openedTournament?.title || '比賽')}</div>
            <div className="text-xs cue-muted mt-1">
              {(() => {
                const cap = Number(openedTournament?.capacity ?? 0);
                const count = Number(openedTournament?.signupCount ?? 0);
                const status = cap > 0 ? `${count}/${cap}` : `${count}/—`;
                const startsAt = openedTournament?.startsAt ? new Date(String(openedTournament.startsAt)) : null;
                const startsText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
                const closesAt = openedTournament?.signupClosesAt ? new Date(String(openedTournament.signupClosesAt)) : null;
                const closesText = closesAt && Number.isFinite(closesAt.getTime()) ? closesAt.toLocaleDateString() : '';
                return `${startsText ? `${startsText} · ` : ''}${closesText ? `截止 ${closesText} · ` : ''}報名 ${status}`;
              })()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTournamentOpen(null)}
            className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
          >
            返回
          </button>
        </div>

        {tournamentDetailLoading ? (
          <div className="mt-4 text-sm cue-muted">讀取比賽詳情中…</div>
        ) : tournamentDetailError ? (
          <div className="mt-4 text-sm text-rose-300">{tournamentDetailError}</div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="text-sm cue-muted">賽制</div>
                <div className="text-2xl font-extrabold accent-yellow mt-1">{formatTournamentFormatLabel(openedTournamentFormat)}</div>
                <div className="text-xs cue-muted mt-2">{formatTournamentWorkflowLabel(openedTournament?.workflow_status)}</div>
              </div>
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="text-sm cue-muted">報名</div>
                <div className="text-2xl font-extrabold accent-yellow mt-1">{Number(openedTournament?.signupCount ?? 0)}</div>
                <div className="text-xs cue-muted mt-2">
                  {Number(openedTournament?.capacity ?? 0) > 0 ? `上限 ${Number(openedTournament?.capacity || 0)} 人` : '不限名額'}
                </div>
              </div>
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="text-sm cue-muted">參賽 / 賽程</div>
                <div className="text-2xl font-extrabold accent-yellow mt-1">
                  {Number(openedTournament?.summary?.participantCount || openedTournamentParticipants.length)} / {openedTournamentMatches.length}
                </div>
                <div className="text-xs cue-muted mt-2">正式參賽者 / 對局數</div>
              </div>
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="text-sm cue-muted">進度</div>
                <div className="text-sm font-semibold mt-2">已完成 {Number(openedTournament?.summary?.completedMatchCount || 0)} 場</div>
                <div className="text-xs cue-muted mt-2">
                  就緒 {Number(openedTournament?.summary?.readyMatchCount || 0)} · 待定 {Number(openedTournament?.summary?.pendingMatchCount || 0)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2 cue-surface-strong rounded-lg p-4">
                <div className="font-semibold mb-2">比賽詳情</div>
                <div className="text-sm whitespace-pre-wrap">{String(openedTournament?.description || '—')}</div>
                {String(openedTournament?.signupGuide || '').trim() ? (
                  <div className="mt-4 rounded-lg p-3 cue-surface">
                    <div className="font-semibold mb-1">報名指引</div>
                    <div className="text-sm cue-muted whitespace-pre-wrap">{String(openedTournament?.signupGuide || '')}</div>
                  </div>
                ) : null}
              </div>
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="font-semibold mb-2">我的狀態</div>
                <div className="text-sm">
                  {String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
                    ? '已確認'
                    : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
                      ? '待確認'
                      : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CANCELLED'
                        ? '已取消'
                        : '未報名'}
                </div>
                <div className="text-xs cue-muted mt-2">{openedTournament?.club?.name ? `場館：${openedTournament.club.name}` : ''}</div>
                <div className="text-xs cue-muted mt-1">
                  {openedTournament?.startsAt ? `比賽時間：${new Date(String(openedTournament.startsAt)).toLocaleString()}` : '未設定比賽時間'}
                </div>
              </div>
            </div>

            {openedTournamentMatches.length > 0 ? (
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
                  <div>
                    <div className="font-semibold">Live 賽況</div>
                    <div className="text-xs cue-muted mt-1">即時反映目前盤數、下一局與本場 break 摘要</div>
                  </div>
                  <div className="text-xs cue-muted">
                    進行中 {openedTournamentLiveMatches.length} · 即將上場 {openedTournamentReadyMatches.length} · 最近完成 {openedTournamentRecentCompletedMatches.length}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3 mb-4">
                  <div className="cue-surface rounded-lg p-3">
                    <div className="text-sm cue-muted">進行中</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">{openedTournamentLiveMatches.length}</div>
                    <div className="text-xs cue-muted mt-2">已開局而未完賽場次</div>
                  </div>
                  <div className="cue-surface rounded-lg p-3">
                    <div className="text-sm cue-muted">即將上場</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">{openedTournamentReadyMatches.length}</div>
                    <div className="text-xs cue-muted mt-2">已排位可隨時開打場次</div>
                  </div>
                  <div className="cue-surface rounded-lg p-3">
                    <div className="text-sm cue-muted">最新完成</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">{Number(openedTournament?.summary?.completedMatchCount || 0)}</div>
                    <div className="text-xs cue-muted mt-2">本賽事已完成場次總數</div>
                  </div>
                </div>

                {openedTournamentLiveMatches.length > 0 ? (
                  <div className="grid gap-3 xl:grid-cols-2">
                    {openedTournamentLiveMatches.map((row: any) => {
                      const breakSummary = buildPublicTournamentBreakSummary(row);
                      return (
                        <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</div>
                              <div className="text-xs cue-muted mt-1">{buildPublicTournamentLiveProgressLabel(row, openedTournament?.bestOfFrames)}</div>
                            </div>
                            <div className="text-xs font-semibold accent-yellow">{formatTournamentMatchStatusLabel(row?.status)}</div>
                          </div>
                          <div className="mt-3">
                            <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                            <div className="text-sm cue-muted my-1">
                              {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                            </div>
                            <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                            <div className="cue-surface-strong rounded-lg p-2">{breakSummary.topLabel}</div>
                            <div className="cue-surface-strong rounded-lg p-2">{breakSummary.countLabel}</div>
                            <div className="cue-surface-strong rounded-lg p-2">已完成 {Array.isArray(row?.frames) ? row.frames.length : 0} 局</div>
                          </div>
                          <div className="text-xs cue-muted mt-3">{breakSummary.latestLabel}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm cue-muted">目前未有進行中場次；下方會顯示即將上場或最近完成的對局。</div>
                )}

                {openedTournamentReadyMatches.length > 0 ? (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">即將上場</div>
                    <div className="grid gap-2 lg:grid-cols-2">
                      {openedTournamentReadyMatches.slice(0, 4).map((row: any) => (
                        <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                            <span>{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</span>
                            <span>{row?.scheduled_at ? new Date(String(row.scheduled_at)).toLocaleString() : '待定時間'}</span>
                          </div>
                          <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                          <div className="text-xs cue-muted my-1">vs</div>
                          <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {openedTournamentRecentCompletedMatches.length > 0 ? (
                  <div className="mt-4">
                    <div className="font-semibold mb-2">最近完成</div>
                    <div className="grid gap-2 lg:grid-cols-3">
                      {openedTournamentRecentCompletedMatches.map((row: any) => (
                        <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                          <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</div>
                          <div className="font-semibold mt-2">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                          <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                          <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                          <div className="text-xs cue-muted mt-2">{buildPublicTournamentLiveProgressLabel(row, openedTournament?.bestOfFrames)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!!openedTournament?.podium && (openedTournament.podium?.champion || openedTournament.podium?.runnerUp || (Array.isArray(openedTournament.podium?.semiFinalists) && openedTournament.podium.semiFinalists.length > 0)) ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="cue-surface-strong rounded-lg p-4">
                  <div className="text-sm cue-muted">冠軍</div>
                  <div className="font-semibold mt-1">{openedTournament.podium?.champion ? formatTournamentParticipantLabel(openedTournament.podium.champion) : '-'}</div>
                </div>
                <div className="cue-surface-strong rounded-lg p-4">
                  <div className="text-sm cue-muted">亞軍</div>
                  <div className="font-semibold mt-1">{openedTournament.podium?.runnerUp ? formatTournamentParticipantLabel(openedTournament.podium.runnerUp) : '-'}</div>
                </div>
                <div className="cue-surface-strong rounded-lg p-4">
                  <div className="text-sm cue-muted">四強</div>
                  <div className="font-semibold mt-1">
                    {Array.isArray(openedTournament.podium?.semiFinalists) && openedTournament.podium.semiFinalists.length > 0
                      ? openedTournament.podium.semiFinalists.map((row: any) => formatTournamentParticipantLabel(row)).join(' / ')
                      : '-'}
                  </div>
                </div>
              </div>
            ) : null}

            <ClubPublicTournamentParticipantPanel {...participantPanelProps} />

            {openedTournamentFormat === 'KNOCKOUT' && openedTournamentBracketColumns.length > 0 ? (
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-semibold">Knockout Bracket</div>
                  <div className="text-xs cue-muted">{openedTournamentMatches.length} 場</div>
                </div>
                <div className="overflow-x-auto -mx-2 px-2">
                  <div className="flex gap-10 min-w-max items-start pb-2">
                    {openedTournamentBracketColumns.map((column: any) => (
                      <div key={String(column?.label || Math.random())} className="w-72">
                        <div className="font-semibold mb-3">{column.label}</div>
                        <div className="relative" style={{ height: `${column.columnHeight}px`, paddingTop: `${column.paddingTop}px` }}>
                          {column.connectors.map((connector: any, connectorIndex: number) => (
                            <React.Fragment key={`${column.label}-connector-${connectorIndex}`}>
                              <div className="absolute border-t cue-border" style={{ left: '100%', top: `${connector.top}px`, width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                              <div className="absolute border-r cue-border" style={{ left: `calc(100% + ${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px)`, top: `${connector.top}px`, height: `${connector.height}px` }} />
                              <div className="absolute border-t cue-border" style={{ left: '100%', top: `${connector.top + connector.height}px`, width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                            </React.Fragment>
                          ))}
                          <div className="flex flex-col" style={{ gap: `${column.gap}px` }}>
                            {column.items.map((row: any) => {
                              const winnerId = String(row?.winner_participant_id || '');
                              const aParticipantId = String(row?.player_a_participant_id || '');
                              const bParticipantId = String(row?.player_b_participant_id || '');
                              return (
                                <div key={String(row?.id || Math.random())} className="relative" style={{ height: `${PUBLIC_BRACKET_CARD_HEIGHT}px` }}>
                                  {column.roundIndex > 0 ? (
                                    <div className="absolute border-t cue-border" style={{ right: '100%', top: '50%', width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                                  ) : null}
                                  {!column.isFinal ? (
                                    <div className="absolute border-t cue-border" style={{ left: '100%', top: '50%', width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                                  ) : null}
                                  <div className="relative z-10 h-full w-full rounded-lg border cue-border cue-surface p-3">
                                    <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                                      <span>M{row?.match_no || '-'}</span>
                                      <span>{formatTournamentResultTypeLabel(row?.result_type)}</span>
                                    </div>
                                    <div className={`font-semibold truncate ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                                    <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                                    <div className={`font-semibold truncate ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {openedTournamentFormat === 'LEAGUE' && openedTournamentLeagueRounds.length > 0 ? (
              <div className="cue-surface-strong rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="font-semibold">League Rounds</div>
                  <div className="text-xs cue-muted">{openedTournamentLeagueRounds.length} 輪</div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {openedTournamentLeagueRounds.map((round: any) => (
                    <div key={String(round?.label || round?.roundNo || Math.random())} className="cue-surface rounded-lg p-3">
                      <div className="font-semibold mb-2">{round.label}</div>
                      <div className="grid gap-2">
                        {round.items.map((row: any) => (
                          <div key={String(row?.id || Math.random())} className="rounded-lg border cue-border p-3">
                            <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                              <span>M{row?.match_no || '-'}</span>
                              <span>{formatTournamentResultTypeLabel(row?.result_type)}</span>
                            </div>
                            <div className="font-semibold truncate">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                            <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                            <div className="font-semibold truncate">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="cue-surface-strong rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-semibold">公開賽程列表</div>
                <div className="text-xs cue-muted">{openedTournamentMatches.length} 場</div>
              </div>
              {openedTournamentMatches.length === 0 ? (
                <div className="text-sm cue-muted">尚未生成賽程</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">輪次</th>
                        <th className="py-2 px-2">對賽</th>
                        <th className="py-2 px-2">比分</th>
                        <th className="py-2 px-2">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openedTournamentMatches.map((row: any) => (
                        <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                          <td className="py-2 px-2 whitespace-nowrap">
                            {openedTournamentFormat === 'LEAGUE'
                              ? `第 ${Number(row?.round_no || 0)} 輪`
                              : formatPublicKnockoutRoundLabel(row, openedTournamentParticipants.length)}
                          </td>
                          <td className="py-2 px-2">
                            <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)} vs {formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                            <div className="text-xs cue-muted mt-1">M{row?.match_no || '-'} · {formatTournamentResultTypeLabel(row?.result_type)}</div>
                          </td>
                          <td className="py-2 px-2 whitespace-nowrap">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</td>
                          <td className="py-2 px-2 whitespace-nowrap">{formatTournamentMatchStatusLabel(row?.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={
              tournamentOpenLoading
              || tournamentDetailLoading
              || String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
              || String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
              || openedTournament?.signupOpen === false
            }
            onClick={handleTournamentSignup}
            className={`flex-1 px-4 py-2 rounded font-semibold ${tournamentOpenLoading ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
          >
            {String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
              ? '已確認報名'
              : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
                ? '待場館確認'
                : openedTournament?.signupOpen === false
                  ? '暫未開放報名'
                  : '一鍵報名'}
          </button>
          <button
            type="button"
            onClick={() => setTournamentOpen(null)}
            className="flex-1 px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClubPublicTournamentDetailModal;
