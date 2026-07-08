import React from 'react';
import ClubPublicTournamentParticipantPanel from './ClubPublicTournamentParticipantPanel';
import ClubPublicTournamentOverviewSection from './ClubPublicTournamentOverviewSection';
import ClubPublicTournamentLiveSection from './ClubPublicTournamentLiveSection';
import ClubPublicTournamentStageSection from './ClubPublicTournamentStageSection';

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
            <ClubPublicTournamentOverviewSection
              openedTournament={openedTournament}
              openedTournamentFormat={openedTournamentFormat}
              openedTournamentParticipants={openedTournamentParticipants}
              openedTournamentMatches={openedTournamentMatches}
              formatTournamentFormatLabel={formatTournamentFormatLabel}
              formatTournamentWorkflowLabel={formatTournamentWorkflowLabel}
              formatTournamentParticipantLabel={formatTournamentParticipantLabel}
            />

            <ClubPublicTournamentLiveSection
              openedTournament={openedTournament}
              openedTournamentFormat={openedTournamentFormat}
              openedTournamentParticipants={openedTournamentParticipants}
              openedTournamentMatches={openedTournamentMatches}
              openedTournamentLiveMatches={openedTournamentLiveMatches}
              openedTournamentReadyMatches={openedTournamentReadyMatches}
              openedTournamentRecentCompletedMatches={openedTournamentRecentCompletedMatches}
              buildPublicTournamentBreakSummary={buildPublicTournamentBreakSummary}
              formatPublicTournamentStageLabel={formatPublicTournamentStageLabel}
              buildPublicTournamentLiveProgressLabel={buildPublicTournamentLiveProgressLabel}
              formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
              formatTournamentParticipantLabel={formatTournamentParticipantLabel}
            />

            <ClubPublicTournamentParticipantPanel {...participantPanelProps} />

            <ClubPublicTournamentStageSection
              openedTournamentFormat={openedTournamentFormat}
              openedTournamentParticipants={openedTournamentParticipants}
              openedTournamentMatches={openedTournamentMatches}
              openedTournamentBracketColumns={openedTournamentBracketColumns}
              openedTournamentLeagueRounds={openedTournamentLeagueRounds}
              formatTournamentParticipantLabel={formatTournamentParticipantLabel}
              formatTournamentResultTypeLabel={formatTournamentResultTypeLabel}
              formatPublicKnockoutRoundLabel={formatPublicKnockoutRoundLabel}
              formatTournamentMatchStatusLabel={formatTournamentMatchStatusLabel}
              PUBLIC_BRACKET_CONNECTOR_HALF_GAP={PUBLIC_BRACKET_CONNECTOR_HALF_GAP}
              PUBLIC_BRACKET_CARD_HEIGHT={PUBLIC_BRACKET_CARD_HEIGHT}
            />
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
