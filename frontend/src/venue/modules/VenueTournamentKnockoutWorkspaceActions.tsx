import React from 'react';

type VenueTournamentKnockoutWorkspaceActionsProps = {
  canGenerateParticipants: boolean;
  canGenerateSchedule: boolean;
  canResetSchedule: boolean;
  generateParticipantsHint: string;
  generateScheduleHint: string;
  isRefreshing: boolean;
  resetScheduleHint: string;
  scheduleResetSaving: boolean;
  testToolsAvailable: boolean;
  testToolsHint: string;
  testToolsOpen: boolean;
  onGenerateParticipants: () => void;
  onGenerateSchedule: () => void;
  onRefresh: () => void;
  onResetSchedule: () => void;
  onToggleTestTools: () => void;
};

const VenueTournamentKnockoutWorkspaceActions: React.FC<VenueTournamentKnockoutWorkspaceActionsProps> = ({
  canGenerateParticipants,
  canGenerateSchedule,
  canResetSchedule,
  generateParticipantsHint,
  generateScheduleHint,
  isRefreshing,
  resetScheduleHint,
  scheduleResetSaving,
  testToolsAvailable,
  testToolsHint,
  testToolsOpen,
  onGenerateParticipants,
  onGenerateSchedule,
  onRefresh,
  onResetSchedule,
  onToggleTestTools,
}) => (
  <div className="rounded-lg border cue-border bg-black/10 p-3">
    <div className="text-[11px] font-semibold uppercase tracking-wide cue-muted">主要操作</div>
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={!canGenerateParticipants}
        className={`px-3 py-2 rounded text-sm font-semibold ${canGenerateParticipants ? 'cue-button' : 'cue-surface-strong cue-muted'}`}
        onClick={onGenerateParticipants}
      >
        生成正式名單
      </button>
      <button
        type="button"
        disabled={!canGenerateSchedule}
        className={`px-3 py-2 rounded text-sm font-semibold ${canGenerateSchedule ? 'cue-button' : 'cue-surface-strong cue-muted'}`}
        onClick={onGenerateSchedule}
      >
        生成淘汰賽賽程
      </button>
    </div>

    <div className="mt-3 grid gap-2 md:grid-cols-2">
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="text-xs font-semibold">生成正式名單</div>
        <div className="mt-1 text-xs cue-muted">{generateParticipantsHint}</div>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="text-xs font-semibold">生成淘汰賽賽程</div>
        <div className="mt-1 text-xs cue-muted">{generateScheduleHint}</div>
      </div>
    </div>

    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide cue-muted">輔助操作</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
          onClick={onRefresh}
        >
          {isRefreshing ? '更新中...' : '重新整理工作台'}
        </button>
        {testToolsAvailable ? (
          <button
            type="button"
            className={`px-3 py-2 rounded text-sm font-semibold ${testToolsOpen ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
            onClick={onToggleTestTools}
          >
            {testToolsOpen ? '收起方法 Z' : '方法 Z 測試工具'}
          </button>
        ) : null}
      </div>
      <div className="mt-2 text-xs cue-muted">
        {testToolsAvailable
          ? '這組只處理刷新資料與測試輔助，不影響正式賽程流程。'
          : `方法 Z 入口已隱藏：${testToolsHint}`}
      </div>
    </div>

    <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-200/80">危險操作</div>
          <div className="mt-1 text-sm font-semibold text-rose-100">重建賽程</div>
          <div className="mt-1 text-xs text-rose-100/80">{resetScheduleHint}</div>
        </div>
        <button
          type="button"
          disabled={!canResetSchedule || scheduleResetSaving}
          className={`px-3 py-2 rounded text-sm font-semibold ${!canResetSchedule || scheduleResetSaving ? 'cue-surface-strong cue-muted' : 'bg-rose-500/20 text-rose-100 border border-rose-400/30 hover:brightness-95'}`}
          onClick={onResetSchedule}
        >
          {scheduleResetSaving ? '重建中...' : '重建賽程'}
        </button>
      </div>
    </div>
  </div>
);

export default VenueTournamentKnockoutWorkspaceActions;
