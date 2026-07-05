import React from 'react';
import type { TournamentScoringWorkspace } from './VenueTournamentScoringTypes';

type VenueTournamentBreaksPanelProps = {
  workspace: TournamentScoringWorkspace;
};

const VenueTournamentBreaksPanel: React.FC<VenueTournamentBreaksPanelProps> = ({ workspace }) => {
  const {
    breakFrameNo,
    breakMemberId,
    breakNote,
    breakPoints,
    breakRecordedAt,
    breakSaving,
    formatDisplayDateTime,
    formatMemberLabel,
    getRecommendedFrameNoForSegment,
    onSubmitSidebarBreak,
    resultFrames,
    selectedMatchActiveSegment,
    selectedMatchActiveSegmentBreakRows,
    selectedMatchActiveSegmentBreakSummary,
    selectedMatchBreakEnabled,
    selectedMatchBreakFrameOptions,
    selectedMatchBreakRows,
    selectedMatchMemberOptions,
    setActiveFrameNo,
    setBreakFrameNo,
    setBreakMemberId,
    setBreakNote,
    setBreakPoints,
    setBreakRecordedAt,
  } = workspace;

  return (
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
  );
};

export default VenueTournamentBreaksPanel;
