import React from 'react';

export type MatchStatusFilterKey = 'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING';
export type MatchQuickFilterKey = 'ALL' | 'SCORABLE' | 'UNFINISHED';

type VenueTournamentMatchesFiltersProps = {
  effectiveFocusedRoundLabel: string;
  isLeague: boolean;
  quickFilter: MatchQuickFilterKey;
  quickFilterOptions: Array<{ key: MatchQuickFilterKey; label: string }>;
  roundOptions: string[];
  setFocusedRoundLabel: (value: string) => void;
  setQuickFilter: (value: MatchQuickFilterKey) => void;
  setStatusFilter: (value: MatchStatusFilterKey) => void;
  statusFilter: MatchStatusFilterKey;
  statusFilterOptions: Array<{ key: MatchStatusFilterKey; label: string }>;
};

const VenueTournamentMatchesFilters: React.FC<VenueTournamentMatchesFiltersProps> = ({
  effectiveFocusedRoundLabel,
  isLeague,
  quickFilter,
  quickFilterOptions,
  roundOptions,
  setFocusedRoundLabel,
  setQuickFilter,
  setStatusFilter,
  statusFilter,
  statusFilterOptions,
}) => (
  <div className="cue-surface rounded-lg p-3 mb-3">
    <div className="flex flex-wrap items-center gap-2">
      {quickFilterOptions.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setQuickFilter(option.key)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            quickFilter === option.key
              ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30'
              : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
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
            statusFilter === option.key
              ? 'bg-white/15 text-white border border-white/20'
              : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
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
              effectiveFocusedRoundLabel === 'ALL'
                ? 'bg-white/15 text-white border border-white/20'
                : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
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
                effectiveFocusedRoundLabel === label
                  ? 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30'
                  : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
              }`}
            >
              {label}
            </button>
          ))}
        </>
      ) : null}
    </div>
    <div className="text-xs cue-muted mt-2">
      {!isLeague && effectiveFocusedRoundLabel !== 'ALL' ? `目前焦點：${effectiveFocusedRoundLabel} · ` : ''}
      快捷篩選：{quickFilterOptions.find((option) => option.key === quickFilter)?.label || '全部對局'} ·
      {' '}狀態篩選：{statusFilterOptions.find((option) => option.key === statusFilter)?.label || '全部狀態'}
    </div>
  </div>
);

export default VenueTournamentMatchesFilters;
