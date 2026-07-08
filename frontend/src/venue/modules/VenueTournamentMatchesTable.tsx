import React from 'react';
import { formatKnockoutRoundLabel, formatLeagueRoundLabel } from './useTournamentStageViewData';

type VenueTournamentMatchesTableProps = {
  buildMatchMeta: (row: any) => string;
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  filteredMatchesRows: any[];
  formatMatchResultTypeLabel: (value: any) => string;
  formatMatchStatusLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  getMatchStatusTone: (value: any) => string;
  getRoundTheme: (label: string) => {
    chipClassName: string;
    cardClassName: string;
    headerClassName: string;
  };
  isLeague: boolean;
  participantsCount: number;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
  selectMatchForScoring: (row: any) => void;
};

const VenueTournamentMatchesTable: React.FC<VenueTournamentMatchesTableProps> = ({
  buildMatchMeta,
  buildMatchProgressSummary,
  filteredMatchesRows,
  formatMatchResultTypeLabel,
  formatMatchStatusLabel,
  formatParticipantLabel,
  getMatchStatusTone,
  getRoundTheme,
  isLeague,
  participantsCount,
  selectedMatchId,
  selectedTournamentBestOf,
  selectMatchForScoring,
}) => (
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
        {filteredMatchesRows.map((row: any) => {
          const id = String(row?.id || '');
          const aLabel = formatParticipantLabel(row?.player_a_participant);
          const bLabel = formatParticipantLabel(row?.player_b_participant);
          const roundLabel = isLeague
            ? formatLeagueRoundLabel(row)
            : formatKnockoutRoundLabel(row, participantsCount);
          const roundTheme = getRoundTheme(roundLabel);
          const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
          const canRecordMatch =
            !!row?.player_a_participant_id &&
            !!row?.player_b_participant_id &&
            String(row?.status || '').toUpperCase() !== 'PENDING';
          return (
            <tr
              key={id}
              className={`border-b cue-border hover:brightness-95 ${selectedMatchId === id ? 'bg-white/5' : ''}`}
            >
              <td className="py-2 px-2 whitespace-nowrap">
                <div
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${roundTheme.chipClassName}`}
                >
                  {roundLabel}
                </div>
                <div className="text-xs cue-muted mt-0.5">R{row?.round_no || '-'} / M{row?.match_no || '-'}</div>
              </td>
              <td className="py-2 px-2">
                <div className="font-semibold">
                  {aLabel} vs {bLabel}
                </div>
                <div className="text-xs cue-muted mt-1">{buildMatchMeta(row)}</div>
              </td>
              <td className="py-2 px-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getMatchStatusTone(row?.status)}`}
                  >
                    {formatMatchStatusLabel(row?.status)}
                  </span>
                  <span className="text-xs cue-muted">{resultTypeLabel}</span>
                </div>
                <div className="text-xs cue-muted mt-1">
                  比分 {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                </div>
              </td>
              <td className="py-2 px-2">
                <button
                  type="button"
                  disabled={!canRecordMatch}
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    canRecordMatch ? 'cue-surface hover:brightness-95' : 'cue-surface-strong cue-muted'
                  }`}
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
);

export default VenueTournamentMatchesTable;
