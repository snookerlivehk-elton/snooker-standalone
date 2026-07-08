import React from 'react';
import type { TournamentScoringWorkspace } from './VenueTournamentScoringTypes';

type VenueTournamentScoringMainPanelProps = {
  workspace: TournamentScoringWorkspace;
};

const VenueTournamentScoringMainPanel: React.FC<VenueTournamentScoringMainPanelProps> = ({ workspace }) => {
  const {
    activeFrame,
    activeFrameIndex,
    formatMatchResultTypeLabel,
    formatMemberLabel,
    getFrameSegmentLabel,
    getRecommendedFrameNoForSegment,
    getSegmentBreakSummary,
    getSegmentCompletionSummary,
    getSegmentFramesWonSummary,
    onSubmitQuickResult,
    onSubmitStandardResult,
    pendingResultFrame,
    resultEndedAt,
    resultFrames,
    resultQuickType,
    resultQuickWinnerSide,
    resultSaving,
    resultStartedAt,
    selectedMatch,
    selectedMatchActiveSegment,
    selectedMatchBestOf,
    selectedMatchBreakRows,
    selectedMatchBreakTotalsLabel,
    selectedMatchCompletedFrames,
    selectedMatchCurrentBlockNo,
    selectedMatchCurrentFrameNo,
    selectedMatchCurrentSessionNo,
    selectedMatchIsCompleted,
    selectedMatchIsLongFormat,
    selectedMatchLatestSavedFrameNo,
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
    setResultEndedAt,
    setResultQuickType,
    setResultQuickWinnerSide,
    setResultStartedAt,
    tournamentFormat,
    updateFrameDraft,
  } = workspace;

  const matchStatusLabel = selectedMatchIsCompleted ? '已完成' : (selectedMatchResultEditable ? '可記分' : '待就緒');
  const frameEditorTitle = `第 ${Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo)} 局`;
  const activeSegmentLabel = selectedMatchActiveSegment
    ? selectedMatchActiveSegment.title
    : getFrameSegmentLabel(Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo));

  return (
    <div className="cue-surface-strong rounded-lg p-4">
      <div className="flex flex-col gap-3 mb-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="font-semibold">輸入賽果</div>
          <div className="mt-1 text-sm">
            {formatMemberLabel(selectedMatch?.player_a_participant?.member)} vs {formatMemberLabel(selectedMatch?.player_b_participant?.member)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs cue-muted">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">{matchStatusLabel}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              結果類型：{formatMatchResultTypeLabel(selectedMatch?.result_type)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {tournamentFormat === 'KNOCKOUT' ? `Best of ${selectedMatchBestOf} / 先贏 ${selectedMatchTargetWins} 局` : `Best of ${selectedMatchBestOf}`}
            </span>
          </div>
          <div className="text-xs cue-muted mt-2">
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
            <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              此對局尚未就緒，需待兩位球手已落位並成為 `READY / COMPLETED` 才可記分。
            </div>
          ) : null}
        </div>
        <div className="grid gap-2 text-xs cue-muted sm:grid-cols-2 xl:w-[320px] xl:grid-cols-1">
          <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
            <div>目前焦點</div>
            <div className="mt-1 font-semibold text-white">
              {selectedMatchIsCompleted ? '可回看已保存局數' : `${getFrameSegmentLabel(selectedMatchCurrentFrameNo)} · 第 ${selectedMatchCurrentFrameNo} 局`}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
            <div>下一步</div>
            <div className="mt-1 font-semibold text-white">{selectedMatchIsCompleted ? '檢查最終比分與單杆' : selectedMatchNextCheckpointLabel}</div>
          </div>
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
          <div className="text-xs cue-muted mt-1">
            本場單杆統計：{selectedMatchBreakTotalsLabel}
          </div>
        </div>
      ) : null}

      {!selectedMatchIsCompleted ? (
        <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 mb-3">
          <div className="font-semibold text-cyan-100">自動承接進度</div>
          <div className="text-xs cue-muted mt-1">{selectedMatchResumeSummary}</div>
        </div>
      ) : null}

      <div className="rounded-lg border cue-border p-3 mb-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-semibold">目前工作重點</div>
          <div className="text-xs cue-muted">先完成左側逐局輸入；20+ 補錄與全場單杆總覽可在右側處理。</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="text-xs cue-muted">目前盤數</div>
            <div className="font-semibold mt-1">{Number(selectedMatch?.player_a_frames_won ?? 0)} : {Number(selectedMatch?.player_b_frames_won ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs cue-muted">{selectedMatchIsCompleted ? '比賽狀態' : '下一個建議輸入'}</div>
            <div className="font-semibold mt-1">{selectedMatchIsCompleted ? '已完成' : `第 ${selectedMatchCurrentFrameNo} 局`}</div>
          </div>
          <div>
            <div className="text-xs cue-muted">已完成局數</div>
            <div className="font-semibold mt-1">{selectedMatchCompletedFrames} / {selectedMatchBestOf}</div>
          </div>
          <div>
            <div className="text-xs cue-muted">目前焦點</div>
            <div className="font-semibold mt-1">{activeSegmentLabel}</div>
            <div className="mt-1 text-xs cue-muted">{selectedMatchNextCheckpointLabel}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveFrameNo(selectedMatchCurrentFrameNo)}
            className="rounded-lg border border-violet-400/30 bg-white/5 px-3 py-2 text-sm font-semibold hover:brightness-95"
          >
            回到下一局
          </button>
          {selectedMatchLatestSavedFrameNo > 0 ? (
            <button
              type="button"
              onClick={() => setActiveFrameNo(selectedMatchLatestSavedFrameNo)}
              className="rounded-lg border border-violet-400/30 bg-white/5 px-3 py-2 text-sm font-semibold hover:brightness-95"
            >
              最新已保存：第 {selectedMatchLatestSavedFrameNo} 局
            </button>
          ) : null}
          {selectedMatchActiveSegment ? (
            <button
              type="button"
              onClick={() => setActiveFrameNo(getRecommendedFrameNoForSegment(resultFrames, selectedMatchActiveSegment))}
              className="rounded-lg border border-violet-400/30 bg-white/5 px-3 py-2 text-sm font-semibold hover:brightness-95"
            >
              回到目前段
            </button>
          ) : null}
        </div>
        <details className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <summary className="cursor-pointer text-sm font-semibold">查看進階摘要與次要操作</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="text-xs cue-muted">尚差勝局</div>
              <div className="mt-1 font-semibold">A 還差 {selectedMatchWinsRemainingA} 局</div>
              <div className="mt-1 font-semibold">B 還差 {selectedMatchWinsRemainingB} 局</div>
            </div>
            <div>
              <div className="text-xs cue-muted">目前節次</div>
              <div className="mt-1 font-semibold">{`Session ${selectedMatchCurrentSessionNo}`}</div>
            </div>
            <div>
              <div className="text-xs cue-muted">本節段落</div>
              <div className="mt-1 font-semibold">{`第 ${selectedMatchCurrentBlockNo} 段`}</div>
            </div>
            <div>
              <div className="text-xs cue-muted">本場最高 break</div>
              <div className="mt-1 font-semibold">{selectedMatchTopBreakLabel}</div>
              <div className="mt-1 text-xs cue-muted">{selectedMatchBreakTotalsLabel}</div>
            </div>
          </div>
          <div className="mt-3 text-xs cue-muted">
            {selectedMatchIsCompleted
              ? '此場已達勝出局數，系統已停止追加下一局草稿；最高 break 與 20+ 會按本場現有資料自動重算。'
              : selectedMatchIsLongFormat
                ? `Best of ${selectedMatchBestOf} 已啟用完整分段工作台；可按段查看進度並配合右側 20+ 補錄。`
                : '系統以每 4 局為一段、每 8 局為一節，自動安排小休與續賽提示。'}
          </div>
        </details>
      </div>

      <div className="rounded-lg border cue-border p-3 mb-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-semibold">局數導航</div>
          <div className="text-xs cue-muted">
            {selectedMatchIsCompleted ? '按任一局可回看已保存內容' : '按任一局可回看或修正；每 4 局自動分段，預設停留在下一局'}
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {selectedMatchSegments.map((segment: any) => (
            <div
              key={segment.key}
              className={`rounded-lg border p-3 ${selectedMatchActiveSegment?.key === segment.key ? 'border-yellow-400 bg-white/5' : 'cue-border'}`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <div className="font-semibold">{segment.title}</div>
                  <div className="text-xs cue-muted mt-1">{segment.rangeLabel}</div>
                </div>
                <div className="text-[11px] cue-muted text-right">
                  <div>{segment.boundaryLabel}</div>
                  <div className="mt-1">{getSegmentCompletionSummary(resultFrames, segment)}</div>
                  <div className="mt-1">{getSegmentFramesWonSummary(resultFrames, segment)}</div>
                  <div className="mt-1">{getSegmentBreakSummary(selectedMatchBreakRows, segment).countLabel}</div>
                  <div className="mt-1">{getSegmentBreakSummary(selectedMatchBreakRows, segment).topLabel}</div>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFrameNo(getRecommendedFrameNoForSegment(resultFrames, segment))}
                  className="rounded border cue-border px-2 py-1 text-xs font-semibold hover:brightness-95"
                >
                  前往本段
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {resultFrames
                  .filter((frame: any) => Number(frame.frameNo || 0) >= segment.startFrameNo && Number(frame.frameNo || 0) <= segment.endFrameNo)
                  .map((frame: any) => {
                    const isActive = Number(frame.frameNo || 0) === Number(activeFrame?.frameNo || 0);
                    const isPending = !!frame.isPlaceholder;
                    const statusLabel = selectedMatchIsCompleted
                      ? '已保存'
                      : isPending
                        ? '待輸入'
                        : Number(frame.frameNo || 0) === Number(selectedMatchCurrentFrameNo || 0) && !pendingResultFrame
                          ? '編輯中'
                          : '已保存';
                    return (
                      <button
                        key={frame.frameNo}
                        type="button"
                        onClick={() => setActiveFrameNo(Number(frame.frameNo || 1))}
                        className={`rounded-lg border px-3 py-2 text-left transition-colors ${isActive ? 'border-yellow-400 bg-white/5' : 'cue-border cue-surface hover:brightness-95'}`}
                      >
                        <div className="text-sm font-semibold">第 {frame.frameNo} 局</div>
                        <div className="text-[11px] cue-muted mt-1">{statusLabel}</div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs cue-muted mt-3">{selectedMatchResumeSummary}</div>
      </div>

      <div className="rounded-lg border cue-border p-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold">{frameEditorTitle}</div>
            <div className="text-xs cue-muted mt-1">
              {selectedMatchIsCompleted
                ? '此局已保存，可在這裡回看或修正比分與最高 break。'
                : activeFrame?.isPlaceholder
                  ? '這是目前待輸入的下一局。儲存後系統會自動承接最新進度。'
                  : '這是已保存局數；你可在儲存前再次修正內容。'}
            </div>
          </div>
          <div className="text-xs cue-muted">
            <div>{selectedMatchActiveSegment ? selectedMatchActiveSegment.title : getFrameSegmentLabel(Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo))}</div>
            <div className="mt-1">{activeFrame?.isPlaceholder ? '待輸入' : '已保存/可修正'}</div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="block text-sm mb-1 cue-muted">勝方</label>
            <select
              value={activeFrame?.winnerSide || 'A'}
              onChange={(e) => updateFrameDraft(activeFrameIndex, { winnerSide: e.target.value === 'B' ? 'B' : 'A' })}
              className="w-full px-3 py-2 rounded cue-input"
            >
              <option value="A">{formatMemberLabel(selectedMatch?.player_a_participant?.member)}</option>
              <option value="B">{formatMemberLabel(selectedMatch?.player_b_participant?.member)}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 cue-muted">A 本局得分</label>
            <input value={activeFrame?.playerAScore || '0'} onChange={(e) => updateFrameDraft(activeFrameIndex, { playerAScore: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 64" />
          </div>
          <div>
            <label className="block text-sm mb-1 cue-muted">B 本局得分</label>
            <input value={activeFrame?.playerBScore || '0'} onChange={(e) => updateFrameDraft(activeFrameIndex, { playerBScore: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 27" />
          </div>
          <div>
            <label className="block text-sm mb-1 cue-muted">A 本局最高 break</label>
            <input value={activeFrame?.playerAHighestBreak || '0'} onChange={(e) => updateFrameDraft(activeFrameIndex, { playerAHighestBreak: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 36" />
          </div>
          <div>
            <label className="block text-sm mb-1 cue-muted">B 本局最高 break</label>
            <input value={activeFrame?.playerBHighestBreak || '0'} onChange={(e) => updateFrameDraft(activeFrameIndex, { playerBHighestBreak: e.target.value })} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} placeholder="例如 28" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs cue-muted">
            最高 break 只填單次最高連續得分；如要補錄或查看全場 20+，請使用右側面板。
          </div>
          <button
            type="button"
            disabled={resultSaving || !selectedMatchResultEditable}
            className={`px-4 py-2 rounded font-semibold ${resultSaving || !selectedMatchResultEditable ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
            onClick={onSubmitStandardResult}
          >
            {resultSaving ? '儲存中...' : (selectedMatchIsCompleted ? '更新已保存賽果' : `儲存第 ${Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo)} 局`)}
          </button>
        </div>
      </div>

      <details className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-rose-100">Walkover / Forfeit 與時間欄位</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm mb-1 cue-muted">開賽時間（可選）</label>
            <input type="datetime-local" value={resultStartedAt} onChange={(e) => setResultStartedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
          </div>
          <div>
            <label className="block text-sm mb-1 cue-muted">完賽時間（可選）</label>
            <input type="datetime-local" value={resultEndedAt} onChange={(e) => setResultEndedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
          </div>
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
        <div className="mt-2 text-xs cue-muted">此操作不會建立逐局賽果，並會清空該場既有局數和 tournament `20+` 記錄。</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={resultSaving || !selectedMatchResultEditable}
            className={`px-4 py-2 rounded font-semibold ${resultSaving || !selectedMatchResultEditable ? 'cue-surface-strong cue-muted' : 'bg-rose-500/20 text-rose-100 border border-rose-400/30 hover:brightness-95'}`}
            onClick={onSubmitQuickResult}
          >
            {resultSaving ? '儲存中...' : `記錄${resultQuickType === 'FORFEIT' ? '棄權' : 'Walkover'}`}
          </button>
        </div>
      </details>
    </div>
  );
};

export default VenueTournamentScoringMainPanel;
