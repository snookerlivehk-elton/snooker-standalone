import React from 'react';

type VenueTournamentLeagueParticipantsPanelProps = {
  formatFinalRankLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  formatParticipantStatusLabel: (value: any) => string;
  participantsLoading: boolean;
  participantsRows: any[];
};

const VenueTournamentLeagueParticipantsPanel: React.FC<VenueTournamentLeagueParticipantsPanelProps> = ({
  formatFinalRankLabel,
  formatParticipantLabel,
  formatParticipantStatusLabel,
  participantsLoading,
  participantsRows,
}) => (
  <div>
    <div className="flex flex-col gap-2 mb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold">正式參賽名單</div>
        <div className="text-xs cue-muted">{participantsLoading ? '讀取中…' : `${participantsRows.length} 人`}</div>
      </div>
      <div className="text-xs cue-muted">
        聯賽模式工作台不使用 seed 排位；round-robin 對戰會按正式名單自動配對。
      </div>
    </div>
    {participantsLoading ? (
      <div className="text-sm cue-muted">讀取中…</div>
    ) : participantsRows.length === 0 ? (
      <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
    ) : (
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="cue-muted border-b cue-border">
              <th className="py-2 px-2">#</th>
              <th className="py-2 px-2">球手</th>
              <th className="py-2 px-2">狀態</th>
              <th className="py-2 px-2">名次</th>
            </tr>
          </thead>
          <tbody>
            {participantsRows.map((row: any, index) => (
              <tr key={String(row?.id || index)} className="border-b cue-border hover:brightness-95">
                <td className="py-2 px-2 cue-muted">{index + 1}</td>
                <td className="py-2 px-2 font-semibold">{formatParticipantLabel(row)}</td>
                <td className="py-2 px-2 cue-muted">{formatParticipantStatusLabel(row?.status)}</td>
                <td className="py-2 px-2 cue-muted">{formatFinalRankLabel(row?.final_rank)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default VenueTournamentLeagueParticipantsPanel;
