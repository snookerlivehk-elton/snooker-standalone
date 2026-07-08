import React, { useEffect, useMemo, useState } from 'react';

type LeagueSchedulePanelProps = {
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  filteredLeagueRounds: any[];
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  selectMatchForScoring: (row: any) => void;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
};

const LeagueSchedulePanel: React.FC<LeagueSchedulePanelProps> = ({
  buildMatchProgressSummary,
  filteredLeagueRounds,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  selectMatchForScoring,
  selectedMatchId,
  selectedTournamentBestOf,
}) => {
  const formatMatchStatusLabel = (value: any) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return '已完成';
    if (normalized === 'LIVE') return '進行中';
    if (normalized === 'READY') return '就緒';
    if (normalized === 'PENDING') return '待定';
    return normalized || '-';
  };

  const getRoundTone = (round: any) => {
    const summary = round?.summary || {};
    if (Number(summary.liveCount || 0) > 0) {
      return {
        cardClassName: 'border-amber-400/30 bg-amber-500/10',
        chipClassName: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
      };
    }
    if (Number(summary.readyCount || 0) > 0) {
      return {
        cardClassName: 'border-sky-400/30 bg-sky-500/10',
        chipClassName: 'border-sky-400/30 bg-sky-500/15 text-sky-200',
      };
    }
    if (Number(summary.completedCount || 0) > 0 && Number(summary.completedCount || 0) === Number(summary.total || 0)) {
      return {
        cardClassName: 'border-emerald-400/25 bg-emerald-500/8',
        chipClassName: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
      };
    }
    return {
      cardClassName: 'cue-border cue-surface',
      chipClassName: 'border-white/15 bg-white/10 text-white',
    };
  };

  const selectedRoundLabel = useMemo(() => {
    const matchedRound = filteredLeagueRounds.find((round) => round.items.some((row: any) => String(row?.id || '') === selectedMatchId));
    return matchedRound?.label || '';
  }, [filteredLeagueRounds, selectedMatchId]);

  const defaultExpandedRoundLabel = useMemo(() => {
    if (selectedRoundLabel) return selectedRoundLabel;
    const preferredRound = filteredLeagueRounds.find((round) => Number(round?.summary?.liveCount || 0) > 0)
      || filteredLeagueRounds.find((round) => Number(round?.summary?.readyCount || 0) > 0)
      || filteredLeagueRounds.find((round) => Number(round?.summary?.completedCount || 0) < Number(round?.summary?.total || 0))
      || filteredLeagueRounds[0];
    return preferredRound?.label || '';
  }, [filteredLeagueRounds, selectedRoundLabel]);

  const [expandedRoundLabel, setExpandedRoundLabel] = useState(defaultExpandedRoundLabel);

  useEffect(() => {
    if (selectedRoundLabel) {
      setExpandedRoundLabel(selectedRoundLabel);
      return;
    }
    if (!expandedRoundLabel || !filteredLeagueRounds.some((round) => round.label === expandedRoundLabel)) {
      setExpandedRoundLabel(defaultExpandedRoundLabel);
    }
  }, [defaultExpandedRoundLabel, expandedRoundLabel, filteredLeagueRounds, selectedRoundLabel]);

  if (filteredLeagueRounds.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex flex-col gap-2 mb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-semibold">League Rounds</div>
          <div className="text-xs cue-muted mt-1">
            先看輪次摘要，再展開需要處理的輪次；按對局列可直接切換到該場記分。
          </div>
        </div>
        <div className="text-xs cue-muted">
          預設聚焦目前最需要處理的輪次，避免所有 rounds 同時鋪開。
        </div>
      </div>

      <div className="grid gap-2 mb-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredLeagueRounds.map((round) => {
          const tone = getRoundTone(round);
          const isExpanded = expandedRoundLabel === round.label;
          return (
            <button
              key={round.label}
              type="button"
              onClick={() => setExpandedRoundLabel(isExpanded ? '' : round.label)}
              className={`rounded-lg border p-3 text-left transition-colors hover:brightness-95 ${isExpanded ? tone.cardClassName : 'cue-border cue-surface'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{round.label}</div>
                  <div className="text-xs cue-muted mt-1">
                    {round.summary.total} 場
                    {round.summary.liveCount > 0 ? ` · 進行中 ${round.summary.liveCount}` : ''}
                    {round.summary.readyCount > 0 ? ` · 就緒 ${round.summary.readyCount}` : ''}
                    {round.summary.completedCount > 0 ? ` · 已完成 ${round.summary.completedCount}` : ''}
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isExpanded ? tone.chipClassName : 'border-white/10 bg-white/5 text-slate-200'}`}>
                  {isExpanded ? '已展開' : '展開輪次'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filteredLeagueRounds.map((round) => {
          const tone = getRoundTone(round);
          const isExpanded = expandedRoundLabel === round.label;
          return (
            <div key={round.label} className={`rounded-lg border ${isExpanded ? tone.cardClassName : 'cue-border cue-surface'}`}>
              <button
                type="button"
                onClick={() => setExpandedRoundLabel(isExpanded ? '' : round.label)}
                className="flex w-full items-start justify-between gap-3 p-3 text-left"
              >
                <div>
                  <div className="font-semibold">{round.label}</div>
                  <div className="text-xs cue-muted mt-1">
                    {round.summary.total} 場
                    {round.summary.liveCount > 0 ? ` · 進行中 ${round.summary.liveCount}` : ''}
                    {round.summary.readyCount > 0 ? ` · 就緒 ${round.summary.readyCount}` : ''}
                    {round.summary.completedCount > 0 ? ` · 已完成 ${round.summary.completedCount}` : ''}
                    {round.summary.pendingCount > 0 ? ` · 待定 ${round.summary.pendingCount}` : ''}
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${isExpanded ? tone.chipClassName : 'border-white/10 bg-white/5 text-slate-200'}`}>
                  {isExpanded ? '收合' : '查看對局'}
                </span>
              </button>

              {isExpanded ? (
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <div className="space-y-2">
                    {round.items.map((row: any) => {
                      const id = String(row?.id || '');
                      const status = String(row?.status || '').trim().toUpperCase();
                      const canSelectMatch =
                        !!row?.player_a_participant_id &&
                        !!row?.player_b_participant_id &&
                        status !== 'PENDING';
                      const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={!canSelectMatch}
                          onClick={() => {
                            if (!canSelectMatch) return;
                            selectMatchForScoring(row);
                          }}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            !canSelectMatch
                              ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed'
                              : selectedMatchId === id
                                ? 'border-yellow-400 bg-white/5 shadow-[0_0_0_1px_rgba(250,204,21,0.12)]'
                                : 'cue-border cue-surface hover:brightness-95'
                          }`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs cue-muted">
                                <span>M{row?.match_no || '-'}</span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                  {formatMatchStatusLabel(status)}
                                </span>
                                {resultTypeLabel !== '正常完賽' ? (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                                    {resultTypeLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 grid gap-1">
                                <div className="truncate font-semibold">{formatParticipantLabel(row?.player_a_participant)}</div>
                                <div className="truncate font-semibold">{formatParticipantLabel(row?.player_b_participant)}</div>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-lg border border-white/10 bg-black/10 px-4 py-2 text-center">
                              <div className="text-[11px] cue-muted">目前盤數</div>
                              <div className="mt-1 text-base font-semibold">
                                {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                              </div>
                            </div>

                            <div className="min-w-0 lg:w-72">
                              <div className="text-sm">{buildMatchProgressSummary(row, selectedTournamentBestOf)}</div>
                              <div className="mt-1 text-xs cue-muted">
                                {canSelectMatch ? '可直接切換到記分區繼續處理。' : '等待兩位球手落位後，這場才可開始記分。'}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeagueSchedulePanel;
