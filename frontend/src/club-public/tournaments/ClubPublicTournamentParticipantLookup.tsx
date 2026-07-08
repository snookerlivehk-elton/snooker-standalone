import React from 'react';

type ClubPublicTournamentParticipantLookupProps = {
  openedTournamentParticipants: any[];
  tournamentParticipantSearchQuery: string;
  filteredOpenedTournamentParticipantSearchRows: any[];
  openedTournamentParticipantSearchRows: any[];
  tournamentParticipantOpen: any;
  setTournamentParticipantSearchQuery: (value: string) => void;
  openTournamentParticipantPanel: (row: any) => void;
};

const ClubPublicTournamentParticipantLookup: React.FC<ClubPublicTournamentParticipantLookupProps> = ({
  openedTournamentParticipants,
  tournamentParticipantSearchQuery,
  filteredOpenedTournamentParticipantSearchRows,
  openedTournamentParticipantSearchRows,
  tournamentParticipantOpen,
  setTournamentParticipantSearchQuery,
  openTournamentParticipantPanel,
}) => {
  return (
    <>
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
    </>
  );
};

export default ClubPublicTournamentParticipantLookup;
