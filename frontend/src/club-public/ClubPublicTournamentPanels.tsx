import React from 'react';
import ClubPublicTournamentLiveBoard from './tournaments/ClubPublicTournamentLiveBoard';
import ClubPublicTournamentDetailModal from './tournaments/ClubPublicTournamentDetailModal';

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
        <ClubPublicTournamentLiveBoard
          tournamentLiveBoardLoading={tournamentLiveBoardLoading}
          tournamentLiveBoard={tournamentLiveBoard}
          tournamentLiveBoardError={tournamentLiveBoardError}
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
        />
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

          <ClubPublicTournamentDetailModal
            tournamentOpen={tournamentOpen}
            openedTournament={openedTournament}
            tournamentDetailLoading={tournamentDetailLoading}
            tournamentDetailError={tournamentDetailError}
            openedTournamentFormat={openedTournamentFormat}
            openedTournamentParticipants={openedTournamentParticipants}
            openedTournamentMatches={openedTournamentMatches}
            openedTournamentLiveMatches={openedTournamentLiveMatches}
            openedTournamentReadyMatches={openedTournamentReadyMatches}
            openedTournamentRecentCompletedMatches={openedTournamentRecentCompletedMatches}
            openedTournamentStandings={openedTournamentStandings}
            openedTournamentBracketColumns={openedTournamentBracketColumns}
            openedTournamentLeagueRounds={openedTournamentLeagueRounds}
            tournamentOpenLoading={tournamentOpenLoading}
            setTournamentOpen={setTournamentOpen}
            handleTournamentSignup={handleTournamentSignup}
            formatTournamentFormatLabel={formatTournamentFormatLabel}
            formatTournamentWorkflowLabel={formatTournamentWorkflowLabel}
            buildPublicTournamentBreakSummary={buildPublicTournamentBreakSummary}
            formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
            buildPublicTournamentLiveProgressLabel={buildPublicTournamentLiveProgressLabel}
            formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
            formatTournamentParticipantLabel={formatTournamentParticipantLabel}
            formatTournamentResultTypeLabel={formatTournamentResultTypeLabel}
            formatPublicKnockoutRoundLabel={formatPublicKnockoutRoundLabel}
            PUBLIC_BRACKET_CONNECTOR_HALF_GAP={PUBLIC_BRACKET_CONNECTOR_HALF_GAP}
            PUBLIC_BRACKET_CARD_HEIGHT={PUBLIC_BRACKET_CARD_HEIGHT}
            participantPanelProps={{
              openedTournament,
              openedTournamentParticipants,
              openedTournamentStandings,
              openedTournamentFormat,
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
              setTournamentParticipantSearchQuery,
              openTournamentParticipantPanel,
              setTournamentParticipantOpen,
              setTournamentParticipantMonthFilter,
              setTournamentParticipantRoundFilter,
              formatTournamentParticipantLabel,
              formatMonthFilterLabel,
              panelRef: tournamentParticipantPanelRef,
            }}
          />

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
