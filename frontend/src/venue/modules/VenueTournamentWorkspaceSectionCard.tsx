import React from 'react';

type VenueTournamentWorkspaceSectionCardProps = {
  title: string;
  summary: string;
  priorityLabel?: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const VenueTournamentWorkspaceSectionCard: React.FC<VenueTournamentWorkspaceSectionCardProps> = ({
  title,
  summary,
  priorityLabel,
  expanded,
  onToggle,
  children,
}) => (
  <div className="rounded-xl border cue-border bg-black/10">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-start justify-between gap-3 p-4 text-left"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-semibold">{title}</div>
          {priorityLabel ? (
            <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
              {priorityLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-xs cue-muted">{summary}</div>
      </div>
      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${expanded ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
        {expanded ? '收合' : '展開'}
      </span>
    </button>
    {expanded ? (
      <div className="border-t border-white/10 p-4 pt-3">
        {children}
      </div>
    ) : null}
  </div>
);

export default VenueTournamentWorkspaceSectionCard;
