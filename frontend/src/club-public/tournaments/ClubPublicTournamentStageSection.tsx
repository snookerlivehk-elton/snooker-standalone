import React from 'react';

type ClubPublicTournamentStageSectionProps = {
  openedTournamentFormat: any;
  openedTournamentParticipants: any[];
  openedTournamentMatches: any[];
  openedTournamentBracketColumns: any[];
  openedTournamentLeagueRounds: any[];
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentResultTypeLabel: (value: any) => string;
  formatPublicKnockoutRoundLabel: (row: any, participantCount: number) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  PUBLIC_BRACKET_CONNECTOR_HALF_GAP: number;
  PUBLIC_BRACKET_CARD_HEIGHT: number;
};

const ClubPublicTournamentStageSection: React.FC<ClubPublicTournamentStageSectionProps> = ({
  openedTournamentFormat,
  openedTournamentParticipants,
  openedTournamentMatches,
  openedTournamentBracketColumns,
  openedTournamentLeagueRounds,
  formatTournamentParticipantLabel,
  formatTournamentResultTypeLabel,
  formatPublicKnockoutRoundLabel,
  formatTournamentMatchStatusLabel,
  PUBLIC_BRACKET_CONNECTOR_HALF_GAP,
  PUBLIC_BRACKET_CARD_HEIGHT,
}) => {
  return (
    <>
      {openedTournamentFormat === 'KNOCKOUT' && openedTournamentBracketColumns.length > 0 ? (
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="font-semibold">Knockout Bracket</div>
            <div className="text-xs cue-muted">{openedTournamentMatches.length} 場</div>
          </div>
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex gap-10 min-w-max items-start pb-2">
              {openedTournamentBracketColumns.map((column: any) => (
                <div key={String(column?.label || Math.random())} className="w-72">
                  <div className="font-semibold mb-3">{column.label}</div>
                  <div className="relative" style={{ height: `${column.columnHeight}px`, paddingTop: `${column.paddingTop}px` }}>
                    {column.connectors.map((connector: any, connectorIndex: number) => (
                      <React.Fragment key={`${column.label}-connector-${connectorIndex}`}>
                        <div className="absolute border-t cue-border" style={{ left: '100%', top: `${connector.top}px`, width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                        <div className="absolute border-r cue-border" style={{ left: `calc(100% + ${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px)`, top: `${connector.top}px`, height: `${connector.height}px` }} />
                        <div className="absolute border-t cue-border" style={{ left: '100%', top: `${connector.top + connector.height}px`, width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                      </React.Fragment>
                    ))}
                    <div className="flex flex-col" style={{ gap: `${column.gap}px` }}>
                      {column.items.map((row: any) => {
                        const winnerId = String(row?.winner_participant_id || '');
                        const aParticipantId = String(row?.player_a_participant_id || '');
                        const bParticipantId = String(row?.player_b_participant_id || '');
                        return (
                          <div key={String(row?.id || Math.random())} className="relative" style={{ height: `${PUBLIC_BRACKET_CARD_HEIGHT}px` }}>
                            {column.roundIndex > 0 ? (
                              <div className="absolute border-t cue-border" style={{ right: '100%', top: '50%', width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                            ) : null}
                            {!column.isFinal ? (
                              <div className="absolute border-t cue-border" style={{ left: '100%', top: '50%', width: `${PUBLIC_BRACKET_CONNECTOR_HALF_GAP}px` }} />
                            ) : null}
                            <div className="relative z-10 h-full w-full rounded-lg border cue-border cue-surface p-3">
                              <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                                <span>M{row?.match_no || '-'}</span>
                                <span>{formatTournamentResultTypeLabel(row?.result_type)}</span>
                              </div>
                              <div className={`font-semibold truncate ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                              <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                              <div className={`font-semibold truncate ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {openedTournamentFormat === 'LEAGUE' && openedTournamentLeagueRounds.length > 0 ? (
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="font-semibold">League Rounds</div>
            <div className="text-xs cue-muted">{openedTournamentLeagueRounds.length} 輪</div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {openedTournamentLeagueRounds.map((round: any) => (
              <div key={String(round?.label || round?.roundNo || Math.random())} className="cue-surface rounded-lg p-3">
                <div className="font-semibold mb-2">{round.label}</div>
                <div className="grid gap-2">
                  {round.items.map((row: any) => (
                    <div key={String(row?.id || Math.random())} className="rounded-lg border cue-border p-3">
                      <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                        <span>M{row?.match_no || '-'}</span>
                        <span>{formatTournamentResultTypeLabel(row?.result_type)}</span>
                      </div>
                      <div className="font-semibold truncate">{formatTournamentParticipantLabel(row?.player_a_participant)}</div>
                      <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                      <div className="font-semibold truncate">{formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="cue-surface-strong rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-semibold">公開賽程列表</div>
          <div className="text-xs cue-muted">{openedTournamentMatches.length} 場</div>
        </div>
        {openedTournamentMatches.length === 0 ? (
          <div className="text-sm cue-muted">尚未生成賽程</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">輪次</th>
                  <th className="py-2 px-2">對賽</th>
                  <th className="py-2 px-2">比分</th>
                  <th className="py-2 px-2">狀態</th>
                </tr>
              </thead>
              <tbody>
                {openedTournamentMatches.map((row: any) => (
                  <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                    <td className="py-2 px-2 whitespace-nowrap">
                      {openedTournamentFormat === 'LEAGUE'
                        ? `第 ${Number(row?.round_no || 0)} 輪`
                        : formatPublicKnockoutRoundLabel(row, openedTournamentParticipants.length)}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-semibold">{formatTournamentParticipantLabel(row?.player_a_participant)} vs {formatTournamentParticipantLabel(row?.player_b_participant)}</div>
                      <div className="text-xs cue-muted mt-1">M{row?.match_no || '-'} · {formatTournamentResultTypeLabel(row?.result_type)}</div>
                    </td>
                    <td className="py-2 px-2 whitespace-nowrap">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</td>
                    <td className="py-2 px-2 whitespace-nowrap">{formatTournamentMatchStatusLabel(row?.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default ClubPublicTournamentStageSection;
