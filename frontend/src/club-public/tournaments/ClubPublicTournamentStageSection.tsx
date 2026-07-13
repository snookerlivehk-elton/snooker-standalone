import React from 'react';

type ClubPublicTournamentStageSectionProps = {
  openedTournamentFormat: any;
  openedTournamentParticipants: any[];
  openedTournamentMatches: any[];
  openedTournamentBracketColumns: any[];
  openedTournamentThirdPlaceMatch: any;
  openedTournamentLeagueRounds: any[];
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentResultTypeLabel: (value: any) => string;
  formatPublicKnockoutRoundLabel: (row: any, participantCount: number) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
  openTournamentParticipantPanel: (participant: any) => void;
  PUBLIC_BRACKET_CONNECTOR_HALF_GAP: number;
  PUBLIC_BRACKET_CARD_HEIGHT: number;
};

const ClubPublicTournamentStageSection: React.FC<ClubPublicTournamentStageSectionProps> = ({
  openedTournamentFormat,
  openedTournamentParticipants,
  openedTournamentMatches,
  openedTournamentBracketColumns,
  openedTournamentThirdPlaceMatch,
  openedTournamentLeagueRounds,
  formatTournamentParticipantLabel,
  formatTournamentResultTypeLabel,
  formatPublicKnockoutRoundLabel,
  formatTournamentMatchStatusLabel,
  openTournamentParticipantPanel,
  PUBLIC_BRACKET_CONNECTOR_HALF_GAP,
  PUBLIC_BRACKET_CARD_HEIGHT,
}) => {
  const [showLeagueRounds, setShowLeagueRounds] = React.useState(false);
  const [showFullSchedule, setShowFullSchedule] = React.useState(false);
  const isLeague = openedTournamentFormat === 'LEAGUE';
  const isGoldSilverCup = openedTournamentFormat === 'GOLD_SILVER_CUP';
  const goldBracketColumns = openedTournamentBracketColumns.filter((column: any) => (
    Array.isArray(column?.items) && column.items.some((row: any) => String(row?.stage_code || '').trim().toUpperCase().startsWith('GOLD_'))
  ));
  const silverBracketColumns = openedTournamentBracketColumns.filter((column: any) => (
    Array.isArray(column?.items) && column.items.some((row: any) => String(row?.stage_code || '').trim().toUpperCase().startsWith('SILVER_'))
  ));
  const standardBracketColumns = openedTournamentBracketColumns.filter((column: any) => (
    Array.isArray(column?.items) && column.items.some((row: any) => {
      const stageCode = String(row?.stage_code || '').trim().toUpperCase();
      return !stageCode.startsWith('GOLD_') && !stageCode.startsWith('SILVER_');
    })
  ));
  const standardThirdPlaceMatch = openedTournamentThirdPlaceMatch
    || openedTournamentMatches.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'KNOCKOUT_THIRD_PLACE')
    || null;
  const goldThirdPlaceMatch = openedTournamentMatches.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'GOLD_THIRD_PLACE') || null;
  const silverThirdPlaceMatch = openedTournamentMatches.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'SILVER_THIRD_PLACE') || null;

  const renderBracketSection = (title: string, subtitle: string, columns: any[]) => {
    if (columns.length <= 0) return null;
    return (
      <div className="cue-surface-strong rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-xs cue-muted mt-1">{subtitle}</div>
          </div>
          <div className="text-xs cue-muted">
            {columns.reduce((sum: number, column: any) => sum + (Array.isArray(column?.items) ? column.items.length : 0), 0)} 場
          </div>
        </div>
        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex gap-10 min-w-max items-start pb-2">
            {columns.map((column: any) => (
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
                            <button
                              type="button"
                              onClick={() => openTournamentParticipantPanel(row?.player_a_participant)}
                              className={`font-semibold truncate text-left hover:underline ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}
                            >
                              {formatTournamentParticipantLabel(row?.player_a_participant)}
                            </button>
                            <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                            <button
                              type="button"
                              onClick={() => openTournamentParticipantPanel(row?.player_b_participant)}
                              className={`font-semibold truncate text-left hover:underline ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}
                            >
                              {formatTournamentParticipantLabel(row?.player_b_participant)}
                            </button>
                            <div className="text-[11px] cue-muted mt-2">可點擊球手名稱查看個人戰況。</div>
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
    );
  };

  const renderThirdPlaceSection = (title: string, subtitle: string, match: any) => {
    if (!match) return null;
    return (
      <div className="cue-surface-strong rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold">{title}</div>
            <div className="text-xs cue-muted mt-1">{subtitle}</div>
          </div>
          <div className="text-xs cue-muted">{formatTournamentMatchStatusLabel(match?.status)}</div>
        </div>
        <div className="rounded-lg cue-surface p-4">
          <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
            <span>{formatPublicKnockoutRoundLabel(match, openedTournamentParticipants.length)} · M{match?.match_no || '-'}</span>
            <span>{formatTournamentResultTypeLabel(match?.result_type)}</span>
          </div>
          <button
            type="button"
            onClick={() => openTournamentParticipantPanel(match?.player_a_participant)}
            className="font-semibold truncate text-left hover:underline"
          >
            {formatTournamentParticipantLabel(match?.player_a_participant)}
          </button>
          <div className="text-sm cue-muted my-1">
            {Number(match?.player_a_frames_won ?? 0)} : {Number(match?.player_b_frames_won ?? 0)}
          </div>
          <button
            type="button"
            onClick={() => openTournamentParticipantPanel(match?.player_b_participant)}
            className="font-semibold truncate text-left hover:underline"
          >
            {formatTournamentParticipantLabel(match?.player_b_participant)}
          </button>
          <div className="text-[11px] cue-muted mt-2">可點擊球手名稱查看個人戰況。</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {!isLeague && !isGoldSilverCup ? renderBracketSection(
        '淘汰賽模式進級表',
        '以進級表為主視圖，完整對局列表已下沉到次要區。',
        standardBracketColumns,
      ) : null}

      {!isLeague && !isGoldSilverCup ? renderThirdPlaceSection(
        '季軍戰',
        '獨立於主線進級表顯示，方便分開查看第三名對決。',
        standardThirdPlaceMatch,
      ) : null}

      {isGoldSilverCup ? renderBracketSection(
        '金杯進級表',
        '先看金杯主線推進，再留意敗方如何掉入銀杯。',
        goldBracketColumns,
      ) : null}

      {isGoldSilverCup ? renderBracketSection(
        '銀杯進級表',
        '銀杯會承接金杯敗方與前序晉級者，公開頁同步拆成獨立區塊。',
        silverBracketColumns,
      ) : null}

      {isGoldSilverCup && (goldThirdPlaceMatch || silverThirdPlaceMatch) ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {renderThirdPlaceSection(
            '金杯季軍戰',
            '金杯四強敗方會在此決出金杯季軍。',
            goldThirdPlaceMatch,
          )}
          {renderThirdPlaceSection(
            '銀杯季軍戰',
            '銀杯四強敗方會在此決出銀杯季軍。',
            silverThirdPlaceMatch,
          )}
        </div>
      ) : null}

      {isLeague && openedTournamentLeagueRounds.length > 0 ? (
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="font-semibold">聯賽模式輪次對賽</div>
              <div className="text-xs cue-muted mt-1">聯賽模式以積分榜為主；輪次對賽已降為次要查看區。</div>
            </div>
            <button
              type="button"
              onClick={() => setShowLeagueRounds((prev) => !prev)}
              className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-xs font-semibold"
            >
              {showLeagueRounds ? '收合輪次' : `展開 ${openedTournamentLeagueRounds.length} 輪`}
            </button>
          </div>
          {showLeagueRounds ? (
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
                        <button
                          type="button"
                          onClick={() => openTournamentParticipantPanel(row?.player_a_participant)}
                          className="font-semibold truncate text-left hover:underline"
                        >
                          {formatTournamentParticipantLabel(row?.player_a_participant)}
                        </button>
                        <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                        <button
                          type="button"
                          onClick={() => openTournamentParticipantPanel(row?.player_b_participant)}
                          className="font-semibold truncate text-left hover:underline"
                        >
                          {formatTournamentParticipantLabel(row?.player_b_participant)}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm cue-muted">
              已先收合輪次對賽，建議先查看上方積分榜，再按需要展開輪次賽程。
            </div>
          )}
        </div>
      ) : null}

      <div className="cue-surface-strong rounded-lg p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="font-semibold">完整賽程列表</div>
            <div className="text-xs cue-muted mt-1">屬次要資訊，適合在已掌握積分榜或進級表後再查看。</div>
          </div>
          <button
            type="button"
            onClick={() => setShowFullSchedule((prev) => !prev)}
            className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-xs font-semibold"
          >
            {showFullSchedule ? '收合列表' : `展開 ${openedTournamentMatches.length} 場`}
          </button>
        </div>
        {openedTournamentMatches.length === 0 ? (
          <div className="text-sm cue-muted">尚未生成賽程</div>
        ) : !showFullSchedule ? (
          <div className="text-sm cue-muted">
            完整對局列表已收合。建議先查看主視圖，再按需要展開全部賽程。
          </div>
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
                      {isLeague
                        ? `第 ${Number(row?.round_no || 0)} 輪`
                        : formatPublicKnockoutRoundLabel(row, openedTournamentParticipants.length)}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex flex-wrap items-center gap-1 font-semibold">
                        <button
                          type="button"
                          onClick={() => openTournamentParticipantPanel(row?.player_a_participant)}
                          className="text-left hover:underline"
                        >
                          {formatTournamentParticipantLabel(row?.player_a_participant)}
                        </button>
                        <span>vs</span>
                        <button
                          type="button"
                          onClick={() => openTournamentParticipantPanel(row?.player_b_participant)}
                          className="text-left hover:underline"
                        >
                          {formatTournamentParticipantLabel(row?.player_b_participant)}
                        </button>
                      </div>
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
