import React from 'react';
import VenueTournamentKnockoutWorkspaceActions from './VenueTournamentKnockoutWorkspaceActions';
import VenueTournamentWorkflowSummaryBar from './VenueTournamentWorkflowSummaryBar';

type VenueTournamentKnockoutWorkspaceHeaderProps = {
  canGenerateParticipants: boolean;
  canGenerateSchedule: boolean;
  canResetSchedule: boolean;
  currentWorkflowStep: 'SIGNUP' | 'PARTICIPANTS' | 'SCHEDULE' | 'SCORING' | 'COMPLETED';
  generateParticipantsHint: string;
  generateScheduleHint: string;
  isRefreshing: boolean;
  resetScheduleHint: string;
  scheduleResetSaving: boolean;
  testToolsOpen: boolean;
  workflowNote: string;
  onGenerateParticipants: () => void;
  onGenerateSchedule: () => void;
  onRefresh: () => void;
  onResetSchedule: () => void;
  onToggleTestTools: () => void;
};

const VenueTournamentKnockoutWorkspaceHeader: React.FC<VenueTournamentKnockoutWorkspaceHeaderProps> = ({
  canGenerateParticipants,
  canGenerateSchedule,
  canResetSchedule,
  currentWorkflowStep,
  generateParticipantsHint,
  generateScheduleHint,
  isRefreshing,
  resetScheduleHint,
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
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,500px)] xl:items-start">
      <div>
        <div className="font-semibold">正式參賽名單 / Knockout 工作台</div>
        <div className="text-xs cue-muted mt-1">
          先完成主要操作，再用輔助工具整理資料；重建賽程會獨立顯示，避免和日常操作混在一起。
        </div>
      </div>
      <VenueTournamentKnockoutWorkspaceActions
        canGenerateParticipants={canGenerateParticipants}
        canGenerateSchedule={canGenerateSchedule}
        canResetSchedule={canResetSchedule}
        generateParticipantsHint={generateParticipantsHint}
        generateScheduleHint={generateScheduleHint}
        isRefreshing={isRefreshing}
        resetScheduleHint={resetScheduleHint}
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
  </div>
);

export default VenueTournamentKnockoutWorkspaceHeader;
