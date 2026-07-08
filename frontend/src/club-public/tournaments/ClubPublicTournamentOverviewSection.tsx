import React from 'react';

type ClubPublicTournamentOverviewSectionProps = {
  openedTournament: any;
  openedTournamentFormat: any;
  openedTournamentParticipants: any[];
  openedTournamentMatches: any[];
  formatTournamentFormatLabel: (value: any) => string;
  formatTournamentWorkflowLabel: (value: any) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
};

const ClubPublicTournamentOverviewSection: React.FC<ClubPublicTournamentOverviewSectionProps> = ({
  openedTournament,
  openedTournamentFormat,
  openedTournamentParticipants,
  openedTournamentMatches,
  formatTournamentFormatLabel,
  formatTournamentWorkflowLabel,
  formatTournamentParticipantLabel,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="text-sm cue-muted">賽制</div>
          <div className="text-2xl font-extrabold accent-yellow mt-1">{formatTournamentFormatLabel(openedTournamentFormat)}</div>
          <div className="text-xs cue-muted mt-2">{formatTournamentWorkflowLabel(openedTournament?.workflow_status)}</div>
        </div>
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="text-sm cue-muted">報名</div>
          <div className="text-2xl font-extrabold accent-yellow mt-1">{Number(openedTournament?.signupCount ?? 0)}</div>
          <div className="text-xs cue-muted mt-2">
            {Number(openedTournament?.capacity ?? 0) > 0 ? `上限 ${Number(openedTournament?.capacity || 0)} 人` : '不限名額'}
          </div>
        </div>
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="text-sm cue-muted">參賽 / 賽程</div>
          <div className="text-2xl font-extrabold accent-yellow mt-1">
            {Number(openedTournament?.summary?.participantCount || openedTournamentParticipants.length)} / {openedTournamentMatches.length}
          </div>
          <div className="text-xs cue-muted mt-2">正式參賽者 / 對局數</div>
        </div>
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="text-sm cue-muted">進度</div>
          <div className="text-sm font-semibold mt-2">已完成 {Number(openedTournament?.summary?.completedMatchCount || 0)} 場</div>
          <div className="text-xs cue-muted mt-2">
            就緒 {Number(openedTournament?.summary?.readyMatchCount || 0)} · 待定 {Number(openedTournament?.summary?.pendingMatchCount || 0)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 cue-surface-strong rounded-lg p-4">
          <div className="font-semibold mb-2">比賽詳情</div>
          <div className="text-sm whitespace-pre-wrap">{String(openedTournament?.description || '—')}</div>
          {String(openedTournament?.signupGuide || '').trim() ? (
            <div className="mt-4 rounded-lg p-3 cue-surface">
              <div className="font-semibold mb-1">報名指引</div>
              <div className="text-sm cue-muted whitespace-pre-wrap">{String(openedTournament?.signupGuide || '')}</div>
            </div>
          ) : null}
        </div>
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="font-semibold mb-2">我的狀態</div>
          <div className="text-sm">
            {String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CONFIRMED'
              ? '已確認'
              : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'PENDING'
                ? '待確認'
                : String(openedTournament?.mySignup?.status || '').toUpperCase() === 'CANCELLED'
                  ? '已取消'
                  : '未報名'}
          </div>
          <div className="text-xs cue-muted mt-2">{openedTournament?.club?.name ? `場館：${openedTournament.club.name}` : ''}</div>
          <div className="text-xs cue-muted mt-1">
            {openedTournament?.startsAt ? `比賽時間：${new Date(String(openedTournament.startsAt)).toLocaleString()}` : '未設定比賽時間'}
          </div>
        </div>
      </div>

      {!!openedTournament?.podium && (openedTournament.podium?.champion || openedTournament.podium?.runnerUp || (Array.isArray(openedTournament.podium?.semiFinalists) && openedTournament.podium.semiFinalists.length > 0)) ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="cue-surface-strong rounded-lg p-4">
            <div className="text-sm cue-muted">冠軍</div>
            <div className="font-semibold mt-1">{openedTournament.podium?.champion ? formatTournamentParticipantLabel(openedTournament.podium.champion) : '-'}</div>
          </div>
          <div className="cue-surface-strong rounded-lg p-4">
            <div className="text-sm cue-muted">亞軍</div>
            <div className="font-semibold mt-1">{openedTournament.podium?.runnerUp ? formatTournamentParticipantLabel(openedTournament.podium.runnerUp) : '-'}</div>
          </div>
          <div className="cue-surface-strong rounded-lg p-4">
            <div className="text-sm cue-muted">四強</div>
            <div className="font-semibold mt-1">
              {Array.isArray(openedTournament.podium?.semiFinalists) && openedTournament.podium.semiFinalists.length > 0
                ? openedTournament.podium.semiFinalists.map((row: any) => formatTournamentParticipantLabel(row)).join(' / ')
                : '-'}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ClubPublicTournamentOverviewSection;
