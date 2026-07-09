import React from 'react';

type TournamentSeedMode = 'MANUAL' | 'RANKING' | 'RANDOM';

type VenueTournamentKnockoutSeedingGuideProps = {
  hasSchedule: boolean;
  participantCount: number;
  seedMode: TournamentSeedMode;
};

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

const VenueTournamentKnockoutSeedingGuide: React.FC<VenueTournamentKnockoutSeedingGuideProps> = ({
  hasSchedule,
  participantCount,
  seedMode,
}) => {
  const canEstimate = participantCount >= 2;
  const bracketSize = canEstimate ? nextPowerOfTwo(participantCount) : 0;
  const byeCount = canEstimate ? Math.max(0, bracketSize - participantCount) : 0;
  const hasPreliminaryRound = canEstimate && participantCount !== bracketSize;
  const mainDrawSize = canEstimate ? bracketSize / (hasPreliminaryRound ? 2 : 1) : 0;
  const byeSeedsLabel = byeCount > 0 ? `#1 至 #${byeCount}` : '不需要輪空 seed';

  return (
    <div className="cue-surface rounded-lg p-3 mb-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold">淘汰賽模式 seed / bye 摘要</div>
        <div className="text-xs cue-muted">seedMode: {seedMode}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <div className="text-xs cue-muted">正式參賽者</div>
          <div className="font-semibold mt-1">{participantCount || 0} 人</div>
        </div>
        <div>
          <div className="text-xs cue-muted">籤表大小</div>
          <div className="font-semibold mt-1">{canEstimate ? `${bracketSize} 強` : '-'}</div>
        </div>
        <div>
          <div className="text-xs cue-muted">輪空 Bye</div>
          <div className="font-semibold mt-1">{canEstimate ? `${byeCount} 個` : '-'}</div>
        </div>
        <div>
          <div className="text-xs cue-muted">起始輪次</div>
          <div className="font-semibold mt-1">
            {canEstimate ? (hasPreliminaryRound ? `預賽 -> ${mainDrawSize} 強` : `${bracketSize} 強主賽圈`) : '-'}
          </div>
        </div>
      </div>
      <div className="text-xs cue-muted mt-3">
        {canEstimate
          ? hasPreliminaryRound
            ? `目前人數未滿 2 的次方，系統會先產生預賽，並讓高 seed 優先取得 bye。預計 bye seed：${byeSeedsLabel}。`
            : '目前人數剛好可直接進入完整主賽圈，不需預賽與 bye。'
          : '至少需要 2 位正式參賽者才可估算籤表。'}
      </div>
      <div className="text-xs cue-muted mt-1">
        {hasSchedule ? '賽程已生成，seed、bye 與預賽配置已鎖定；若需重排，請先使用重建賽程。'
          : '建議先確認 seed 順序，再生成淘汰賽模式賽程。'}
      </div>
    </div>
  );
};

export default VenueTournamentKnockoutSeedingGuide;
