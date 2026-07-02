import React, { useCallback, useEffect, useMemo, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  cancelTournamentSignup,
  closeClubTournament,
  confirmTournamentSignup,
  createTournamentMatchBreak,
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
  recordTournamentMatchResult,
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

type EditableFrame = {
  frameNo: number;
  winnerSide: 'A' | 'B';
  playerAScore: string;
  playerBScore: string;
  playerAHighestBreak: string;
  playerBHighestBreak: string;
  isPlaceholder?: boolean;
};

type TournamentFormat = 'KNOCKOUT' | 'LEAGUE';
type TournamentSeedMode = 'MANUAL' | 'RANKING' | 'RANDOM';
type MatchResultType = 'STANDARD' | 'BYE' | 'WALKOVER' | 'FORFEIT';

const BRACKET_CARD_HEIGHT = 92;
const BRACKET_BASE_GAP = 18;
const BRACKET_CONNECTOR_HALF_GAP = 24;

function formatDateTimeLocalInput(raw: any) {
  if (!raw) return '';
  const d = new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:${mm}`;
}

function formatDisplayDateTime(raw: any) {
  if (!raw) return '-';
  const d = new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString();
}

function formatMemberLabel(member: any) {
  return [
    String(member?.member_code || '').trim(),
    String(member?.name || '').trim(),
  ].filter(Boolean).join(' ') || '-';
}

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

function createEmptyEditableFrame(frameNo: number): EditableFrame {
  return {
    frameNo,
    winnerSide: 'A',
    playerAScore: '0',
    playerBScore: '0',
    playerAHighestBreak: '0',
    playerBHighestBreak: '0',
    isPlaceholder: true,
  };
}

function getTargetWins(bestOfRaw: any) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1)));
  return Math.floor(bestOf / 2) + 1;
}

function buildFramesFromMatch(match: any, tournamentBestOfRaw?: any): EditableFrame[] {
  const frames = Array.isArray(match?.frames) ? match.frames : [];
  const next = frames.length > 0
    ? frames.map((frame: any, index: number) => ({
      frameNo: Number(frame?.frame_no || index + 1),
      winnerSide: String(frame?.winner_participant_id || '') === String(match?.player_b_participant_id || '') ? 'B' : 'A',
      playerAScore: String(frame?.player_a_score ?? 0),
      playerBScore: String(frame?.player_b_score ?? 0),
      playerAHighestBreak: String(frame?.player_a_highest_break ?? 0),
      playerBHighestBreak: String(frame?.player_b_highest_break ?? 0),
      isPlaceholder: false,
    }))
    : [];
  const bestOf = Math.max(1, Math.floor(Number(match?.best_of_frames ?? tournamentBestOfRaw ?? 1) || 1));
  const targetWins = getTargetWins(bestOf);
  const aWins = Number(match?.player_a_frames_won || 0);
  const bWins = Number(match?.player_b_frames_won || 0);
  const matchStatus = String(match?.status || '').trim().toUpperCase();
  const canAppendNextFrame =
    normalizeMatchResultType(match?.result_type) === 'STANDARD'
    && matchStatus !== 'COMPLETED'
    && next.length < bestOf
    && aWins < targetWins
    && bWins < targetWins;
  if (canAppendNextFrame) {
    next.push(createEmptyEditableFrame((next[next.length - 1]?.frameNo || 0) + 1));
  }
  return next.length > 0 ? next : [createEmptyEditableFrame(1)];
}

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function formatKnockoutRoundLabel(match: any, participantCount: number) {
  const roundNo = Number(match?.round_no || 0);
  if (roundNo <= 0) return '-';
  const bracketSize = nextPowerOfTwo(Math.max(2, participantCount || 2));
  const hasPreliminaryRound = participantCount > 0 && participantCount !== bracketSize;
  if (hasPreliminaryRound && roundNo === 1) return '預賽';
  const roundOffset = hasPreliminaryRound ? 1 : 0;
  const stageSize = bracketSize / (2 ** Math.max(0, roundNo - 1));
  if (stageSize <= 2) return '決賽';
  if (stageSize === 4) return '4 強';
  if (stageSize === 8) return '8 強';
  if (stageSize === 16) return '16 強';
  if (stageSize === 32) return '32 強';
  if (stageSize === 64) return '64 強';
  if (stageSize === 128) return '128 強';
  if (stageSize === 256) return '256 強';
  return `Round ${Math.max(1, roundNo - roundOffset)}`;
}

function formatLeagueRoundLabel(match: any) {
  const roundNo = Number(match?.round_no || 0);
  return roundNo > 0 ? `第 ${roundNo} 輪` : '循環賽';
}

function buildKnockoutSummary(participantsRows: any[], matchesRows: any[]) {
  const participantCount = participantsRows.length;
  const bracketSize = participantCount > 1 ? nextPowerOfTwo(participantCount) : 0;
  const byeCount = participantCount > 1 ? Math.max(0, bracketSize - participantCount) : 0;
  const completedCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length;
  const readyCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length;
  const pendingCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length;
  return { participantCount, bracketSize, byeCount, completedCount, readyCount, pendingCount };
}

function buildLeagueSummary(participantsRows: any[], matchesRows: any[]) {
  const participantCount = participantsRows.length;
  const totalRounds = participantCount > 1 ? participantCount - 1 + (participantCount % 2 === 1 ? 1 : 0) : 0;
  const completedCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length;
  const readyCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length;
  const pendingCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length;
  return { participantCount, totalRounds, totalMatches: matchesRows.length, completedCount, readyCount, pendingCount };
}

function getBracketColumnPaddingTop(roundIndex: number) {
  if (roundIndex <= 0) return 0;
  return ((2 ** roundIndex) - 1) * (BRACKET_CARD_HEIGHT + BRACKET_BASE_GAP) / 2;
}

function getBracketColumnGap(roundIndex: number) {
  if (roundIndex <= 0) return BRACKET_BASE_GAP;
  return (2 ** roundIndex) * (BRACKET_CARD_HEIGHT + BRACKET_BASE_GAP) - BRACKET_CARD_HEIGHT;
}

function getBracketColumnHeight(matchCount: number) {
  if (matchCount <= 0) return BRACKET_CARD_HEIGHT;
  return matchCount * BRACKET_CARD_HEIGHT + Math.max(0, matchCount - 1) * BRACKET_BASE_GAP;
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
  const [resultSaving, setResultSaving] = useState(false);
  const [breakSaving, setBreakSaving] = useState(false);
  const [breakMemberId, setBreakMemberId] = useState('');
  const [breakFrameNo, setBreakFrameNo] = useState('1');
  const [breakPoints, setBreakPoints] = useState('');
  const [breakRecordedAt, setBreakRecordedAt] = useState(() => formatDateTimeLocalInput(new Date()));
  const [breakNote, setBreakNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
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
    setBreakMemberId('');
    setBreakFrameNo('1');
    setBreakPoints('');
    setBreakRecordedAt(formatDateTimeLocalInput(new Date()));
    setBreakNote('');
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
    setFormat(normalizeTournamentFormat(selectedTournament?.format));
    setSeedMode(normalizeSeedMode(selectedTournament?.seed_mode));
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
    const firstReadyMatch = matchesRows.find((row: any) => (
      !!row?.player_a_participant_id
      && !!row?.player_b_participant_id
      && String(row?.status || '').toUpperCase() !== 'PENDING'
    ));
    if (firstReadyMatch) {
      setSelectedMatchId(String(firstReadyMatch.id || ''));
    }
  }, [matchesRows, selectedMatchId]);
  const tournamentFormat = normalizeTournamentFormat(selectedTournament?.format || format);
  const isLeague = tournamentFormat === 'LEAGUE';
  const workflowStatus = String(selectedTournament?.workflow_status || 'DRAFT').trim().toUpperCase();
  const hasParticipants = participantsRows.length > 0;
  const hasSchedule = matchesRows.length > 0;
  const canGenerateParticipants = confirmedRows.length > 0 && !hasSchedule;
  const canGenerateSchedule = participantsRows.length >= 2 && !hasSchedule;
  const canEditSeeding = hasParticipants && !hasSchedule;
  const hasPlayedMatches = matchesRows.some((row: any) => {
    const frames = Array.isArray(row?.frames) ? row.frames : [];
    return frames.length > 0 || !!row?.started_at || !!row?.ended_at;
  });
  const canResetSchedule = hasSchedule && !hasPlayedMatches;
  const selectedMatchHasPlayers = !!selectedMatch?.player_a_participant_id && !!selectedMatch?.player_b_participant_id;
  const selectedMatchStatus = String(selectedMatch?.status || '').trim().toUpperCase();
  const selectedMatchResultType = normalizeMatchResultType(selectedMatch?.result_type);
  const selectedMatchIsCompleted = selectedMatchStatus === 'COMPLETED';
  const selectedMatchResultEditable = !!selectedMatch && selectedMatchHasPlayers && selectedMatchStatus !== 'PENDING';
  const selectedMatchBreakEnabled = !!selectedMatch && selectedMatchHasPlayers && selectedMatchResultType === 'STANDARD';
  const selectedMatchMemberOptions = useMemo(() => (selectedMatch ? [
    {
      value: String(selectedMatch?.player_a_participant?.member?.id || ''),
      label: formatMemberLabel(selectedMatch?.player_a_participant?.member),
    },
    {
      value: String(selectedMatch?.player_b_participant?.member?.id || ''),
      label: formatMemberLabel(selectedMatch?.player_b_participant?.member),
    },
  ].filter((item) => item.value) : []), [selectedMatch]);
  const selectedMatchBestOf = Math.max(1, Math.floor(Number(selectedMatch?.best_of_frames ?? selectedTournament?.best_of_frames ?? 1) || 1));
  const selectedMatchTargetWins = getTargetWins(selectedMatchBestOf);
  const selectedMatchCompletedFrames = Array.isArray(selectedMatch?.frames) ? selectedMatch.frames.length : 0;
  const selectedMatchWinnerLabel = useMemo(() => {
    if (!selectedMatchIsCompleted) return '';
    if (String(selectedMatch?.winner_participant_id || '') === String(selectedMatch?.player_a_participant_id || '')) {
      return formatMemberLabel(selectedMatch?.player_a_participant?.member);
    }
    if (String(selectedMatch?.winner_participant_id || '') === String(selectedMatch?.player_b_participant_id || '')) {
      return formatMemberLabel(selectedMatch?.player_b_participant?.member);
    }
    return '';
  }, [selectedMatch, selectedMatchIsCompleted]);
  const selectedMatchBreakRows = useMemo(() => (
    Array.isArray(selectedMatch?.breaks) ? [...selectedMatch.breaks] : []
  ).sort((a: any, b: any) => {
    const aFrame = Number(a?.frame_no || 0);
    const bFrame = Number(b?.frame_no || 0);
    if (aFrame !== bFrame) return aFrame - bFrame;
    const aTime = a?.recorded_at ? new Date(a.recorded_at).getTime() : 0;
    const bTime = b?.recorded_at ? new Date(b.recorded_at).getTime() : 0;
    return bTime - aTime;
  }), [selectedMatch]);
  const selectedMatchBreakFrameOptions = useMemo(() => {
    const values = Array.from(new Set(resultFrames.map((frame) => String(frame.frameNo || '1')).filter(Boolean)));
    return values.length > 0 ? values : ['1'];
  }, [resultFrames]);
  const selectedMatchCurrentFrameNo = Number(resultFrames[resultFrames.length - 1]?.frameNo || 1);
  const selectedMatchCanAddFrame = selectedMatchResultEditable
    && selectedMatchResultType === 'STANDARD'
    && resultFrames.length < selectedMatchBestOf;
  useEffect(() => {
    if (!selectedMatch) return;
    const nextFrames = buildFramesFromMatch(selectedMatch, selectedTournament?.best_of_frames);
    setResultStartedAt(formatDateTimeLocalInput(selectedMatch?.started_at));
    setResultEndedAt(formatDateTimeLocalInput(selectedMatch?.ended_at));
    setResultQuickWinnerSide(
      String(selectedMatch?.winner_participant_id || '') === String(selectedMatch?.player_b_participant_id || '') ? 'B' : 'A'
    );
    setResultFrames(nextFrames);
    setBreakMemberId((prev) => (
      selectedMatchMemberOptions.some((item) => item.value === prev)
        ? prev
        : String(selectedMatchMemberOptions[0]?.value || '')
    ));
    setBreakFrameNo(String(nextFrames[nextFrames.length - 1]?.frameNo || 1));
  }, [selectedMatch, selectedMatchMemberOptions, selectedTournament?.best_of_frames]);
  const bracketColumns = useMemo(() => {
    const grouped = new Map<string, { roundNo: number; items: Array<any> }>();
    for (const row of matchesRows) {
      const key = formatKnockoutRoundLabel(row, participantsRows.length);
      const roundNo = Number(row?.round_no || 0);
      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(row);
        existing.roundNo = existing.roundNo > 0 ? Math.min(existing.roundNo, roundNo || existing.roundNo) : roundNo;
      } else {
        grouped.set(key, { roundNo, items: [row] });
      }
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[1].roundNo - b[1].roundNo)
      .map(([label, group], roundIndex, allColumns) => {
      const items = group.items;
      const sortedItems = [...items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0));
      const paddingTop = getBracketColumnPaddingTop(roundIndex);
      const gap = getBracketColumnGap(roundIndex);
      const cardCenters = sortedItems.map((_: any, itemIndex: number) => (
        paddingTop + itemIndex * (BRACKET_CARD_HEIGHT + gap) + BRACKET_CARD_HEIGHT / 2
      ));
      const connectors = roundIndex < allColumns.length - 1
        ? Array.from({ length: Math.floor(sortedItems.length / 2) }, (_unused, pairIndex) => {
            const topCenter = cardCenters[pairIndex * 2];
            const bottomCenter = cardCenters[pairIndex * 2 + 1];
            if (typeof topCenter !== 'number' || typeof bottomCenter !== 'number') return null;
            return {
              top: topCenter,
              height: Math.max(0, bottomCenter - topCenter),
            };
          }).filter(Boolean)
        : [];
        return {
          label,
          roundIndex,
          isFinal: roundIndex === allColumns.length - 1,
          items: sortedItems,
          paddingTop,
          gap,
          columnHeight: Math.max(getBracketColumnHeight(matchesRows.length), paddingTop + (sortedItems.length * BRACKET_CARD_HEIGHT) + Math.max(0, sortedItems.length - 1) * gap),
          connectors,
        };
      });
  }, [matchesRows, participantsRows.length]);
  const knockoutSummary = useMemo(() => buildKnockoutSummary(participantsRows, matchesRows), [participantsRows, matchesRows]);
  const leagueSummary = useMemo(() => buildLeagueSummary(participantsRows, matchesRows), [participantsRows, matchesRows]);
  const leagueRounds = useMemo(() => {
    const grouped = new Map<number, any[]>();
    for (const row of matchesRows) {
      const roundNo = Number(row?.round_no || 0);
      if (!grouped.has(roundNo)) grouped.set(roundNo, []);
      grouped.get(roundNo)!.push(row);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([roundNo, items]) => ({
        roundNo,
        label: roundNo > 0 ? `第 ${roundNo} 輪` : '循環賽',
        items: [...items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0)),
      }));
  }, [matchesRows]);
  const podiumSummary = useMemo(() => {
    const champion = participantsRows.find((row: any) => Number(row?.final_rank || 0) === 1) || null;
    const runnerUp = participantsRows.find((row: any) => Number(row?.final_rank || 0) === 2) || null;
    const semiFinalists = participantsRows
      .filter((row: any) => Number(row?.final_rank || 0) === 3)
      .sort((a: any, b: any) => Number(a?.seed || 0) - Number(b?.seed || 0));
    return { champion, runnerUp, semiFinalists };
  }, [participantsRows]);

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
            '填寫標題、賽制、局數、上限、截止日期、比賽時間（可選）、詳情與參賽指引後按「新增」。',
              '在下方列表可「選擇」某個比賽以查看報名名單與賽事工作台。',
            '按「上架」讓會員端可見並可報名；按「關閉」停止報名與後續操作。',
              '確認報名後，可生成正式名單與對應賽制賽程，再在同頁輸入每局賽果與記錄比賽 20+。',
          ]}
          tips={[
            '建議先完成內容後再上架，避免會員看到未完成資訊。',
            '如要在場館公開頁顯示比賽入口，請同時於場館公開設定開啟「公開比賽入口」。',
              'Phase 1 現已支援 Knockout bracket 與 League round-robin + standings，之後再補 live scoring 與更完整統計。',
          ]}
        />
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

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
          <label className="block text-sm mb-1 cue-muted">Seed 模式</label>
          <select value={seedMode} onChange={(e) => setSeedMode(normalizeSeedMode(e.target.value))} className="w-full px-3 py-2 rounded cue-input">
            <option value="MANUAL">手動種子</option>
            <option value="RANKING">按評分排序</option>
            <option value="RANDOM">隨機抽籤</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">每場局數 / Best Of</label>
          <input value={bestOfFrames} onChange={(e) => setBestOfFrames(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="5" type="number" min={1} />
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
                if (!Number.isFinite(pw) || !Number.isFinite(pd) || !Number.isFinite(pl)) throw new Error('League 計分設定不正確');
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
                    bestOfFrames: bestOf,
                    pointsWin: pw,
                    pointsDraw: pd,
                    pointsLoss: pl,
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
                    bestOfFrames: bestOf,
                    pointsWin: pw,
                    pointsDraw: pd,
                    pointsLoss: pl,
                    capacity: Math.floor(cap),
                    startsAt: startsIso,
                    signupClosesAt: deadlineIso,
                  });
                  showNotice('已建立比賽（草稿）');
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
            {selectedId ? '更新' : '建立'}
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
            <div>
              <div className="font-semibold">正式參賽名單 / {isLeague ? 'League' : 'Knockout'} 工作台</div>
              <div className="text-xs cue-muted mt-1">
                先由已確認報名生成正式名單，再按目前設定生成 {isLeague ? 'League round-robin' : 'Knockout'} 賽程。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canGenerateParticipants}
                className={`px-3 py-2 rounded text-sm font-semibold ${canGenerateParticipants ? 'cue-button' : 'cue-surface-strong cue-muted'}`}
                onClick={async () => {
                  try {
                    await generateTournamentParticipants(API_URL, operatorId, selectedId);
                    await Promise.all([loadSelectedPhase1Data(), loadRows()]);
                    showNotice('已生成正式參賽名單');
                  } catch (e: any) {
                    showNotice(e?.message || '生成正式參賽名單失敗', 3000);
                  }
                }}
              >
                生成正式名單
              </button>
              <button
                type="button"
                disabled={!canGenerateSchedule}
                className={`px-3 py-2 rounded text-sm font-semibold ${canGenerateSchedule ? 'cue-button' : 'cue-surface-strong cue-muted'}`}
                onClick={async () => {
                  if (!confirm(`確定按目前正式名單生成 ${isLeague ? 'League' : 'Knockout'} 賽程？`)) return;
                  try {
                    if (isLeague) {
                      await generateTournamentLeagueSchedule(API_URL, operatorId, selectedId);
                    } else {
                      await generateTournamentKnockoutSchedule(API_URL, operatorId, selectedId);
                    }
                    await loadSelectedPhase1Data();
                    showNotice(`已生成${isLeague ? '循環賽' : '淘汰賽'}賽程`);
                  } catch (e: any) {
                    showNotice(e?.message || `生成${isLeague ? '循環賽' : '淘汰賽'}賽程失敗`, 3000);
                  }
                }}
              >
                {isLeague ? '生成 League 賽程' : '生成 Knockout 賽程'}
              </button>
              <button
                type="button"
                disabled={!canResetSchedule || scheduleResetSaving}
                className={`px-3 py-2 rounded text-sm font-semibold ${!canResetSchedule || scheduleResetSaving ? 'cue-surface-strong cue-muted' : 'cue-surface hover:brightness-95'}`}
                onClick={async () => {
                  if (!selectedId) return;
                  if (!confirm(`確定要重建${isLeague ? ' League ' : ' Knockout '}賽程？現有賽程將被清空，但正式名單會保留。`)) return;
                  if (!confirm('再次確認：只適用於未開打賽程。若已有實際賽果，系統會拒絕重建。')) return;
                  try {
                    setScheduleResetSaving(true);
                    setSelectedMatchId('');
                    if (isLeague) {
                      await resetTournamentLeagueSchedule(API_URL, operatorId, selectedId);
                    } else {
                      await resetTournamentKnockoutSchedule(API_URL, operatorId, selectedId);
                    }
                    await Promise.all([loadSelectedPhase1Data(), loadRows()]);
                    showNotice(`已重建${isLeague ? '循環賽' : '淘汰賽'}賽程，可重新調整 seed 與重新生成`);
                  } catch (e: any) {
                    showNotice(e?.message || `重建${isLeague ? '循環賽' : '淘汰賽'}賽程失敗`, 3500);
                  } finally {
                    setScheduleResetSaving(false);
                  }
                }}
              >
                {scheduleResetSaving ? '重建中...' : '重建賽程'}
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                onClick={loadSelectedPhase1Data}
              >
                {participantsLoading || matchesLoading ? '更新中...' : '重新整理工作台'}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted">Workflow</div>
              <div className="font-semibold mt-1">{formatWorkflowStatusLabel(workflowStatus)}</div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted">賽制</div>
              <div className="font-semibold mt-1">{formatTournamentFormatLabel(tournamentFormat)}</div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted">{isLeague ? '正式參賽者 / 輪次' : '正式參賽者 / 籤表'}</div>
              <div className="font-semibold mt-1">
                {isLeague
                  ? `${leagueSummary.participantCount || 0} / ${leagueSummary.totalRounds || '-'}`
                  : `${knockoutSummary.participantCount || 0} / ${knockoutSummary.bracketSize || '-'}`
                }
              </div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted">{isLeague ? 'Best Of / 計分' : '輪空 Bye'}</div>
              <div className="font-semibold mt-1">
                {isLeague
                  ? `BO${bestOfFrames || '-'} / ${pointsWin}-${pointsDraw}-${pointsLoss}`
                  : knockoutSummary.byeCount}
              </div>
            </div>
            <div className="cue-surface rounded-lg p-3">
              <div className="text-xs cue-muted">賽程進度</div>
              <div className="font-semibold mt-1">
                {isLeague
                  ? `${leagueSummary.completedCount} 完成 / ${leagueSummary.readyCount} 就緒 / ${leagueSummary.pendingCount} 待定`
                  : `${knockoutSummary.completedCount} 完成 / ${knockoutSummary.readyCount} 就緒 / ${knockoutSummary.pendingCount} 待定`
                }
              </div>
            </div>
          </div>
          {!isLeague && (podiumSummary.champion || podiumSummary.runnerUp || podiumSummary.semiFinalists.length > 0) ? (
            <div className="grid gap-3 md:grid-cols-3 mb-4">
              <div className="cue-surface rounded-lg p-3">
                <div className="text-xs cue-muted">冠軍</div>
                <div className="font-semibold mt-1">{podiumSummary.champion ? formatParticipantLabel(podiumSummary.champion) : '-'}</div>
              </div>
              <div className="cue-surface rounded-lg p-3">
                <div className="text-xs cue-muted">亞軍</div>
                <div className="font-semibold mt-1">{podiumSummary.runnerUp ? formatParticipantLabel(podiumSummary.runnerUp) : '-'}</div>
              </div>
              <div className="cue-surface rounded-lg p-3">
                <div className="text-xs cue-muted">四強</div>
                <div className="font-semibold mt-1">
                  {podiumSummary.semiFinalists.length > 0
                    ? podiumSummary.semiFinalists.map((row: any) => formatParticipantLabel(row)).join(' / ')
                    : '-'}
                </div>
              </div>
            </div>
          ) : null}
          <div className="text-xs cue-muted mb-4">
            {!confirmedRows.length
              ? '先確認至少 1 位報名者，之後才可生成正式名單。'
              : hasSchedule
                ? hasPlayedMatches
                  ? `賽程已開始，正式名單與 seedMode 會鎖定，且不可再重建${isLeague ? '循環賽' : 'bracket'}。`
                  : `賽程已生成但尚未開打，可使用「重建賽程」清空目前${isLeague ? 'League' : 'Knockout'}賽程。`
                : !hasParticipants
                  ? `先生成正式名單，再決定 seedMode 與${isLeague ? ' League' : ' Knockout'}賽程。`
                  : participantsRows.length < 2
                    ? `正式名單至少需要 2 位有效參賽者才可生成${isLeague ? ' League' : ' Knockout'}賽程。`
                    : `目前可調整種子及生成${isLeague ? ' League' : ' Knockout'}賽程。`}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="flex flex-col gap-3 mb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">正式參賽名單</div>
                  <div className="text-xs cue-muted">{participantsLoading ? '讀取中…' : `${participantsRows.length} 人`}</div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs mb-1 cue-muted">目前 seedMode</label>
                    <select value={seedMode} onChange={(e) => setSeedMode(normalizeSeedMode(e.target.value))} className="px-3 py-2 rounded cue-input text-sm min-w-40" disabled={!canEditSeeding || seedModeSaving}>
                      <option value="MANUAL">手動種子</option>
                      <option value="RANKING">按評分排序</option>
                      <option value="RANDOM">隨機抽籤</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={seedModeSaving || !canEditSeeding}
                    className={`px-3 py-2 rounded text-sm font-semibold ${seedModeSaving || !canEditSeeding ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                    onClick={async () => {
                      try {
                        setSeedModeSaving(true);
                        const result = await updateTournamentSeedMode(API_URL, operatorId, selectedId, { seedMode });
                        const nextParticipants = Array.isArray((result as any)?.participants) ? (result as any).participants : [];
                        setParticipantsRows(nextParticipants);
                        setParticipantSeedDrafts(Object.fromEntries(nextParticipants.map((item: any, itemIndex: number) => [String(item?.id || itemIndex), String(item?.seed ?? itemIndex + 1)])));
                        await loadRows();
                        showNotice(`已套用 ${formatSeedModeLabel(seedMode)}`);
                      } catch (e: any) {
                        showNotice(e?.message || '套用 seed 模式失敗', 3000);
                      } finally {
                        setSeedModeSaving(false);
                      }
                    }}
                  >
                    {seedModeSaving ? '套用中...' : '套用 seedMode'}
                  </button>
                  <div className="text-xs cue-muted">手動改 seed 會自動切回 `MANUAL`；賽程生成後會鎖定。</div>
                </div>
              </div>
              {participantsLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : participantsRows.length === 0 ? (
                <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">Seed</th>
                        <th className="py-2 px-2">球手</th>
                        <th className="py-2 px-2">狀態</th>
                        <th className="py-2 px-2">名次</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantsRows.map((row: any, index) => {
                        const rowId = String(row?.id || index);
                        const seedDraft = participantSeedDrafts[rowId] ?? String(row?.seed ?? index + 1);
                        const isSaving = participantSeedSavingId === rowId;
                        return (
                        <tr key={rowId} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-2 w-28">
                            <input
                              type="number"
                              min={1}
                              value={seedDraft}
                              onChange={(e) => setParticipantSeedDrafts((prev) => ({ ...prev, [rowId]: e.target.value }))}
                              className="w-full px-2 py-1 rounded cue-input"
                              disabled={isSaving || !canEditSeeding}
                            />
                          </td>
                          <td className="py-2 px-2 font-semibold">{formatParticipantLabel(row)}</td>
                          <td className="py-2 px-2 cue-muted">{formatParticipantStatusLabel(row?.status)}</td>
                          <td className="py-2 px-2 cue-muted">{formatFinalRankLabel(row?.final_rank)}</td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              disabled={isSaving || !canEditSeeding}
                              className={`px-3 py-1 rounded text-sm font-semibold ${isSaving || !canEditSeeding ? 'cue-surface-strong cue-muted' : 'cue-surface hover:brightness-95'}`}
                              onClick={async () => {
                                try {
                                  const seed = Math.max(1, Math.floor(Number(seedDraft || 1)));
                                  setParticipantSeedSavingId(rowId);
                                  const result = await updateTournamentParticipant(API_URL, operatorId, selectedId, rowId, { seed });
                                  const next = Array.isArray((result as any)?.participants) ? (result as any).participants : [];
                                  setParticipantsRows(next);
                                  setParticipantSeedDrafts(Object.fromEntries(next.map((item: any, itemIndex: number) => [String(item?.id || itemIndex), String(item?.seed ?? itemIndex + 1)])));
                                  showNotice('已更新 seed');
                                } catch (e: any) {
                                  showNotice(e?.message || '更新 seed 失敗', 3000);
                                } finally {
                                  setParticipantSeedSavingId('');
                                }
                              }}
                            >
                              {isSaving ? '儲存中...' : '更新 seed'}
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              {isLeague ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-semibold">League 積分榜</div>
                    <div className="text-xs cue-muted">{standingsRows.length} 人</div>
                  </div>
                  {standingsRows.length === 0 ? (
                    <div className="text-sm cue-muted">賽程生成後會在這裡顯示 standings</div>
                  ) : (
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="cue-muted border-b cue-border">
                            <th className="py-2 px-2">名次</th>
                            <th className="py-2 px-2">球手</th>
                            <th className="py-2 px-2">賽</th>
                            <th className="py-2 px-2">勝和負</th>
                            <th className="py-2 px-2">局差</th>
                            <th className="py-2 px-2">積分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standingsRows.map((row: any) => (
                            <tr key={String(row?.participantId || '')} className="border-b cue-border hover:brightness-95">
                              <td className="py-2 px-2 font-semibold">{row?.position || '-'}</td>
                              <td className="py-2 px-2 font-semibold">{formatParticipantLabel(row?.participant)}</td>
                              <td className="py-2 px-2 cue-muted">{Number(row?.played || 0)}</td>
                              <td className="py-2 px-2 cue-muted">{Number(row?.won || 0)} / {Number(row?.drawn || 0)} / {Number(row?.lost || 0)}</td>
                              <td className="py-2 px-2 cue-muted">{Number(row?.framesFor || 0)} - {Number(row?.framesAgainst || 0)} ({Number(row?.frameDiff || 0)})</td>
                              <td className="py-2 px-2">{Number(row?.matchPoints || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">{isLeague ? 'League 賽程' : 'Knockout 賽程'}</div>
                <div className="text-xs cue-muted">{matchesLoading ? '讀取中…' : `${matchesRows.length} 場`}</div>
              </div>
              {matchesLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : matchesRows.length === 0 ? (
                <div className="text-sm cue-muted">尚未生成賽程</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">輪次</th>
                        <th className="py-2 px-2">對賽</th>
                        <th className="py-2 px-2">狀態</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchesRows.map((row: any) => {
                        const id = String(row?.id || '');
                        const aLabel = formatParticipantLabel(row?.player_a_participant);
                        const bLabel = formatParticipantLabel(row?.player_b_participant);
                        const roundLabel = isLeague ? formatLeagueRoundLabel(row) : formatKnockoutRoundLabel(row, participantsRows.length);
                        const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
                        const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
                        return (
                          <tr key={id} className={`border-b cue-border hover:brightness-95 ${selectedMatchId === id ? 'bg-white/5' : ''}`}>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <div>{roundLabel}</div>
                              <div className="text-xs cue-muted mt-0.5">R{row?.round_no || '-'} / M{row?.match_no || '-'}</div>
                            </td>
                            <td className="py-2 px-2">{aLabel} vs {bLabel}</td>
                            <td className="py-2 px-2 cue-muted">
                              <div>{String(row?.status || '-')}</div>
                              <div className="text-xs mt-0.5">{resultTypeLabel}</div>
                            </td>
                            <td className="py-2 px-2">
                              <button
                                type="button"
                                disabled={!canRecordMatch}
                                className={`px-3 py-1 rounded text-sm font-semibold ${canRecordMatch ? 'cue-surface hover:brightness-95' : 'cue-surface-strong cue-muted'}`}
                                onClick={() => {
                                  if (!canRecordMatch) return;
                                  setSelectedMatchId(id);
                                  setResultStartedAt(formatDateTimeLocalInput(row?.started_at));
                                  setResultEndedAt(formatDateTimeLocalInput(row?.ended_at));
                                  setResultQuickType(normalizeMatchResultType(row?.result_type) === 'FORFEIT' ? 'FORFEIT' : 'WALKOVER');
                                  setResultQuickWinnerSide(
                                    String(row?.winner_participant_id || '') === String(row?.player_b_participant_id || '') ? 'B' : 'A',
                                  );
                                  setResultFrames(buildFramesFromMatch(row));
                                  setBreakMemberId(String(row?.player_a_participant?.member?.id || row?.player_b_participant?.member?.id || ''));
                                  setBreakFrameNo(String((Array.isArray(row?.frames) && row.frames.length > 0 ? row.frames.length : 1) || 1));
                                }}
                              >
                                {!canRecordMatch ? '未就緒' : selectedMatchId === id ? '已選擇' : '記錄賽果'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {!isLeague && matchesRows.length > 0 ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">Knockout Bracket Tree</div>
                <div className="text-xs cue-muted">按卡片可直接切換到該場對局記分</div>
              </div>
              <div className="overflow-x-auto -mx-2 px-2">
                <div className="flex gap-12 min-w-max items-start pb-2">
                  {bracketColumns.map((column) => (
                    <div key={column.label} className="w-72">
                      <div className="font-semibold mb-3 sticky left-0">{column.label}</div>
                      <div
                        className="relative"
                        style={{
                          height: `${column.columnHeight}px`,
                          paddingTop: `${column.paddingTop}px`,
                        }}
                      >
                        {column.connectors.map((connector: any, connectorIndex: number) => (
                          <React.Fragment key={`${column.label}-connector-${connectorIndex}`}>
                            <div
                              className="absolute border-t cue-border"
                              style={{
                                left: '100%',
                                top: `${connector.top}px`,
                                width: `${BRACKET_CONNECTOR_HALF_GAP}px`,
                              }}
                            />
                            <div
                              className="absolute border-r cue-border"
                              style={{
                                left: `calc(100% + ${BRACKET_CONNECTOR_HALF_GAP}px)`,
                                top: `${connector.top}px`,
                                height: `${connector.height}px`,
                              }}
                            />
                            <div
                              className="absolute border-t cue-border"
                              style={{
                                left: '100%',
                                top: `${connector.top + connector.height}px`,
                                width: `${BRACKET_CONNECTOR_HALF_GAP}px`,
                              }}
                            />
                          </React.Fragment>
                        ))}
                        <div className="flex flex-col" style={{ gap: `${column.gap}px` }}>
                        {column.items.map((row: any) => {
                          const id = String(row?.id || '');
                          const aLabel = formatParticipantLabel(row?.player_a_participant);
                          const bLabel = formatParticipantLabel(row?.player_b_participant);
                          const winnerId = String(row?.winner_participant_id || '');
                          const aParticipantId = String(row?.player_a_participant_id || '');
                          const bParticipantId = String(row?.player_b_participant_id || '');
                          const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
                          const canSelectMatch = !!aParticipantId && !!bParticipantId && String(row?.status || '').toUpperCase() !== 'PENDING';
                          return (
                            <div key={id} className="relative" style={{ height: `${BRACKET_CARD_HEIGHT}px` }}>
                              {column.roundIndex > 0 ? (
                                <div
                                  className="absolute border-t cue-border"
                                  style={{
                                    right: '100%',
                                    top: '50%',
                                    width: `${BRACKET_CONNECTOR_HALF_GAP}px`,
                                  }}
                                />
                              ) : null}
                              {!column.isFinal ? (
                                <div
                                  className="absolute border-t cue-border"
                                  style={{
                                    left: '100%',
                                    top: '50%',
                                    width: `${BRACKET_CONNECTOR_HALF_GAP}px`,
                                  }}
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  if (!canSelectMatch) return;
                                  setSelectedMatchId(id);
                                  setResultStartedAt(formatDateTimeLocalInput(row?.started_at));
                                  setResultEndedAt(formatDateTimeLocalInput(row?.ended_at));
                                  setResultQuickType(normalizeMatchResultType(row?.result_type) === 'FORFEIT' ? 'FORFEIT' : 'WALKOVER');
                                  setResultQuickWinnerSide(
                                    String(row?.winner_participant_id || '') === String(row?.player_b_participant_id || '') ? 'B' : 'A',
                                  );
                                  setResultFrames(buildFramesFromMatch(row));
                                  setBreakMemberId(String(row?.player_a_participant?.member?.id || row?.player_b_participant?.member?.id || ''));
                                  setBreakFrameNo(String((Array.isArray(row?.frames) && row.frames.length > 0 ? row.frames.length : 1) || 1));
                                }}
                                disabled={!canSelectMatch}
                                className={`relative z-10 h-full w-full text-left rounded-lg border p-3 transition-colors ${!canSelectMatch ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed' : selectedMatchId === id ? 'border-yellow-400 bg-white/5' : 'cue-border cue-surface hover:brightness-95'}`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                                  <span>M{row?.match_no || '-'}</span>
                                  <span>{resultTypeLabel}</span>
                                </div>
                                <div className={`font-semibold truncate ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{aLabel}</div>
                                <div className="text-xs cue-muted my-1">
                                  {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                                </div>
                                <div className={`font-semibold truncate ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{bLabel}</div>
                              </button>
                            </div>
                          );
                        })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {isLeague && leagueRounds.length > 0 ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">League Rounds</div>
                <div className="text-xs cue-muted">依輪次排列，按卡片可直接切換到該場對局記分</div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {leagueRounds.map((round) => (
                  <div key={round.label} className="cue-surface rounded-lg p-3">
                    <div className="font-semibold mb-2">{round.label}</div>
                    <div className="grid gap-2">
                      {round.items.map((row: any) => {
                        const id = String(row?.id || '');
                        const canSelectMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={!canSelectMatch}
                            onClick={() => {
                              if (!canSelectMatch) return;
                              setSelectedMatchId(id);
                              setResultStartedAt(formatDateTimeLocalInput(row?.started_at));
                              setResultEndedAt(formatDateTimeLocalInput(row?.ended_at));
                              setResultQuickType(normalizeMatchResultType(row?.result_type) === 'FORFEIT' ? 'FORFEIT' : 'WALKOVER');
                              setResultQuickWinnerSide(
                                String(row?.winner_participant_id || '') === String(row?.player_b_participant_id || '') ? 'B' : 'A',
                              );
                              setResultFrames(buildFramesFromMatch(row));
                              setBreakMemberId(String(row?.player_a_participant?.member?.id || row?.player_b_participant?.member?.id || ''));
                              setBreakFrameNo(String((Array.isArray(row?.frames) && row.frames.length > 0 ? row.frames.length : 1) || 1));
                            }}
                            className={`w-full rounded-lg border p-3 text-left ${!canSelectMatch ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed' : selectedMatchId === id ? 'border-yellow-400 bg-white/5' : 'cue-border cue-surface hover:brightness-95'}`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                              <span>M{row?.match_no || '-'}</span>
                              <span>{formatMatchResultTypeLabel(row?.result_type)}</span>
                            </div>
                            <div className="font-semibold truncate">{formatParticipantLabel(row?.player_a_participant)}</div>
                            <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                            <div className="font-semibold truncate">{formatParticipantLabel(row?.player_b_participant)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedId && selectedMatch ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="cue-surface-strong rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold">輸入賽果</div>
                <div className="text-xs cue-muted mt-1">
                  {formatMemberLabel(selectedMatch?.player_a_participant?.member)} vs {formatMemberLabel(selectedMatch?.player_b_participant?.member)}
                </div>
                <div className="text-xs cue-muted mt-1">
                  目前結果類型：{formatMatchResultTypeLabel(selectedMatch?.result_type)}
                </div>
                <div className="text-xs cue-muted mt-1">
                  {tournamentFormat === 'KNOCKOUT'
                    ? `Best of ${selectedMatchBestOf}，先贏 ${selectedMatchTargetWins} 局；目前盤數 ${Number(selectedMatch?.player_a_frames_won ?? 0)} : ${Number(selectedMatch?.player_b_frames_won ?? 0)}`
                    : `Best of ${selectedMatchBestOf}；目前已記錄 ${selectedMatchCompletedFrames} 局，盤數 ${Number(selectedMatch?.player_a_frames_won ?? 0)} : ${Number(selectedMatch?.player_b_frames_won ?? 0)}`}
                </div>
                <div className="text-xs cue-muted mt-1">
                  {selectedMatchIsCompleted
                    ? '此場比賽已完成；下方逐局資料為已保存紀錄，可檢查最終比分與最高 break。'
                    : `正在輸入第 ${selectedMatchCurrentFrameNo} 局；「本局得分」是該局最後總分，「本局最高 break」是真正最高 break，不是總分。`}
                </div>
                {!selectedMatchResultEditable ? (
                  <div className="text-xs cue-muted mt-1">此對局尚未就緒，需待兩位球手已落位並成為 `READY / COMPLETED` 才可記分。</div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!selectedMatchCanAddFrame}
                  className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                  onClick={() => {
                    setResultFrames((prev) => [...prev, createEmptyEditableFrame((prev[prev.length - 1]?.frameNo || 0) + 1)]);
                    setBreakFrameNo(String((resultFrames[resultFrames.length - 1]?.frameNo || 0) + 1));
                  }}
                >
                  加一局
                </button>
                <button
                  type="button"
                  disabled={!selectedMatchResultEditable}
                  className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                  onClick={() => setResultFrames((prev) => prev.length > 1 ? prev.slice(0, -1) : prev)}
                >
                  減一局
                </button>
              </div>
            </div>

            {selectedMatchIsCompleted ? (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 mb-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div className="font-semibold accent-yellow">此場比賽已完成</div>
                  <div className="text-sm">
                    最終盤數 {Number(selectedMatch?.player_a_frames_won ?? 0)} : {Number(selectedMatch?.player_b_frames_won ?? 0)}
                  </div>
                </div>
                <div className="text-xs cue-muted mt-1">
                  {selectedMatchWinnerLabel ? `勝方：${selectedMatchWinnerLabel}` : '已保存最終賽果。'}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border cue-border p-3 mb-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-xs cue-muted">賽制摘要</div>
                  <div className="font-semibold mt-1">{tournamentFormat === 'KNOCKOUT' ? `Best of ${selectedMatchBestOf} / 先贏 ${selectedMatchTargetWins} 局` : `Best of ${selectedMatchBestOf}`}</div>
                </div>
                <div>
                  <div className="text-xs cue-muted">目前盤數</div>
                  <div className="font-semibold mt-1">{Number(selectedMatch?.player_a_frames_won ?? 0)} : {Number(selectedMatch?.player_b_frames_won ?? 0)}</div>
                </div>
                <div>
                  <div className="text-xs cue-muted">已完成局數</div>
                  <div className="font-semibold mt-1">{selectedMatchCompletedFrames} / {selectedMatchBestOf}</div>
                </div>
                <div>
                  <div className="text-xs cue-muted">{selectedMatchIsCompleted ? '比賽狀態' : '下一個建議輸入'}</div>
                  <div className="font-semibold mt-1">{selectedMatchIsCompleted ? '已完成' : `第 ${selectedMatchCurrentFrameNo} 局`}</div>
                </div>
              </div>
              <div className="text-xs cue-muted mt-3">
                {selectedMatchIsCompleted
                  ? '此場已達勝出局數，系統已停止追加下一局草稿。'
                  : '每完成一局後可直接儲存；系統會保留已完成各局，並自動幫你預備下一局草稿。'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 mb-3">
              <div>
                <label className="block text-sm mb-1 cue-muted">開賽時間（可選）</label>
                <input type="datetime-local" value={resultStartedAt} onChange={(e) => setResultStartedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">完賽時間（可選）</label>
                <input type="datetime-local" value={resultEndedAt} onChange={(e) => setResultEndedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
            </div>

            <div className="rounded-lg border cue-border p-3 mb-3">
              <div className="font-semibold mb-2">Walkover / Forfeit</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-sm mb-1 cue-muted">結果類型</label>
                  <select
                    value={resultQuickType}
                    onChange={(e) => setResultQuickType(e.target.value === 'FORFEIT' ? 'FORFEIT' : 'WALKOVER')}
                    className="w-full px-3 py-2 rounded cue-input"
                    disabled={!selectedMatchResultEditable || resultSaving}
                  >
                    <option value="WALKOVER">Walkover</option>
                    <option value="FORFEIT">Forfeit / 棄權</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1 cue-muted">勝方</label>
                  <select
                    value={resultQuickWinnerSide}
                    onChange={(e) => setResultQuickWinnerSide(e.target.value === 'B' ? 'B' : 'A')}
                    className="w-full px-3 py-2 rounded cue-input"
                    disabled={!selectedMatchResultEditable || resultSaving}
                  >
                    <option value="A">{formatMemberLabel(selectedMatch?.player_a_participant?.member)}</option>
                    <option value="B">{formatMemberLabel(selectedMatch?.player_b_participant?.member)}</option>
                  </select>
                </div>
              </div>
              <div className="text-xs cue-muted mt-2">此操作不會建立逐局賽果，並會清空該場既有局數和 tournament `20+` 記錄。</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={resultSaving || !selectedMatchResultEditable}
                  className={`px-4 py-2 rounded font-semibold ${resultSaving || !selectedMatchResultEditable ? 'cue-surface-strong cue-muted' : 'cue-surface hover:brightness-95'}`}
                  onClick={async () => {
                    try {
                      if (!selectedMatchId) throw new Error('請先選擇賽事對局');
                      const winnerLabel = resultQuickWinnerSide === 'B'
                        ? formatMemberLabel(selectedMatch?.player_b_participant?.member)
                        : formatMemberLabel(selectedMatch?.player_a_participant?.member);
                      if (!confirm(`確定將此場記錄為 ${resultQuickType === 'FORFEIT' ? '棄權' : 'Walkover'}，由 ${winnerLabel} 勝出？`)) return;
                      setResultSaving(true);
                      await recordTournamentMatchResult(API_URL, operatorId, selectedId, selectedMatchId, {
                        startedAt: resultStartedAt ? new Date(resultStartedAt).toISOString() : null,
                        endedAt: resultEndedAt ? new Date(resultEndedAt).toISOString() : null,
                        resultType: resultQuickType,
                        winnerSide: resultQuickWinnerSide,
                        frames: [],
                      });
                      await loadSelectedPhase1Data();
                      showNotice(`已記錄${resultQuickType === 'FORFEIT' ? '棄權' : 'Walkover'}賽果`);
                    } catch (e: any) {
                      showNotice(e?.message || '記錄特殊賽果失敗', 3000);
                    } finally {
                      setResultSaving(false);
                    }
                  }}
                >
                  {resultSaving ? '儲存中...' : `記錄${resultQuickType === 'FORFEIT' ? '棄權' : 'Walkover'}`}
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {resultFrames.map((frame, index) => (
                <div key={frame.frameNo} className="rounded-lg border cue-border p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="font-semibold">第 {frame.frameNo} 局</div>
                    {frame.isPlaceholder ? <div className="text-xs cue-muted">待輸入</div> : null}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div>
                      <label className="block text-sm mb-1 cue-muted">勝方</label>
                      <select
                        value={frame.winnerSide}
                        onChange={(e) => updateFrameDraft(index, { winnerSide: e.target.value === 'B' ? 'B' : 'A' })}
                        className="w-full px-3 py-2 rounded cue-input"
                      >
                        <option value="A">{formatMemberLabel(selectedMatch?.player_a_participant?.member)}</option>
                        <option value="B">{formatMemberLabel(selectedMatch?.player_b_participant?.member)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">A 本局得分</label>
                      <input value={frame.playerAScore} onChange={(e) => updateFrameDraft(index, { playerAScore: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 64" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">B 本局得分</label>
                      <input value={frame.playerBScore} onChange={(e) => updateFrameDraft(index, { playerBScore: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 27" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">A 本局最高 break</label>
                      <input value={frame.playerAHighestBreak} onChange={(e) => updateFrameDraft(index, { playerAHighestBreak: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 36" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">B 本局最高 break</label>
                      <input value={frame.playerBHighestBreak} onChange={(e) => updateFrameDraft(index, { playerBHighestBreak: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 28" />
                    </div>
                  </div>
                  <div className="text-xs cue-muted mt-2">最高 break 只填單次最高連續得分；如你在右側記錄 `20+`，系統會自動把該局最高 break 更新為較高值。</div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resultSaving || !selectedMatchResultEditable}
                className={`px-4 py-2 rounded font-semibold ${resultSaving || !selectedMatchResultEditable ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
                onClick={async () => {
                  try {
                    if (!selectedMatchId) throw new Error('請先選擇賽事對局');
                    const frames = resultFrames
                      .filter((frame) => !frame.isPlaceholder)
                      .map((frame, index) => ({
                        frameNo: index + 1,
                        winnerSide: frame.winnerSide,
                        playerAScore: Math.max(0, Math.floor(Number(frame.playerAScore || 0))),
                        playerBScore: Math.max(0, Math.floor(Number(frame.playerBScore || 0))),
                        playerAHighestBreak: Math.max(0, Math.floor(Number(frame.playerAHighestBreak || 0))),
                        playerBHighestBreak: Math.max(0, Math.floor(Number(frame.playerBHighestBreak || 0))),
                      }));
                    if (frames.length === 0) throw new Error('請先輸入至少一局賽果');
                    setResultSaving(true);
                    await recordTournamentMatchResult(API_URL, operatorId, selectedId, selectedMatchId, {
                      startedAt: resultStartedAt ? new Date(resultStartedAt).toISOString() : null,
                      endedAt: resultEndedAt ? new Date(resultEndedAt).toISOString() : null,
                      resultType: 'STANDARD',
                      frames,
                    });
                    await loadSelectedPhase1Data();
                    showNotice('已記錄賽果');
                  } catch (e: any) {
                    showNotice(e?.message || '記錄賽果失敗', 3000);
                  } finally {
                    setResultSaving(false);
                  }
                }}
              >
                {resultSaving ? '儲存中...' : '儲存賽果'}
              </button>
            </div>
          </div>

          <div className="cue-surface-strong rounded-lg p-4">
            <div className="font-semibold mb-3">記錄比賽 20+</div>
            <div className="text-xs cue-muted mb-3">
              `20+` 會正式寫入比賽履歷，並自動回寫對應局數的最高 break。
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">球手</label>
                <select value={breakMemberId} onChange={(e) => setBreakMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input" disabled={!selectedMatchBreakEnabled}>
                  <option value="">選擇球手</option>
                  {selectedMatchMemberOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">對應局數</label>
                <select value={breakFrameNo} onChange={(e) => setBreakFrameNo(e.target.value)} className="w-full px-3 py-2 rounded cue-input" disabled={!selectedMatchBreakEnabled}>
                  {selectedMatchBreakFrameOptions.map((value) => (
                    <option key={value} value={value}>第 {value} 局</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">Break 分數</label>
                <input value={breakPoints} onChange={(e) => setBreakPoints(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={20} placeholder="例如 34" disabled={!selectedMatchBreakEnabled} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">記錄時間（可選）</label>
                <input value={breakRecordedAt} onChange={(e) => setBreakRecordedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="datetime-local" disabled={!selectedMatchBreakEnabled} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">備註（可空）</label>
                <input value={breakNote} onChange={(e) => setBreakNote(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：清枱 34、關鍵局" disabled={!selectedMatchBreakEnabled} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={breakSaving || !selectedMatchBreakEnabled}
                className={`px-4 py-2 rounded font-semibold ${breakSaving || !selectedMatchBreakEnabled ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
                onClick={async () => {
                  try {
                    if (!selectedMatchId) throw new Error('請先選擇賽事對局');
                    if (!breakMemberId) throw new Error('請先選擇球手');
                    const points = Math.floor(Number(breakPoints));
                    if (!Number.isFinite(points) || points < 20) throw new Error('20+ 分數不正確');
                    setBreakSaving(true);
                    await createTournamentMatchBreak(API_URL, operatorId, selectedId, selectedMatchId, {
                      memberId: breakMemberId,
                      points,
                      frameNo: Math.max(1, Math.floor(Number(breakFrameNo || 1))),
                      recordedAt: breakRecordedAt ? new Date(breakRecordedAt).toISOString() : null,
                      note: breakNote || null,
                    });
                    await loadSelectedPhase1Data();
                    setBreakPoints('');
                    setBreakNote('');
                    showNotice('已記錄比賽 20+');
                  } catch (e: any) {
                    showNotice(e?.message || '記錄 20+ 失敗', 3000);
                  } finally {
                    setBreakSaving(false);
                  }
                }}
              >
                {breakSaving ? '儲存中...' : '新增 20+ 記錄'}
              </button>
            </div>
            <div className="mt-4 text-xs cue-muted">
              {selectedMatchBreakEnabled
                ? '只有正常逐局賽果可記錄 tournament `20+`；Walkover / 棄權 會停用此功能。'
                : '此對局目前不是標準逐局賽果，已停用 tournament 20+ 記錄。'}
            </div>

            <div className="mt-4 rounded-lg border cue-border p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="font-semibold">本場已記錄 20+</div>
                <div className="text-xs cue-muted">{selectedMatchBreakRows.length} 筆</div>
              </div>
              {selectedMatchBreakRows.length === 0 ? (
                <div className="text-sm cue-muted">暫未有已加入的 20+ 記錄</div>
              ) : (
                <div className="space-y-2">
                  {selectedMatchBreakRows.map((row: any) => (
                    <div key={String(row?.id || `${row?.member_id || ''}-${row?.frame_no || ''}-${row?.points || ''}`)} className="rounded cue-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{formatMemberLabel(row?.member)}</div>
                        <div className="accent-yellow font-semibold">{Number(row?.points || 0)}</div>
                      </div>
                      <div className="text-xs cue-muted mt-1">
                        第 {Number(row?.frame_no || 0)} 局 · {formatDisplayDateTime(row?.recorded_at)}
                      </div>
                      {row?.note ? <div className="text-xs cue-muted mt-1">{String(row.note)}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default VenueTournamentsModule;
