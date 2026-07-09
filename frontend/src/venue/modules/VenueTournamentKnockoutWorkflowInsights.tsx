import React from 'react';
import { formatKnockoutRoundLabel } from './useTournamentStageViewData';

type VenueTournamentKnockoutWorkflowInsightsProps = {
  matchesRows: any[];
  onJumpToMatch: (row: any) => void;
  participantsCount: number;
  selectedMatchId: string;
};

function getStatusCount(items: any[], status: string) {
  return items.filter((row: any) => String(row?.status || '').trim().toUpperCase() === status).length;
}

const VenueTournamentKnockoutWorkflowInsights: React.FC<VenueTournamentKnockoutWorkflowInsightsProps> = ({
  matchesRows,
  onJumpToMatch,
  participantsCount,
  selectedMatchId,
}) => {
  const [showAllBlocked, setShowAllBlocked] = React.useState(false);
  const scorableRows = matchesRows.filter((row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    return !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
  });
  const blockedRows = matchesRows.filter((row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    return status === 'PENDING' && (!row?.player_a_participant_id || !row?.player_b_participant_id);
  });
  const nextScorableMatch = scorableRows.find((row: any) => String(row?.id || '') !== selectedMatchId) || scorableRows[0] || null;
  const waitingOneSideCount = blockedRows.filter((row: any) => !!row?.player_a_participant_id !== !!row?.player_b_participant_id).length;
  const waitingBothSidesCount = blockedRows.filter((row: any) => !row?.player_a_participant_id && !row?.player_b_participant_id).length;
  const blockedReasonExamples = blockedRows.map((row: any) => {
    const matchNo = Math.max(1, Number(row?.match_no || 1));
    const roundNo = Math.max(1, Number(row?.round_no || 1));
    const stageCode = String(row?.stage_code || '').trim().toUpperCase();
    const currentLabel = formatKnockoutRoundLabel(row, participantsCount);
    const leftMatchNo = stageCode === 'KNOCKOUT_THIRD_PLACE' ? 1 : Math.max(1, matchNo * 2 - 1);
    const rightMatchNo = stageCode === 'KNOCKOUT_THIRD_PLACE' ? 2 : Math.max(1, matchNo * 2);
    const leftSource = stageCode === 'KNOCKOUT_THIRD_PLACE' ? '四強 M1 敗方' : `上一輪 M${leftMatchNo}`;
    const rightSource = stageCode === 'KNOCKOUT_THIRD_PLACE' ? '四強 M2 敗方' : `上一輪 M${rightMatchNo}`;
    const upstreamMatches = matchesRows.filter((candidate: any) => (
      Number(candidate?.round_no || 0) === roundNo - 1
      && String(candidate?.stage_code || '').trim().toUpperCase() === 'KNOCKOUT_MAIN'
      && (Number(candidate?.match_no || 0) === leftMatchNo || Number(candidate?.match_no || 0) === rightMatchNo)
    ));
    const jumpTarget = upstreamMatches.find((candidate: any) => String(candidate?.status || '').trim().toUpperCase() !== 'COMPLETED')
      || upstreamMatches[0]
      || null;
    let reason = '等待上游對局完成';
    if (stageCode === 'KNOCKOUT_THIRD_PLACE') {
      reason = `等待 ${leftSource} 與 ${rightSource} 補入`;
    } else if (roundNo <= 1) {
      reason = '等待進級表初始配對完成';
    } else if (!row?.player_a_participant_id && !row?.player_b_participant_id) {
      reason = `等待 ${leftSource} 與 ${rightSource} 的勝方`;
    } else if (!row?.player_a_participant_id) {
      reason = `等待 ${leftSource} 的勝方補入上線`;
    } else if (!row?.player_b_participant_id) {
      reason = `等待 ${rightSource} 的勝方補入下線`;
    }
    return {
      id: String(row?.id || `${roundNo}-${matchNo}`),
      label: `${currentLabel} M${matchNo}`,
      reason,
      sourcesLabel: upstreamMatches.length > 0
        ? upstreamMatches.map((candidate: any) => `${formatKnockoutRoundLabel(candidate, participantsCount)} M${Number(candidate?.match_no || 0)}`).join(' / ')
        : `${leftSource} / ${rightSource}`,
      jumpTarget,
    };
  });
  const currentRoundLabel = (() => {
    const liveOrReady = matchesRows.find((row: any) => {
      const status = String(row?.status || '').trim().toUpperCase();
      return status === 'LIVE' || status === 'READY';
    });
    if (liveOrReady) return formatKnockoutRoundLabel(liveOrReady, participantsCount);
    const firstPendingPlayable = matchesRows.find((row: any) => !!row?.player_a_participant_id && !!row?.player_b_participant_id);
    return firstPendingPlayable ? formatKnockoutRoundLabel(firstPendingPlayable, participantsCount) : '-';
  })();
  const readyCount = getStatusCount(matchesRows, 'READY');
  const liveCount = getStatusCount(matchesRows, 'LIVE');
  const completedCount = getStatusCount(matchesRows, 'COMPLETED');
  const visibleBlockedItems = showAllBlocked ? blockedReasonExamples : blockedReasonExamples.slice(0, 4);

  let guidance = '先完成目前輪次，再讓下游進級表自動解鎖。';
  if (matchesRows.length === 0) {
    guidance = '尚未生成淘汰賽模式進級表，先確認 seed 與名單後再建立賽程。';
  } else if (blockedRows.length > 0) {
    guidance = `目前有 ${blockedRows.length} 場仍被上游結果阻塞；完成已 ready / live 的對局後，系統會逐步補齊下游對戰。`;
  } else if (scorableRows.length > 0) {
    guidance = `目前有 ${scorableRows.length} 場已可直接記分，可優先處理 ${currentRoundLabel}。`;
  }

  return (
    <div className="cue-surface rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="font-semibold">淘汰賽模式流程摘要</div>
        <div className="text-xs cue-muted">{matchesRows.length ? `${matchesRows.length} 場對局` : '尚未生成進級表'}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">目前推進輪次</div>
          <div className="font-semibold mt-1">{currentRoundLabel}</div>
          <div className="text-xs cue-muted mt-1">{`${liveCount} 場進行中 / ${readyCount} 場就緒`}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">可記分對局</div>
          <div className="font-semibold mt-1">{scorableRows.length}</div>
          <div className="text-xs cue-muted mt-1">雙方已確定且不屬於待定</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">Blocked 對局</div>
          <div className="font-semibold mt-1">{blockedRows.length}</div>
          <div className="text-xs cue-muted mt-1">{`${waitingOneSideCount} 場只欠一邊 / ${waitingBothSidesCount} 場兩邊未定`}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="text-xs cue-muted">已完成</div>
          <div className="font-semibold mt-1">{completedCount}</div>
          <div className="text-xs cue-muted mt-1">完成後會自動推進下游輪次</div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs cue-muted">下一個可記分對局</div>
          <div className="font-semibold mt-1">
            {nextScorableMatch
              ? `${formatKnockoutRoundLabel(nextScorableMatch, participantsCount)} M${Number(nextScorableMatch?.match_no || 0)}`
              : '目前沒有可直接跳轉的對局'}
          </div>
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
      {blockedReasonExamples.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="text-xs cue-muted">Blocked 清單預覽</div>
              <div className="text-[11px] cue-muted mt-1">
                先顯示前 {Math.min(4, blockedReasonExamples.length)} 項，避免首屏過長；需要時再展開全部。
              </div>
            </div>
            {blockedReasonExamples.length > 4 ? (
              <button
                type="button"
                className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold hover:brightness-95"
                onClick={() => setShowAllBlocked((prev) => !prev)}
              >
                {showAllBlocked ? '收合清單' : `展開全部 ${blockedReasonExamples.length} 項`}
              </button>
            ) : null}
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {visibleBlockedItems.map((item) => (
              <div key={item.id} className="text-sm">
                <span className="font-semibold">{item.label}</span>
                <span className="cue-muted"> · {item.reason}</span>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="cue-muted">上游對局：{item.sourcesLabel}</span>
                  {item.jumpTarget ? (
                    <button
                      type="button"
                      className="rounded border border-white/10 bg-white/5 px-2 py-1 font-semibold hover:brightness-95"
                      onClick={() => onJumpToMatch(item.jumpTarget)}
                    >
                      跳到上游對局
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {!showAllBlocked && blockedReasonExamples.length > visibleBlockedItems.length ? (
            <div className="mt-2 text-xs cue-muted">
              尚有 {blockedReasonExamples.length - visibleBlockedItems.length} 項未展開。
            </div>
          ) : null}
        </div>
      )}
      <div className="text-xs cue-muted mt-3">{guidance}</div>
    </div>
  );
};

export default VenueTournamentKnockoutWorkflowInsights;
