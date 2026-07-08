import React from 'react';

const ClubPublicTournamentPanels: React.FC<any> = ({ state, actions, helpers, api, env }) => {
  const {
    activeTab,
    tournamentLiveBoardLoading,
    tournamentLiveBoard,
    tournamentLiveBoardError,
    tournamentsLoading,
    tournaments,
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
    tournamentParticipantSearchQuery,
    filteredOpenedTournamentParticipantSearchRows,
    openedTournamentParticipantSearchRows,
    tournamentParticipantOpen,
    tournamentParticipantDetailLoading,
    tournamentParticipantDetailError,
    tournamentParticipantDetail,
    selectedTournamentParticipantFormat,
    filteredTournamentParticipantRecentForm,
    filteredTournamentParticipantOpponentStats,
    tournamentParticipantMonthFilter,
    tournamentParticipantRoundFilter,
    tournamentParticipantFilterOptions,
    filteredTournamentParticipantMatches,
    filteredTournamentParticipantBreaks,
    filteredTournamentParticipantChartData,
    tournamentOpenLoading,
    tournamentSubmitModal,
  } = state;

  const {
    setActiveTab,
    setTournamentOpen,
    setTournamentParticipantSearchQuery,
    openTournamentParticipantPanel,
    openPublicBoardParticipantPanel,
    renderPublicBoardParticipantActions,
    setTournamentParticipantMonthFilter,
    setTournamentParticipantRoundFilter,
    setTournamentParticipantOpen,
    setTournamentOpenLoading,
    setTournamentSubmitModal,
    setTournaments,
    setTournamentDetail,
    setMemberAccessNotice,
  } = actions;

  const {
    formatTournamentFormatLabel,
    formatTournamentWorkflowLabel,
    buildPublicTournamentBreakSummary,
    formatPublicTournamentStageLabel,
    normalizeTournamentFormat,
    buildPublicTournamentLiveProgressLabel,
    formatTournamentMatchStatusLabel,
    formatTournamentParticipantLabel,
    formatTournamentResultTypeLabel,
    formatPublicKnockoutRoundLabel,
    formatMonthFilterLabel,
    PUBLIC_BRACKET_CONNECTOR_HALF_GAP,
    PUBLIC_BRACKET_CARD_HEIGHT,
    tournamentParticipantPanelRef,
  } = helpers;

  const { API_URL, signupTournament, getPublicClubTournaments, getPublicClubTournament } = api;
  const { clubId, sessionMemberId, nav, loc } = env;

  const handleTournamentSignup = async () => {
    if (!clubId || !openedTournament?.id) return;
    if (!sessionMemberId) {
      nav(`/members/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`);
      return;
    }
    try {
      setTournamentOpenLoading(true);
      const res = await signupTournament(API_URL, clubId, sessionMemberId, String(openedTournament.id));
      const ok = !!(res && (res as any).ok);
      if (!ok) throw new Error('報名失敗');
      setTournamentSubmitModal({
        open: true,
        title: String(openedTournament?.title || '比賽'),
        guide: String(openedTournament?.signupGuide || ''),
      });
      try {
        const rows = await getPublicClubTournaments(API_URL, clubId, sessionMemberId || undefined);
        setTournaments(Array.isArray(rows) ? rows : []);
      } catch {}
      try {
        const detail = await getPublicClubTournament(API_URL, clubId, String(openedTournament.id), sessionMemberId || undefined);
        setTournamentDetail(detail && typeof detail === 'object' ? detail : null);
      } catch {}
      setTournamentOpen(null);
    } catch (e: any) {
      if (String((e as any)?.code || '') === 'member_not_verified') {
        setMemberAccessNotice(String(e?.message || '比賽報名只限認證會員使用，請先完成 Email 驗證'));
        setTournamentOpen(null);
        nav('/me');
        return;
      }
      alert(String(e?.message || '報名失敗'));
    } finally {
      setTournamentOpenLoading(false);
    }
  };

  return (
    <>
      {activeTab === 'scoreboard' && (
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
      )}

      {activeTab === 'signup' && (
        <div className="mt-5 space-y-6">
          <div className="cue-surface rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-semibold text-lg">比賽列表</div>
              <div className="text-xs cue-muted">{tournamentsLoading ? '讀取中…' : `共 ${tournaments.length} 場`}</div>
            </div>

            {tournamentsLoading && <div className="text-sm cue-muted">讀取中…</div>}
            {!tournamentsLoading && tournaments.length === 0 && <div className="text-sm cue-muted">暫無比賽</div>}
            {!tournamentsLoading && tournaments.length > 0 && (
              <div className="space-y-2">
                {tournaments.slice(0, 50).map((t: any) => {
                  const title = String(t?.title || '比賽');
                  const cap = Number(t?.capacity ?? 0);
                  const count = Number(t?.signupCount ?? 0);
                  const status = cap > 0 ? `${count}/${cap}` : `${count}/—`;
                  const startsAt = t?.startsAt ? new Date(String(t.startsAt)) : null;
                  const startsText = startsAt && Number.isFinite(startsAt.getTime()) ? startsAt.toLocaleString() : '';
                  const closesAt = t?.signupClosesAt ? new Date(String(t.signupClosesAt)) : null;
                  const closesText = closesAt && Number.isFinite(closesAt.getTime()) ? closesAt.toLocaleDateString() : '';
                  const my = t?.mySignup;
                  const myStatus = String(my?.status || '').toUpperCase();
                  const myLabel = myStatus === 'CONFIRMED' ? '已確認' : myStatus === 'PENDING' ? '待確認' : myStatus === 'CANCELLED' ? '已取消' : '';
                  return (
                    <div
                      key={String(t?.id || title)}
                      className="cue-surface-strong rounded-lg p-3 flex items-start justify-between gap-3 hover:brightness-95 cursor-pointer"
                      onClick={() => setTournamentOpen(t)}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{title}</div>
                        <div className="text-xs cue-muted mt-1 truncate">
                          {startsText ? `${startsText} · ` : ''}
                          {closesText ? `截止 ${closesText} · ` : ''}
                          {myLabel ? `${myLabel} · ` : ''}
                          報名 {status}
                        </div>
                      </div>
                      <div className="flex-shrink-0 font-semibold accent-yellow">{status}</div>
                    </div>
                  );
                })}
                {tournaments.length > 50 && <div className="text-xs cue-muted">只顯示前 50 場</div>}
              </div>
            )}
          </div>

          {!!tournamentOpen && (
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

                    <div ref={tournamentParticipantPanelRef} className="cue-surface-strong rounded-lg p-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                          <div className="font-semibold">球手搜尋與個人戰況</div>
                          <div className="text-xs cue-muted mt-1">
                            可直接搜尋球手，或從下方正式參賽名單 / 積分榜點選，於同一個 tournament 詳情 modal 內查看個人戰況。
                          </div>
                        </div>
                        <div className="text-xs cue-muted">參賽者 {openedTournamentParticipants.length} 人</div>
                      </div>
                      <div className="mt-3 flex flex-col gap-3 lg:flex-row">
                        <div className="flex-1">
                          <input
                            value={tournamentParticipantSearchQuery}
                            onChange={(e) => setTournamentParticipantSearchQuery(e.target.value)}
                            placeholder="搜尋球手姓名、會員編號或 seed"
                            className="w-full rounded-lg cue-input px-3 py-2 text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setTournamentParticipantSearchQuery('')}
                          className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                        >
                          清除搜尋
                        </button>
                      </div>

                      {openedTournamentParticipants.length === 0 ? (
                        <div className="mt-4 text-sm cue-muted">尚未生成正式參賽名單，暫時未能查看球手個人戰況。</div>
                      ) : (
                        <>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {filteredOpenedTournamentParticipantSearchRows.map((row: any) => {
                              const isActive = String(tournamentParticipantOpen?.participantId || '') === String(row?.participantId || '');
                              return (
                                <button
                                  key={row.participantId}
                                  type="button"
                                  onClick={() => openTournamentParticipantPanel(row)}
                                  className={`rounded-lg px-3 py-2 text-left text-sm transition ${isActive ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                                >
                                  <div className="font-semibold">{row.label}</div>
                                  <div className="text-xs mt-1 opacity-80">
                                    {row.standingPosition ? `排名 ${row.standingPosition} · ` : ''}
                                    {row.finalRank ? `名次 ${row.finalRank} · ` : ''}
                                    {row.status || '-'}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          {tournamentParticipantSearchQuery.trim() && filteredOpenedTournamentParticipantSearchRows.length === 0 ? (
                            <div className="mt-3 text-sm cue-muted">搜尋不到相符球手。</div>
                          ) : null}
                          {!tournamentParticipantSearchQuery.trim() && openedTournamentParticipantSearchRows.length > filteredOpenedTournamentParticipantSearchRows.length ? (
                            <div className="mt-3 text-xs cue-muted">
                              先顯示前 {filteredOpenedTournamentParticipantSearchRows.length} 位球手；可輸入關鍵字進一步搜尋。
                            </div>
                          ) : null}
                        </>
                      )}

                      {openedTournamentParticipants.length > 0 && (
                        <div className="mt-5 border-t cue-border pt-5">
                          {!tournamentParticipantOpen ? (
                            <div className="text-sm cue-muted">先搜尋或從下方名單點選球手，即可查看個人戰況。</div>
                          ) : tournamentParticipantDetailLoading ? (
                            <div className="text-sm cue-muted">讀取球手戰況中…</div>
                          ) : tournamentParticipantDetailError ? (
                            <div className="text-sm text-rose-300">{tournamentParticipantDetailError}</div>
                          ) : tournamentParticipantDetail ? (
                            <div className="space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-lg font-extrabold accent-yellow truncate">
                                    {tournamentParticipantDetail?.participant?.member
                                      ? formatTournamentParticipantLabel({
                                          seed: tournamentParticipantDetail?.participant?.seed,
                                          member: tournamentParticipantDetail?.participant?.member,
                                        })
                                      : String(tournamentParticipantOpen?.label || '球手戰況')}
                                  </div>
                                  <div className="text-xs cue-muted mt-1">
                                    {String(openedTournament?.title || '比賽')} · 個人戰況
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setTournamentParticipantOpen(null)}
                                  className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                                >
                                  清除選擇
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="text-sm cue-muted">{selectedTournamentParticipantFormat === 'LEAGUE' ? '目前名次' : '名次 / 狀態'}</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">
                                    {Number(tournamentParticipantDetail?.standing?.position || 0) > 0
                                      ? Number(tournamentParticipantDetail?.standing?.position || 0)
                                      : Number(tournamentParticipantDetail?.participant?.finalRank || 0) > 0
                                        ? `#${Number(tournamentParticipantDetail?.participant?.finalRank || 0)}`
                                        : '-'}
                                  </div>
                                  <div className="text-xs cue-muted mt-2">
                                    Seed {tournamentParticipantDetail?.participant?.seed ?? '-'} · {String(tournamentParticipantDetail?.participant?.status || '-')}
                                  </div>
                                </div>
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="text-sm cue-muted">戰績</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">
                                    {Number(tournamentParticipantDetail?.summary?.wins || 0)} / {Number(tournamentParticipantDetail?.summary?.draws || 0)} / {Number(tournamentParticipantDetail?.summary?.losses || 0)}
                                  </div>
                                  <div className="text-xs cue-muted mt-2">勝 / 和 / 負</div>
                                </div>
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="text-sm cue-muted">{selectedTournamentParticipantFormat === 'LEAGUE' ? '聯賽總得分' : '累積總得分'}</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">
                                    {Number(tournamentParticipantDetail?.summary?.totalPoints || 0)}
                                  </div>
                                  <div className="text-xs cue-muted mt-2">
                                    失分 {Number(tournamentParticipantDetail?.summary?.totalPointsAgainst || 0)} · 差 {Number(tournamentParticipantDetail?.summary?.pointsDiff || 0)}
                                  </div>
                                </div>
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="text-sm cue-muted">單杆 / 20+</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">
                                    {Number(tournamentParticipantDetail?.summary?.highestBreak || 0)}
                                  </div>
                                  <div className="text-xs cue-muted mt-2">20+ 共 {Number(tournamentParticipantDetail?.summary?.breaks20Plus || 0)} 筆</div>
                                </div>
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="text-sm cue-muted">平均每場得分</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">
                                    {Number(tournamentParticipantDetail?.summary?.avgPointsPerMatch || 0).toFixed(1)}
                                  </div>
                                  <div className="text-xs cue-muted mt-2">以已完成場次計算</div>
                                </div>
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="text-sm cue-muted">平均每場 20+</div>
                                  <div className="text-2xl font-extrabold accent-yellow mt-1">
                                    {Number(tournamentParticipantDetail?.summary?.avgBreaks20PlusPerMatch || 0).toFixed(2)}
                                  </div>
                                  <div className="text-xs cue-muted mt-2">以已完成場次計算</div>
                                </div>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-3">
                                <div className="xl:col-span-1 cue-surface rounded-lg p-4">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="font-semibold">最近 5 場表現</div>
                                    <div className="text-xs cue-muted">{filteredTournamentParticipantRecentForm.length} 場</div>
                                  </div>
                                  {filteredTournamentParticipantRecentForm.length > 0 ? (
                                    <div className="space-y-2">
                                      {filteredTournamentParticipantRecentForm.map((row: any) => (
                                        <div key={String(row?.id || Math.random())} className="cue-surface-strong rounded-lg p-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</div>
                                              <div className="text-xs cue-muted mt-1">{row?.roundLabel || '-'}</div>
                                            </div>
                                            <div className={`text-xs font-semibold px-2 py-1 rounded ${row?.resultKey === 'WIN' ? 'bg-emerald-500/15 text-emerald-300' : row?.resultKey === 'LOSS' ? 'bg-rose-500/15 text-rose-300' : 'bg-white/10 cue-muted'}`}>
                                              {row?.resultLabel || '-'}
                                            </div>
                                          </div>
                                          <div className="mt-2 text-sm cue-muted">
                                            局數 {Number(row?.framesWon || 0)} - {Number(row?.framesLost || 0)} · 得分 {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                          </div>
                                          <div className="mt-1 text-xs cue-muted">
                                            單杆 {Number(row?.maxBreak || 0)} · 20+ {Number(row?.breaks20Plus || 0)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm cue-muted">尚未有最近賽果。</div>
                                  )}
                                </div>

                                <div className="xl:col-span-2 cue-surface rounded-lg p-4">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="font-semibold">對手分布統計</div>
                                    <div className="text-xs cue-muted">{filteredTournamentParticipantOpponentStats.length} 位對手</div>
                                  </div>
                                  {filteredTournamentParticipantOpponentStats.length > 0 ? (
                                    <div className="overflow-x-auto -mx-2 px-2">
                                      <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                          <tr className="cue-muted border-b cue-border">
                                            <th className="py-2 px-2">對手</th>
                                            <th className="py-2 px-2">戰績</th>
                                            <th className="py-2 px-2">總得分</th>
                                            <th className="py-2 px-2">平均</th>
                                            <th className="py-2 px-2">單杆 / 20+</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredTournamentParticipantOpponentStats.map((row: any, index: number) => (
                                            <tr key={`${String(row?.opponent?.participantId || row?.opponent?.id || 'bye')}-${index}`} className="border-b cue-border">
                                              <td className="py-2 px-2 font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</td>
                                              <td className="py-2 px-2 cue-muted">
                                                {Number(row?.wins || 0)} / {Number(row?.draws || 0)} / {Number(row?.losses || 0)}
                                                <div className="text-xs cue-muted mt-1">已完成 {Number(row?.completed || 0)} 場</div>
                                              </td>
                                              <td className="py-2 px-2 cue-muted">
                                                {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                                <div className="text-xs cue-muted mt-1">差 {Number(row?.pointsDiff || 0)}</div>
                                              </td>
                                              <td className="py-2 px-2 cue-muted">
                                                <div>{Number(row?.avgPointsPerMatch || 0).toFixed(1)} 分/場</div>
                                                <div className="text-xs cue-muted mt-1">{Number(row?.avgBreaks20PlusPerMatch || 0).toFixed(2)} 筆 20+/場</div>
                                              </td>
                                              <td className="py-2 px-2 cue-muted">
                                                <div>{Number(row?.highestBreak || 0)}</div>
                                                <div className="text-xs cue-muted mt-1">20+ {Number(row?.breaks20Plus || 0)}</div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="text-sm cue-muted">尚未有對手分布統計。</div>
                                  )}
                                </div>
                              </div>

                              <div className="cue-surface rounded-lg p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                  <div>
                                    <div className="font-semibold">月份 / 輪次篩選</div>
                                    <div className="text-xs cue-muted mt-1">以下圖表與逐場/20+資料會跟隨篩選更新；上方總覽卡保留整個賽事總成績。</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTournamentParticipantMonthFilter('ALL');
                                      setTournamentParticipantRoundFilter('ALL');
                                    }}
                                    className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                                  >
                                    重設篩選
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <label className="block">
                                    <div className="text-xs cue-muted mb-1">月份</div>
                                    <select
                                      value={tournamentParticipantMonthFilter}
                                      onChange={(e) => setTournamentParticipantMonthFilter(e.target.value)}
                                      className="w-full rounded-lg cue-surface-strong px-3 py-2 text-sm"
                                    >
                                      <option value="ALL">全部月份</option>
                                      {tournamentParticipantFilterOptions.months.map((month: any) => (
                                        <option key={month} value={month}>{formatMonthFilterLabel(month)}</option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="block">
                                    <div className="text-xs cue-muted mb-1">輪次</div>
                                    <select
                                      value={tournamentParticipantRoundFilter}
                                      onChange={(e) => setTournamentParticipantRoundFilter(e.target.value)}
                                      className="w-full rounded-lg cue-surface-strong px-3 py-2 text-sm"
                                    >
                                      <option value="ALL">全部輪次</option>
                                      {tournamentParticipantFilterOptions.rounds.map((roundNo: any) => (
                                        <option key={roundNo} value={String(roundNo)}>{`第 ${roundNo} 輪`}</option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                                <div className="mt-3 text-xs cue-muted">
                                  篩選結果：{filteredTournamentParticipantMatches.length} 場賽事、{filteredTournamentParticipantBreaks.length} 筆 20+
                                </div>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-3">
                                <div className="cue-surface rounded-lg p-4">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="font-semibold">賽果分布</div>
                                    <div className="text-xs cue-muted">{filteredTournamentParticipantChartData.completedCount} 場</div>
                                  </div>
                                  <div className="space-y-3">
                                    {filteredTournamentParticipantChartData.resultCounts.map((row: any) => {
                                      const total = Math.max(1, filteredTournamentParticipantChartData.completedCount);
                                      const width = `${Math.max(row.count > 0 ? 12 : 0, (row.count / total) * 100)}%`;
                                      return (
                                        <div key={row.key}>
                                          <div className="flex items-center justify-between gap-3 text-sm mb-1">
                                            <span className="font-semibold">{row.label}</span>
                                            <span className="cue-muted">{row.count}</span>
                                          </div>
                                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                            <div className={`h-full rounded-full ${row.className}`} style={{ width }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="xl:col-span-2 cue-surface rounded-lg p-4">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="font-semibold">圖表化展示</div>
                                    <div className="text-xs cue-muted">每輪得分與 20+</div>
                                  </div>
                                  {filteredTournamentParticipantChartData.pointsTrend.length > 0 ? (
                                    <div className="space-y-3">
                                      {filteredTournamentParticipantChartData.pointsTrend.map((row: any) => (
                                        <div key={String(row?.id || Math.random())} className="cue-surface-strong rounded-lg p-3">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                              <div className="font-semibold truncate">{row.label} · {row.opponentLabel}</div>
                                              <div className="text-xs cue-muted mt-1">{row.resultLabel}</div>
                                            </div>
                                            <div className="text-xs cue-muted text-right">
                                              <div>得分 {row.totalPoints}</div>
                                              <div className="mt-1">20+ {row.breaks20Plus}</div>
                                            </div>
                                          </div>
                                          <div className="mt-3 space-y-2">
                                            <div>
                                              <div className="flex items-center justify-between gap-3 text-xs cue-muted mb-1">
                                                <span>得分</span>
                                                <span>{row.totalPoints}</span>
                                              </div>
                                              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                <div className="h-full rounded-full bg-amber-400" style={{ width: row.pointWidth }} />
                                              </div>
                                            </div>
                                            <div>
                                              <div className="flex items-center justify-between gap-3 text-xs cue-muted mb-1">
                                                <span>20+</span>
                                                <span>{row.breaks20Plus}</span>
                                              </div>
                                              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                <div className="h-full rounded-full bg-sky-400" style={{ width: row.breakWidth }} />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm cue-muted">所選月份 / 輪次尚未有已完成賽事可供展示。</div>
                                  )}
                                </div>
                              </div>

                              <div className="grid gap-4 xl:grid-cols-3">
                                <div className="xl:col-span-2 cue-surface rounded-lg p-4">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="font-semibold">{selectedTournamentParticipantFormat === 'LEAGUE' ? '逐場聯賽紀錄' : '逐場賽事紀錄'}</div>
                                    <div className="text-xs cue-muted">{filteredTournamentParticipantMatches.length} 場</div>
                                  </div>
                                  {filteredTournamentParticipantMatches.length > 0 ? (
                                    <div className="overflow-x-auto -mx-2 px-2">
                                      <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                          <tr className="cue-muted border-b cue-border">
                                            <th className="py-2 px-2">輪次</th>
                                            <th className="py-2 px-2">對手</th>
                                            <th className="py-2 px-2">賽果</th>
                                            <th className="py-2 px-2">總得分</th>
                                            <th className="py-2 px-2">單杆</th>
                                            <th className="py-2 px-2">20+</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredTournamentParticipantMatches.map((row: any) => (
                                            <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                                              <td className="py-2 px-2">
                                                <div className="font-semibold">{row?.roundLabel || '-'}</div>
                                                <div className="text-xs cue-muted mt-1">M{row?.matchNo || '-'}</div>
                                              </td>
                                              <td className="py-2 px-2 font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</td>
                                              <td className="py-2 px-2">
                                                <div className="font-semibold">{row?.resultLabel || '-'}</div>
                                                <div className="text-xs cue-muted mt-1">{Number(row?.framesWon || 0)} - {Number(row?.framesLost || 0)}</div>
                                              </td>
                                              <td className="py-2 px-2 cue-muted">
                                                {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                              </td>
                                              <td className="py-2 px-2 cue-muted">{Number(row?.maxBreak || 0)}</td>
                                              <td className="py-2 px-2 cue-muted">{Number(row?.breaks20Plus || 0)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="text-sm cue-muted">尚未有賽事紀錄。</div>
                                  )}
                                </div>

                                <div className="cue-surface rounded-lg p-4">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="font-semibold">20+ 詳細記錄</div>
                                    <div className="text-xs cue-muted">{filteredTournamentParticipantBreaks.length} 筆</div>
                                  </div>
                                  {filteredTournamentParticipantBreaks.length > 0 ? (
                                    <div className="space-y-2">
                                      {filteredTournamentParticipantBreaks.map((row: any) => (
                                        <div key={String(row?.id || Math.random())} className="cue-surface-strong rounded-lg p-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <div>
                                              <div className="font-semibold accent-yellow">{Number(row?.points || 0)}</div>
                                              <div className="text-xs cue-muted mt-1">
                                                {row?.roundLabel || '-'} · {row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}
                                              </div>
                                            </div>
                                            <div className="text-xs cue-muted">第 {Number(row?.frameNo || 0)} 局</div>
                                          </div>
                                          <div className="text-xs cue-muted mt-2">
                                            {row?.recordedAt ? new Date(String(row.recordedAt)).toLocaleString() : '未記錄時間'}
                                          </div>
                                          {String(row?.note || '').trim() ? (
                                            <div className="text-xs cue-muted mt-1 whitespace-pre-wrap">{String(row.note || '')}</div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm cue-muted">尚未記錄 20+。</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm cue-muted">暫無球手戰況數據。</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="cue-surface-strong rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="font-semibold">正式參賽名單</div>
                          <div className="text-xs cue-muted">{openedTournamentParticipants.length} 人</div>
                        </div>
                        {openedTournamentParticipants.length === 0 ? (
                          <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
                        ) : (
                          <div className="overflow-x-auto -mx-2 px-2">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="cue-muted border-b cue-border">
                                  <th className="py-2 px-2">Seed</th>
                                  <th className="py-2 px-2">球手</th>
                                  <th className="py-2 px-2">狀態</th>
                                  <th className="py-2 px-2">名次</th>
                                </tr>
                              </thead>
                              <tbody>
                                {openedTournamentParticipants.map((row: any) => (
                                  <tr
                                    key={String(row?.id || Math.random())}
                                    className="border-b cue-border hover:brightness-95 cursor-pointer"
                                    onClick={() => openTournamentParticipantPanel(row)}
                                  >
                                    <td className="py-2 px-2">{row?.seed || '-'}</td>
                                    <td className="py-2 px-2 font-semibold">
                                      <div>{formatTournamentParticipantLabel(row)}</div>
                                      <div className="text-xs cue-muted mt-1">查看個人戰況</div>
                                    </td>
                                    <td className="py-2 px-2 cue-muted">{String(row?.status || '-')}</td>
                                    <td className="py-2 px-2 cue-muted">{row?.final_rank || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {openedTournamentFormat === 'LEAGUE' ? (
                        <div className="cue-surface-strong rounded-lg p-4">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="font-semibold">League 積分榜</div>
                            <div className="text-xs cue-muted">{openedTournamentStandings.length} 人</div>
                          </div>
                          {openedTournamentStandings.length === 0 ? (
                            <div className="text-sm cue-muted">賽程生成後會在這裡顯示 standings</div>
                          ) : (
                            <div className="overflow-x-auto -mx-2 px-2">
                              <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                  <tr className="cue-muted border-b cue-border">
                                    <th className="py-2 px-2">名次</th>
                                    <th className="py-2 px-2">球手</th>
                                    <th className="py-2 px-2">賽</th>
                                    <th className="py-2 px-2">勝和負</th>
                                    <th className="py-2 px-2">局差</th>
                                    <th className="py-2 px-2">積分</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {openedTournamentStandings.map((row: any) => (
                                    <tr
                                      key={String(row?.participantId || Math.random())}
                                      className="border-b cue-border hover:brightness-95 cursor-pointer"
                                      onClick={() => openTournamentParticipantPanel(row?.participant)}
                                    >
                                      <td className="py-2 px-2 font-semibold">{row?.position || '-'}</td>
                                      <td className="py-2 px-2 font-semibold">
                                        <div>{formatTournamentParticipantLabel(row?.participant)}</div>
                                        <div className="text-xs cue-muted mt-1">查看個人戰況</div>
                                      </td>
                                      <td className="py-2 px-2 cue-muted">{Number(row?.played || 0)}</td>
                                      <td className="py-2 px-2 cue-muted">{Number(row?.won || 0)} / {Number(row?.drawn || 0)} / {Number(row?.lost || 0)}</td>
                                      <td className="py-2 px-2 cue-muted">{Number(row?.framesFor || 0)} - {Number(row?.framesAgainst || 0)} ({Number(row?.frameDiff || 0)})</td>
                                      <td className="py-2 px-2">{Number(row?.matchPoints || 0)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

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
          )}

          {tournamentSubmitModal.open && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
              <div className="w-full max-w-md cue-surface rounded-xl border cue-border p-4">
                <div className="font-extrabold text-lg">已提交報名</div>
                <div className="mt-2 text-sm cue-muted">
                  已提交至場館，等待確認。{tournamentSubmitModal.title ? `（${tournamentSubmitModal.title}）` : ''}
                </div>
                {String(tournamentSubmitModal.guide || '').trim() && (
                  <div className="mt-3 cue-surface-strong rounded-lg p-3">
                    <div className="font-semibold mb-1">報名指引 / 流程</div>
                    <div className="text-sm cue-muted whitespace-pre-wrap">{String(tournamentSubmitModal.guide || '')}</div>
                  </div>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 rounded cue-button font-semibold"
                    onClick={() => setTournamentSubmitModal({ open: false, title: '', guide: '' })}
                  >
                    知道了
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ClubPublicTournamentPanels;
