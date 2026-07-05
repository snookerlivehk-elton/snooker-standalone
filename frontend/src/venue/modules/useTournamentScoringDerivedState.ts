import { useMemo } from 'react';
import {
  buildNextSegmentCheckpointLabel,
  buildScoreSegments,
  buildSegmentResumeSummary,
  createEmptyEditableFrame,
  getBlockNoInSession,
  getBreakRowsInSegment,
  getCompletedEditableFrames,
  getPendingEditableFrame,
  getRecommendedFrameNoForSegment,
  getSegmentBreakSummary,
  getSessionNoForFrame,
  getTargetWins,
  isLongMatchBestOf,
} from './VenueTournamentScoringHelpers';
import type {
  EditableFrame,
  MatchMemberOption,
  MatchResultQuickType,
  TournamentScoringWorkspace,
} from './VenueTournamentScoringTypes';

type UseTournamentScoringDerivedStateArgs = {
  activeFrameNo: number;
  formatMemberLabel: TournamentScoringWorkspace['formatMemberLabel'];
  normalizeMatchResultType: (value: any) => 'STANDARD' | 'BYE' | 'WALKOVER' | 'FORFEIT';
  resultFrames: EditableFrame[];
  selectedMatch: any;
  selectedTournamentBestOf: any;
};

export function useTournamentScoringDerivedState({
  activeFrameNo,
  formatMemberLabel,
  normalizeMatchResultType,
  resultFrames,
  selectedMatch,
  selectedTournamentBestOf,
}: UseTournamentScoringDerivedStateArgs) {
  const selectedMatchHasPlayers = !!selectedMatch?.player_a_participant_id && !!selectedMatch?.player_b_participant_id;
  const selectedMatchStatus = String(selectedMatch?.status || '').trim().toUpperCase();
  const selectedMatchResultType = normalizeMatchResultType(selectedMatch?.result_type);
  const selectedMatchIsCompleted = selectedMatchStatus === 'COMPLETED';
  const selectedMatchResultEditable = !!selectedMatch && selectedMatchHasPlayers && selectedMatchStatus !== 'PENDING';
  const selectedMatchBreakEnabled = !!selectedMatch && selectedMatchHasPlayers && selectedMatchResultType === 'STANDARD';
  const selectedMatchMemberOptions = useMemo<MatchMemberOption[]>(() => (selectedMatch ? [
    {
      value: String(selectedMatch?.player_a_participant?.member?.id || ''),
      label: formatMemberLabel(selectedMatch?.player_a_participant?.member),
    },
    {
      value: String(selectedMatch?.player_b_participant?.member?.id || ''),
      label: formatMemberLabel(selectedMatch?.player_b_participant?.member),
    },
  ].filter((item) => item.value) : []), [formatMemberLabel, selectedMatch]);
  const selectedMatchBestOf = Math.max(1, Math.floor(Number(selectedMatch?.best_of_frames ?? selectedTournamentBestOf ?? 1) || 1));
  const selectedMatchTargetWins = getTargetWins(selectedMatchBestOf);
  const selectedMatchCompletedFrames = Array.isArray(selectedMatch?.frames) ? selectedMatch.frames.length : 0;
  const selectedMatchAWins = Number(selectedMatch?.player_a_frames_won ?? 0);
  const selectedMatchBWins = Number(selectedMatch?.player_b_frames_won ?? 0);
  const selectedMatchIsLongFormat = isLongMatchBestOf(selectedMatchBestOf);
  const selectedMatchWinnerLabel = useMemo(() => {
    if (!selectedMatchIsCompleted) return '';
    if (String(selectedMatch?.winner_participant_id || '') === String(selectedMatch?.player_a_participant_id || '')) {
      return formatMemberLabel(selectedMatch?.player_a_participant?.member);
    }
    if (String(selectedMatch?.winner_participant_id || '') === String(selectedMatch?.player_b_participant_id || '')) {
      return formatMemberLabel(selectedMatch?.player_b_participant?.member);
    }
    return '';
  }, [formatMemberLabel, selectedMatch, selectedMatchIsCompleted]);
  const selectedMatchAMaxBreak = Math.max(0, Number(selectedMatch?.player_a_max_break ?? 0));
  const selectedMatchBMaxBreak = Math.max(0, Number(selectedMatch?.player_b_max_break ?? 0));
  const selectedMatchA20PlusCount = Math.max(0, Number(selectedMatch?.player_a_20_plus_count ?? 0));
  const selectedMatchB20PlusCount = Math.max(0, Number(selectedMatch?.player_b_20_plus_count ?? 0));
  const selectedMatchTopBreakValue = Math.max(selectedMatchAMaxBreak, selectedMatchBMaxBreak);
  const selectedMatchTopBreakOwners = [
    selectedMatchAMaxBreak === selectedMatchTopBreakValue && selectedMatchTopBreakValue > 0
      ? formatMemberLabel(selectedMatch?.player_a_participant?.member)
      : '',
    selectedMatchBMaxBreak === selectedMatchTopBreakValue && selectedMatchTopBreakValue > 0
      ? formatMemberLabel(selectedMatch?.player_b_participant?.member)
      : '',
  ].filter(Boolean);
  const selectedMatchTopBreakLabel = selectedMatchTopBreakValue > 0
    ? `${selectedMatchTopBreakOwners.join(' / ')} · ${selectedMatchTopBreakValue}`
    : '-';
  const selectedMatchBreakTotalsLabel = `A ${selectedMatchAMaxBreak} / ${selectedMatchA20PlusCount} 筆 20+ · B ${selectedMatchBMaxBreak} / ${selectedMatchB20PlusCount} 筆 20+`;
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
  const completedResultFrames = useMemo(() => getCompletedEditableFrames(resultFrames), [resultFrames]);
  const pendingResultFrame = useMemo(() => getPendingEditableFrame(resultFrames), [resultFrames]);
  const activeFrameIndex = resultFrames.findIndex((frame) => Number(frame.frameNo || 0) === Number(activeFrameNo || 0));
  const activeFrame = activeFrameIndex >= 0
    ? resultFrames[activeFrameIndex]
    : (pendingResultFrame || resultFrames[resultFrames.length - 1] || createEmptyEditableFrame(1));
  const selectedMatchCurrentFrameNo = Number(pendingResultFrame?.frameNo || activeFrame?.frameNo || 1);
  const selectedMatchCurrentSessionNo = getSessionNoForFrame(selectedMatchCurrentFrameNo);
  const selectedMatchCurrentBlockNo = getBlockNoInSession(selectedMatchCurrentFrameNo);
  const selectedMatchSegments = useMemo(() => buildScoreSegments(selectedMatchBestOf), [selectedMatchBestOf]);
  const selectedMatchActiveSegment = useMemo(() => (
    selectedMatchSegments.find((segment) => (
      Number(activeFrame?.frameNo || 0) >= segment.startFrameNo
      && Number(activeFrame?.frameNo || 0) <= segment.endFrameNo
    )) || selectedMatchSegments[0] || null
  ), [activeFrame, selectedMatchSegments]);
  const selectedMatchWinsRemainingA = Math.max(0, selectedMatchTargetWins - selectedMatchAWins);
  const selectedMatchWinsRemainingB = Math.max(0, selectedMatchTargetWins - selectedMatchBWins);
  const selectedMatchLatestSavedFrameNo = Number(completedResultFrames[completedResultFrames.length - 1]?.frameNo || 0);
  const selectedMatchNextCheckpointLabel = buildNextSegmentCheckpointLabel(selectedMatchActiveSegment, selectedMatchBestOf);
  const selectedMatchActiveSegmentBreakRows = useMemo(
    () => getBreakRowsInSegment(selectedMatchBreakRows, selectedMatchActiveSegment),
    [selectedMatchActiveSegment, selectedMatchBreakRows],
  );
  const selectedMatchActiveSegmentBreakSummary = useMemo(
    () => getSegmentBreakSummary(selectedMatchBreakRows, selectedMatchActiveSegment),
    [selectedMatchActiveSegment, selectedMatchBreakRows],
  );
  const activeFrameNoValue = Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo || 1);
  const selectedMatchActiveFrameBreakRows = useMemo(() => (
    selectedMatchBreakRows.filter((row: any) => Number(row?.frame_no || 0) === activeFrameNoValue)
  ), [activeFrameNoValue, selectedMatchBreakRows]);
  const selectedMatchResumeSummary = selectedMatchIsCompleted
    ? '此場比賽已完成，可回看各局結果與最高 break。'
    : buildSegmentResumeSummary(selectedMatchCurrentFrameNo, completedResultFrames.length, selectedMatchBestOf);

  return {
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
  };
}
