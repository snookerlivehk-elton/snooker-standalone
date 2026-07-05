import React from 'react';
import { formatKnockoutRoundLabel, formatLeagueRoundLabel } from './useTournamentStageViewData';

type VenueTournamentScheduleBracketPanelProps = {
  bracketColumns: any[];
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  isLeague: boolean;
  leagueRounds: any[];
  matchesLoading: boolean;
  matchesRows: any[];
  participantsCount: number;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
  selectMatchForScoring: (row: any) => void;
};

const VenueTournamentScheduleBracketPanel: React.FC<VenueTournamentScheduleBracketPanelProps> = ({
  bracketColumns,
  buildMatchProgressSummary,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  isLeague,
  leagueRounds,
  matchesLoading,
  matchesRows,
  participantsCount,
  selectedMatchId,
  selectedTournamentBestOf,
  selectMatchForScoring,
}) => (
  <>
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="font-semibold">{isLeague ? 'League 賽程' : 'Knockout 賽程'}</div>
      <div className="text-xs cue-muted">{matchesLoading ? '讀取中…' : `${matchesRows.length} 場`}</div>
    </div>
    {matchesLoading ? (
      <div className="text-sm cue-muted">讀取中…</div>
    ) : matchesRows.length === 0 ? (
      <div className="text-sm cue-muted">尚未生成賽程</div>
    ) : (
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="cue-muted border-b cue-border">
              <th className="py-2 px-2">輪次</th>
              <th className="py-2 px-2">對賽</th>
              <th className="py-2 px-2">狀態</th>
              <th className="py-2 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {matchesRows.map((row: any) => {
              const id = String(row?.id || '');
              const aLabel = formatParticipantLabel(row?.player_a_participant);
              const bLabel = formatParticipantLabel(row?.player_b_participant);
              const roundLabel = isLeague ? formatLeagueRoundLabel(row) : formatKnockoutRoundLabel(row, participantsCount);
              const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
              const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
              return (
                <tr key={id} className={`border-b cue-border hover:brightness-95 ${selectedMatchId === id ? 'bg-white/5' : ''}`}>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <div>{roundLabel}</div>
                    <div className="text-xs cue-muted mt-0.5">R{row?.round_no || '-'} / M{row?.match_no || '-'}</div>
                  </td>
                  <td className="py-2 px-2">{aLabel} vs {bLabel}</td>
                  <td className="py-2 px-2 cue-muted">
                    <div>{String(row?.status || '-')}</div>
                    <div className="text-xs mt-0.5">{resultTypeLabel}</div>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      disabled={!canRecordMatch}
                      className={`px-3 py-1 rounded text-sm font-semibold ${canRecordMatch ? 'cue-surface hover:brightness-95' : 'cue-surface-strong cue-muted'}`}
                      onClick={() => {
                        if (!canRecordMatch) return;
                        selectMatchForScoring(row);
                      }}
                    >
                      {!canRecordMatch ? '未就緒' : selectedMatchId === id ? '已選擇' : '記錄賽果'}
                    </button>
                    <div className="text-xs cue-muted mt-1">
                      {buildMatchProgressSummary(row, selectedTournamentBestOf)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
    {!isLeague && matchesRows.length > 0 ? (
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="font-semibold">Knockout Bracket Tree</div>
          <div className="text-xs cue-muted">按卡片可直接切換到該場對局記分</div>
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-12 min-w-max items-start pb-2">
            {bracketColumns.map((column) => (
              <div key={column.label} className="w-72">
                <div className="font-semibold mb-3 sticky left-0">{column.label}</div>
                <div
                  className="relative"
                  style={{
                    height: `${column.columnHeight}px`,
                    paddingTop: `${column.paddingTop}px`,
                  }}
                >
                  {column.connectors.map((connector: any, connectorIndex: number) => (
                    <React.Fragment key={`${column.label}-connector-${connectorIndex}`}>
                      <div
                        className="absolute border-t cue-border"
                        style={{
                          left: '100%',
                          top: `${connector.top}px`,
                          width: `${column.connectorHalfGap}px`,
                        }}
                      />
                      <div
                        className="absolute border-r cue-border"
                        style={{
                          left: `calc(100% + ${column.connectorHalfGap}px)`,
                          top: `${connector.top}px`,
                          height: `${connector.height}px`,
                        }}
                      />
                      <div
                        className="absolute border-t cue-border"
                        style={{
                          left: '100%',
                          top: `${connector.top + connector.height}px`,
                          width: `${column.connectorHalfGap}px`,
                        }}
                      />
                    </React.Fragment>
                  ))}
                  <div className="flex flex-col" style={{ gap: `${column.gap}px` }}>
                    {column.items.map((row: any) => {
                      const id = String(row?.id || '');
                      const aLabel = formatParticipantLabel(row?.player_a_participant);
                      const bLabel = formatParticipantLabel(row?.player_b_participant);
                      const winnerId = String(row?.winner_participant_id || '');
                      const aParticipantId = String(row?.player_a_participant_id || '');
                      const bParticipantId = String(row?.player_b_participant_id || '');
                      const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
                      const canSelectMatch = !!aParticipantId && !!bParticipantId && String(row?.status || '').toUpperCase() !== 'PENDING';
                      return (
                        <div key={id} className="relative" style={{ height: `${column.cardHeight}px` }}>
                          {column.roundIndex > 0 ? (
                            <div
                              className="absolute border-t cue-border"
                              style={{
                                right: '100%',
                                top: '50%',
                                width: `${column.connectorHalfGap}px`,
                              }}
                            />
                          ) : null}
                          {!column.isFinal ? (
                            <div
                              className="absolute border-t cue-border"
                              style={{
                                left: '100%',
                                top: '50%',
                                width: `${column.connectorHalfGap}px`,
                              }}
                            />
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (!canSelectMatch) return;
                              selectMatchForScoring(row);
                            }}
                            disabled={!canSelectMatch}
                            className={`relative z-10 h-full w-full text-left rounded-lg border p-3 transition-colors ${!canSelectMatch ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed' : selectedMatchId === id ? 'border-yellow-400 bg-white/5' : 'cue-border cue-surface hover:brightness-95'}`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                              <span>M{row?.match_no || '-'}</span>
                              <span>{resultTypeLabel}</span>
                            </div>
                            <div className={`font-semibold truncate ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{aLabel}</div>
                            <div className="text-xs cue-muted my-1">
                              {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                            </div>
                            <div className={`font-semibold truncate ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{bLabel}</div>
                            <div className="text-xs cue-muted mt-2">{buildMatchProgressSummary(row, selectedTournamentBestOf)}</div>
                          </button>
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
    {isLeague && leagueRounds.length > 0 ? (
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="font-semibold">League Rounds</div>
          <div className="text-xs cue-muted">依輪次排列，按卡片可直接切換到該場對局記分</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {leagueRounds.map((round) => (
            <div key={round.label} className="cue-surface rounded-lg p-3">
              <div className="font-semibold mb-2">{round.label}</div>
              <div className="grid gap-2">
                {round.items.map((row: any) => {
                  const id = String(row?.id || '');
                  const canSelectMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!canSelectMatch}
                      onClick={() => {
                        if (!canSelectMatch) return;
                        selectMatchForScoring(row);
                      }}
                      className={`w-full rounded-lg border p-3 text-left ${!canSelectMatch ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed' : selectedMatchId === id ? 'border-yellow-400 bg-white/5' : 'cue-border cue-surface hover:brightness-95'}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                        <span>M{row?.match_no || '-'}</span>
                        <span>{formatMatchResultTypeLabel(row?.result_type)}</span>
                      </div>
                      <div className="font-semibold truncate">{formatParticipantLabel(row?.player_a_participant)}</div>
                      <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                      <div className="font-semibold truncate">{formatParticipantLabel(row?.player_b_participant)}</div>
                      <div className="text-xs cue-muted mt-2">{buildMatchProgressSummary(row, selectedTournamentBestOf)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </>
);

export default VenueTournamentScheduleBracketPanel;
