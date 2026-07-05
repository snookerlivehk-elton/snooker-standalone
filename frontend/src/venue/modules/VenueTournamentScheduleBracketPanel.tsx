import React, { useMemo, useState } from 'react';
import { formatKnockoutRoundLabel, formatLeagueRoundLabel } from './useTournamentStageViewData';

type VenueTournamentScheduleBracketPanelProps = {
  bracketColumns: any[];
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  formatDisplayDateTime: (value: any) => string;
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
  formatDisplayDateTime,
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
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING'>('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'SCORABLE' | 'UNFINISHED'>('ALL');
  const [focusedRoundLabel, setFocusedRoundLabel] = useState<string>('ALL');

  const formatMatchStatusLabel = (value: any) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return '已完成';
    if (normalized === 'LIVE') return '進行中';
    if (normalized === 'READY') return '就緒';
    if (normalized === 'PENDING') return '待定';
    return normalized || '-';
  };

  const getMatchStatusTone = (value: any) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    if (normalized === 'LIVE') return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    if (normalized === 'READY') return 'bg-sky-500/15 text-sky-300 border-sky-400/30';
    if (normalized === 'PENDING') return 'bg-white/5 text-slate-300 border-white/10';
    return 'bg-white/5 text-slate-300 border-white/10';
  };

  const buildMatchMeta = (row: any) => {
    const scheduledLabel = row?.scheduled_at ? formatDisplayDateTime(row?.scheduled_at) : '待定時間';
    const tableLabel = row?.table_no ? `球枱 ${row.table_no}` : '未編球枱';
    return `${scheduledLabel} · ${tableLabel}`;
  };

  const getBracketCardClassName = (row: any, canSelectMatch: boolean, selected: boolean) => {
    if (!canSelectMatch) return 'cue-border cue-surface-strong cue-muted cursor-not-allowed';
    const status = String(row?.status || '').trim().toUpperCase();
    if (selected) return 'border-yellow-400 bg-white/5 shadow-[0_0_0_1px_rgba(250,204,21,0.18)]';
    if (status === 'LIVE') return 'border-amber-400/70 bg-amber-500/10 hover:brightness-105';
    if (status === 'COMPLETED') return 'border-emerald-500/40 bg-emerald-500/5 hover:brightness-105';
    if (status === 'READY') return 'border-sky-500/40 bg-sky-500/5 hover:brightness-105';
    return 'cue-border cue-surface hover:brightness-95';
  };

  const matchesQuickFilter = (row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
    if (quickFilter === 'SCORABLE') return canRecordMatch;
    if (quickFilter === 'UNFINISHED') return status !== 'COMPLETED';
    return true;
  };

  const getRoundTheme = (label: string) => {
    if (label.includes('決賽')) {
      return {
        chipClassName: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30',
        cardClassName: 'border-yellow-400/35 bg-yellow-500/8',
        headerClassName: 'text-yellow-200',
      };
    }
    if (label.includes('4 強')) {
      return {
        chipClassName: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30',
        cardClassName: 'border-fuchsia-400/30 bg-fuchsia-500/8',
        headerClassName: 'text-fuchsia-200',
      };
    }
    if (label.includes('8 強')) {
      return {
        chipClassName: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
        cardClassName: 'border-sky-400/30 bg-sky-500/8',
        headerClassName: 'text-sky-200',
      };
    }
    if (label.includes('預賽')) {
      return {
        chipClassName: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
        cardClassName: 'border-slate-400/25 bg-slate-500/8',
        headerClassName: 'text-slate-100',
      };
    }
    return {
      chipClassName: 'bg-white/10 text-white border-white/15',
      cardClassName: 'cue-border cue-surface',
      headerClassName: 'text-white',
    };
  };

  const roundOptions = useMemo(() => bracketColumns.map((column: any) => String(column?.label || '')).filter(Boolean), [bracketColumns]);
  const effectiveFocusedRoundLabel = !isLeague && roundOptions.includes(focusedRoundLabel) ? focusedRoundLabel : 'ALL';

  const filteredMatchesRows = useMemo(() => {
    return matchesRows.filter((row: any) => {
      const status = String(row?.status || '').trim().toUpperCase();
      const statusOk = statusFilter === 'ALL' || status === statusFilter;
      if (!statusOk) return false;
      if (!matchesQuickFilter(row)) return false;
      if (isLeague || effectiveFocusedRoundLabel === 'ALL') return true;
      return formatKnockoutRoundLabel(row, participantsCount) === effectiveFocusedRoundLabel;
    });
  }, [effectiveFocusedRoundLabel, isLeague, matchesRows, participantsCount, quickFilter, statusFilter]);

  const filteredBracketColumns = useMemo(() => {
    return bracketColumns.map((column: any) => {
      const items = Array.isArray(column?.items)
        ? column.items.filter((row: any) => {
            const statusOk = statusFilter === 'ALL' || String(row?.status || '').trim().toUpperCase() === statusFilter;
            return statusOk && matchesQuickFilter(row);
          })
        : [];
      return {
        ...column,
        items,
        summary: {
          total: items.length,
          completedCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length,
          liveCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'LIVE').length,
          readyCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length,
          pendingCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length,
        },
      };
    });
  }, [bracketColumns, quickFilter, statusFilter]);

  const knockoutRoundCards = useMemo(() => {
    return filteredBracketColumns.map((column: any) => ({
      label: String(column?.label || ''),
      total: Number(column?.summary?.total || 0),
      liveCount: Number(column?.summary?.liveCount || 0),
      readyCount: Number(column?.summary?.readyCount || 0),
      completedCount: Number(column?.summary?.completedCount || 0),
      pendingCount: Number(column?.summary?.pendingCount || 0),
    }));
  }, [filteredBracketColumns]);

  const statusFilterOptions: Array<{ key: 'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING'; label: string }> = [
    { key: 'ALL', label: '全部狀態' },
    { key: 'LIVE', label: '進行中' },
    { key: 'READY', label: '就緒' },
    { key: 'COMPLETED', label: '已完成' },
    { key: 'PENDING', label: '待定' },
  ];
  const quickFilterOptions: Array<{ key: 'ALL' | 'SCORABLE' | 'UNFINISHED'; label: string }> = [
    { key: 'ALL', label: '全部對局' },
    { key: 'SCORABLE', label: '只看可記分對局' },
    { key: 'UNFINISHED', label: '只看未完成' },
  ];

  return (
    <>
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="font-semibold">{isLeague ? 'League 賽程' : 'Knockout 賽程'}</div>
      <div className="text-xs cue-muted">{matchesLoading ? '讀取中…' : `${filteredMatchesRows.length} / ${matchesRows.length} 場`}</div>
    </div>
    {matchesLoading ? (
      <div className="text-sm cue-muted">讀取中…</div>
    ) : matchesRows.length === 0 ? (
      <div className="text-sm cue-muted">尚未生成賽程</div>
    ) : (
      <>
        <div className="cue-surface rounded-lg p-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {quickFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setQuickFilter(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  quickFilter === option.key ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                }`}
              >
                {option.label}
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-white/10" />
            {statusFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === option.key ? 'bg-white/15 text-white border border-white/20' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                }`}
              >
                {option.label}
              </button>
            ))}
            {!isLeague ? (
              <>
                <div className="mx-1 h-4 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => setFocusedRoundLabel('ALL')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    effectiveFocusedRoundLabel === 'ALL' ? 'bg-white/15 text-white border border-white/20' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                  }`}
                >
                  全部輪次
                </button>
                {roundOptions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setFocusedRoundLabel(label)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      effectiveFocusedRoundLabel === label ? 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </>
            ) : null}
          </div>
          <div className="text-xs cue-muted mt-2">
            {!isLeague && effectiveFocusedRoundLabel !== 'ALL'
              ? `目前焦點：${effectiveFocusedRoundLabel} · `
              : ''}
            快捷篩選：{quickFilterOptions.find((option) => option.key === quickFilter)?.label || '全部對局'} · 
            狀態篩選：{statusFilterOptions.find((option) => option.key === statusFilter)?.label || '全部狀態'}
          </div>
        </div>
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
              const roundLabel = isLeague ? formatLeagueRoundLabel(row) : formatKnockoutRoundLabel(row, participantsCount);
              const roundTheme = getRoundTheme(roundLabel);
              const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
              const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
              return (
                <tr key={id} className={`border-b cue-border hover:brightness-95 ${selectedMatchId === id ? 'bg-white/5' : ''}`}>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${roundTheme.chipClassName}`}>{roundLabel}</div>
                    <div className="text-xs cue-muted mt-0.5">R{row?.round_no || '-'} / M{row?.match_no || '-'}</div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-semibold">{aLabel} vs {bLabel}</div>
                    <div className="text-xs cue-muted mt-1">{buildMatchMeta(row)}</div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getMatchStatusTone(row?.status)}`}>
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
      </>
    )}
    {!isLeague && matchesRows.length > 0 ? (
      <div className="mt-5">
        {knockoutRoundCards.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
            {knockoutRoundCards.map((column) => {
              const isFocused = effectiveFocusedRoundLabel === column.label;
              const isAll = effectiveFocusedRoundLabel === 'ALL';
              const roundTheme = getRoundTheme(column.label);
              return (
                <button
                  key={column.label}
                  type="button"
                  onClick={() => setFocusedRoundLabel(isFocused ? 'ALL' : column.label)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isFocused
                      ? `${roundTheme.cardClassName} shadow-[0_0_0_1px_rgba(255,255,255,0.06)]`
                      : isAll
                        ? 'cue-border cue-surface hover:brightness-105'
                        : 'cue-border cue-surface hover:brightness-105'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className={`font-semibold ${roundTheme.headerClassName}`}>{column.label}</div>
                    <div className="text-xs cue-muted">{column.total} 場</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs cue-muted">
                    <span>進行中 {column.liveCount}</span>
                    <span>就緒 {column.readyCount}</span>
                    <span>已完成 {column.completedCount}</span>
                    <span>待定 {column.pendingCount}</span>
                  </div>
                  <div className="text-[11px] cue-muted mt-2">
                    {isFocused ? '再按一次返回全部輪次' : '按一下聚焦此輪'}
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="font-semibold">Knockout Bracket Tree</div>
          <div className="text-xs cue-muted">
            {effectiveFocusedRoundLabel !== 'ALL' ? `焦點輪次：${effectiveFocusedRoundLabel}` : '按卡片可直接切換到該場對局記分'}
          </div>
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-12 min-w-max items-start pb-2">
            {filteredBracketColumns.map((column) => {
              const isFocusedColumn = effectiveFocusedRoundLabel === 'ALL' || effectiveFocusedRoundLabel === column.label;
              const roundTheme = getRoundTheme(String(column?.label || ''));
              return (
              <div key={column.label} className={`w-72 transition-opacity ${isFocusedColumn ? 'opacity-100' : 'opacity-35'}`}>
                <div className="mb-3 sticky left-0">
                  <div className={`font-semibold ${roundTheme.headerClassName}`}>{column.label}</div>
                  <div className="text-xs cue-muted mt-1">
                    {column.summary?.total || 0} 場
                    {Number(column.summary?.liveCount || 0) > 0 ? ` · 進行中 ${column.summary.liveCount}` : ''}
                    {Number(column.summary?.completedCount || 0) > 0 ? ` · 已完成 ${column.summary.completedCount}` : ''}
                  </div>
                </div>
                {column.items.length === 0 ? (
                  <div className="cue-surface-strong rounded-lg border cue-border p-3 text-sm cue-muted">此狀態篩選下沒有對局</div>
                ) : (
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
                            className={`relative z-10 h-full w-full text-left rounded-lg border p-3 transition-colors ${selectedMatchId === id ? `${getBracketCardClassName(row, canSelectMatch, true)} ${roundTheme.cardClassName}` : getBracketCardClassName(row, canSelectMatch, false)}`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                              <span>M{row?.match_no || '-'}</span>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${getMatchStatusTone(row?.status)}`}>
                                {formatMatchStatusLabel(row?.status)}
                              </span>
                            </div>
                            <div className="text-[11px] cue-muted mb-2">{buildMatchMeta(row)}</div>
                            <div className={`font-semibold truncate ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{aLabel}</div>
                            <div className="text-sm cue-muted my-1">
                              {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                            </div>
                            <div className={`font-semibold truncate ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{bLabel}</div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                              <span className="cue-muted">{resultTypeLabel}</span>
                              <span className="cue-muted truncate">{buildMatchProgressSummary(row, selectedTournamentBestOf)}</span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
              </div>
            );
            })}
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
};

export default VenueTournamentScheduleBracketPanel;
