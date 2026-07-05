import React, { useMemo } from 'react';

type VenueTournamentLeagueStandingsPanelProps = {
  standingsRows: any[];
  formatParticipantLabel: (participant: any) => string;
};

const VenueTournamentLeagueStandingsPanel: React.FC<VenueTournamentLeagueStandingsPanelProps> = ({
  standingsRows,
  formatParticipantLabel,
}) => {
  const chartData = useMemo(() => {
    const rows = standingsRows.map((row: any) => {
      const played = Number(row?.played || 0);
      const won = Number(row?.won || 0);
      const drawn = Number(row?.drawn || 0);
      const lost = Number(row?.lost || 0);
      const matchPoints = Number(row?.matchPoints || 0);
      const frameDiff = Number(row?.frameDiff || 0);
      const breaks20Plus = Number(row?.breaks20Plus || 0);
      const maxBreak = Number(row?.maxBreak || 0);
      return {
        ...row,
        played,
        won,
        drawn,
        lost,
        matchPoints,
        frameDiff,
        breaks20Plus,
        maxBreak,
        label: formatParticipantLabel(row?.participant),
        winRate: played > 0 ? (won / played) * 100 : 0,
      };
    });

    const maxPoints = Math.max(1, ...rows.map((row: any) => row.matchPoints));
    const maxWinRate = Math.max(1, ...rows.map((row: any) => row.winRate));
    const maxBreaks20Plus = Math.max(1, ...rows.map((row: any) => row.breaks20Plus));
    const maxBreak = Math.max(1, ...rows.map((row: any) => row.maxBreak));
    const maxAbsFrameDiff = Math.max(1, ...rows.map((row: any) => Math.abs(row.frameDiff)));
    const leader = rows[0] || null;
    const bestWinRate = [...rows]
      .filter((row: any) => row.played > 0)
      .sort((a: any, b: any) => b.winRate - a.winRate || a.position - b.position)[0] || null;
    const bestFrameDiff = [...rows]
      .sort((a: any, b: any) => b.frameDiff - a.frameDiff || a.position - b.position)[0] || null;
    const bestBreak = [...rows]
      .sort((a: any, b: any) => b.maxBreak - a.maxBreak || b.breaks20Plus - a.breaks20Plus)[0] || null;

    return {
      rows,
      maxPoints,
      maxWinRate,
      maxBreaks20Plus,
      maxBreak,
      maxAbsFrameDiff,
      leader,
      bestWinRate,
      bestFrameDiff,
      bestBreak,
    };
  }, [formatParticipantLabel, standingsRows]);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold">League 積分榜</div>
        <div className="text-xs cue-muted">{standingsRows.length} 人</div>
      </div>
      {standingsRows.length === 0 ? (
        <div className="text-sm cue-muted">賽程生成後會在這裡顯示 standings</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted mb-1">榜首</div>
              <div className="font-semibold truncate">{chartData.leader?.label || '-'}</div>
              <div className="text-sm mt-1">{Number(chartData.leader?.matchPoints || 0)} 分</div>
              <div className="text-xs cue-muted mt-1">
                {Number(chartData.leader?.won || 0)} 勝 / {Number(chartData.leader?.drawn || 0)} 和 / {Number(chartData.leader?.lost || 0)} 負
              </div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted mb-1">最高勝率</div>
              <div className="font-semibold truncate">{chartData.bestWinRate?.label || '-'}</div>
              <div className="text-sm mt-1">{Number(chartData.bestWinRate?.winRate || 0).toFixed(1)}%</div>
              <div className="text-xs cue-muted mt-1">已賽 {Number(chartData.bestWinRate?.played || 0)} 場</div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted mb-1">最佳局差</div>
              <div className="font-semibold truncate">{chartData.bestFrameDiff?.label || '-'}</div>
              <div className="text-sm mt-1">
                {Number(chartData.bestFrameDiff?.frameDiff || 0) > 0 ? '+' : ''}{Number(chartData.bestFrameDiff?.frameDiff || 0)}
              </div>
              <div className="text-xs cue-muted mt-1">
                {Number(chartData.bestFrameDiff?.framesFor || 0)} - {Number(chartData.bestFrameDiff?.framesAgainst || 0)}
              </div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted mb-1">單杆表現</div>
              <div className="font-semibold truncate">{chartData.bestBreak?.label || '-'}</div>
              <div className="text-sm mt-1">最高單杆 {Number(chartData.bestBreak?.maxBreak || 0)}</div>
              <div className="text-xs cue-muted mt-1">20+ 次數 {Number(chartData.bestBreak?.breaks20Plus || 0)}</div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 mb-4">
            <div className="cue-surface rounded-lg p-3 xl:col-span-2">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="font-semibold">積分 / 局差圖</div>
                <div className="text-xs cue-muted">依目前積分榜排序</div>
              </div>
              <div className="space-y-3">
                {chartData.rows.map((row: any) => (
                  <div key={`points-${String(row?.participantId || '')}`}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <div className="min-w-0">
                        <span className="font-semibold mr-2">#{Number(row?.position || 0)}</span>
                        <span className="truncate">{row.label}</span>
                      </div>
                      <div className="text-xs cue-muted whitespace-nowrap">
                        {row.matchPoints} 分 · 局差 {row.frameDiff > 0 ? '+' : ''}{row.frameDiff}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.max(8, (row.matchPoints / chartData.maxPoints) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.frameDiff >= 0 ? 'bg-sky-400' : 'bg-rose-400'}`}
                        style={{ width: `${Math.max(6, (Math.abs(row.frameDiff) / chartData.maxAbsFrameDiff) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cue-surface rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="font-semibold">勝率圖</div>
                <div className="text-xs cue-muted">勝場 / 已賽</div>
              </div>
              <div className="space-y-3">
                {chartData.rows.map((row: any) => (
                  <div key={`winrate-${String(row?.participantId || '')}`}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <div className="truncate">{row.label}</div>
                      <div className="text-xs cue-muted whitespace-nowrap">{row.winRate.toFixed(1)}%</div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400"
                        style={{ width: `${Math.max(6, (row.winRate / chartData.maxWinRate) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="cue-surface rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="font-semibold">20+ / 最高單杆圖</div>
              <div className="text-xs cue-muted">Break 表現對比</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {chartData.rows.map((row: any) => (
                  <div key={`break20-${String(row?.participantId || '')}`}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <div className="truncate">{row.label}</div>
                      <div className="text-xs cue-muted whitespace-nowrap">20+ {row.breaks20Plus}</div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-fuchsia-400"
                        style={{ width: `${Math.max(4, (row.breaks20Plus / chartData.maxBreaks20Plus) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {chartData.rows.map((row: any) => (
                  <div key={`maxbreak-${String(row?.participantId || '')}`}>
                    <div className="flex items-center justify-between gap-2 text-sm mb-1">
                      <div className="truncate">{row.label}</div>
                      <div className="text-xs cue-muted whitespace-nowrap">最高單杆 {row.maxBreak}</div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{ width: `${Math.max(4, (row.maxBreak / chartData.maxBreak) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

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
        </>
      )}
    </div>
  );
};

export default VenueTournamentLeagueStandingsPanel;
