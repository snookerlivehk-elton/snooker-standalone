import React, { useCallback, useEffect, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  buildMatchProgressSummary,
  createEmptyEditableFrame,
  formatDateTimeLocalInput,
  formatDisplayDateTime,
  formatMemberLabel,
  getFrameSegmentLabel,
  getRecommendedFrameNoForSegment,
  getSegmentBreakSummary,
  getSegmentCompletionSummary,
  getSegmentFramesWonSummary,
} from './VenueTournamentScoringHelpers';
import VenueTournamentKnockoutParticipantsPanel from './VenueTournamentKnockoutParticipantsPanel';
import VenueTournamentKnockoutWorkspaceHeader from './VenueTournamentKnockoutWorkspaceHeader';
import VenueTournamentKnockoutWorkspaceMainContent from './VenueTournamentKnockoutWorkspaceMainContent';
import VenueTournamentKnockoutWorkspaceOverview from './VenueTournamentKnockoutWorkspaceOverview';
import VenueTournamentLeagueParticipantsPanel from './VenueTournamentLeagueParticipantsPanel';
import VenueTournamentLeagueWorkspaceHeader from './VenueTournamentLeagueWorkspaceHeader';
import VenueTournamentLeagueWorkspaceMainContent from './VenueTournamentLeagueWorkspaceMainContent';
import VenueTournamentLeagueWorkspaceOverview from './VenueTournamentLeagueWorkspaceOverview';
import VenueTournamentScoringWorkspace from './VenueTournamentScoringWorkspace';
import VenueTournamentTestToolsPanel from './VenueTournamentTestToolsPanel';
import type { EditableFrame, TournamentScoringWorkspace } from './VenueTournamentScoringTypes';
import { useTournamentScoringActions } from './useTournamentScoringActions';
import { useTournamentScoringDerivedState } from './useTournamentScoringDerivedState';
import { useTournamentStageViewData } from './useTournamentStageViewData';
import {
  cancelTournamentSignup,
  closeClubTournament,
  confirmTournamentSignup,
  createClubTournament,
  generateTournamentLeagueSchedule,
  generateTournamentKnockoutSchedule,
  generateTournamentParticipants,
  getMyClubTournaments,
  getTournamentMatches,
  getTournamentParticipants,
  getTournamentSignups,
  getTournamentStandings,
  publishClubTournament,
  resetTournamentLeagueSchedule,
  resetTournamentKnockoutSchedule,
  updateTournamentSeedMode,
  updateTournamentParticipant,
  updateClubTournament,
} from '../../lib/api';

type VenueTournamentsModuleProps = {
  operatorId: string;
  enabled: boolean;
  className?: string;
};

type TournamentFormat = 'KNOCKOUT' | 'LEAGUE';
type TournamentSeedMode = 'MANUAL' | 'RANKING' | 'RANDOM';
type TournamentLeagueRoundRobinMode = 'SINGLE' | 'DOUBLE';
type MatchResultType = 'STANDARD' | 'BYE' | 'WALKOVER' | 'FORFEIT';
type WorkflowStepKey = 'SIGNUP' | 'PARTICIPANTS' | 'SCHEDULE' | 'SCORING' | 'COMPLETED';

function formatParticipantLabel(participant: any) {
  if (!participant) return 'BYE';
  const seed = Number(participant?.seed || 0);
  const prefix = seed > 0 ? `#${seed} ` : '';
  return `${prefix}${formatMemberLabel(participant?.member)}`;
}

function normalizeTournamentFormat(value: any): TournamentFormat {
  return String(value || '').trim().toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
}

function formatTournamentFormatLabel(value: any) {
  return normalizeTournamentFormat(value) === 'LEAGUE' ? 'League' : 'Knockout';
}

function normalizeSeedMode(value: any): TournamentSeedMode {
  const mode = String(value || 'MANUAL').trim().toUpperCase();
  if (mode === 'RANKING' || mode === 'RANDOM') return mode;
  return 'MANUAL';
}

function formatSeedModeLabel(value: TournamentSeedMode) {
  if (value === 'RANDOM') return '隨機抽籤';
  if (value === 'RANKING') return '按評分排序';
  return '手動種子';
}

function normalizeLeagueRoundRobinMode(value: any): TournamentLeagueRoundRobinMode {
  return String(value || '').trim().toUpperCase() === 'DOUBLE' ? 'DOUBLE' : 'SINGLE';
}

function formatLeagueRoundRobinModeLabel(value: TournamentLeagueRoundRobinMode) {
  return value === 'DOUBLE' ? '雙循環' : '單循環';
}

function formatWorkflowStatusLabel(value: any) {
  const status = String(value || 'DRAFT').trim().toUpperCase();
  if (status === 'REGISTRATION') return '已生成名單';
  if (status === 'SEEDED') return '已生成賽程';
  if (status === 'IN_PROGRESS') return '進行中';
  if (status === 'COMPLETED') return '已完成';
  return '草稿';
}

function normalizeMatchResultType(value: any): MatchResultType {
  const resultType = String(value || 'STANDARD').trim().toUpperCase();
  if (resultType === 'BYE' || resultType === 'WALKOVER' || resultType === 'FORFEIT') return resultType;
  return 'STANDARD';
}

function formatMatchResultTypeLabel(value: any) {
  const resultType = normalizeMatchResultType(value);
  if (resultType === 'BYE') return 'BYE';
  if (resultType === 'WALKOVER') return 'W/O';
  if (resultType === 'FORFEIT') return '棄權';
  return '正常完賽';
}

function formatParticipantStatusLabel(value: any) {
  const status = String(value || '').trim().toUpperCase();
  if (status === 'CHAMPION') return '冠軍';
  if (status === 'ELIMINATED') return '已淘汰';
  if (status === 'WITHDRAWN') return '退出';
  if (status === 'DISQUALIFIED') return '取消資格';
  return status || '-';
}

function formatFinalRankLabel(value: any) {
  const rank = Number(value || 0);
  if (!Number.isFinite(rank) || rank <= 0) return '-';
  if (rank === 1) return '冠軍';
  if (rank === 2) return '亞軍';
  if (rank === 3) return '四強';
  return `第 ${rank} 名`;
}

function estimateLeagueScheduleSummary(participantCount: number, roundRobinMode: TournamentLeagueRoundRobinMode) {
  if (!Number.isFinite(participantCount) || participantCount < 2) {
    return { rounds: 0, matches: 0 };
  }
  const baseRounds = participantCount % 2 === 0 ? participantCount - 1 : participantCount;
  const baseMatches = (participantCount * (participantCount - 1)) / 2;
  return {
    rounds: roundRobinMode === 'DOUBLE' ? baseRounds * 2 : baseRounds,
    matches: roundRobinMode === 'DOUBLE' ? baseMatches * 2 : baseMatches,
  };
}

function nextPowerOfTwo(value: number) {
  let p = 1;
  while (p < value) p *= 2;
  return p;
}

function estimateKnockoutBracketSummary(participantCount: number) {
  if (!Number.isFinite(participantCount) || participantCount < 2) {
    return { bracketSize: 0, byeCount: 0 };
  }
  const bracketSize = nextPowerOfTwo(participantCount);
  return {
    bracketSize,
    byeCount: Math.max(0, bracketSize - participantCount),
  };
}

function canScoreTournamentMatch(row: any) {
  const status = String(row?.status || '').trim().toUpperCase();
  return !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
}

function getPreferredScoringMatch(rows: any[]) {
  return rows.find((row: any) => canScoreTournamentMatch(row) && String(row?.status || '').trim().toUpperCase() === 'LIVE')
    || rows.find((row: any) => canScoreTournamentMatch(row) && String(row?.status || '').trim().toUpperCase() === 'READY')
    || rows.find((row: any) => canScoreTournamentMatch(row) && String(row?.status || '').trim().toUpperCase() !== 'COMPLETED')
    || rows.find((row: any) => canScoreTournamentMatch(row))
    || null;
}

function formatScoringJumpTargetLabel(row: any) {
  if (!row) return '';
  return `第 ${Math.max(1, Number(row?.round_no || 1))} 輪 M${Math.max(1, Number(row?.match_no || 1))}`;
}

const VenueTournamentsModule: React.FC<VenueTournamentsModuleProps> = ({
  operatorId,
  enabled,
  className = '',
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [guide, setGuide] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('KNOCKOUT');
  const [seedMode, setSeedMode] = useState<TournamentSeedMode>('MANUAL');
  const [leagueRoundRobinMode, setLeagueRoundRobinMode] = useState<TournamentLeagueRoundRobinMode>('SINGLE');
  const [bestOfFrames, setBestOfFrames] = useState('5');
  const [pointsWin, setPointsWin] = useState('3');
  const [pointsDraw, setPointsDraw] = useState('1');
  const [pointsLoss, setPointsLoss] = useState('0');
  const [capacity, setCapacity] = useState('32');
  const [startsAt, setStartsAt] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [confirmedRows, setConfirmedRows] = useState<any[]>([]);
  const [confirmedLoading, setConfirmedLoading] = useState(false);
  const [participantsRows, setParticipantsRows] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantSeedDrafts, setParticipantSeedDrafts] = useState<Record<string, string>>({});
  const [participantSeedSavingId, setParticipantSeedSavingId] = useState('');
  const [seedModeSaving, setSeedModeSaving] = useState(false);
  const [matchesRows, setMatchesRows] = useState<any[]>([]);
  const [standingsRows, setStandingsRows] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [scheduleResetSaving, setScheduleResetSaving] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [resultStartedAt, setResultStartedAt] = useState('');
  const [resultEndedAt, setResultEndedAt] = useState('');
  const [resultQuickType, setResultQuickType] = useState<'WALKOVER' | 'FORFEIT'>('WALKOVER');
  const [resultQuickWinnerSide, setResultQuickWinnerSide] = useState<'A' | 'B'>('A');
  const [resultFrames, setResultFrames] = useState<EditableFrame[]>([createEmptyEditableFrame(1)]);
  const [activeFrameNo, setActiveFrameNo] = useState(1);
  const [resultSaving, setResultSaving] = useState(false);
  const [breakSaving, setBreakSaving] = useState(false);
  const [breakMemberId, setBreakMemberId] = useState('');
  const [breakFrameNo, setBreakFrameNo] = useState('1');
  const [breakPoints, setBreakPoints] = useState('');
  const [breakRecordedAt, setBreakRecordedAt] = useState(() => formatDateTimeLocalInput(new Date()));
  const [breakNote, setBreakNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [workflowFocusNotice, setWorkflowFocusNotice] = useState<string | null>(null);
  const [testToolsOpen, setTestToolsOpen] = useState(false);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const showWorkflowFocusNotice = useCallback((message: string, timeout = 5000) => {
    setWorkflowFocusNotice(message);
    window.setTimeout(() => setWorkflowFocusNotice(null), timeout);
  }, []);

  const updateFrameDraft = useCallback((index: number, patch: Partial<EditableFrame>) => {
    setResultFrames((prev) => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch, isPlaceholder: false } : item
    )));
  }, []);

  const resetEditor = useCallback(() => {
    setSelectedId('');
    setTitle('');
    setDescription('');
    setGuide('');
    setFormat('KNOCKOUT');
    setSeedMode('MANUAL');
    setLeagueRoundRobinMode('SINGLE');
    setBestOfFrames('5');
    setPointsWin('3');
    setPointsDraw('1');
    setPointsLoss('0');
    setCapacity('32');
    setDeadline('');
    setStartsAt('');
    setPendingRows([]);
    setConfirmedRows([]);
    setParticipantsRows([]);
    setParticipantSeedDrafts({});
    setParticipantSeedSavingId('');
    setSeedModeSaving(false);
    setMatchesRows([]);
    setStandingsRows([]);
    setSelectedMatchId('');
    setResultStartedAt('');
    setResultEndedAt('');
    setResultQuickType('WALKOVER');
    setResultQuickWinnerSide('A');
    setResultFrames([createEmptyEditableFrame(1)]);
    setActiveFrameNo(1);
    setBreakMemberId('');
    setBreakFrameNo('1');
    setBreakPoints('');
    setBreakRecordedAt(formatDateTimeLocalInput(new Date()));
    setBreakNote('');
    setWorkflowFocusNotice(null);
    setTestToolsOpen(false);
  }, []);

  const loadRows = useCallback(async () => {
    if (!operatorId || !enabled) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const next = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
      setRows(Array.isArray(next) ? next : []);
    } catch (e: any) {
      showNotice(e?.message || '載入比賽失敗', 3000);
    } finally {
      setLoading(false);
    }
  }, [enabled, operatorId, showNotice]);

  const loadSelectedSignups = useCallback(async () => {
    if (!operatorId || !enabled || !selectedId) {
      setPendingRows([]);
      setConfirmedRows([]);
      return;
    }
    setPendingLoading(true);
    setConfirmedLoading(true);
    try {
      const [pendingNext, confirmedNext] = await Promise.all([
        getTournamentSignups(API_URL, operatorId, selectedId, 'PENDING').catch(() => []),
        getTournamentSignups(API_URL, operatorId, selectedId, 'CONFIRMED').catch(() => []),
      ]);
      setPendingRows(Array.isArray(pendingNext) ? pendingNext : []);
      setConfirmedRows(Array.isArray(confirmedNext) ? confirmedNext : []);
    } catch (e: any) {
      showNotice(e?.message || '載入報名名單失敗', 3000);
    } finally {
      setPendingLoading(false);
      setConfirmedLoading(false);
    }
  }, [enabled, operatorId, selectedId, showNotice]);

  const loadSelectedPhase1Data = useCallback(async () => {
    if (!operatorId || !enabled || !selectedId) {
      setParticipantsRows([]);
      setMatchesRows([]);
      setStandingsRows([]);
      return;
    }
    const selectedRow = rows.find((row: any) => String(row?.id || '') === selectedId) || null;
    const selectedFormat = normalizeTournamentFormat(selectedRow?.format);
    setParticipantsLoading(true);
    setMatchesLoading(true);
    try {
      const requests: Promise<any>[] = [
        getTournamentParticipants(API_URL, operatorId, selectedId).catch(() => []),
        getTournamentMatches(API_URL, operatorId, selectedId).catch(() => []),
      ];
      if (selectedFormat === 'LEAGUE') {
        requests.push(getTournamentStandings(API_URL, operatorId, selectedId).catch(() => ({ standings: [] })));
      }
      const [participantsNext, matchesNext, standingsNext] = await Promise.all(requests);
      const normalizedParticipants = Array.isArray(participantsNext) ? participantsNext : [];
      setParticipantsRows(normalizedParticipants);
      setParticipantSeedDrafts(Object.fromEntries(normalizedParticipants.map((row: any, index: number) => [String(row?.id || index), String(row?.seed ?? index + 1)])));
      setMatchesRows(Array.isArray(matchesNext) ? matchesNext : []);
      setStandingsRows(selectedFormat === 'LEAGUE' && Array.isArray((standingsNext as any)?.standings) ? (standingsNext as any).standings : []);
    } catch (e: any) {
      showNotice(e?.message || '載入賽程資料失敗', 3000);
    } finally {
      setParticipantsLoading(false);
      setMatchesLoading(false);
    }
  }, [enabled, operatorId, rows, selectedId, showNotice]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadSelectedSignups();
  }, [loadSelectedSignups]);

  useEffect(() => {
    loadSelectedPhase1Data();
  }, [loadSelectedPhase1Data]);

  const selectedTournament = rows.find((row: any) => String(row?.id || '') === selectedId) || null;
  useEffect(() => {
    if (!selectedTournament) return;
    setWorkflowFocusNotice(null);
    setFormat(normalizeTournamentFormat(selectedTournament?.format));
    setSeedMode(normalizeSeedMode(selectedTournament?.seed_mode));
    setLeagueRoundRobinMode(normalizeLeagueRoundRobinMode((selectedTournament as any)?.league_round_robin_mode));
    setBestOfFrames(String(selectedTournament?.best_of_frames ?? 5));
    setPointsWin(String(selectedTournament?.points_win ?? 3));
    setPointsDraw(String(selectedTournament?.points_draw ?? 1));
    setPointsLoss(String(selectedTournament?.points_loss ?? 0));
  }, [selectedTournament]);

  const selectedMatch = matchesRows.find((row: any) => String(row?.id || '') === selectedMatchId) || null;
  useEffect(() => {
    if (matchesRows.length === 0) {
      if (selectedMatchId) setSelectedMatchId('');
      return;
    }
    const hasCurrentSelection = matchesRows.some((row: any) => String(row?.id || '') === selectedMatchId);
    if (hasCurrentSelection) return;
    const resumableMatch = matchesRows.find((row: any) => (
      canScoreTournamentMatch(row)
      && String(row?.status || '').toUpperCase() !== 'COMPLETED'
      && Array.isArray(row?.frames)
      && row.frames.length > 0
    ));
    const preferredMatch = resumableMatch || getPreferredScoringMatch(matchesRows);
    if (preferredMatch) {
      setSelectedMatchId(String(preferredMatch?.id || ''));
    }
  }, [matchesRows, selectedMatchId]);
  const tournamentFormat = normalizeTournamentFormat(selectedTournament?.format || format);
  const isLeague = tournamentFormat === 'LEAGUE';
  const workflowStatus = String(selectedTournament?.workflow_status || 'DRAFT').trim().toUpperCase();
  const hasParticipants = participantsRows.length > 0;
  const hasSchedule = matchesRows.length > 0;
  const canGenerateParticipants = confirmedRows.length > 0 && !hasSchedule;
  const canGenerateSchedule = participantsRows.length >= 2 && !hasSchedule;
  const canEditSeeding = hasParticipants && !hasSchedule && !isLeague;
  const hasPlayedMatches = matchesRows.some((row: any) => {
    const frames = Array.isArray(row?.frames) ? row.frames : [];
    return frames.length > 0 || !!row?.started_at || !!row?.ended_at;
  });
  const canResetSchedule = hasSchedule && !hasPlayedMatches;
  const {
    bracketColumns,
    knockoutSummary,
    leagueSummary,
    leagueRounds,
    podiumSummary,
  } = useTournamentStageViewData(participantsRows, matchesRows);
  const {
    activeFrame,
    activeFrameIndex,
    activeFrameNoValue,
    completedResultFrames,
    pendingResultFrame,
    selectedMatchA20PlusCount,
    selectedMatchAWins,
    selectedMatchActiveFrameBreakRows,
    selectedMatchActiveSegment,
    selectedMatchActiveSegmentBreakRows,
    selectedMatchActiveSegmentBreakSummary,
    selectedMatchB20PlusCount,
    selectedMatchBWins,
    selectedMatchBestOf,
    selectedMatchBreakEnabled,
    selectedMatchBreakFrameOptions,
    selectedMatchBreakRows,
    selectedMatchBreakTotalsLabel,
    selectedMatchCompletedFrames,
    selectedMatchCurrentBlockNo,
    selectedMatchCurrentFrameNo,
    selectedMatchCurrentSessionNo,
    selectedMatchHasPlayers,
    selectedMatchIsCompleted,
    selectedMatchIsLongFormat,
    selectedMatchLatestSavedFrameNo,
    selectedMatchMemberOptions,
    selectedMatchNextCheckpointLabel,
    selectedMatchResultEditable,
    selectedMatchResultType,
    selectedMatchResumeSummary,
    selectedMatchSegments,
    selectedMatchStatus,
    selectedMatchTargetWins,
    selectedMatchTopBreakLabel,
    selectedMatchWinnerLabel,
    selectedMatchWinsRemainingA,
    selectedMatchWinsRemainingB,
  } = useTournamentScoringDerivedState({
    activeFrameNo,
    formatMemberLabel,
    normalizeMatchResultType,
    resultFrames,
    selectedMatch,
    selectedTournamentBestOf: selectedTournament?.best_of_frames,
  });
  const {
    handleSubmitActiveFrameBreak,
    handleSubmitQuickResult,
    handleSubmitSidebarBreak,
    handleSubmitStandardResult,
    selectMatchForScoring,
  } = useTournamentScoringActions({
    activeFrame,
    activeFrameNoValue,
    breakFrameNo,
    breakMemberId,
    breakNote,
    breakPoints,
    breakRecordedAt,
    loadSelectedPhase1Data,
    operatorId,
    resultEndedAt,
    resultFrames,
    resultQuickType,
    resultQuickWinnerSide,
    resultStartedAt,
    selectedId,
    selectedMatch,
    selectedMatchCurrentFrameNo,
    selectedMatchId,
    selectedMatchMemberOptions,
    selectedMatchStatus,
    selectedMatchTargetWins,
    selectedTournamentBestOf: selectedTournament?.best_of_frames,
    setActiveFrameNo,
    setBreakFrameNo,
    setBreakMemberId,
    setBreakNote,
    setBreakPoints,
    setBreakRecordedAt,
    setBreakSaving,
    setResultEndedAt,
    setResultFrames,
    setResultQuickType,
    setResultQuickWinnerSide,
    setResultSaving,
    setResultStartedAt,
    setSelectedMatchId,
    showNotice,
    normalizeMatchResultType,
  });
  const tournamentSummaryNote = !confirmedRows.length
    ? '先確認至少 1 位報名者，之後才可生成正式名單。'
    : hasSchedule
      ? hasPlayedMatches
        ? `賽程已開始，正式名單${isLeague ? '' : '與 seedMode'}會鎖定，且不可再重建${isLeague ? '循環賽' : 'bracket'}。`
        : `賽程已生成但尚未開打，可使用「重建賽程」清空目前${isLeague ? 'League' : 'Knockout'}賽程。`
      : !hasParticipants
        ? isLeague
          ? '先生成正式名單，再建立 League round-robin 賽程。'
          : '先生成正式名單，再決定 seedMode 與 Knockout 賽程。'
        : participantsRows.length < 2
          ? `正式名單至少需要 2 位有效參賽者才可生成${isLeague ? ' League' : ' Knockout'}賽程。`
          : isLeague
            ? '目前可直接生成 League 賽程。'
            : '目前可調整種子及生成 Knockout 賽程。';
  const currentWorkflowStep: WorkflowStepKey = workflowStatus === 'COMPLETED'
    ? 'COMPLETED'
    : hasPlayedMatches || workflowStatus === 'IN_PROGRESS'
      ? 'SCORING'
      : hasSchedule || workflowStatus === 'SEEDED'
        ? 'SCHEDULE'
        : hasParticipants || workflowStatus === 'REGISTRATION'
          ? 'PARTICIPANTS'
          : 'SIGNUP';
  const workflowSummaryNote = !confirmedRows.length
    ? '先確認報名名單，之後才可生成正式參賽名單。'
    : !hasParticipants
      ? `目前已有 ${confirmedRows.length} 位已確認報名，下一步是生成正式名單。`
      : !hasSchedule
        ? `目前已有 ${participantsRows.length} 位正式參賽者，下一步是生成${isLeague ? ' League' : ' Knockout'}賽程。`
        : hasPlayedMatches
          ? '賽事已開始，現在以記分、進度追蹤與結果整理為主。'
          : '賽程已生成但尚未開打，可先安排首批對局並開始記分。';
  const leagueScheduleEstimate = estimateLeagueScheduleSummary(participantsRows.length, leagueRoundRobinMode);
  const knockoutBracketEstimate = estimateKnockoutBracketSummary(participantsRows.length);
  const handleGenerateParticipants = async () => {
    try {
      const result = await generateTournamentParticipants(API_URL, operatorId, selectedId);
      await Promise.all([loadSelectedPhase1Data(), loadRows()]);
      const nextParticipants = Array.isArray((result as any)?.participants) ? (result as any).participants : [];
      showNotice(`已生成正式參賽名單：共 ${nextParticipants.length || participantsRows.length || confirmedRows.length} 位參賽者。`);
    } catch (e: any) {
      showNotice(e?.message || '生成正式參賽名單失敗', 3000);
    }
  };
  const handleGenerateLeagueSchedule = async () => {
    if (!confirm(
      `確定按目前正式名單生成 League 賽程？\n\n- 正式參賽者：${participantsRows.length} 位\n- 循環模式：${formatLeagueRoundRobinModeLabel(leagueRoundRobinMode)}\n- 預計輪次 / 場數：${leagueScheduleEstimate.rounds} 輪 / ${leagueScheduleEstimate.matches} 場\n- 生成後如需改循環模式、BO 或計分，應先重建賽程`
    )) return;
    try {
      const result = await generateTournamentLeagueSchedule(API_URL, operatorId, selectedId);
      const createdMatches = Array.isArray((result as any)?.matches) ? (result as any).matches : [];
      const preferredMatch = getPreferredScoringMatch(createdMatches);
      if (preferredMatch?.id) setSelectedMatchId(String(preferredMatch.id));
      await loadSelectedPhase1Data();
      const createdRounds = new Set(createdMatches.map((row: any) => Number(row?.round_no || 0)).filter((value: number) => value > 0)).size;
      if (preferredMatch) {
        showWorkflowFocusNotice(`已自動跳到 League 的 ${formatScoringJumpTargetLabel(preferredMatch)}，可直接開始記分或安排時間 / 球枱。`, 5200);
      }
      showNotice(`已生成 League 賽程：${participantsRows.length} 位參賽者，${formatLeagueRoundRobinModeLabel(leagueRoundRobinMode)}，共 ${createdRounds || leagueScheduleEstimate.rounds} 輪 / ${createdMatches.length || leagueScheduleEstimate.matches} 場。${preferredMatch ? ' 已自動選中下一場可記分對局。' : ''}`, 3800);
    } catch (e: any) {
      showNotice(e?.message || '生成循環賽賽程失敗', 3000);
    }
  };
  const handleGenerateKnockoutSchedule = async () => {
    if (!confirm(
      `確定按目前正式名單生成 Knockout 賽程？\n\n- 正式參賽者：${participantsRows.length} 位\n- seedMode：${formatSeedModeLabel(seedMode)}\n- 預計籤表：${knockoutBracketEstimate.bracketSize || '-'} 強\n- 預計 Bye：${knockoutBracketEstimate.byeCount}\n- 生成後如需改 seed 排列，應先重建賽程`
    )) return;
    try {
      const result = await generateTournamentKnockoutSchedule(API_URL, operatorId, selectedId);
      const createdMatches = Array.isArray((result as any)?.matches) ? (result as any).matches : [];
      const preferredMatch = getPreferredScoringMatch(createdMatches);
      if (preferredMatch?.id) setSelectedMatchId(String(preferredMatch.id));
      await loadSelectedPhase1Data();
      const readyCount = createdMatches.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY').length;
      const pendingCount = createdMatches.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'PENDING').length;
      const byeCount = createdMatches.filter((row: any) => String(row?.result_type || '').trim().toUpperCase() === 'BYE').length;
      if (preferredMatch) {
        showWorkflowFocusNotice(`已自動跳到 Knockout 的 ${formatScoringJumpTargetLabel(preferredMatch)}，可直接開始記分並推進下游 bracket。`, 5200);
      }
      showNotice(`已生成 Knockout 賽程：${knockoutBracketEstimate.bracketSize || '-'} 強 bracket，共 ${createdMatches.length} 場；${readyCount} 場可直接開打，${pendingCount} 場待上游，${byeCount} 個 bye。${preferredMatch ? ' 已自動選中下一場可記分對局。' : ''}`, 3800);
    } catch (e: any) {
      showNotice(e?.message || '生成淘汰賽賽程失敗', 3000);
    }
  };
  const handleResetLeagueSchedule = async () => {
    if (!selectedId) return;
    if (!confirm(
      `確定要重建 League 賽程？\n\n- 目前會清空 ${matchesRows.length} 場已生成賽程\n- 正式名單會保留 ${participantsRows.length} 位\n- 已安排時間、球枱與對局配對都會一併移除`
    )) return;
    if (!confirm('再次確認：只適用於未開打賽程。若已有實際賽果、frame 或 break records，系統會拒絕重建。')) return;
    try {
      setScheduleResetSaving(true);
      setSelectedMatchId('');
      setWorkflowFocusNotice(null);
      const clearedMatches = matchesRows.length;
      const result = await resetTournamentLeagueSchedule(API_URL, operatorId, selectedId);
      await Promise.all([loadSelectedPhase1Data(), loadRows()]);
      const preservedParticipants = Array.isArray((result as any)?.participants) ? (result as any).participants.length : participantsRows.length;
      showNotice(`已清空 ${clearedMatches} 場 League 賽程，保留 ${preservedParticipants} 位正式參賽者，可重新生成。`, 3500);
    } catch (e: any) {
      showNotice(e?.message || '重建循環賽賽程失敗', 3500);
    } finally {
      setScheduleResetSaving(false);
    }
  };
  const handleResetKnockoutSchedule = async () => {
    if (!selectedId) return;
    if (!confirm(
      `確定要重建 Knockout 賽程？\n\n- 目前會清空 ${matchesRows.length} 場已生成對局\n- 正式名單會保留 ${participantsRows.length} 位\n- 既有 seed 仍可保留，但 bracket、bye 與預賽配置會重新建立`
    )) return;
    if (!confirm('再次確認：只適用於未開打賽程。若已有實際賽果、frame 或 break records，系統會拒絕重建。')) return;
    try {
      setScheduleResetSaving(true);
      setSelectedMatchId('');
      setWorkflowFocusNotice(null);
      const clearedMatches = matchesRows.length;
      const result = await resetTournamentKnockoutSchedule(API_URL, operatorId, selectedId);
      await Promise.all([loadSelectedPhase1Data(), loadRows()]);
      const preservedParticipants = Array.isArray((result as any)?.participants) ? (result as any).participants.length : participantsRows.length;
      showNotice(`已清空 ${clearedMatches} 場 Knockout 對局，保留 ${preservedParticipants} 位正式參賽者，可重新調整 seed 與生成 bracket。`, 3500);
    } catch (e: any) {
      showNotice(e?.message || '重建淘汰賽賽程失敗', 3500);
    } finally {
      setScheduleResetSaving(false);
    }
  };
  const scoringWorkspace: TournamentScoringWorkspace | null = selectedId && selectedMatch ? {
    activeFrame,
    activeFrameIndex,
    activeFrameNoValue,
    breakFrameNo,
    breakMemberId,
    breakNote,
    breakPoints,
    breakRecordedAt,
    breakSaving,
    formatDisplayDateTime,
    formatMatchResultTypeLabel,
    formatMemberLabel,
    getFrameSegmentLabel,
    getRecommendedFrameNoForSegment,
    getSegmentBreakSummary,
    getSegmentCompletionSummary,
    getSegmentFramesWonSummary,
    onSubmitActiveFrameBreak: handleSubmitActiveFrameBreak,
    onSubmitQuickResult: handleSubmitQuickResult,
    onSubmitSidebarBreak: handleSubmitSidebarBreak,
    onSubmitStandardResult: handleSubmitStandardResult,
    pendingResultFrame,
    resultEndedAt,
    resultFrames,
    resultQuickType,
    resultQuickWinnerSide,
    resultSaving,
    resultStartedAt,
    selectedMatch,
    selectedMatchA20PlusCount,
    selectedMatchActiveFrameBreakRows,
    selectedMatchActiveSegment,
    selectedMatchActiveSegmentBreakRows,
    selectedMatchActiveSegmentBreakSummary,
    selectedMatchB20PlusCount,
    selectedMatchBestOf,
    selectedMatchBreakEnabled,
    selectedMatchBreakFrameOptions,
    selectedMatchBreakRows,
    selectedMatchBreakTotalsLabel,
    selectedMatchCompletedFrames,
    selectedMatchCurrentBlockNo,
    selectedMatchCurrentFrameNo,
    selectedMatchCurrentSessionNo,
    selectedMatchIsCompleted,
    selectedMatchIsLongFormat,
    selectedMatchLatestSavedFrameNo,
    selectedMatchMemberOptions,
    selectedMatchNextCheckpointLabel,
    selectedMatchResultEditable,
    selectedMatchResumeSummary,
    selectedMatchSegments,
    selectedMatchTargetWins,
    selectedMatchTopBreakLabel,
    selectedMatchWinnerLabel,
    selectedMatchWinsRemainingA,
    selectedMatchWinsRemainingB,
    setActiveFrameNo,
    setBreakFrameNo,
    setBreakMemberId,
    setBreakNote,
    setBreakPoints,
    setBreakRecordedAt,
    setResultEndedAt,
    setResultQuickType,
    setResultQuickWinnerSide,
    setResultStartedAt,
    showNotice,
    tournamentFormat,
    updateFrameDraft,
  } : null;

  if (!enabled) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`.trim()}>
        <div className="text-xl font-bold mb-2">比賽報名（管理）</div>
        <div className="cue-muted text-sm">此功能未開通（可於系統功能上架設定中開啟）</div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-6 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
        <h2 className="text-xl font-bold">比賽報名（管理）</h2>
        <HelpGuide
          title="比賽報名（管理）"
            intro="建立、更新、上架或關閉比賽報名，並逐步管理待確認報名、正式參賽名單、Knockout / League 賽程、賽果與比賽 20+。"
          steps={[
            '填寫標題、賽制與對應欄位設定；League 需選單/雙循環與計分，Knockout 則調整 seed 模式，之後按「新增」。',
              '在下方列表可「選擇」某個比賽以查看報名名單與賽事工作台。',
            '按「上架」讓會員端可見並可報名；按「關閉」停止報名與後續操作。',
              '確認報名後，可生成正式名單與對應賽制賽程，再在同頁輸入每局賽果與記錄比賽 20+。',
          ]}
          tips={[
            '建議先完成內容後再上架，避免會員看到未完成資訊。',
            '如要在場館公開頁顯示比賽入口，請同時於場館公開設定開啟「公開比賽入口」。',
              'League 現可設定單循環 / 雙循環；Knockout 與 League 會共用列表，但建立欄位與後續賽程生成會按賽制分流。',
          ]}
        />
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}
      {workflowFocusNotice ? (
        <div className="mb-4 rounded-lg border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <div className="font-semibold mb-1">已自動定位到下一個工作點</div>
          <div>{workflowFocusNotice}</div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3">
          <label className="block text-sm mb-1 cue-muted">標題</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：週末公開賽" />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm mb-1 cue-muted">賽制</label>
          <select value={format} onChange={(e) => setFormat(normalizeTournamentFormat(e.target.value))} className="w-full px-3 py-2 rounded cue-input">
            <option value="KNOCKOUT">Knockout</option>
            <option value="LEAGUE">League</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm mb-1 cue-muted">上限</label>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="32" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">每場局數 / Best Of</label>
          <input value={bestOfFrames} onChange={(e) => setBestOfFrames(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="5" type="number" min={1} />
        </div>
        {format === 'KNOCKOUT' ? (
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 cue-muted">Seed 模式</label>
            <select value={seedMode} onChange={(e) => setSeedMode(normalizeSeedMode(e.target.value))} className="w-full px-3 py-2 rounded cue-input">
              <option value="MANUAL">手動種子</option>
              <option value="RANKING">按評分排序</option>
              <option value="RANDOM">隨機抽籤</option>
            </select>
          </div>
        ) : (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 cue-muted">循環模式</label>
              <select
                value={leagueRoundRobinMode}
                onChange={(e) => setLeagueRoundRobinMode(normalizeLeagueRoundRobinMode(e.target.value))}
                className="w-full px-3 py-2 rounded cue-input"
              >
                <option value="SINGLE">單循環</option>
                <option value="DOUBLE">雙循環</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm mb-1 cue-muted">勝分</label>
              <input value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm mb-1 cue-muted">和分</label>
              <input value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm mb-1 cue-muted">負分</label>
              <input value={pointsLoss} onChange={(e) => setPointsLoss(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
            </div>
          </>
        )}
        <div className="md:col-span-6 text-xs cue-muted">
          {format === 'LEAGUE'
            ? `目前建立為 ${formatLeagueRoundRobinModeLabel(leagueRoundRobinMode)}，生成賽程時會按此模式建立 round-robin fixtures。`
            : `目前建立為 Knockout，正式名單生成後可按 ${formatSeedModeLabel(seedMode)} 建立籤表。`}
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">截止日期</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm mb-1 cue-muted">比賽時間（可選）</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm mb-1 cue-muted">比賽詳情</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded cue-input h-24" placeholder="輸入比賽詳情..." />
        </div>
        <div className="md:col-span-6">
          <label className="block text-sm mb-1 cue-muted">報名指引 / 流程（會員確認彈窗顯示）</label>
          <textarea value={guide} onChange={(e) => setGuide(e.target.value)} className="w-full px-3 py-2 rounded cue-input h-24" placeholder="例如：已提交報名，待場館確認；確認後請於 X 日前到場繳費..." />
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            className={`px-4 py-2 rounded font-semibold ${saving ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
            onClick={async () => {
              try {
                const trimmedTitle = String(title || '').trim();
                if (!trimmedTitle) throw new Error('請輸入標題');
                const cap = Number(capacity || 32);
                if (!Number.isFinite(cap) || cap <= 0) throw new Error('上限不正確');
                const bestOf = Math.max(1, Math.floor(Number(bestOfFrames || 1)));
                if (!Number.isFinite(bestOf) || bestOf <= 0) throw new Error('局數設定不正確');
                const pw = Math.max(0, Math.floor(Number(pointsWin || 0)));
                const pd = Math.max(0, Math.floor(Number(pointsDraw || 0)));
                const pl = Math.max(0, Math.floor(Number(pointsLoss || 0)));
                if (format === 'LEAGUE' && (!Number.isFinite(pw) || !Number.isFinite(pd) || !Number.isFinite(pl))) throw new Error('League 計分設定不正確');
                const deadlineIso = deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null;
                const startsIso = startsAt ? new Date(startsAt).toISOString() : null;
                if (startsAt && !Number.isFinite(new Date(startsAt).getTime())) throw new Error('比賽時間格式不正確');
                if (deadline && !Number.isFinite(new Date(`${deadline}T23:59:59`).getTime())) throw new Error('截止日期格式不正確');
                setSaving(true);
                if (selectedId) {
                  await updateClubTournament(API_URL, operatorId, selectedId, {
                    title: trimmedTitle,
                    description,
                    signupGuide: guide,
                    format,
                    seedMode,
                    leagueRoundRobinMode,
                    bestOfFrames: bestOf,
                    pointsWin: format === 'LEAGUE' ? pw : 3,
                    pointsDraw: format === 'LEAGUE' ? pd : 1,
                    pointsLoss: format === 'LEAGUE' ? pl : 0,
                    capacity: Math.floor(cap),
                    startsAt: startsIso,
                    signupClosesAt: deadlineIso,
                  });
                  showNotice('已更新比賽');
                } else {
                  await createClubTournament(API_URL, operatorId, {
                    title: trimmedTitle,
                    description,
                    signupGuide: guide,
                    format,
                    seedMode,
                    leagueRoundRobinMode,
                    bestOfFrames: bestOf,
                    pointsWin: format === 'LEAGUE' ? pw : 3,
                    pointsDraw: format === 'LEAGUE' ? pd : 1,
                    pointsLoss: format === 'LEAGUE' ? pl : 0,
                    capacity: Math.floor(cap),
                    startsAt: startsIso,
                    signupClosesAt: deadlineIso,
                  });
                  showNotice(`已建立${format === 'LEAGUE' ? ' League' : ' Knockout'}比賽（草稿）`);
                  resetEditor();
                }
                await loadRows();
              } catch (e: any) {
                showNotice(e?.message || '操作失敗', 3000);
              } finally {
                setSaving(false);
              }
            }}
          >
            {selectedId ? '更新' : format === 'LEAGUE' ? '建立 League' : '建立 Knockout'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
            onClick={resetEditor}
          >
            清除
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded cue-surface hover:brightness-95 font-semibold"
            onClick={loadRows}
          >
            重新整理
          </button>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="text-sm cue-muted">載入中...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm cue-muted">暫無比賽</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">狀態</th>
                  <th className="py-2 px-2">標題</th>
                  <th className="py-2 px-2">賽制</th>
                  <th className="py-2 px-2">上限</th>
                  <th className="py-2 px-2">截止</th>
                  <th className="py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row: any) => {
                  const id = String(row?.id || '');
                  const status = String(row?.status || '').toUpperCase();
                  const capN = Number(row?.capacity ?? 0);
                  const confirmedN = Number(row?.confirmedCount ?? 0);
                  const cap = capN > 0 ? `${confirmedN}/${capN}` : '-';
                  const closes = row?.signupClosesAt ? new Date(row.signupClosesAt).toLocaleDateString() : '-';
                  const isSelected = selectedId && id === selectedId;
                  return (
                    <tr key={id} className={`border-b cue-border hover:brightness-95 ${isSelected ? 'bg-white/5' : ''}`}>
                      <td className="py-2 px-2 whitespace-nowrap">{status || '-'}</td>
                      <td className="py-2 px-2 font-semibold">{String(row?.title || '')}</td>
                      <td className="py-2 px-2 cue-muted">{formatTournamentFormatLabel(row?.format)}</td>
                      <td className="py-2 px-2">{cap}</td>
                      <td className="py-2 px-2">{closes}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                            onClick={() => {
                              setSelectedId(id);
                              setTitle(String(row?.title || ''));
                              setDescription(String(row?.description || ''));
                              setGuide(String(row?.signupGuide || ''));
                              setFormat(normalizeTournamentFormat(row?.format));
                              setSeedMode(normalizeSeedMode(row?.seed_mode));
                              setLeagueRoundRobinMode(normalizeLeagueRoundRobinMode((row as any)?.league_round_robin_mode));
                              setBestOfFrames(String(row?.best_of_frames ?? 5));
                              setPointsWin(String(row?.points_win ?? 3));
                              setPointsDraw(String(row?.points_draw ?? 1));
                              setPointsLoss(String(row?.points_loss ?? 0));
                              setCapacity(String(row?.capacity ?? 32));
                              setDeadline(row?.signupClosesAt ? String(row.signupClosesAt).slice(0, 10) : '');
                              if (row?.startsAt) {
                                const d = new Date(String(row.startsAt));
                                if (Number.isFinite(d.getTime())) {
                                  const y = d.getFullYear();
                                  const m = String(d.getMonth() + 1).padStart(2, '0');
                                  const dd = String(d.getDate()).padStart(2, '0');
                                  const hh = String(d.getHours()).padStart(2, '0');
                                  const mm = String(d.getMinutes()).padStart(2, '0');
                                  setStartsAt(`${y}-${m}-${dd}T${hh}:${mm}`);
                                } else {
                                  setStartsAt('');
                                }
                              } else {
                                setStartsAt('');
                              }
                            }}
                          >
                            {isSelected ? '已選擇' : '選擇'}
                          </button>
                          <button
                            type="button"
                            disabled={status === 'PUBLISHED'}
                            className={`px-3 py-1 rounded text-sm font-semibold ${status === 'PUBLISHED' ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                            onClick={async () => {
                              if (!confirm('確定要上架此比賽？')) return;
                              try {
                                await publishClubTournament(API_URL, operatorId, id);
                                await loadRows();
                                showNotice('已上架');
                              } catch (e: any) {
                                showNotice(e?.message || '上架失敗', 3000);
                              }
                            }}
                          >
                            上架
                          </button>
                          <button
                            type="button"
                            disabled={status === 'CLOSED'}
                            className={`px-3 py-1 rounded text-sm font-semibold ${status === 'CLOSED' ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                            onClick={async () => {
                              if (!confirm('確定要關閉此比賽？')) return;
                              try {
                                await closeClubTournament(API_URL, operatorId, id);
                                await loadRows();
                                showNotice('已關閉');
                              } catch (e: any) {
                                showNotice(e?.message || '關閉失敗', 3000);
                              }
                            }}
                          >
                            關閉
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId ? (
        <div className="mt-6 cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-semibold">待確認報名</div>
            <div className="text-xs cue-muted">{pendingLoading ? '讀取中…' : `${pendingRows.length} 筆`}</div>
          </div>
          {pendingLoading ? (
            <div className="text-sm cue-muted">讀取中…</div>
          ) : pendingRows.length === 0 ? (
            <div className="text-sm cue-muted">暫無待確認報名</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">會員</th>
                    <th className="py-2 px-2">報名時間</th>
                    <th className="py-2 px-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.slice(0, 200).map((row: any) => {
                    const signupId = String(row?.id || '');
                    const member = row?.member || {};
                    const who = [String(member?.member_code || '無').trim(), String(member?.name || '').trim()].filter(Boolean).join(' ');
                    return (
                      <tr key={signupId} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 font-semibold">{who || '-'}</td>
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">{row?.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</td>
                        <td className="py-2 px-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded cue-button text-sm font-semibold"
                              onClick={async () => {
                                if (!confirm('確定要確認此報名？')) return;
                                try {
                                  await confirmTournamentSignup(API_URL, operatorId, selectedId, signupId);
                                  await Promise.all([loadSelectedSignups(), loadRows()]);
                                  showNotice('已確認');
                                } catch (e: any) {
                                  showNotice(e?.message || '確認失敗', 3000);
                                }
                              }}
                            >
                              確認
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
                              onClick={async () => {
                                if (!confirm('確定要取消此報名？')) return;
                                try {
                                  await cancelTournamentSignup(API_URL, operatorId, selectedId, signupId);
                                  await Promise.all([loadSelectedSignups(), loadRows()]);
                                  showNotice('已取消');
                                } catch (e: any) {
                                  showNotice(e?.message || '取消失敗', 3000);
                                }
                              }}
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {selectedId ? (
        <div className="mt-4 cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-semibold">已成功報名（已確認）</div>
            <div className="text-xs cue-muted">{confirmedLoading ? '讀取中…' : `${confirmedRows.length} / ${Number(capacity || 0) || 32}`}</div>
          </div>
          {confirmedLoading ? (
            <div className="text-sm cue-muted">讀取中…</div>
          ) : confirmedRows.length === 0 ? (
            <div className="text-sm cue-muted">暫無已確認報名</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">會員</th>
                    <th className="py-2 px-2">確認時間</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedRows.slice(0, 200).map((row: any) => {
                    const member = row?.member || {};
                    const who = [String(member?.member_code || '無').trim(), String(member?.name || '').trim()].filter(Boolean).join(' ');
                    return (
                      <tr key={String(row?.id || '')} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 font-semibold">{who || '-'}</td>
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">
                          {row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : row?.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {selectedId ? (
        <div className="mt-4 cue-surface-strong rounded-lg p-4">
          {isLeague ? (
            <VenueTournamentLeagueWorkspaceHeader
              bestOfFrames={Math.max(1, Number(bestOfFrames || 1))}
              canGenerateParticipants={canGenerateParticipants}
              canGenerateSchedule={canGenerateSchedule}
              canResetSchedule={canResetSchedule}
              confirmedCount={confirmedRows.length}
              currentWorkflowStep={currentWorkflowStep}
              hasParticipants={hasParticipants}
              hasSchedule={hasSchedule}
              isRefreshing={participantsLoading || matchesLoading}
              participantCount={participantsRows.length}
              roundRobinMode={leagueRoundRobinMode}
              scheduleResetSaving={scheduleResetSaving}
              testToolsOpen={testToolsOpen}
              workflowNote={workflowSummaryNote}
              onGenerateParticipants={handleGenerateParticipants}
              onGenerateSchedule={handleGenerateLeagueSchedule}
              onRefresh={loadSelectedPhase1Data}
              onResetSchedule={handleResetLeagueSchedule}
              onToggleTestTools={() => setTestToolsOpen((prev) => !prev)}
            />
          ) : (
            <VenueTournamentKnockoutWorkspaceHeader
              canGenerateParticipants={canGenerateParticipants}
              canGenerateSchedule={canGenerateSchedule}
              canResetSchedule={canResetSchedule}
              currentWorkflowStep={currentWorkflowStep}
              isRefreshing={participantsLoading || matchesLoading}
              scheduleResetSaving={scheduleResetSaving}
              testToolsOpen={testToolsOpen}
              workflowNote={workflowSummaryNote}
              onGenerateParticipants={handleGenerateParticipants}
              onGenerateSchedule={handleGenerateKnockoutSchedule}
              onRefresh={loadSelectedPhase1Data}
              onResetSchedule={handleResetKnockoutSchedule}
              onToggleTestTools={() => setTestToolsOpen((prev) => !prev)}
            />
          )}

          {testToolsOpen ? (
            <VenueTournamentTestToolsPanel
              operatorId={operatorId}
              tournamentId={selectedId}
              tournamentTitle={String(selectedTournament?.title || '')}
              isLeague={isLeague}
              confirmedCount={confirmedRows.length}
              capacity={Math.max(2, Number(capacity || 0) || 32)}
              confirmedRows={confirmedRows}
              participantsRows={participantsRows}
              matchesRows={matchesRows}
              onCompleted={async () => {
                await Promise.all([loadSelectedSignups(), loadSelectedPhase1Data(), loadRows()]);
              }}
              showNotice={showNotice}
            />
          ) : null}

          {isLeague ? (
            <VenueTournamentLeagueWorkspaceOverview
              bestOfFrames={bestOfFrames}
              formatTournamentFormatLabel={formatTournamentFormatLabel}
              formatWorkflowStatusLabel={formatWorkflowStatusLabel}
              leagueRoundRobinMode={leagueRoundRobinMode}
              leagueSummary={leagueSummary}
              note={tournamentSummaryNote}
              pointsDraw={pointsDraw}
              pointsLoss={pointsLoss}
              pointsWin={pointsWin}
              tournamentFormat={tournamentFormat}
              workflowStatus={workflowStatus}
            />
          ) : (
            <VenueTournamentKnockoutWorkspaceOverview
              formatParticipantLabel={formatParticipantLabel}
              formatTournamentFormatLabel={formatTournamentFormatLabel}
              formatWorkflowStatusLabel={formatWorkflowStatusLabel}
              knockoutSummary={knockoutSummary}
              note={tournamentSummaryNote}
              podiumSummary={podiumSummary}
              tournamentFormat={tournamentFormat}
              workflowStatus={workflowStatus}
            />
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              {isLeague ? (
                <VenueTournamentLeagueParticipantsPanel
                  formatFinalRankLabel={formatFinalRankLabel}
                  formatParticipantLabel={formatParticipantLabel}
                  formatParticipantStatusLabel={formatParticipantStatusLabel}
                  participantsLoading={participantsLoading}
                  participantsRows={participantsRows}
                />
              ) : (
                <VenueTournamentKnockoutParticipantsPanel
                  canEditSeeding={canEditSeeding}
                  formatFinalRankLabel={formatFinalRankLabel}
                  formatParticipantLabel={formatParticipantLabel}
                  formatParticipantStatusLabel={formatParticipantStatusLabel}
                  hasSchedule={hasSchedule}
                  participantsLoading={participantsLoading}
                  participantsRows={participantsRows}
                  participantSeedDrafts={participantSeedDrafts}
                  participantSeedSavingId={participantSeedSavingId}
                  seedMode={seedMode}
                  seedModeSaving={seedModeSaving}
                  onApplySeedMode={async () => {
                    try {
                      setSeedModeSaving(true);
                      const result = await updateTournamentSeedMode(API_URL, operatorId, selectedId, { seedMode });
                      const nextParticipants = Array.isArray((result as any)?.participants) ? (result as any).participants : [];
                      setParticipantsRows(nextParticipants);
                      setParticipantSeedDrafts(Object.fromEntries(nextParticipants.map((item: any, itemIndex: number) => [String(item?.id || itemIndex), String(item?.seed ?? itemIndex + 1)])));
                      await loadRows();
                      showNotice(`已套用 ${formatSeedModeLabel(seedMode)}：更新 ${nextParticipants.length} 位參賽者 seed 排序。`, 3200);
                    } catch (e: any) {
                      showNotice(e?.message || '套用 seed 模式失敗', 3000);
                    } finally {
                      setSeedModeSaving(false);
                    }
                  }}
                  onSeedDraftChange={(rowId, value) => setParticipantSeedDrafts((prev) => ({ ...prev, [rowId]: value }))}
                  onSeedModeChange={(value) => setSeedMode(normalizeSeedMode(value))}
                  onUpdateSeed={async (rowId, seedDraft) => {
                    try {
                      const seed = Math.max(1, Math.floor(Number(seedDraft || 1)));
                      setParticipantSeedSavingId(rowId);
                      const result = await updateTournamentParticipant(API_URL, operatorId, selectedId, rowId, { seed });
                      const next = Array.isArray((result as any)?.participants) ? (result as any).participants : [];
                      setParticipantsRows(next);
                      setParticipantSeedDrafts(Object.fromEntries(next.map((item: any, itemIndex: number) => [String(item?.id || itemIndex), String(item?.seed ?? itemIndex + 1)])));
                      const updatedParticipant = next.find((item: any) => String(item?.id || '') === rowId) || null;
                      showNotice(`已更新 seed：${formatParticipantLabel(updatedParticipant)} -> #${seed}`, 3200);
                    } catch (e: any) {
                      showNotice(e?.message || '更新 seed 失敗', 3000);
                    } finally {
                      setParticipantSeedSavingId('');
                    }
                  }}
                />
              )}
            </div>

            <div>
              {isLeague ? (
                <VenueTournamentLeagueWorkspaceMainContent
                  bracketColumns={bracketColumns}
                  buildMatchProgressSummary={buildMatchProgressSummary}
                  formatDisplayDateTime={formatDisplayDateTime}
                  formatMatchResultTypeLabel={formatMatchResultTypeLabel}
                  formatParticipantLabel={formatParticipantLabel}
                  leagueRounds={leagueRounds}
                  matchesLoading={matchesLoading}
                  matchesRows={matchesRows}
                  participantsCount={participantsRows.length}
                  pointsDraw={Number(selectedTournament?.points_draw ?? 1)}
                  pointsLoss={Number(selectedTournament?.points_loss ?? 0)}
                  pointsWin={Number(selectedTournament?.points_win ?? 3)}
                  selectedMatchId={selectedMatchId}
                  selectedTournamentBestOf={selectedTournament?.best_of_frames}
                  selectMatchForScoring={selectMatchForScoring}
                  standingsRows={standingsRows}
                  tournamentTitle={String(selectedTournament?.title || '')}
                />
              ) : (
                <VenueTournamentKnockoutWorkspaceMainContent
                  bracketColumns={bracketColumns}
                  buildMatchProgressSummary={buildMatchProgressSummary}
                  formatDisplayDateTime={formatDisplayDateTime}
                  formatMatchResultTypeLabel={formatMatchResultTypeLabel}
                  formatParticipantLabel={formatParticipantLabel}
                  leagueRounds={leagueRounds}
                  matchesLoading={matchesLoading}
                  matchesRows={matchesRows}
                  participantsCount={participantsRows.length}
                  selectedMatchId={selectedMatchId}
                  selectedTournamentBestOf={selectedTournament?.best_of_frames}
                  selectMatchForScoring={selectMatchForScoring}
                  tournamentTitle={selectedTournament?.title}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {scoringWorkspace ? (
        <VenueTournamentScoringWorkspace workspace={scoringWorkspace} />
      ) : null}
    </div>
  );
};

export default VenueTournamentsModule;
