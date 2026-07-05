import React from 'react';

type VenueTournamentLeagueStandingsPanelProps = {
  standingsRows: any[];
  formatParticipantLabel: (participant: any) => string;
};

const VenueTournamentLeagueStandingsPanel: React.FC<VenueTournamentLeagueStandingsPanelProps> = ({
  standingsRows,
  formatParticipantLabel,
}) => (
  <div className="mb-4">
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="font-semibold">League 積分榜</div>
      <div className="text-xs cue-muted">{standingsRows.length} 人</div>
    </div>
    {standingsRows.length === 0 ? (
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
            {standingsRows.map((row: any) => (
              <tr key={String(row?.participantId || '')} className="border-b cue-border hover:brightness-95">
                <td className="py-2 px-2 font-semibold">{row?.position || '-'}</td>
                <td className="py-2 px-2 font-semibold">{formatParticipantLabel(row?.participant)}</td>
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
);

export default VenueTournamentLeagueStandingsPanel;
