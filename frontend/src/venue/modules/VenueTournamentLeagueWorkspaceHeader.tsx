import React from 'react';
import VenueTournamentLeagueWorkspaceActions from './VenueTournamentLeagueWorkspaceActions';

type VenueTournamentLeagueWorkspaceHeaderProps = {
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

const VenueTournamentLeagueWorkspaceHeader: React.FC<VenueTournamentLeagueWorkspaceHeaderProps> = ({
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
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
    <div>
      <div className="font-semibold">正式參賽名單 / League 工作台</div>
      <div className="text-xs cue-muted mt-1">
        先由已確認報名生成正式名單，再按目前 round-robin 設定生成 League 賽程。
      </div>
    </div>
    <VenueTournamentLeagueWorkspaceActions
      canGenerateParticipants={canGenerateParticipants}
      canGenerateSchedule={canGenerateSchedule}
      canResetSchedule={canResetSchedule}
      isRefreshing={isRefreshing}
      scheduleResetSaving={scheduleResetSaving}
      testToolsOpen={testToolsOpen}
      onGenerateParticipants={onGenerateParticipants}
      onGenerateSchedule={onGenerateSchedule}
      onRefresh={onRefresh}
      onResetSchedule={onResetSchedule}
      onToggleTestTools={onToggleTestTools}
    />
  </div>
);

export default VenueTournamentLeagueWorkspaceHeader;
