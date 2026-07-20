import { useCallback, useEffect } from 'react';
import { API_URL } from '../../config';
import { createTournamentMatchBreak, recordTournamentMatchResult } from '../../lib/api';
import {
  buildFramesFromMatch,
  buildSaveProgressNotice,
  formatDateTimeLocalInput,
  formatMemberLabel,
  getRecommendedActiveFrameNo,
} from './VenueTournamentScoringHelpers';
import type { EditableFrame, MatchMemberOption, MatchResultQuickType } from './VenueTournamentScoringTypes';

type UseTournamentScoringActionsArgs = {
  activeFrame: EditableFrame;
  activeFrameNoValue: number;
  breakFrameNo: string;
  breakMemberId: string;
  breakNote: string;
  breakPoints: string;
  breakRecordedAt: string;
  loadSelectedPhase1Data: () => Promise<void>;
  operatorId: string;
  resultEndedAt: string;
  resultFrames: EditableFrame[];
  resultQuickType: MatchResultQuickType;
  resultQuickWinnerSide: 'A' | 'B';
  resultStartedAt: string;
  selectedId: string;
  selectedMatch: any;
  selectedMatchCurrentFrameNo: number;
  selectedMatchId: string;
  selectedMatchMemberOptions: MatchMemberOption[];
  selectedMatchStatus: string;
  selectedMatchTargetWins: number;
  selectedTournamentBestOf: any;
  setActiveFrameNo: React.Dispatch<React.SetStateAction<number>>;
  setBreakFrameNo: React.Dispatch<React.SetStateAction<string>>;
  setBreakMemberId: React.Dispatch<React.SetStateAction<string>>;
  setBreakNote: React.Dispatch<React.SetStateAction<string>>;
  setBreakPoints: React.Dispatch<React.SetStateAction<string>>;
  setBreakRecordedAt: React.Dispatch<React.SetStateAction<string>>;
  setBreakSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setResultEndedAt: React.Dispatch<React.SetStateAction<string>>;
  setResultFrames: React.Dispatch<React.SetStateAction<EditableFrame[]>>;
  setResultQuickType: React.Dispatch<React.SetStateAction<MatchResultQuickType>>;
  setResultQuickWinnerSide: React.Dispatch<React.SetStateAction<'A' | 'B'>>;
  setResultSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setResultStartedAt: React.Dispatch<React.SetStateAction<string>>;
  setSelectedMatchId: React.Dispatch<React.SetStateAction<string>>;
  showNotice: (message: string, timeout?: number) => void;
  normalizeMatchResultType: (value: any) => 'STANDARD' | 'BYE' | 'WALKOVER' | 'FORFEIT';
};

export function useTournamentScoringActions({
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
  selectedTournamentBestOf,
  setActiveFrameNo,
  setBreakFrameNo,
  setBreakMemberId,
  setBreakNote,
  setBreakPoints,
  setBreakRecordedAt: _setBreakRecordedAt,
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
}: UseTournamentScoringActionsArgs) {
  const submitTournamentBreak = useCallback(async (frameNoRaw?: number) => {
    if (!selectedMatchId) throw new Error('請先選擇賽事對局');
    if (!breakMemberId) throw new Error('請先選擇球手');
    const points = Math.floor(Number(breakPoints));
    if (!Number.isFinite(points) || points < 20) throw new Error('20+ 分數不正確');
    const frameNo = Math.max(1, Math.floor(Number(frameNoRaw || breakFrameNo || 1)));
    setBreakSaving(true);
    try {
      await createTournamentMatchBreak(API_URL, operatorId, selectedId, selectedMatchId, {
        memberId: breakMemberId,
        points,
        frameNo,
        recordedAt: breakRecordedAt ? new Date(breakRecordedAt).toISOString() : null,
        note: breakNote || null,
      });
      await loadSelectedPhase1Data();
      setBreakFrameNo(String(frameNo));
      setBreakPoints('');
      setBreakNote('');
      showNotice(`已記錄第 ${frameNo} 局 20+`);
    } finally {
      setBreakSaving(false);
    }
  }, [
    breakFrameNo,
    breakMemberId,
    breakNote,
    breakPoints,
    breakRecordedAt,
    loadSelectedPhase1Data,
    operatorId,
    selectedId,
    selectedMatchId,
    setBreakFrameNo,
    setBreakNote,
    setBreakPoints,
    setBreakSaving,
    showNotice,
  ]);

  const handleSubmitActiveFrameBreak = useCallback(async () => {
    try {
      await submitTournamentBreak(activeFrameNoValue);
    } catch (e: any) {
      showNotice(e?.message || '記錄 20+ 失敗', 3000);
    }
  }, [activeFrameNoValue, showNotice, submitTournamentBreak]);

  const handleSubmitSidebarBreak = useCallback(async () => {
    try {
      await submitTournamentBreak(Math.max(1, Math.floor(Number(breakFrameNo || 1))));
    } catch (e: any) {
      showNotice(e?.message || '記錄 20+ 失敗', 3000);
    }
  }, [breakFrameNo, showNotice, submitTournamentBreak]);

  const handleSubmitQuickResult = useCallback(async () => {
    try {
      if (!selectedMatchId) throw new Error('請先選擇賽事對局');
      const winnerLabel = resultQuickWinnerSide === 'B'
        ? formatMemberLabel(selectedMatch?.player_b_participant?.member)
        : formatMemberLabel(selectedMatch?.player_a_participant?.member);
      if (!window.confirm(`確定將此場記錄為 ${resultQuickType === 'FORFEIT' ? '棄權' : 'Walkover'}，由 ${winnerLabel} 勝出？`)) return;
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
  }, [
    loadSelectedPhase1Data,
    operatorId,
    resultEndedAt,
    resultQuickType,
    resultQuickWinnerSide,
    resultStartedAt,
    selectedId,
    selectedMatch,
    selectedMatchId,
    setResultSaving,
    showNotice,
  ]);

  const handleSubmitStandardResult = useCallback(async () => {
    try {
      if (!selectedMatchId) throw new Error('請先選擇賽事對局');
      const savingFrameNo = Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo || 1);
      const frames = resultFrames
        .filter((frame) => !frame.isPlaceholder)
        .map((frame, index) => ({
          frameNo: index + 1,
          winnerSide: frame.winnerSide,
          playerAScore: Math.max(0, Math.floor(Number(frame.playerAScore || 0))),
          playerBScore: Math.max(0, Math.floor(Number(frame.playerBScore || 0))),
        }));
      if (frames.length === 0) throw new Error('請先輸入至少一局賽果');
      const nextAWins = frames.filter((frame) => frame.winnerSide === 'A').length;
      const nextBWins = frames.filter((frame) => frame.winnerSide === 'B').length;
      const didCompleteMatch = nextAWins >= selectedMatchTargetWins || nextBWins >= selectedMatchTargetWins;
      setResultSaving(true);
      await recordTournamentMatchResult(API_URL, operatorId, selectedId, selectedMatchId, {
        startedAt: resultStartedAt ? new Date(resultStartedAt).toISOString() : null,
        endedAt: resultEndedAt ? new Date(resultEndedAt).toISOString() : null,
        resultType: 'STANDARD',
        frames,
      });
      await loadSelectedPhase1Data();
      showNotice(buildSaveProgressNotice(savingFrameNo, selectedTournamentBestOf ?? selectedMatch?.best_of_frames, didCompleteMatch));
    } catch (e: any) {
      showNotice(e?.message || '記錄賽果失敗', 3000);
    } finally {
      setResultSaving(false);
    }
  }, [
    activeFrame,
    loadSelectedPhase1Data,
    operatorId,
    resultEndedAt,
    resultFrames,
    resultStartedAt,
    selectedId,
    selectedMatch,
    selectedMatchCurrentFrameNo,
    selectedMatchId,
    selectedMatchTargetWins,
    selectedTournamentBestOf,
    setResultSaving,
    showNotice,
  ]);

  const selectMatchForScoring = useCallback((row: any) => {
    const id = String(row?.id || '');
    setSelectedMatchId(id);
    setResultStartedAt(formatDateTimeLocalInput(row?.started_at));
    setResultEndedAt(formatDateTimeLocalInput(row?.ended_at));
    setResultQuickType(normalizeMatchResultType(row?.result_type) === 'FORFEIT' ? 'FORFEIT' : 'WALKOVER');
    setResultQuickWinnerSide(
      String(row?.winner_participant_id || '') === String(row?.player_b_participant_id || '') ? 'B' : 'A',
    );
    const nextFrames = buildFramesFromMatch(row, selectedTournamentBestOf);
    setResultFrames(nextFrames);
    setActiveFrameNo(getRecommendedActiveFrameNo(nextFrames, String(row?.status || '').toUpperCase() === 'COMPLETED'));
    setBreakMemberId(String(row?.player_a_participant?.member?.id || row?.player_b_participant?.member?.id || ''));
    setBreakFrameNo(String(getRecommendedActiveFrameNo(nextFrames, false)));
  }, [
    normalizeMatchResultType,
    selectedTournamentBestOf,
    setActiveFrameNo,
    setBreakFrameNo,
    setBreakMemberId,
    setResultEndedAt,
    setResultFrames,
    setResultQuickType,
    setResultQuickWinnerSide,
    setResultStartedAt,
    setSelectedMatchId,
  ]);

  useEffect(() => {
    if (!selectedMatch) return;
    const nextFrames = buildFramesFromMatch(selectedMatch, selectedTournamentBestOf);
    setResultStartedAt(formatDateTimeLocalInput(selectedMatch?.started_at));
    setResultEndedAt(formatDateTimeLocalInput(selectedMatch?.ended_at));
    setResultQuickWinnerSide(
      String(selectedMatch?.winner_participant_id || '') === String(selectedMatch?.player_b_participant_id || '') ? 'B' : 'A',
    );
    setResultFrames(nextFrames);
    setActiveFrameNo(getRecommendedActiveFrameNo(nextFrames, selectedMatchStatus === 'COMPLETED'));
    setBreakMemberId((prev) => (
      selectedMatchMemberOptions.some((item) => item.value === prev)
        ? prev
        : String(selectedMatchMemberOptions[0]?.value || '')
    ));
    setBreakFrameNo(String(getRecommendedActiveFrameNo(nextFrames, false)));
  }, [
    selectedMatch,
    selectedMatchMemberOptions,
    selectedMatchStatus,
    selectedTournamentBestOf,
    setActiveFrameNo,
    setBreakFrameNo,
    setBreakMemberId,
    setResultEndedAt,
    setResultFrames,
    setResultQuickWinnerSide,
    setResultStartedAt,
  ]);

  return {
    handleSubmitActiveFrameBreak,
    handleSubmitQuickResult,
    handleSubmitSidebarBreak,
    handleSubmitStandardResult,
    selectMatchForScoring,
  };
}
