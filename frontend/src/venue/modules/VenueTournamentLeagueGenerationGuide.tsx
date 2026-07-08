import React from 'react';

type TournamentLeagueRoundRobinMode = 'SINGLE' | 'DOUBLE';

type VenueTournamentLeagueGenerationGuideProps = {
  bestOfFrames: number;
  confirmedCount: number;
  hasParticipants: boolean;
  hasSchedule: boolean;
  participantCount: number;
  roundRobinMode: TournamentLeagueRoundRobinMode;
};

const VenueTournamentLeagueGenerationGuide: React.FC<VenueTournamentLeagueGenerationGuideProps> = ({
  bestOfFrames,
  confirmedCount,
  hasParticipants,
  hasSchedule,
  participantCount,
  roundRobinMode,
}) => {
  const effectiveParticipantCount = hasParticipants ? participantCount : confirmedCount;
  const canEstimate = effectiveParticipantCount >= 2;
  const baseRounds = canEstimate
    ? effectiveParticipantCount % 2 === 0
      ? effectiveParticipantCount - 1
      : effectiveParticipantCount
    : 0;
  const totalRounds = roundRobinMode === 'DOUBLE' ? baseRounds * 2 : baseRounds;
  const matchesPerPass = canEstimate ? (effectiveParticipantCount * (effectiveParticipantCount - 1)) / 2 : 0;
  const totalMatches = roundRobinMode === 'DOUBLE' ? matchesPerPass * 2 : matchesPerPass;
  const averageMatchesPerRound = canEstimate ? Math.floor(effectiveParticipantCount / 2) : 0;
  const sourceLabel = hasParticipants ? '正式名單' : '已確認報名';
  const nextStepLabel = hasSchedule
    ? '賽程已生成，可直接開始安排與記分。'
    : !hasParticipants
      ? '下一步先生成正式名單，再建立 League 賽程。'
      : '下一步可按目前設定生成 League 賽程。';

  return (
    <div className="cue-surface rounded-lg p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold">League 生成前預估</div>
        <div className="text-xs cue-muted">{roundRobinMode === 'DOUBLE' ? '雙循環' : '單循環'}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <div className="text-xs cue-muted">{sourceLabel}</div>
          <div className="font-semibold mt-1">{effectiveParticipantCount || 0} 人</div>
        </div>
        <div>
          <div className="text-xs cue-muted">預計輪次</div>
          <div className="font-semibold mt-1">{canEstimate ? `${totalRounds} 輪` : '-'}</div>
        </div>
        <div>
          <div className="text-xs cue-muted">預計場數</div>
          <div className="font-semibold mt-1">{canEstimate ? `${totalMatches} 場` : '-'}</div>
        </div>
        <div>
          <div className="text-xs cue-muted">每場設定</div>
          <div className="font-semibold mt-1">{`BO${bestOfFrames || 1}`}</div>
        </div>
      </div>
      <div className="text-xs cue-muted mt-3">
        {canEstimate
          ? `${effectiveParticipantCount % 2 === 1 ? '單數人數會有輪空位；' : ''}每輪約 ${averageMatchesPerRound} 場，${roundRobinMode === 'DOUBLE' ? '第二循環會對調主客序' : '完成一輪後即完成聯賽基本循環'}。`
          : '至少需要 2 位球手才可估算 League 賽程。'}
      </div>
      <div className="text-xs cue-muted mt-1">{nextStepLabel}</div>
    </div>
  );
};

export default VenueTournamentLeagueGenerationGuide;
