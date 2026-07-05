import React from 'react';

type VenueTournamentScoringWorkspaceProps = {
  workspace: any;
};

const VenueTournamentScoringWorkspace: React.FC<VenueTournamentScoringWorkspaceProps> = ({ workspace }) => {
  const {
    activeFrame,
    activeFrameIndex,
    activeFrameNoValue,
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
    onSubmitActiveFrameBreak,
    onSubmitQuickResult,
    onSubmitSidebarBreak,
    onSubmitStandardResult,
    pendingResultFrame,
    resultEndedAt,
    resultFrames,
    resultQuickType,
    resultQuickWinnerSide,
    resultSaving,
    resultStartedAt,
    selectedMatch,
    selectedMatchActiveFrameBreakRows,
    selectedMatchActiveSegment,
    selectedMatchActiveSegmentBreakRows,
    selectedMatchActiveSegmentBreakSummary,
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
    selectedMatchWinnerLabel,
    selectedMatchWinsRemainingA,
    selectedMatchWinsRemainingB,
    setActiveFrameNo,
    setBreakMemberId,
    setBreakNote,
    setBreakPoints,
    setBreakRecordedAt,
    setBreakFrameNo,
    setResultEndedAt,
    setResultQuickType,
    setResultQuickWinnerSide,
    setResultStartedAt,
    showNotice,
    tournamentFormat,
    updateFrameDraft,
    breakFrameNo,
  } = workspace;

  return (
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
          <div className="text-right text-xs cue-muted">
            {selectedMatchIsCompleted
              ? '可回看已保存局數'
              : `工作台已定位到 ${getFrameSegmentLabel(selectedMatchCurrentFrameNo)} · 第 ${selectedMatchCurrentFrameNo} 局`}
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

        <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 mb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="font-semibold text-violet-100">比賽工作台總覽</div>
              <div className="text-xs cue-muted mt-1">
                {selectedMatchIsLongFormat
                  ? `Best of ${selectedMatchBestOf} 已啟用完整分段工作台；可按段查看進度、20+ 與快速跳回下一局。`
                  : `Best of ${selectedMatchBestOf} 也沿用同一套工作台；以統一方式查看目前焦點、最近已保存局數與下一節點。`}
              </div>
            </div>
            <div className="grid gap-2 text-xs cue-muted sm:grid-cols-3">
              <div className="rounded border border-violet-400/20 bg-black/10 px-3 py-2">
                <div>尚差勝局</div>
                <div className="mt-1 font-semibold text-white">A 還差 {selectedMatchWinsRemainingA} 局</div>
                <div className="mt-1 font-semibold text-white">B 還差 {selectedMatchWinsRemainingB} 局</div>
              </div>
              <div className="rounded border border-violet-400/20 bg-black/10 px-3 py-2">
                <div>目前焦點</div>
                <div className="mt-1 font-semibold text-white">{selectedMatchActiveSegment ? selectedMatchActiveSegment.title : getFrameSegmentLabel(selectedMatchCurrentFrameNo)}</div>
                <div className="mt-1">第 {selectedMatchCurrentFrameNo} 局</div>
              </div>
              <div className="rounded border border-violet-400/20 bg-black/10 px-3 py-2">
                <div>下一節點</div>
                <div className="mt-1 font-semibold text-white">{selectedMatchNextCheckpointLabel}</div>
              </div>
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
        </div>

        <div className="rounded-lg border cue-border p-3 mb-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
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
            <div>
              <div className="text-xs cue-muted">目前節次</div>
              <div className="font-semibold mt-1">{`Session ${selectedMatchCurrentSessionNo}`}</div>
            </div>
            <div>
              <div className="text-xs cue-muted">本節段落</div>
              <div className="font-semibold mt-1">{`第 ${selectedMatchCurrentBlockNo} 段`}</div>
            </div>
            <div>
              <div className="text-xs cue-muted">本場最高 break</div>
              <div className="font-semibold mt-1">{workspace.selectedMatchTopBreakLabel}</div>
            </div>
            <div>
              <div className="text-xs cue-muted">本場 20+</div>
              <div className="font-semibold mt-1">{`A ${workspace.selectedMatchA20PlusCount} 筆 · B ${workspace.selectedMatchB20PlusCount} 筆`}</div>
            </div>
          </div>
          <div className="text-xs cue-muted mt-3">
            {selectedMatchIsCompleted
              ? '此場已達勝出局數，系統已停止追加下一局草稿；最高 break 與 20+ 會按本場現有資料自動重算。'
              : '系統以每 4 局為一段、每 8 局為一節，自動安排小休與續賽提示。'}
          </div>
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
              onClick={onSubmitQuickResult}
            >
              {resultSaving ? '儲存中...' : `記錄${resultQuickType === 'FORFEIT' ? '棄權' : 'Walkover'}`}
            </button>
          </div>
        </div>

        <div className="rounded-lg border cue-border p-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-semibold">第 {Number(activeFrame?.frameNo || selectedMatchCurrentFrameNo)} 局</div>
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
          <div className="mt-3 rounded-lg border cue-border p-3">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold">本局 20+ / 單杆</div>
                <div className="text-xs cue-muted mt-1">
                  以目前這一局作為所屬局數；加入後會同步更新該局最高 break 與本場單杆統計。
                </div>
              </div>
              <div className="text-xs cue-muted">
                {activeFrame?.isPlaceholder ? '請先儲存本局賽果，再加入 20+' : `第 ${activeFrameNoValue} 局`}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="block text-sm mb-1 cue-muted">球手</label>
                <select value={breakMemberId} onChange={(e) => setBreakMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input" disabled={!selectedMatchBreakEnabled || !!activeFrame?.isPlaceholder}>
                  <option value="">選擇球手</option>
                  {selectedMatchMemberOptions.map((option: any) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">Break 分數</label>
                <input value={breakPoints} onChange={(e) => setBreakPoints(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={20} placeholder="例如 34" disabled={!selectedMatchBreakEnabled || !!activeFrame?.isPlaceholder} />
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">記錄時間（可選）</label>
                <input value={breakRecordedAt} onChange={(e) => setBreakRecordedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="datetime-local" disabled={!selectedMatchBreakEnabled || !!activeFrame?.isPlaceholder} />
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">備註（可空）</label>
                <input value={breakNote} onChange={(e) => setBreakNote(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：清枱 34、關鍵局" disabled={!selectedMatchBreakEnabled || !!activeFrame?.isPlaceholder} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={breakSaving || !selectedMatchBreakEnabled || !!activeFrame?.isPlaceholder}
                className={`px-4 py-2 rounded font-semibold ${breakSaving || !selectedMatchBreakEnabled || !!activeFrame?.isPlaceholder ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
                onClick={onSubmitActiveFrameBreak}
              >
                {breakSaving ? '儲存中...' : `加入第 ${activeFrameNoValue} 局 20+`}
              </button>
            </div>
            <div className="mt-3 rounded-lg border cue-border p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="font-semibold">本局已記錄 20+</div>
                <div className="text-xs cue-muted">{selectedMatchActiveFrameBreakRows.length} 筆</div>
              </div>
              {selectedMatchActiveFrameBreakRows.length === 0 ? (
                <div className="text-sm cue-muted">此局暫未有已加入的 20+ 記錄</div>
              ) : (
                <div className="space-y-2">
                  {selectedMatchActiveFrameBreakRows.map((row: any) => (
                    <div key={String(row?.id || `${row?.member_id || ''}-${row?.frame_no || ''}-${row?.points || ''}`)} className="rounded cue-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold">{formatMemberLabel(row?.member)}</div>
                        <div className="accent-yellow font-semibold">{Number(row?.points || 0)}</div>
                      </div>
                      <div className="text-xs cue-muted mt-1">{formatDisplayDateTime(row?.recorded_at)}</div>
                      {row?.note ? <div className="text-xs cue-muted mt-1">{String(row.note)}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-xs cue-muted mt-2">最高 break 只填單次最高連續得分；如你在右側記錄 `20+`，系統會自動把該局最高 break 更新為較高值。</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
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

      <div className="cue-surface-strong rounded-lg p-4">
        <div className="font-semibold mb-3">比賽 20+ 總覽 / 補錄</div>
        <div className="text-xs cue-muted mb-3">
          建議優先在左側每局輸入卡直接加入 `20+`；這裡保留全場總覽、分段摘要與補錄入口。
        </div>
        {selectedMatchActiveSegment ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold accent-yellow">{selectedMatchActiveSegment.title}</div>
                <div className="text-xs cue-muted mt-1">{selectedMatchActiveSegment.rangeLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setActiveFrameNo(getRecommendedFrameNoForSegment(resultFrames, selectedMatchActiveSegment))}
                className="rounded border border-yellow-500/30 px-2 py-1 text-xs font-semibold hover:brightness-95"
              >
                回到本段
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3 text-xs cue-muted">
              <div className="rounded cue-surface px-3 py-2">{selectedMatchActiveSegmentBreakSummary.countLabel}</div>
              <div className="rounded cue-surface px-3 py-2">{selectedMatchActiveSegmentBreakSummary.topLabel}</div>
              <div className="rounded cue-surface px-3 py-2">{selectedMatchActiveSegmentBreakSummary.frameLabel}</div>
            </div>
            {selectedMatchActiveSegmentBreakRows.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(Array.from(
                  new Set(selectedMatchActiveSegmentBreakRows.map((row: any) => Number(row?.frame_no || 0)).filter((value: number) => value > 0)),
                ) as number[])
                  .sort((a, b) => a - b)
                  .map((frameNo) => (
                    <button
                      key={frameNo}
                      type="button"
                      onClick={() => setActiveFrameNo(frameNo)}
                      className="rounded border cue-border px-2 py-1 text-xs font-semibold hover:brightness-95"
                    >
                      前往第 {frameNo} 局
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 cue-muted">球手</label>
            <select value={breakMemberId} onChange={(e) => setBreakMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input" disabled={!selectedMatchBreakEnabled}>
              <option value="">選擇球手</option>
              {selectedMatchMemberOptions.map((option: any) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 cue-muted">對應局數</label>
            <select value={breakFrameNo} onChange={(e) => setBreakFrameNo(e.target.value)} className="w-full px-3 py-2 rounded cue-input" disabled={!selectedMatchBreakEnabled}>
              {selectedMatchBreakFrameOptions.map((value: string) => (
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
            onClick={onSubmitSidebarBreak}
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
  );
};

export default VenueTournamentScoringWorkspace;
