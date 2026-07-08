import React from 'react';

type KnockoutBracketPanelProps = {
  buildMatchMeta: (row: any) => string;
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  effectiveFocusedRoundLabel: string;
  filteredBracketColumns: any[];
  formatMatchResultTypeLabel: (value: any) => string;
  formatMatchStatusLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  getBracketCardClassName: (row: any, canSelectMatch: boolean, selected: boolean) => string;
  getMatchStatusTone: (value: any) => string;
  getRoundTheme: (label: string) => {
    chipClassName: string;
    cardClassName: string;
    headerClassName: string;
  };
  knockoutRoundCards: any[];
  onFocusRound: (label: string) => void;
  selectMatchForScoring: (row: any) => void;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
};

const KnockoutBracketPanel: React.FC<KnockoutBracketPanelProps> = ({
  buildMatchMeta,
  buildMatchProgressSummary,
  effectiveFocusedRoundLabel,
  filteredBracketColumns,
  formatMatchResultTypeLabel,
  formatMatchStatusLabel,
  formatParticipantLabel,
  getBracketCardClassName,
  getMatchStatusTone,
  getRoundTheme,
  knockoutRoundCards,
  onFocusRound,
  selectMatchForScoring,
  selectedMatchId,
  selectedTournamentBestOf,
}) => {
  if (knockoutRoundCards.length === 0 && filteredBracketColumns.length === 0) return null;
  const selectedRoundLabel = filteredBracketColumns.find((column: any) => (
    Array.isArray(column?.items) && column.items.some((row: any) => String(row?.id || '') === selectedMatchId)
  ))?.label || '';

  return (
    <div className="mt-5">
      {knockoutRoundCards.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
          {knockoutRoundCards.map((column) => {
            const isFocused = effectiveFocusedRoundLabel === column.label;
            const isAll = effectiveFocusedRoundLabel === 'ALL';
            const roundTheme = getRoundTheme(column.label);
            return (
              <button
                key={column.label}
                type="button"
                onClick={() => onFocusRound(isFocused ? 'ALL' : column.label)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  isFocused
                    ? `${roundTheme.cardClassName} shadow-[0_0_0_1px_rgba(255,255,255,0.06)]`
                    : selectedRoundLabel === column.label
                      ? 'border-yellow-400/50 bg-yellow-500/10 shadow-[0_0_0_1px_rgba(250,204,21,0.16)]'
                    : isAll
                      ? 'cue-border cue-surface hover:brightness-105'
                      : 'cue-border cue-surface hover:brightness-105'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`font-semibold ${roundTheme.headerClassName}`}>{column.label}</div>
                  <div className="text-xs cue-muted">{column.total} 場</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs cue-muted">
                  <span>進行中 {column.liveCount}</span>
                  <span>就緒 {column.readyCount}</span>
                  <span>已完成 {column.completedCount}</span>
                  <span>待定 {column.pendingCount}</span>
                </div>
                <div className="text-[11px] cue-muted mt-2">
                  {selectedRoundLabel === column.label
                    ? '目前記分區正在處理這一輪'
                    : isFocused
                      ? '再按一次返回全部輪次'
                      : '按一下聚焦此輪'}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="font-semibold">Knockout Bracket Tree</div>
        <div className="text-xs cue-muted">
          {effectiveFocusedRoundLabel !== 'ALL' ? `焦點輪次：${effectiveFocusedRoundLabel}` : '按卡片可直接切換到該場對局記分'}
        </div>
      </div>
      <div className="overflow-x-auto -mx-2 px-2 pb-2">
        <div className="flex gap-8 xl:gap-10 min-w-fit items-start">
          {filteredBracketColumns.map((column) => {
            const isFocusedColumn =
              effectiveFocusedRoundLabel === 'ALL' || effectiveFocusedRoundLabel === column.label;
            const roundTheme = getRoundTheme(String(column?.label || ''));
            return (
              <div
                key={column.label}
                className={`w-[19rem] xl:w-[21rem] 2xl:w-[23rem] shrink-0 transition-opacity ${
                  isFocusedColumn ? 'opacity-100' : 'opacity-35'
                }`}
              >
                <div className={`mb-3 rounded-lg p-2 ${selectedRoundLabel === column.label ? 'border border-yellow-400/40 bg-yellow-500/10' : ''}`}>
                  <div className={`font-semibold ${roundTheme.headerClassName}`}>{column.label}</div>
                  <div className="text-xs cue-muted mt-1">
                    {column.summary?.total || 0} 場
                    {Number(column.summary?.liveCount || 0) > 0 ? ` · 進行中 ${column.summary.liveCount}` : ''}
                    {Number(column.summary?.completedCount || 0) > 0
                      ? ` · 已完成 ${column.summary.completedCount}`
                      : ''}
                  </div>
                  {selectedRoundLabel === column.label ? (
                    <div className="mt-1 text-[11px] text-yellow-100">
                      目前選中的對局來自這一輪
                    </div>
                  ) : null}
                </div>
                {column.items.length === 0 ? (
                  <div className="cue-surface-strong rounded-lg border cue-border p-3 text-sm cue-muted">
                    此狀態篩選下沒有對局
                  </div>
                ) : (
                  <div
                    className="relative"
                    style={{
                      height: `${column.columnHeight}px`,
                      paddingTop: `${column.paddingTop}px`,
                    }}
                  >
                    {column.connectors.map((connector: any, connectorIndex: number) => (
                      <React.Fragment key={`${column.label}-connector-${connectorIndex}`}>
                        <div
                          className="absolute border-t cue-border"
                          style={{
                            left: '100%',
                            top: `${connector.top}px`,
                            width: `${column.connectorHalfGap}px`,
                          }}
                        />
                        <div
                          className="absolute border-r cue-border"
                          style={{
                            left: `calc(100% + ${column.connectorHalfGap}px)`,
                            top: `${connector.top}px`,
                            height: `${connector.height}px`,
                          }}
                        />
                        <div
                          className="absolute border-t cue-border"
                          style={{
                            left: '100%',
                            top: `${connector.top + connector.height}px`,
                            width: `${column.connectorHalfGap}px`,
                          }}
                        />
                      </React.Fragment>
                    ))}
                    <div className="flex flex-col" style={{ gap: `${column.gap}px` }}>
                      {column.items.map((row: any) => {
                        const id = String(row?.id || '');
                        const aLabel = formatParticipantLabel(row?.player_a_participant);
                        const bLabel = formatParticipantLabel(row?.player_b_participant);
                        const winnerId = String(row?.winner_participant_id || '');
                        const aParticipantId = String(row?.player_a_participant_id || '');
                        const bParticipantId = String(row?.player_b_participant_id || '');
                        const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
                        const canSelectMatch =
                          !!aParticipantId &&
                          !!bParticipantId &&
                          String(row?.status || '').toUpperCase() !== 'PENDING';
                        return (
                          <div key={id} className="relative" style={{ height: `${column.cardHeight}px` }}>
                            {column.roundIndex > 0 ? (
                              <div
                                className="absolute border-t cue-border"
                                style={{
                                  right: '100%',
                                  top: '50%',
                                  width: `${column.connectorHalfGap}px`,
                                }}
                              />
                            ) : null}
                            {!column.isFinal ? (
                              <div
                                className="absolute border-t cue-border"
                                style={{
                                  left: '100%',
                                  top: '50%',
                                  width: `${column.connectorHalfGap}px`,
                                }}
                              />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                if (!canSelectMatch) return;
                                selectMatchForScoring(row);
                              }}
                              disabled={!canSelectMatch}
                              className={`relative z-10 h-full w-full text-left rounded-lg border p-3 transition-colors ${
                                selectedMatchId === id
                                  ? `${getBracketCardClassName(row, canSelectMatch, true)} ${roundTheme.cardClassName}`
                                  : getBracketCardClassName(row, canSelectMatch, false)
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                                <span>M{row?.match_no || '-'}</span>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${getMatchStatusTone(row?.status)}`}
                                >
                                  {formatMatchStatusLabel(row?.status)}
                                </span>
                              </div>
                              <div className="text-[11px] cue-muted mb-2">{buildMatchMeta(row)}</div>
                              <div
                                className={`font-semibold leading-snug whitespace-normal break-words ${
                                  winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''
                                }`}
                              >
                                {aLabel}
                              </div>
                              <div className="text-sm cue-muted my-1">
                                {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                              </div>
                              <div
                                className={`font-semibold leading-snug whitespace-normal break-words ${
                                  winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''
                                }`}
                              >
                                {bLabel}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                                <span className="cue-muted">{resultTypeLabel}</span>
                                <span className="cue-muted text-right">
                                  {buildMatchProgressSummary(row, selectedTournamentBestOf)}
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KnockoutBracketPanel;
