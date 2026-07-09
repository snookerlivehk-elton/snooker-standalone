import React from 'react';

type ClubPublicTournamentLiveSectionProps = {
  openedTournament: any;
  openedTournamentFormat: any;
  openedTournamentParticipants: any[];
  openedTournamentMatches: any[];
  openedTournamentLiveMatches: any[];
  openedTournamentReadyMatches: any[];
  openedTournamentRecentCompletedMatches: any[];
  buildPublicTournamentBreakSummary: (row: any) => any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  buildPublicTournamentLiveProgressLabel: (row: any, bestOfFrames: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
  openTournamentParticipantPanel: (participant: any) => void;
};

const ClubPublicTournamentLiveSection: React.FC<ClubPublicTournamentLiveSectionProps> = ({
  openedTournament,
  openedTournamentFormat,
  openedTournamentParticipants,
  openedTournamentMatches,
  openedTournamentLiveMatches,
  openedTournamentReadyMatches,
  openedTournamentRecentCompletedMatches,
  buildPublicTournamentBreakSummary,
  formatPublicTournamentStageLabel,
  buildPublicTournamentLiveProgressLabel,
  formatTournamentMatchStatusLabel,
  formatTournamentParticipantLabel,
  openTournamentParticipantPanel,
}) => {
  if (openedTournamentMatches.length <= 0) return null;

  return (
    <div className="cue-surface-strong rounded-lg p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
        <div>
          <div className="font-semibold">Live 賽況</div>
          <div className="text-xs cue-muted mt-1">即時反映目前盤數、下一局與本場 break 摘要</div>
        </div>
        <div className="text-xs cue-muted">
          進行中 {openedTournamentLiveMatches.length} · 即將上場 {openedTournamentReadyMatches.length} · 最近完成 {openedTournamentRecentCompletedMatches.length}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <div className="cue-surface rounded-lg p-3">
          <div className="text-sm cue-muted">進行中</div>
          <div className="text-2xl font-extrabold accent-yellow mt-1">{openedTournamentLiveMatches.length}</div>
          <div className="text-xs cue-muted mt-2">已開局而未完賽場次</div>
        </div>
        <div className="cue-surface rounded-lg p-3">
          <div className="text-sm cue-muted">即將上場</div>
          <div className="text-2xl font-extrabold accent-yellow mt-1">{openedTournamentReadyMatches.length}</div>
          <div className="text-xs cue-muted mt-2">已排位可隨時開打場次</div>
        </div>
        <div className="cue-surface rounded-lg p-3">
          <div className="text-sm cue-muted">最新完成</div>
          <div className="text-2xl font-extrabold accent-yellow mt-1">{Number(openedTournament?.summary?.completedMatchCount || 0)}</div>
          <div className="text-xs cue-muted mt-2">本賽事已完成場次總數</div>
        </div>
      </div>

      {openedTournamentLiveMatches.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {openedTournamentLiveMatches.map((row: any) => {
            const breakSummary = buildPublicTournamentBreakSummary(row);
            return (
              <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</div>
                    <div className="text-xs cue-muted mt-1">{buildPublicTournamentLiveProgressLabel(row, openedTournament?.bestOfFrames)}</div>
                  </div>
                  <div className="text-xs font-semibold accent-yellow">{formatTournamentMatchStatusLabel(row?.status)}</div>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => openTournamentParticipantPanel(row?.player_a_participant)}
                    className="font-semibold text-left hover:underline"
                  >
                    {formatTournamentParticipantLabel(row?.player_a_participant)}
                  </button>
                  <div className="text-sm cue-muted my-1">
                    {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                  </div>
                  <button
                    type="button"
                    onClick={() => openTournamentParticipantPanel(row?.player_b_participant)}
                    className="font-semibold text-left hover:underline"
                  >
                    {formatTournamentParticipantLabel(row?.player_b_participant)}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 mt-3 text-xs">
                  <div className="cue-surface-strong rounded-lg p-2">{breakSummary.topLabel}</div>
                  <div className="cue-surface-strong rounded-lg p-2">{breakSummary.countLabel}</div>
                  <div className="cue-surface-strong rounded-lg p-2">已完成 {Array.isArray(row?.frames) ? row.frames.length : 0} 局</div>
                </div>
                <div className="text-xs cue-muted mt-3">{breakSummary.latestLabel}</div>
                <div className="text-xs cue-muted mt-2">可直接點擊球手名稱查看個人戰況。</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm cue-muted">目前未有進行中場次；下方會顯示即將上場或最近完成的對局。</div>
      )}

      {openedTournamentReadyMatches.length > 0 ? (
        <div className="mt-4">
          <div className="font-semibold mb-2">即將上場</div>
          <div className="grid gap-2 lg:grid-cols-2">
            {openedTournamentReadyMatches.slice(0, 4).map((row: any) => (
              <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                  <span>{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</span>
                  <span>{row?.scheduled_at ? new Date(String(row.scheduled_at)).toLocaleString() : '待定時間'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openTournamentParticipantPanel(row?.player_a_participant)}
                  className="font-semibold text-left hover:underline"
                >
                  {formatTournamentParticipantLabel(row?.player_a_participant)}
                </button>
                <div className="text-xs cue-muted my-1">vs</div>
                <button
                  type="button"
                  onClick={() => openTournamentParticipantPanel(row?.player_b_participant)}
                  className="font-semibold text-left hover:underline"
                >
                  {formatTournamentParticipantLabel(row?.player_b_participant)}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {openedTournamentRecentCompletedMatches.length > 0 ? (
        <div className="mt-4">
          <div className="font-semibold mb-2">最近完成</div>
          <div className="grid gap-2 lg:grid-cols-3">
            {openedTournamentRecentCompletedMatches.map((row: any) => (
              <div key={String(row?.id || Math.random())} className="cue-surface rounded-lg p-3">
                <div className="text-xs cue-muted">{formatPublicTournamentStageLabel(row, openedTournamentFormat, openedTournamentParticipants.length)}</div>
                <button
                  type="button"
                  onClick={() => openTournamentParticipantPanel(row?.player_a_participant)}
                  className="mt-2 font-semibold text-left hover:underline"
                >
                  {formatTournamentParticipantLabel(row?.player_a_participant)}
                </button>
                <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                <button
                  type="button"
                  onClick={() => openTournamentParticipantPanel(row?.player_b_participant)}
                  className="font-semibold text-left hover:underline"
                >
                  {formatTournamentParticipantLabel(row?.player_b_participant)}
                </button>
                <div className="text-xs cue-muted mt-2">{buildPublicTournamentLiveProgressLabel(row, openedTournament?.bestOfFrames)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ClubPublicTournamentLiveSection;
