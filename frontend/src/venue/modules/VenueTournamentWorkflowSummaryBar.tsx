import React from 'react';

type WorkflowStepKey = 'SIGNUP' | 'PARTICIPANTS' | 'SCHEDULE' | 'SCORING' | 'COMPLETED';

type VenueTournamentWorkflowSummaryBarProps = {
  currentStep: WorkflowStepKey;
  note: string;
};

const STEPS: Array<{ key: WorkflowStepKey; label: string }> = [
  { key: 'SIGNUP', label: '報名確認' },
  { key: 'PARTICIPANTS', label: '正式名單' },
  { key: 'SCHEDULE', label: '生成賽程' },
  { key: 'SCORING', label: '記分進行' },
  { key: 'COMPLETED', label: '賽事完成' },
];

const VenueTournamentWorkflowSummaryBar: React.FC<VenueTournamentWorkflowSummaryBarProps> = ({
  currentStep,
  note,
}) => {
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.key === currentStep));

  return (
    <div className="cue-surface rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((step, index) => {
          const isActive = index === activeIndex;
          const isCompleted = index < activeIndex;
          return (
            <React.Fragment key={step.key}>
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isActive
                    ? 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
                    : isCompleted
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-white/10 cue-surface-strong cue-muted'
                }`}
              >
                {step.label}
              </div>
              {index < STEPS.length - 1 ? <div className="h-px w-4 bg-white/10" /> : null}
            </React.Fragment>
          );
        })}
      </div>
      <div className="text-xs cue-muted mt-2">{note}</div>
    </div>
  );
};

export default VenueTournamentWorkflowSummaryBar;
