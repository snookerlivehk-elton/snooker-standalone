import React from 'react';

type LeagueSchedulePanelProps = {
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  filteredLeagueRounds: any[];
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  selectMatchForScoring: (row: any) => void;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
};

const LeagueSchedulePanel: React.FC<LeagueSchedulePanelProps> = ({
  buildMatchProgressSummary,
  filteredLeagueRounds,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  selectMatchForScoring,
  selectedMatchId,
  selectedTournamentBestOf,
}) => {
  if (filteredLeagueRounds.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold">League Rounds</div>
        <div className="text-xs cue-muted">依輪次排列，按卡片可直接切換到該場對局記分</div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {filteredLeagueRounds.map((round) => (
          <div key={round.label} className="cue-surface rounded-lg p-3">
            <div className="font-semibold mb-2">{round.label}</div>
            <div className="text-xs cue-muted mb-2">
              {round.summary.total} 場
              {round.summary.liveCount > 0 ? ` · 進行中 ${round.summary.liveCount}` : ''}
              {round.summary.readyCount > 0 ? ` · 就緒 ${round.summary.readyCount}` : ''}
              {round.summary.completedCount > 0 ? ` · 已完成 ${round.summary.completedCount}` : ''}
            </div>
            <div className="grid gap-2">
              {round.items.map((row: any) => {
                const id = String(row?.id || '');
                const canSelectMatch =
                  !!row?.player_a_participant_id &&
                  !!row?.player_b_participant_id &&
                  String(row?.status || '').toUpperCase() !== 'PENDING';
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!canSelectMatch}
                    onClick={() => {
                      if (!canSelectMatch) return;
                      selectMatchForScoring(row);
                    }}
                    className={`w-full rounded-lg border p-3 text-left ${
                      !canSelectMatch
                        ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed'
                        : selectedMatchId === id
                          ? 'border-yellow-400 bg-white/5'
                          : 'cue-border cue-surface hover:brightness-95'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                      <span>M{row?.match_no || '-'}</span>
                      <span>{formatMatchResultTypeLabel(row?.result_type)}</span>
                    </div>
                    <div className="font-semibold truncate">{formatParticipantLabel(row?.player_a_participant)}</div>
                    <div className="text-xs cue-muted my-1">
                      {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                    </div>
                    <div className="font-semibold truncate">{formatParticipantLabel(row?.player_b_participant)}</div>
                    <div className="text-xs cue-muted mt-2">
                      {buildMatchProgressSummary(row, selectedTournamentBestOf)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeagueSchedulePanel;
