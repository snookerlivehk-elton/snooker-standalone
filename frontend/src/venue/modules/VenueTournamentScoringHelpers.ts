import type { EditableFrame, MatchScoreSegment, SegmentBreakSummary } from './VenueTournamentScoringTypes';

type MatchResultType = 'STANDARD' | 'BYE' | 'WALKOVER' | 'FORFEIT';

function normalizeMatchResultType(value: any): MatchResultType {
  const resultType = String(value || 'STANDARD').trim().toUpperCase();
  if (resultType === 'BYE' || resultType === 'WALKOVER' || resultType === 'FORFEIT') return resultType;
  return 'STANDARD';
}

export function formatDateTimeLocalInput(raw: any) {
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

export function formatDisplayDateTime(raw: any) {
  if (!raw) return '-';
  const d = new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString();
}

export function formatMemberLabel(member: any) {
  const name = String(member?.name || '').trim();
  const memberCode = String(member?.member_code || '').trim();
  return name || memberCode || '-';
}

export function createEmptyEditableFrame(frameNo: number): EditableFrame {
  return {
    frameNo,
    winnerSide: 'A',
    playerAScore: '0',
    playerBScore: '0',
    isPlaceholder: true,
  };
}

export function getTargetWins(bestOfRaw: any) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1)));
  return Math.floor(bestOf / 2) + 1;
}

export function buildFramesFromMatch(match: any, tournamentBestOfRaw?: any): EditableFrame[] {
  const frames = Array.isArray(match?.frames) ? match.frames : [];
  const next = frames.length > 0
    ? frames.map((frame: any, index: number) => ({
      frameNo: Number(frame?.frame_no || index + 1),
      winnerSide: String(frame?.winner_participant_id || '') === String(match?.player_b_participant_id || '') ? 'B' : 'A',
      playerAScore: String(frame?.player_a_score ?? 0),
      playerBScore: String(frame?.player_b_score ?? 0),
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

export function getCompletedEditableFrames(frames: EditableFrame[]) {
  return frames.filter((frame) => !frame.isPlaceholder);
}

export function getPendingEditableFrame(frames: EditableFrame[]) {
  return frames.find((frame) => frame.isPlaceholder) || null;
}

export function getRecommendedActiveFrameNo(frames: EditableFrame[], isCompleted?: boolean) {
  if (!isCompleted) {
    const pending = getPendingEditableFrame(frames);
    if (pending) return Number(pending.frameNo || 1);
  }
  const completed = getCompletedEditableFrames(frames);
  return Number(completed[completed.length - 1]?.frameNo || 1);
}

export function buildMatchProgressSummary(match: any, tournamentBestOfRaw?: any) {
  const bestOf = Math.max(1, Math.floor(Number(match?.best_of_frames ?? tournamentBestOfRaw ?? 1) || 1));
  const completedFrames = Array.isArray(match?.frames) ? match.frames.length : 0;
  const aWins = Number(match?.player_a_frames_won ?? 0);
  const bWins = Number(match?.player_b_frames_won ?? 0);
  const status = String(match?.status || '').trim().toUpperCase();
  if (status === 'COMPLETED') {
    return `已完成 · 盤數 ${aWins}:${bWins}`;
  }
  const nextFrameNo = Math.min(bestOf, completedFrames + 1);
  return `盤數 ${aWins}:${bWins} · 已完成 ${completedFrames}/${bestOf} 局 · 下一局 第 ${nextFrameNo} 局`;
}

export function getSessionNoForFrame(frameNo: number) {
  return Math.floor((Math.max(1, frameNo) - 1) / 8) + 1;
}

export function getBlockNoInSession(frameNo: number) {
  return Math.floor(((Math.max(1, frameNo) - 1) % 8) / 4) + 1;
}

export function getFrameSegmentLabel(frameNo: number) {
  return `Session ${getSessionNoForFrame(frameNo)} · 第 ${getBlockNoInSession(frameNo)} 段`;
}

export function buildScoreSegments(bestOfRaw: any) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1) || 1));
  const segments: MatchScoreSegment[] = [];
  for (let startFrameNo = 1; startFrameNo <= bestOf; startFrameNo += 4) {
    const endFrameNo = Math.min(bestOf, startFrameNo + 3);
    const sessionNo = getSessionNoForFrame(startFrameNo);
    const blockNo = getBlockNoInSession(startFrameNo);
    const boundaryLabel = endFrameNo >= bestOf
      ? '本段包含本場最後可輸入局數'
      : endFrameNo % 8 === 0
        ? `第 ${endFrameNo} 局後一節完結`
        : `第 ${endFrameNo} 局後小休`;
    segments.push({
      key: `${startFrameNo}-${endFrameNo}`,
      startFrameNo,
      endFrameNo,
      sessionNo,
      blockNo,
      title: `Session ${sessionNo} · 第 ${blockNo} 段`,
      rangeLabel: startFrameNo === endFrameNo ? `第 ${startFrameNo} 局` : `第 ${startFrameNo}-${endFrameNo} 局`,
      boundaryLabel,
    });
  }
  return segments;
}

export function buildSegmentResumeSummary(nextFrameNo: number, completedFrameCount: number, bestOfRaw: any) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1) || 1));
  if (completedFrameCount <= 0) {
    return `這是本場第一段的開始，先由 ${getFrameSegmentLabel(1)} 的第 1 局輸入。`;
  }
  if (completedFrameCount >= bestOf) {
    return '此場已完成全部所需局數。';
  }
  const previousFrameNo = completedFrameCount;
  if (previousFrameNo % 8 === 0) {
    return `上一節已於第 ${previousFrameNo} 局完結，現進入 ${getFrameSegmentLabel(nextFrameNo)}。`;
  }
  if (previousFrameNo % 4 === 0) {
    return `第 ${previousFrameNo} 局後已進入小休，現由 ${getFrameSegmentLabel(nextFrameNo)} 繼續。`;
  }
  return `已承接上次進度，現由 ${getFrameSegmentLabel(nextFrameNo)} 的第 ${nextFrameNo} 局繼續。`;
}

export function buildSaveProgressNotice(savedFrameNo: number, bestOfRaw: any, didCompleteMatch: boolean) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1) || 1));
  if (didCompleteMatch || savedFrameNo >= bestOf) {
    return `第 ${savedFrameNo} 局已儲存，已達成此場最終進度。`;
  }
  if (savedFrameNo % 8 === 0) {
    return `第 ${savedFrameNo} 局已儲存，本節完成；下一局將進入 ${getFrameSegmentLabel(savedFrameNo + 1)}。`;
  }
  if (savedFrameNo % 4 === 0) {
    return `第 ${savedFrameNo} 局已儲存，現已到小休位；下一局將進入 ${getFrameSegmentLabel(savedFrameNo + 1)}。`;
  }
  return `第 ${savedFrameNo} 局已儲存，工作台已自動承接到下一局。`;
}

export function isLongMatchBestOf(bestOfRaw: any) {
  return Math.max(1, Math.floor(Number(bestOfRaw || 1) || 1)) >= 11;
}

export function getFramesInSegment(
  frames: EditableFrame[],
  segment: { startFrameNo: number; endFrameNo: number },
) {
  return frames.filter((frame) => (
    Number(frame.frameNo || 0) >= segment.startFrameNo
    && Number(frame.frameNo || 0) <= segment.endFrameNo
  ));
}

export function getSegmentCompletionSummary(
  frames: EditableFrame[],
  segment: { startFrameNo: number; endFrameNo: number },
) {
  const segmentFrames = getFramesInSegment(frames, segment);
  const completedCount = segmentFrames.filter((frame) => !frame.isPlaceholder).length;
  const totalCount = segment.endFrameNo - segment.startFrameNo + 1;
  if (completedCount <= 0) return '未開始';
  if (completedCount >= totalCount) return `已完成 ${completedCount}/${totalCount} 局`;
  return `進行中 ${completedCount}/${totalCount} 局`;
}

export function getSegmentFramesWonSummary(
  frames: EditableFrame[],
  segment: { startFrameNo: number; endFrameNo: number },
) {
  const completedFrames = getFramesInSegment(frames, segment).filter((frame) => !frame.isPlaceholder);
  const aWins = completedFrames.filter((frame) => frame.winnerSide === 'A').length;
  const bWins = completedFrames.filter((frame) => frame.winnerSide === 'B').length;
  return completedFrames.length > 0 ? `本段盤數 ${aWins}:${bWins}` : '本段尚未有盤數';
}

export function getRecommendedFrameNoForSegment(
  frames: EditableFrame[],
  segment: { startFrameNo: number; endFrameNo: number },
) {
  const segmentFrames = getFramesInSegment(frames, segment);
  const pending = segmentFrames.find((frame) => frame.isPlaceholder);
  if (pending) return Number(pending.frameNo || segment.startFrameNo);
  const completed = segmentFrames.filter((frame) => !frame.isPlaceholder);
  if (completed.length > 0) {
    return Number(completed[completed.length - 1]?.frameNo || segment.startFrameNo);
  }
  return segment.startFrameNo;
}

export function buildNextSegmentCheckpointLabel(
  segment: { endFrameNo: number; boundaryLabel: string } | null,
  bestOfRaw: any,
) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1) || 1));
  if (!segment) return `本場最多 ${bestOf} 局`;
  if (segment.endFrameNo >= bestOf) return `完成第 ${bestOf} 局後即為本場最後段落`;
  return segment.boundaryLabel;
}

export function getBreakRowsInSegment(
  rows: any[],
  segment: { startFrameNo: number; endFrameNo: number } | null,
) {
  if (!segment) return [];
  return rows.filter((row) => {
    const frameNo = Number(row?.frame_no || 0);
    return frameNo >= segment.startFrameNo && frameNo <= segment.endFrameNo;
  });
}

export function getSegmentBreakSummary(
  rows: any[],
  segment: { startFrameNo: number; endFrameNo: number } | null,
): SegmentBreakSummary {
  const segmentRows = getBreakRowsInSegment(rows, segment);
  if (segmentRows.length === 0) {
    return {
      countLabel: '本段未有 20+',
      topLabel: '最高 20+：-',
      frameLabel: '未涉及局數',
    };
  }
  const topRow = segmentRows.reduce((best, row) => (
    Number(row?.points || 0) > Number(best?.points || 0) ? row : best
  ), segmentRows[0]);
  const frameLabels = Array.from(new Set(segmentRows.map((row) => Number(row?.frame_no || 0)).filter((value) => value > 0)))
    .sort((a, b) => a - b)
    .map((value) => `第 ${value} 局`);
  return {
    countLabel: `本段 20+：${segmentRows.length} 筆`,
    topLabel: `最高 20+：${Number(topRow?.points || 0)}`,
    frameLabel: frameLabels.length > 0 ? frameLabels.join('、') : '未涉及局數',
  };
}
