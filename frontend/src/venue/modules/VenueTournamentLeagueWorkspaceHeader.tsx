import React from 'react';
import VenueTournamentLeagueGenerationGuide from './VenueTournamentLeagueGenerationGuide';
import VenueTournamentLeagueWorkspaceActions from './VenueTournamentLeagueWorkspaceActions';
import VenueTournamentWorkflowSummaryBar from './VenueTournamentWorkflowSummaryBar';

type VenueTournamentLeagueWorkspaceHeaderProps = {
  bestOfFrames: number;
  canGenerateParticipants: boolean;
  canGenerateSchedule: boolean;
  canResetSchedule: boolean;
  confirmedCount: number;
  currentWorkflowStep: 'SIGNUP' | 'PARTICIPANTS' | 'SCHEDULE' | 'SCORING' | 'COMPLETED';
  hasParticipants: boolean;
  hasSchedule: boolean;
  isRefreshing: boolean;
  participantCount: number;
  roundRobinMode: 'SINGLE' | 'DOUBLE';
  scheduleResetSaving: boolean;
  testToolsOpen: boolean;
  workflowNote: string;
  onGenerateParticipants: () => void;
  onGenerateSchedule: () => void;
  onRefresh: () => void;
  onResetSchedule: () => void;
  onToggleTestTools: () => void;
};

const VenueTournamentLeagueWorkspaceHeader: React.FC<VenueTournamentLeagueWorkspaceHeaderProps> = ({
  bestOfFrames,
  canGenerateParticipants,
  canGenerateSchedule,
  canResetSchedule,
  confirmedCount,
  currentWorkflowStep,
  hasParticipants,
  hasSchedule,
  isRefreshing,
  participantCount,
  roundRobinMode,
  scheduleResetSaving,
  testToolsOpen,
  workflowNote,
  onGenerateParticipants,
  onGenerateSchedule,
  onRefresh,
  onResetSchedule,
  onToggleTestTools,
}) => (
  <div className="flex flex-col gap-3 mb-3">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
    <VenueTournamentWorkflowSummaryBar currentStep={currentWorkflowStep} note={workflowNote} />
    <VenueTournamentLeagueGenerationGuide
      bestOfFrames={bestOfFrames}
      confirmedCount={confirmedCount}
      hasParticipants={hasParticipants}
      hasSchedule={hasSchedule}
      participantCount={participantCount}
      roundRobinMode={roundRobinMode}
    />
  </div>
);

export default VenueTournamentLeagueWorkspaceHeader;
