import React from 'react';

type VenueTournamentLeagueWorkflowInsightsProps = {
  leagueRounds: any[];
  matchesRows: any[];
  onJumpToMatch: (row: any) => void;
  onApplyScheduleFocus: (preset: { quickFilter?: 'ALL' | 'SCORABLE' | 'UNFINISHED'; statusFilter?: 'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING'; focusedRoundLabel?: string }) => void;
  selectedMatchId: string;
};

function getStatusCount(items: any[], status: string) {
  return items.filter((row: any) => String(row?.status || '').trim().toUpperCase() === status).length;
}

const VenueTournamentLeagueWorkflowInsights: React.FC<VenueTournamentLeagueWorkflowInsightsProps> = ({
  leagueRounds,
  matchesRows,
  onJumpToMatch,
  onApplyScheduleFocus,
  selectedMatchId,
}) => {
  const rounds = leagueRounds.map((round: any) => {
    const items = Array.isArray(round?.items) ? round.items : [];
    const total = items.length;
    const completedCount = getStatusCount(items, 'COMPLETED');
    const liveCount = getStatusCount(items, 'LIVE');
    const readyCount = getStatusCount(items, 'READY');
    const pendingCount = getStatusCount(items, 'PENDING');
    return {
      label: String(round?.label || '循環賽'),
      items,
      total,
      completedCount,
      liveCount,
      readyCount,
      pendingCount,
      isComplete: total > 0 && completedCount === total,
    };
  });

  const activeRoundIndex = rounds.findIndex((round) => round.total > 0 && !round.isComplete);
  const activeRound = activeRoundIndex >= 0 ? rounds[activeRoundIndex] : null;
  const nextRound = activeRoundIndex >= 0 ? rounds[activeRoundIndex + 1] || null : null;
  const allCompleted = rounds.length > 0 && rounds.every((round) => round.total > 0 && round.isComplete);
  const unfinishedRows = matchesRows.filter((row: any) => String(row?.status || '').trim().toUpperCase() !== 'COMPLETED');
  const unscheduledCount = unfinishedRows.filter((row: any) => !row?.scheduled_at).length;
  const unassignedTableCount = unfinishedRows.filter((row: any) => !row?.table_no).length;
  const scorableCount = unfinishedRows.filter((row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    return !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
  }).length;
  const scorableRows = unfinishedRows.filter((row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    return !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
  });
  const firstUnscheduledMatch = unfinishedRows.find((row: any) => !row?.scheduled_at) || null;
  const firstUnassignedTableMatch = unfinishedRows.find((row: any) => !row?.table_no) || null;
  const nextScorableMatch = scorableRows.find((row: any) => String(row?.id || '') !== selectedMatchId) || scorableRows[0] || null;
  const nextScorableLabel = nextScorableMatch
    ? `${activeRound?.label || `第 ${Number(nextScorableMatch?.round_no || 0)} 輪`} M${Number(nextScorableMatch?.match_no || 0)}`
    : '目前沒有可直接跳轉的對局';
  const unscheduledLabel = firstUnscheduledMatch
    ? `${activeRound?.label || `第 ${Number(firstUnscheduledMatch?.round_no || 0)} 輪`} M${Number(firstUnscheduledMatch?.match_no || 0)}`
    : '所有未完成對局均已排時間';
  const unassignedTableLabel = firstUnassignedTableMatch
    ? `${activeRound?.label || `第 ${Number(firstUnassignedTableMatch?.round_no || 0)} 輪`} M${Number(firstUnassignedTableMatch?.match_no || 0)}`
    : '所有未完成對局均已編球枱';

  let guidance = '生成賽程後，優先完成本輪對局，再逐步推進下一輪。';
  if (matchesRows.length === 0) {
    guidance = '尚未生成 League 賽程，先完成正式名單後再建立 round-robin fixtures。';
  } else if (allCompleted) {
    guidance = '所有輪次已完成，可回到 standings 與匯出區整理最終結果。';
  } else if (activeRound) {
    guidance = `${activeRound.label} 尚有 ${Math.max(0, activeRound.total - activeRound.completedCount)} 場未完成；建議先處理本輪，再讓下一輪 fully ready。`;
  }

  return (
    <div className="cue-surface rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-semibold">League 營運摘要</div>
        <div className="text-xs cue-muted">{matchesRows.length ? `${matchesRows.length} 場賽程` : '尚未生成賽程'}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">本輪進度</div>
          <div className="font-semibold mt-1">
            {activeRound
              ? `${activeRound.label} ${activeRound.completedCount}/${activeRound.total}`
              : allCompleted && rounds.length > 0
                ? '全部輪次已完成'
                : '等待賽程'}
          </div>
          <div className="text-xs cue-muted mt-1">
            {activeRound
              ? `${activeRound.readyCount + activeRound.liveCount} 場已可開打`
              : allCompleted && rounds.length > 0
                ? '可整理 standings 與匯出結果'
                : '先建立正式名單與賽程'}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">下一輪 ready</div>
          <div className="font-semibold mt-1">
            {nextRound ? `${nextRound.label} ${nextRound.readyCount + nextRound.liveCount} 場` : allCompleted ? '全部完成' : '-'}
          </div>
          <div className="text-xs cue-muted mt-1">
            {nextRound
              ? `${nextRound.pendingCount} 場仍待上游完成`
              : allCompleted
                ? '沒有後續輪次'
                : '待本輪推進後更新'}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">未排時間 / 未編球枱</div>
          <div className="font-semibold mt-1">{`${unscheduledCount} / ${unassignedTableCount}`}</div>
          <div className="text-xs cue-muted mt-1">只計未完成對局</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">可記分對局</div>
          <div className="font-semibold mt-1">{scorableCount}</div>
          <div className="text-xs cue-muted mt-1">已配對且不屬於待定狀態</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs cue-muted">下一個可記分對局</div>
          <div className="font-semibold mt-1">{nextScorableLabel}</div>
        </div>
        <button
          type="button"
          disabled={!nextScorableMatch}
          className={`px-3 py-2 rounded text-sm font-semibold ${
            nextScorableMatch ? 'cue-button' : 'cue-surface-strong cue-muted'
          }`}
          onClick={() => {
            if (!nextScorableMatch) return;
            onJumpToMatch(nextScorableMatch);
          }}
        >
          {!nextScorableMatch ? '暫無可跳轉對局' : '跳到下一場可記分對局'}
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">未排時間快捷入口</div>
          <div className="font-semibold mt-1">{unscheduledLabel}</div>
          <button
            type="button"
            disabled={!firstUnscheduledMatch}
            className={`mt-2 px-3 py-2 rounded text-sm font-semibold ${
              firstUnscheduledMatch ? 'cue-surface hover:brightness-95' : 'cue-surface-strong cue-muted'
            }`}
            onClick={() => {
              if (!firstUnscheduledMatch) return;
              onApplyScheduleFocus({ quickFilter: 'UNFINISHED', statusFilter: 'ALL' });
              onJumpToMatch(firstUnscheduledMatch);
            }}
          >
            {!firstUnscheduledMatch ? '已全部排程' : '跳到首場未排時間對局'}
          </button>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">未編球枱快捷入口</div>
          <div className="font-semibold mt-1">{unassignedTableLabel}</div>
          <button
            type="button"
            disabled={!firstUnassignedTableMatch}
            className={`mt-2 px-3 py-2 rounded text-sm font-semibold ${
              firstUnassignedTableMatch ? 'cue-surface hover:brightness-95' : 'cue-surface-strong cue-muted'
            }`}
            onClick={() => {
              if (!firstUnassignedTableMatch) return;
              onApplyScheduleFocus({ quickFilter: 'UNFINISHED', statusFilter: 'ALL' });
              onJumpToMatch(firstUnassignedTableMatch);
            }}
          >
            {!firstUnassignedTableMatch ? '已全部分配球枱' : '跳到首場未編球枱對局'}
          </button>
        </div>
      </div>
      <div className="text-xs cue-muted mt-3">{guidance}</div>
    </div>
  );
};

export default VenueTournamentLeagueWorkflowInsights;
