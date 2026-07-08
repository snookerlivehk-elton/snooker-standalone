import React from 'react';

type VenueTournamentLeagueWorkspaceActionsProps = {
  canGenerateParticipants: boolean;
  canGenerateSchedule: boolean;
  canResetSchedule: boolean;
  isRefreshing: boolean;
  scheduleResetSaving: boolean;
  testToolsOpen: boolean;
  onGenerateParticipants: () => void;
  onGenerateSchedule: () => void;
  onRefresh: () => void;
  onResetSchedule: () => void;
  onToggleTestTools: () => void;
};

const VenueTournamentLeagueWorkspaceActions: React.FC<VenueTournamentLeagueWorkspaceActionsProps> = ({
  canGenerateParticipants,
  canGenerateSchedule,
  canResetSchedule,
  isRefreshing,
  scheduleResetSaving,
  testToolsOpen,
  onGenerateParticipants,
  onGenerateSchedule,
  onRefresh,
  onResetSchedule,
  onToggleTestTools,
}) => (
  <div className="flex flex-wrap gap-2">
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
      生成 League 賽程
    </button>
    <button
      type="button"
      disabled={!canResetSchedule || scheduleResetSaving}
      className={`px-3 py-2 rounded text-sm font-semibold ${!canResetSchedule || scheduleResetSaving ? 'cue-surface-strong cue-muted' : 'cue-surface hover:brightness-95'}`}
      onClick={onResetSchedule}
    >
      {scheduleResetSaving ? '重建中...' : '重建賽程'}
    </button>
    <button
      type="button"
      className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
      onClick={onRefresh}
    >
      {isRefreshing ? '更新中...' : '重新整理工作台'}
    </button>
    <button
      type="button"
      className={`px-3 py-2 rounded text-sm font-semibold ${testToolsOpen ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
      onClick={onToggleTestTools}
    >
      {testToolsOpen ? '收起方法 Z' : '方法 Z 測試工具'}
    </button>
  </div>
);

export default VenueTournamentLeagueWorkspaceActions;
