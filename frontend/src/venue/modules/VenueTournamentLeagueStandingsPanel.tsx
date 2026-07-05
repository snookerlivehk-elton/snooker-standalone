import React, { useMemo, useState } from 'react';

type VenueTournamentLeagueStandingsPanelProps = {
  matchesRows: any[];
  pointsDraw: number;
  pointsLoss: number;
  pointsWin: number;
  standingsRows: any[];
  formatParticipantLabel: (participant: any) => string;
};

const VenueTournamentLeagueStandingsPanel: React.FC<VenueTournamentLeagueStandingsPanelProps> = ({
  matchesRows,
  pointsDraw,
  pointsLoss,
  pointsWin,
  standingsRows,
  formatParticipantLabel,
}) => {
  const [dimensionMode, setDimensionMode] = useState<'ALL' | 'MONTH' | 'ROUND'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedRound, setSelectedRound] = useState<string>('ALL');

  const getMatchMonthKey = (row: any) => {
    const raw = row?.ended_at || row?.started_at || row?.scheduled_at || null;
    if (!raw) return '';
    const date = new Date(String(raw));
    if (!Number.isFinite(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const formatMonthLabel = (value: string) => {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(text)) return text || '全部月份';
    return `${text.slice(0, 4)}年${text.slice(5, 7)}月`;
  };

  const createParticipantSeedMap = () => {
    const participantMap = new Map<string, any>();
    for (const row of normalizedOverallRows) {
      const participantId = String(row?.participantId || '');
      if (!participantId) continue;
      participantMap.set(participantId, {
        participantId,
        participant: row?.participant || null,
        label: row?.label || '-',
        seed: Number(row?.seed || row?.participant?.seed || 0),
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        matchPoints: 0,
        framesFor: 0,
        framesAgainst: 0,
        frameDiff: 0,
        breaks20Plus: 0,
        maxBreak: 0,
      });
    }

    for (const match of matchesRows) {
      const seeds = [
        {
          participantId: String(match?.player_a_participant_id || ''),
          participant: match?.player_a_participant || null,
        },
        {
          participantId: String(match?.player_b_participant_id || ''),
          participant: match?.player_b_participant || null,
        },
      ];
      for (const seed of seeds) {
        if (!seed.participantId || participantMap.has(seed.participantId)) continue;
        participantMap.set(seed.participantId, {
          participantId: seed.participantId,
          participant: seed.participant,
          label: formatParticipantLabel(seed.participant),
          seed: Number(seed?.participant?.seed || 0),
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          matchPoints: 0,
          framesFor: 0,
          framesAgainst: 0,
          frameDiff: 0,
          breaks20Plus: 0,
          maxBreak: 0,
        });
      }
    }
    return participantMap;
  };

  const buildStandingsFromMatches = (sourceMatches: any[]) => {
    const participantMap = createParticipantSeedMap();
    for (const match of sourceMatches) {
      const aId = String(match?.player_a_participant_id || '');
      const bId = String(match?.player_b_participant_id || '');
      if (!aId || !bId) continue;
      const a = participantMap.get(aId);
      const b = participantMap.get(bId);
      if (!a || !b) continue;
      const aFrames = Number(match?.player_a_frames_won || 0);
      const bFrames = Number(match?.player_b_frames_won || 0);
      const aBreaks20Plus = Number(match?.player_a_20_plus_count || 0);
      const bBreaks20Plus = Number(match?.player_b_20_plus_count || 0);
      const aMaxBreak = Number(match?.player_a_max_break || 0);
      const bMaxBreak = Number(match?.player_b_max_break || 0);
      const winnerParticipantId = String(match?.winner_participant_id || '');

      a.played += 1;
      b.played += 1;
      a.framesFor += aFrames;
      a.framesAgainst += bFrames;
      b.framesFor += bFrames;
      b.framesAgainst += aFrames;
      a.breaks20Plus += aBreaks20Plus;
      b.breaks20Plus += bBreaks20Plus;
      a.maxBreak = Math.max(a.maxBreak, aMaxBreak);
      b.maxBreak = Math.max(b.maxBreak, bMaxBreak);

      if (winnerParticipantId && winnerParticipantId === aId) {
        a.won += 1;
        b.lost += 1;
        a.matchPoints += Math.max(0, Number(pointsWin || 0));
        b.matchPoints += Math.max(0, Number(pointsLoss || 0));
      } else if (winnerParticipantId && winnerParticipantId === bId) {
        b.won += 1;
        a.lost += 1;
        b.matchPoints += Math.max(0, Number(pointsWin || 0));
        a.matchPoints += Math.max(0, Number(pointsLoss || 0));
      } else {
        a.drawn += 1;
        b.drawn += 1;
        a.matchPoints += Math.max(0, Number(pointsDraw || 0));
        b.matchPoints += Math.max(0, Number(pointsDraw || 0));
      }
    }

    return Array.from(participantMap.values())
      .map((row: any) => ({
        ...row,
        frameDiff: row.framesFor - row.framesAgainst,
        winRate: row.played > 0 ? (row.won / row.played) * 100 : 0,
      }))
      .sort((a: any, b: any) => {
        if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
        if (b.frameDiff !== a.frameDiff) return b.frameDiff - a.frameDiff;
        if (b.framesFor !== a.framesFor) return b.framesFor - a.framesFor;
        if (b.breaks20Plus !== a.breaks20Plus) return b.breaks20Plus - a.breaks20Plus;
        if (b.maxBreak !== a.maxBreak) return b.maxBreak - a.maxBreak;
        return String(a?.label || '').localeCompare(String(b?.label || ''));
      })
      .map((row: any, index: number) => ({
        ...row,
        position: index + 1,
      }));
  };

  const normalizedOverallRows = useMemo(() => {
    return standingsRows.map((row: any) => {
      const played = Number(row?.played || 0);
      const won = Number(row?.won || 0);
      const drawn = Number(row?.drawn || 0);
      const lost = Number(row?.lost || 0);
      const matchPoints = Number(row?.matchPoints || 0);
      const framesFor = Number(row?.framesFor || 0);
      const framesAgainst = Number(row?.framesAgainst || 0);
      const frameDiff = Number(row?.frameDiff || 0);
      const breaks20Plus = Number(row?.breaks20Plus || 0);
      const maxBreak = Number(row?.maxBreak || 0);
      return {
        ...row,
        participantId: String(row?.participantId || ''),
        played,
        won,
        drawn,
        lost,
        matchPoints,
        framesFor,
        framesAgainst,
        frameDiff,
        breaks20Plus,
        maxBreak,
        label: formatParticipantLabel(row?.participant),
        winRate: played > 0 ? (won / played) * 100 : 0,
      };
    });
  }, [formatParticipantLabel, standingsRows]);

  const dimensionOptions = [
    { key: 'ALL' as const, label: '全部' },
    { key: 'MONTH' as const, label: '月份' },
    { key: 'ROUND' as const, label: '輪次' },
  ];

  const monthOptions = useMemo(() => {
    return Array.from(new Set<string>(
      matchesRows
        .map((row: any) => getMatchMonthKey(row))
        .filter((value: string) => !!value),
    )).sort((a, b) => String(b).localeCompare(String(a)));
  }, [matchesRows]);

  const roundOptions = useMemo(() => {
    return Array.from(new Set<number>(
      matchesRows
        .map((row: any) => Number(row?.round_no || 0))
        .filter((value: number) => Number.isFinite(value) && value > 0),
    )).sort((a, b) => a - b);
  }, [matchesRows]);

  const effectiveMonth = monthOptions.includes(selectedMonth) ? selectedMonth : (monthOptions[0] || 'ALL');
  const effectiveRound = roundOptions.includes(Number(selectedRound)) ? selectedRound : (roundOptions[0] != null ? String(roundOptions[0]) : 'ALL');

  const scopedCompletedMatches = useMemo(() => {
    return matchesRows
      .filter((match: any) => {
        const status = String(match?.status || '').trim().toUpperCase();
        if (status !== 'COMPLETED') return false;
        if (dimensionMode === 'MONTH') return getMatchMonthKey(match) === effectiveMonth;
        if (dimensionMode === 'ROUND') return String(Number(match?.round_no || 0)) === effectiveRound;
        return true;
      })
      .slice()
      .sort((a: any, b: any) => {
        const roundDiff = Number(a?.round_no || 0) - Number(b?.round_no || 0);
        if (roundDiff !== 0) return roundDiff;
        return Number(a?.match_no || 0) - Number(b?.match_no || 0);
      });
  }, [dimensionMode, effectiveMonth, effectiveRound, matchesRows]);

  const scopedStandingsRows = useMemo(() => {
    if (dimensionMode === 'ALL') return normalizedOverallRows;
    return buildStandingsFromMatches(scopedCompletedMatches);
  }, [buildStandingsFromMatches, dimensionMode, normalizedOverallRows, scopedCompletedMatches]);

  const activeDimensionLabel = useMemo(() => {
    if (dimensionMode === 'MONTH') return formatMonthLabel(effectiveMonth);
    if (dimensionMode === 'ROUND') return effectiveRound === 'ALL' ? '全部輪次' : `第 ${effectiveRound} 輪`;
    return '整個聯賽';
  }, [dimensionMode, effectiveMonth, effectiveRound]);

  const chartData = useMemo(() => {
    const rows = scopedStandingsRows;

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
  }, [scopedStandingsRows]);

  const rankingTrend = useMemo(() => {
    if (dimensionMode === 'ROUND') {
      return {
        available: false,
        message: '單輪次只會顯示該輪 standings；如要看排名走勢，請切換到「全部」或「月份」。',
        rounds: [],
        series: [],
        maxRank: Math.max(2, scopedStandingsRows.length),
      };
    }

    const groupedRounds = Array.from(new Set<number>(
      scopedCompletedMatches
        .map((match: any) => Number(match?.round_no || 0))
        .filter((round: number) => Number.isFinite(round) && round > 0),
    )).sort((a, b) => a - b);

    if (groupedRounds.length === 0) {
      return {
        available: false,
        message: '暫時未有已完成對局，未能生成排名趨勢。',
        rounds: [],
        series: [],
        maxRank: Math.max(2, scopedStandingsRows.length),
      };
    }

    const snapshots = groupedRounds.map((roundNo) => {
      const cumulativeMatches = scopedCompletedMatches.filter((match: any) => Number(match?.round_no || 0) <= roundNo);
      const standings = buildStandingsFromMatches(cumulativeMatches);
      const rankMap = new Map<string, number>();
      standings.forEach((row: any) => {
        rankMap.set(String(row?.participantId || ''), Number(row?.position || 0));
      });
      return {
        roundNo,
        label: `R${roundNo}`,
        standings,
        rankMap,
      };
    });

    const displayRows = scopedStandingsRows
      .filter((row: any) => Number(row?.played || 0) > 0)
      .slice(0, 6);

    const palette = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#fb7185'];
    const maxRank = Math.max(2, ...snapshots.flatMap((snapshot) => Array.from(snapshot.rankMap.values())));
    const series = displayRows.map((row: any, index: number) => {
      const positions = snapshots.map((snapshot) => {
        const rank = Number(snapshot.rankMap.get(String(row?.participantId || '')) || 0);
        return {
          roundNo: snapshot.roundNo,
          label: snapshot.label,
          rank,
        };
      }).filter((point) => point.rank > 0);
      const firstRank = positions[0]?.rank ?? null;
      const latestRank = positions[positions.length - 1]?.rank ?? null;
      return {
        participantId: String(row?.participantId || ''),
        label: row?.label || '-',
        color: palette[index % palette.length],
        currentRank: Number(row?.position || 0),
        netChange:
          firstRank != null && latestRank != null
            ? firstRank - latestRank
            : 0,
        positions,
      };
    }).filter((row: any) => row.positions.length > 0);

    return {
      available: series.length > 0,
      message: series.length > 0 ? null : '暫時未有足夠輪次資料生成排名走勢。',
      rounds: snapshots.map((snapshot) => ({ roundNo: snapshot.roundNo, label: snapshot.label })),
      series,
      maxRank,
    };
  }, [buildStandingsFromMatches, dimensionMode, scopedCompletedMatches, scopedStandingsRows]);

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
          <div className="cue-surface rounded-lg p-3 mb-4">
            <div className="flex flex-wrap items-center gap-2">
              {dimensionOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDimensionMode(option.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    dimensionMode === option.key
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {dimensionMode === 'MONTH' ? (
                <select
                  value={effectiveMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs"
                >
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              ) : null}
              {dimensionMode === 'ROUND' ? (
                <select
                  value={effectiveRound}
                  onChange={(e) => setSelectedRound(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded px-3 py-1.5 text-xs"
                >
                  {roundOptions.map((round) => (
                    <option key={round} value={String(round)}>
                      第 {round} 輪
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="text-xs cue-muted mt-2">
              目前維度：{activeDimensionLabel}
              {dimensionMode !== 'ALL' ? ' · 會即時重算該維度 standings 與圖表' : ' · 顯示整個聯賽 standings'}
            </div>
          </div>

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
                <div className="text-xs cue-muted">{activeDimensionLabel}</div>
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
                <div className="text-xs cue-muted">{activeDimensionLabel}</div>
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
              <div className="text-xs cue-muted">{activeDimensionLabel}</div>
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

          <div className="cue-surface rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="font-semibold">排名趨勢圖</div>
              <div className="text-xs cue-muted">
                {dimensionMode === 'MONTH' ? `${activeDimensionLabel} 內各輪後排名` : '各輪完成後的累積排名'}
              </div>
            </div>
            {!rankingTrend.available ? (
              <div className="text-sm cue-muted">{rankingTrend.message}</div>
            ) : (
              <>
                <div className="overflow-x-auto pb-2">
                  <svg
                    width={Math.max(520, rankingTrend.rounds.length * 90)}
                    height={Math.max(240, rankingTrend.maxRank * 34 + 36)}
                    viewBox={`0 0 ${Math.max(520, rankingTrend.rounds.length * 90)} ${Math.max(240, rankingTrend.maxRank * 34 + 36)}`}
                    className="w-full min-w-[520px]"
                    role="img"
                    aria-label="聯賽排名趨勢圖"
                  >
                    {rankingTrend.rounds.map((round: any, index: number) => {
                      const x = 76 + (index * ((Math.max(520, rankingTrend.rounds.length * 90) - 124) / Math.max(1, rankingTrend.rounds.length - 1)));
                      return (
                        <g key={`round-axis-${round.roundNo}`}>
                          <line x1={x} y1={24} x2={x} y2={rankingTrend.maxRank * 34 + 4} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
                          <text x={x} y={rankingTrend.maxRank * 34 + 24} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle">
                            {round.label}
                          </text>
                        </g>
                      );
                    })}
                    {Array.from({ length: rankingTrend.maxRank }, (_, index) => index + 1).map((rank) => {
                      const y = 24 + ((rank - 1) * ((rankingTrend.maxRank * 34 - 20) / Math.max(1, rankingTrend.maxRank - 1)));
                      return (
                        <g key={`rank-axis-${rank}`}>
                          <line x1={56} y1={y} x2={Math.max(520, rankingTrend.rounds.length * 90) - 36} y2={y} stroke="rgba(255,255,255,0.06)" />
                          <text x={24} y={y + 4} fill="rgba(255,255,255,0.65)" fontSize="11" textAnchor="middle">
                            #{rank}
                          </text>
                        </g>
                      );
                    })}
                    {rankingTrend.series.map((row: any) => {
                      const points = row.positions.map((point: any, index: number) => {
                        const x = 76 + (index * ((Math.max(520, rankingTrend.rounds.length * 90) - 124) / Math.max(1, rankingTrend.rounds.length - 1)));
                        const y = 24 + ((point.rank - 1) * ((rankingTrend.maxRank * 34 - 20) / Math.max(1, rankingTrend.maxRank - 1)));
                        return `${x},${y}`;
                      }).join(' ');
                      return (
                        <g key={`trend-series-${row.participantId}`}>
                          <polyline
                            fill="none"
                            stroke={row.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                          />
                          {row.positions.map((point: any, index: number) => {
                            const x = 76 + (index * ((Math.max(520, rankingTrend.rounds.length * 90) - 124) / Math.max(1, rankingTrend.rounds.length - 1)));
                            const y = 24 + ((point.rank - 1) * ((rankingTrend.maxRank * 34 - 20) / Math.max(1, rankingTrend.maxRank - 1)));
                            return (
                              <g key={`trend-point-${row.participantId}-${point.roundNo}`}>
                                <circle cx={x} cy={y} r="5" fill={row.color} />
                                <text x={x} y={y - 10} fill={row.color} fontSize="10" textAnchor="middle">
                                  {point.rank}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 mt-3">
                  {rankingTrend.series.map((row: any) => (
                    <div key={`trend-legend-${row.participantId}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                          <span className="truncate text-sm font-semibold">{row.label}</span>
                        </div>
                        <div className="text-xs cue-muted whitespace-nowrap">現時 #{row.currentRank}</div>
                      </div>
                      <div className="text-xs cue-muted mt-1">
                        走勢 {row.positions.map((point: any) => `R${point.roundNo}: #${point.rank}`).join(' -> ')}
                      </div>
                      <div className="text-xs mt-1">
                        淨變化 {row.netChange > 0 ? `+${row.netChange}` : String(row.netChange)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
                {chartData.rows.map((row: any) => (
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
