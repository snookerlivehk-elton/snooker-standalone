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
  generateParticipantsHint: string;
  generateScheduleHint: string;
  hasParticipants: boolean;
  hasSchedule: boolean;
  isRefreshing: boolean;
  participantCount: number;
  resetScheduleHint: string;
  roundRobinMode: 'SINGLE' | 'DOUBLE';
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

const VenueTournamentLeagueWorkspaceHeader: React.FC<VenueTournamentLeagueWorkspaceHeaderProps> = ({
  bestOfFrames,
  canGenerateParticipants,
  canGenerateSchedule,
  canResetSchedule,
  confirmedCount,
  currentWorkflowStep,
  generateParticipantsHint,
  generateScheduleHint,
  hasParticipants,
  hasSchedule,
  isRefreshing,
  participantCount,
  resetScheduleHint,
  roundRobinMode,
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
        <div className="font-semibold">正式參賽名單 / 聯賽模式工作台</div>
        <div className="text-xs cue-muted mt-1">
          先完成主要操作，再用輔助工具整理資料；危險操作會獨立顯示，避免和日常工作流程混在一起。
        </div>
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs cue-muted">
          操作順序：1. 先確認報名並生成正式名單 2. 再生成聯賽模式賽程 3. 先看積分榜，再由流程摘要 / 賽程入口跳到要記分的對局。
        </div>
      </div>
      <VenueTournamentLeagueWorkspaceActions
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
