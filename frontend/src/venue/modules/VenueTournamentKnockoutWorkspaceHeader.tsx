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
  modeLabel?: string;
  resetScheduleHint: string;
  scheduleResetSaving: boolean;
  testToolsAvailable: boolean;
  testToolsHint: string;
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
  modeLabel = '淘汰賽',
  resetScheduleHint,
  scheduleResetSaving,
  testToolsAvailable,
  testToolsHint,
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
        <div className="font-semibold">正式參賽名單 / {modeLabel}模式工作台</div>
        <div className="text-xs cue-muted mt-1">
          先完成主要操作，再用輔助工具整理資料；重建賽程會獨立顯示，避免和日常操作混在一起。
        </div>
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs cue-muted">
          操作順序：1. 先確認報名並生成正式名單 2. 再生成{modeLabel}模式賽程 3. 先看進級表，再優先處理 READY / LIVE 對局，blocked 只作追查上游。
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
        testToolsAvailable={testToolsAvailable}
        testToolsHint={testToolsHint}
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
