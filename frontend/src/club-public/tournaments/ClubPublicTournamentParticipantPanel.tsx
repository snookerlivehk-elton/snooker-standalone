import React from 'react';

type ClubPublicTournamentParticipantPanelProps = {
  openedTournament: any;
  openedTournamentParticipants: any[];
  openedTournamentStandings: any[];
  openedTournamentFormat: any;
  tournamentParticipantSearchQuery: string;
  filteredOpenedTournamentParticipantSearchRows: any[];
  openedTournamentParticipantSearchRows: any[];
  tournamentParticipantOpen: any;
  tournamentParticipantDetailLoading: boolean;
  tournamentParticipantDetailError: string;
  tournamentParticipantDetail: any;
  selectedTournamentParticipantFormat: any;
  filteredTournamentParticipantRecentForm: any[];
  filteredTournamentParticipantOpponentStats: any[];
  tournamentParticipantMonthFilter: string;
  tournamentParticipantRoundFilter: string;
  tournamentParticipantFilterOptions: any;
  filteredTournamentParticipantMatches: any[];
  filteredTournamentParticipantBreaks: any[];
  filteredTournamentParticipantChartData: any;
  setTournamentParticipantSearchQuery: (value: string) => void;
  openTournamentParticipantPanel: (row: any) => void;
  setTournamentParticipantOpen: (value: any) => void;
  setTournamentParticipantMonthFilter: (value: string) => void;
  setTournamentParticipantRoundFilter: (value: string) => void;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatMonthFilterLabel: (month: string) => string;
  panelRef?: React.Ref<HTMLDivElement>;
};

const ClubPublicTournamentParticipantPanel: React.FC<ClubPublicTournamentParticipantPanelProps> = ({
  openedTournament,
  openedTournamentParticipants,
  openedTournamentStandings,
  openedTournamentFormat,
  tournamentParticipantSearchQuery,
  filteredOpenedTournamentParticipantSearchRows,
  openedTournamentParticipantSearchRows,
  tournamentParticipantOpen,
  tournamentParticipantDetailLoading,
  tournamentParticipantDetailError,
  tournamentParticipantDetail,
  selectedTournamentParticipantFormat,
  filteredTournamentParticipantRecentForm,
  filteredTournamentParticipantOpponentStats,
  tournamentParticipantMonthFilter,
  tournamentParticipantRoundFilter,
  tournamentParticipantFilterOptions,
  filteredTournamentParticipantMatches,
  filteredTournamentParticipantBreaks,
  filteredTournamentParticipantChartData,
  setTournamentParticipantSearchQuery,
  openTournamentParticipantPanel,
  setTournamentParticipantOpen,
  setTournamentParticipantMonthFilter,
  setTournamentParticipantRoundFilter,
  formatTournamentParticipantLabel,
  formatMonthFilterLabel,
  panelRef,
}) => {
  return (
    <>
      <div ref={panelRef} className="cue-surface-strong rounded-lg p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="font-semibold">球手搜尋與個人戰況</div>
            <div className="text-xs cue-muted mt-1">
              可直接搜尋球手，或從下方正式參賽名單 / 積分榜點選，於同一個 tournament 詳情 modal 內查看個人戰況。
            </div>
          </div>
          <div className="text-xs cue-muted">參賽者 {openedTournamentParticipants.length} 人</div>
        </div>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <input
              value={tournamentParticipantSearchQuery}
              onChange={(e) => setTournamentParticipantSearchQuery(e.target.value)}
              placeholder="搜尋球手姓名、會員編號或 seed"
              className="w-full rounded-lg cue-input px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setTournamentParticipantSearchQuery('')}
            className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
          >
            清除搜尋
          </button>
        </div>

        {openedTournamentParticipants.length === 0 ? (
          <div className="mt-4 text-sm cue-muted">尚未生成正式參賽名單，暫時未能查看球手個人戰況。</div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {filteredOpenedTournamentParticipantSearchRows.map((row: any) => {
                const isActive = String(tournamentParticipantOpen?.participantId || '') === String(row?.participantId || '');
                return (
                  <button
                    key={row.participantId}
                    type="button"
                    onClick={() => openTournamentParticipantPanel(row)}
                    className={`rounded-lg px-3 py-2 text-left text-sm transition ${isActive ? 'cue-button' : 'cue-surface hover:brightness-95'}`}
                  >
                    <div className="font-semibold">{row.label}</div>
                    <div className="text-xs mt-1 opacity-80">
                      {row.standingPosition ? `排名 ${row.standingPosition} · ` : ''}
                      {row.finalRank ? `名次 ${row.finalRank} · ` : ''}
                      {row.status || '-'}
                    </div>
                  </button>
                );
              })}
            </div>
            {tournamentParticipantSearchQuery.trim() && filteredOpenedTournamentParticipantSearchRows.length === 0 ? (
              <div className="mt-3 text-sm cue-muted">搜尋不到相符球手。</div>
            ) : null}
            {!tournamentParticipantSearchQuery.trim() && openedTournamentParticipantSearchRows.length > filteredOpenedTournamentParticipantSearchRows.length ? (
              <div className="mt-3 text-xs cue-muted">
                先顯示前 {filteredOpenedTournamentParticipantSearchRows.length} 位球手；可輸入關鍵字進一步搜尋。
              </div>
            ) : null}
          </>
        )}

        {openedTournamentParticipants.length > 0 && (
          <div className="mt-5 border-t cue-border pt-5">
            {!tournamentParticipantOpen ? (
              <div className="text-sm cue-muted">先搜尋或從下方名單點選球手，即可查看個人戰況。</div>
            ) : tournamentParticipantDetailLoading ? (
              <div className="text-sm cue-muted">讀取球手戰況中…</div>
            ) : tournamentParticipantDetailError ? (
              <div className="text-sm text-rose-300">{tournamentParticipantDetailError}</div>
            ) : tournamentParticipantDetail ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold accent-yellow truncate">
                      {tournamentParticipantDetail?.participant?.member
                        ? formatTournamentParticipantLabel({
                            seed: tournamentParticipantDetail?.participant?.seed,
                            member: tournamentParticipantDetail?.participant?.member,
                          })
                        : String(tournamentParticipantOpen?.label || '球手戰況')}
                    </div>
                    <div className="text-xs cue-muted mt-1">
                      {String(openedTournament?.title || '比賽')} · 個人戰況
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTournamentParticipantOpen(null)}
                    className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                  >
                    清除選擇
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="cue-surface rounded-lg p-4">
                    <div className="text-sm cue-muted">{selectedTournamentParticipantFormat === 'LEAGUE' ? '目前名次' : '名次 / 狀態'}</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">
                      {Number(tournamentParticipantDetail?.standing?.position || 0) > 0
                        ? Number(tournamentParticipantDetail?.standing?.position || 0)
                        : Number(tournamentParticipantDetail?.participant?.finalRank || 0) > 0
                          ? `#${Number(tournamentParticipantDetail?.participant?.finalRank || 0)}`
                          : '-'}
                    </div>
                    <div className="text-xs cue-muted mt-2">
                      Seed {tournamentParticipantDetail?.participant?.seed ?? '-'} · {String(tournamentParticipantDetail?.participant?.status || '-')}
                    </div>
                  </div>
                  <div className="cue-surface rounded-lg p-4">
                    <div className="text-sm cue-muted">戰績</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">
                      {Number(tournamentParticipantDetail?.summary?.wins || 0)} / {Number(tournamentParticipantDetail?.summary?.draws || 0)} / {Number(tournamentParticipantDetail?.summary?.losses || 0)}
                    </div>
                    <div className="text-xs cue-muted mt-2">勝 / 和 / 負</div>
                  </div>
                  <div className="cue-surface rounded-lg p-4">
                    <div className="text-sm cue-muted">{selectedTournamentParticipantFormat === 'LEAGUE' ? '聯賽總得分' : '累積總得分'}</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">
                      {Number(tournamentParticipantDetail?.summary?.totalPoints || 0)}
                    </div>
                    <div className="text-xs cue-muted mt-2">
                      失分 {Number(tournamentParticipantDetail?.summary?.totalPointsAgainst || 0)} · 差 {Number(tournamentParticipantDetail?.summary?.pointsDiff || 0)}
                    </div>
                  </div>
                  <div className="cue-surface rounded-lg p-4">
                    <div className="text-sm cue-muted">單杆 / 20+</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">
                      {Number(tournamentParticipantDetail?.summary?.highestBreak || 0)}
                    </div>
                    <div className="text-xs cue-muted mt-2">20+ 共 {Number(tournamentParticipantDetail?.summary?.breaks20Plus || 0)} 筆</div>
                  </div>
                  <div className="cue-surface rounded-lg p-4">
                    <div className="text-sm cue-muted">平均每場得分</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">
                      {Number(tournamentParticipantDetail?.summary?.avgPointsPerMatch || 0).toFixed(1)}
                    </div>
                    <div className="text-xs cue-muted mt-2">以已完成場次計算</div>
                  </div>
                  <div className="cue-surface rounded-lg p-4">
                    <div className="text-sm cue-muted">平均每場 20+</div>
                    <div className="text-2xl font-extrabold accent-yellow mt-1">
                      {Number(tournamentParticipantDetail?.summary?.avgBreaks20PlusPerMatch || 0).toFixed(2)}
                    </div>
                    <div className="text-xs cue-muted mt-2">以已完成場次計算</div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-1 cue-surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-semibold">最近 5 場表現</div>
                      <div className="text-xs cue-muted">{filteredTournamentParticipantRecentForm.length} 場</div>
                    </div>
                    {filteredTournamentParticipantRecentForm.length > 0 ? (
                      <div className="space-y-2">
                        {filteredTournamentParticipantRecentForm.map((row: any) => (
                          <div key={String(row?.id || Math.random())} className="cue-surface-strong rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</div>
                                <div className="text-xs cue-muted mt-1">{row?.roundLabel || '-'}</div>
                              </div>
                              <div className={`text-xs font-semibold px-2 py-1 rounded ${row?.resultKey === 'WIN' ? 'bg-emerald-500/15 text-emerald-300' : row?.resultKey === 'LOSS' ? 'bg-rose-500/15 text-rose-300' : 'bg-white/10 cue-muted'}`}>
                                {row?.resultLabel || '-'}
                              </div>
                            </div>
                            <div className="mt-2 text-sm cue-muted">
                              局數 {Number(row?.framesWon || 0)} - {Number(row?.framesLost || 0)} · 得分 {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                            </div>
                            <div className="mt-1 text-xs cue-muted">
                              單杆 {Number(row?.maxBreak || 0)} · 20+ {Number(row?.breaks20Plus || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm cue-muted">尚未有最近賽果。</div>
                    )}
                  </div>

                  <div className="xl:col-span-2 cue-surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-semibold">對手分布統計</div>
                      <div className="text-xs cue-muted">{filteredTournamentParticipantOpponentStats.length} 位對手</div>
                    </div>
                    {filteredTournamentParticipantOpponentStats.length > 0 ? (
                      <div className="overflow-x-auto -mx-2 px-2">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="cue-muted border-b cue-border">
                              <th className="py-2 px-2">對手</th>
                              <th className="py-2 px-2">戰績</th>
                              <th className="py-2 px-2">總得分</th>
                              <th className="py-2 px-2">平均</th>
                              <th className="py-2 px-2">單杆 / 20+</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTournamentParticipantOpponentStats.map((row: any, index: number) => (
                              <tr key={`${String(row?.opponent?.participantId || row?.opponent?.id || 'bye')}-${index}`} className="border-b cue-border">
                                <td className="py-2 px-2 font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</td>
                                <td className="py-2 px-2 cue-muted">
                                  {Number(row?.wins || 0)} / {Number(row?.draws || 0)} / {Number(row?.losses || 0)}
                                  <div className="text-xs cue-muted mt-1">已完成 {Number(row?.completed || 0)} 場</div>
                                </td>
                                <td className="py-2 px-2 cue-muted">
                                  {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                  <div className="text-xs cue-muted mt-1">差 {Number(row?.pointsDiff || 0)}</div>
                                </td>
                                <td className="py-2 px-2 cue-muted">
                                  <div>{Number(row?.avgPointsPerMatch || 0).toFixed(1)} 分/場</div>
                                  <div className="text-xs cue-muted mt-1">{Number(row?.avgBreaks20PlusPerMatch || 0).toFixed(2)} 筆 20+/場</div>
                                </td>
                                <td className="py-2 px-2 cue-muted">
                                  <div>{Number(row?.highestBreak || 0)}</div>
                                  <div className="text-xs cue-muted mt-1">20+ {Number(row?.breaks20Plus || 0)}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm cue-muted">尚未有對手分布統計。</div>
                    )}
                  </div>
                </div>

                <div className="cue-surface rounded-lg p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="font-semibold">月份 / 輪次篩選</div>
                      <div className="text-xs cue-muted mt-1">以下圖表與逐場/20+資料會跟隨篩選更新；上方總覽卡保留整個賽事總成績。</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTournamentParticipantMonthFilter('ALL');
                        setTournamentParticipantRoundFilter('ALL');
                      }}
                      className="px-3 py-1.5 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
                    >
                      重設篩選
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <div className="text-xs cue-muted mb-1">月份</div>
                      <select
                        value={tournamentParticipantMonthFilter}
                        onChange={(e) => setTournamentParticipantMonthFilter(e.target.value)}
                        className="w-full rounded-lg cue-surface-strong px-3 py-2 text-sm"
                      >
                        <option value="ALL">全部月份</option>
                        {tournamentParticipantFilterOptions.months.map((month: any) => (
                          <option key={month} value={month}>{formatMonthFilterLabel(month)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-xs cue-muted mb-1">輪次</div>
                      <select
                        value={tournamentParticipantRoundFilter}
                        onChange={(e) => setTournamentParticipantRoundFilter(e.target.value)}
                        className="w-full rounded-lg cue-surface-strong px-3 py-2 text-sm"
                      >
                        <option value="ALL">全部輪次</option>
                        {tournamentParticipantFilterOptions.rounds.map((roundNo: any) => (
                          <option key={roundNo} value={String(roundNo)}>{`第 ${roundNo} 輪`}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 text-xs cue-muted">
                    篩選結果：{filteredTournamentParticipantMatches.length} 場賽事、{filteredTournamentParticipantBreaks.length} 筆 20+
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="cue-surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-semibold">賽果分布</div>
                      <div className="text-xs cue-muted">{filteredTournamentParticipantChartData.completedCount} 場</div>
                    </div>
                    <div className="space-y-3">
                      {filteredTournamentParticipantChartData.resultCounts.map((row: any) => {
                        const total = Math.max(1, filteredTournamentParticipantChartData.completedCount);
                        const width = `${Math.max(row.count > 0 ? 12 : 0, (row.count / total) * 100)}%`;
                        return (
                          <div key={row.key}>
                            <div className="flex items-center justify-between gap-3 text-sm mb-1">
                              <span className="font-semibold">{row.label}</span>
                              <span className="cue-muted">{row.count}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className={`h-full rounded-full ${row.className}`} style={{ width }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="xl:col-span-2 cue-surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-semibold">圖表化展示</div>
                      <div className="text-xs cue-muted">每輪得分與 20+</div>
                    </div>
                    {filteredTournamentParticipantChartData.pointsTrend.length > 0 ? (
                      <div className="space-y-3">
                        {filteredTournamentParticipantChartData.pointsTrend.map((row: any) => (
                          <div key={String(row?.id || Math.random())} className="cue-surface-strong rounded-lg p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-semibold truncate">{row.label} · {row.opponentLabel}</div>
                                <div className="text-xs cue-muted mt-1">{row.resultLabel}</div>
                              </div>
                              <div className="text-xs cue-muted text-right">
                                <div>得分 {row.totalPoints}</div>
                                <div className="mt-1">20+ {row.breaks20Plus}</div>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              <div>
                                <div className="flex items-center justify-between gap-3 text-xs cue-muted mb-1">
                                  <span>得分</span>
                                  <span>{row.totalPoints}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-400" style={{ width: row.pointWidth }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between gap-3 text-xs cue-muted mb-1">
                                  <span>20+</span>
                                  <span>{row.breaks20Plus}</span>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-sky-400" style={{ width: row.breakWidth }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm cue-muted">所選月份 / 輪次尚未有已完成賽事可供展示。</div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2 cue-surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-semibold">{selectedTournamentParticipantFormat === 'LEAGUE' ? '逐場聯賽紀錄' : '逐場賽事紀錄'}</div>
                      <div className="text-xs cue-muted">{filteredTournamentParticipantMatches.length} 場</div>
                    </div>
                    {filteredTournamentParticipantMatches.length > 0 ? (
                      <div className="overflow-x-auto -mx-2 px-2">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="cue-muted border-b cue-border">
                              <th className="py-2 px-2">輪次</th>
                              <th className="py-2 px-2">對手</th>
                              <th className="py-2 px-2">賽果</th>
                              <th className="py-2 px-2">總得分</th>
                              <th className="py-2 px-2">單杆</th>
                              <th className="py-2 px-2">20+</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTournamentParticipantMatches.map((row: any) => (
                              <tr key={String(row?.id || Math.random())} className="border-b cue-border">
                                <td className="py-2 px-2">
                                  <div className="font-semibold">{row?.roundLabel || '-'}</div>
                                  <div className="text-xs cue-muted mt-1">M{row?.matchNo || '-'}</div>
                                </td>
                                <td className="py-2 px-2 font-semibold">{row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}</td>
                                <td className="py-2 px-2">
                                  <div className="font-semibold">{row?.resultLabel || '-'}</div>
                                  <div className="text-xs cue-muted mt-1">{Number(row?.framesWon || 0)} - {Number(row?.framesLost || 0)}</div>
                                </td>
                                <td className="py-2 px-2 cue-muted">
                                  {Number(row?.totalPoints || 0)} : {Number(row?.totalPointsAgainst || 0)}
                                </td>
                                <td className="py-2 px-2 cue-muted">{Number(row?.maxBreak || 0)}</td>
                                <td className="py-2 px-2 cue-muted">{Number(row?.breaks20Plus || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-sm cue-muted">尚未有賽事紀錄。</div>
                    )}
                  </div>

                  <div className="cue-surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="font-semibold">20+ 詳細記錄</div>
                      <div className="text-xs cue-muted">{filteredTournamentParticipantBreaks.length} 筆</div>
                    </div>
                    {filteredTournamentParticipantBreaks.length > 0 ? (
                      <div className="space-y-2">
                        {filteredTournamentParticipantBreaks.map((row: any) => (
                          <div key={String(row?.id || Math.random())} className="cue-surface-strong rounded-lg p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold accent-yellow">{Number(row?.points || 0)}</div>
                                <div className="text-xs cue-muted mt-1">
                                  {row?.roundLabel || '-'} · {row?.opponent ? formatTournamentParticipantLabel({ member: row.opponent }) : 'BYE'}
                                </div>
                              </div>
                              <div className="text-xs cue-muted">第 {Number(row?.frameNo || 0)} 局</div>
                            </div>
                            <div className="text-xs cue-muted mt-2">
                              {row?.recordedAt ? new Date(String(row.recordedAt)).toLocaleString() : '未記錄時間'}
                            </div>
                            {String(row?.note || '').trim() ? (
                              <div className="text-xs cue-muted mt-1 whitespace-pre-wrap">{String(row.note || '')}</div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm cue-muted">尚未記錄 20+。</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm cue-muted">暫無球手戰況數據。</div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="font-semibold">正式參賽名單</div>
            <div className="text-xs cue-muted">{openedTournamentParticipants.length} 人</div>
          </div>
          {openedTournamentParticipants.length === 0 ? (
            <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">Seed</th>
                    <th className="py-2 px-2">球手</th>
                    <th className="py-2 px-2">狀態</th>
                    <th className="py-2 px-2">名次</th>
                  </tr>
                </thead>
                <tbody>
                  {openedTournamentParticipants.map((row: any) => (
                    <tr
                      key={String(row?.id || Math.random())}
                      className="border-b cue-border hover:brightness-95 cursor-pointer"
                      onClick={() => openTournamentParticipantPanel(row)}
                    >
                      <td className="py-2 px-2">{row?.seed || '-'}</td>
                      <td className="py-2 px-2 font-semibold">
                        <div>{formatTournamentParticipantLabel(row)}</div>
                        <div className="text-xs cue-muted mt-1">查看個人戰況</div>
                      </td>
                      <td className="py-2 px-2 cue-muted">{String(row?.status || '-')}</td>
                      <td className="py-2 px-2 cue-muted">{row?.final_rank || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {openedTournamentFormat === 'LEAGUE' ? (
          <div className="cue-surface-strong rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-semibold">League 積分榜</div>
              <div className="text-xs cue-muted">{openedTournamentStandings.length} 人</div>
            </div>
            {openedTournamentStandings.length === 0 ? (
              <div className="text-sm cue-muted">賽程生成後會在這裡顯示 standings</div>
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="cue-muted border-b cue-border">
                      <th className="py-2 px-2">名次</th>
                      <th className="py-2 px-2">球手</th>
                      <th className="py-2 px-2">賽</th>
                      <th className="py-2 px-2">勝和負</th>
                      <th className="py-2 px-2">局差</th>
                      <th className="py-2 px-2">積分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openedTournamentStandings.map((row: any) => (
                      <tr
                        key={String(row?.participantId || Math.random())}
                        className="border-b cue-border hover:brightness-95 cursor-pointer"
                        onClick={() => openTournamentParticipantPanel(row?.participant)}
                      >
                        <td className="py-2 px-2 font-semibold">{row?.position || '-'}</td>
                        <td className="py-2 px-2 font-semibold">
                          <div>{formatTournamentParticipantLabel(row?.participant)}</div>
                          <div className="text-xs cue-muted mt-1">查看個人戰況</div>
                        </td>
                        <td className="py-2 px-2 cue-muted">{Number(row?.played || 0)}</td>
                        <td className="py-2 px-2 cue-muted">{Number(row?.won || 0)} / {Number(row?.drawn || 0)} / {Number(row?.lost || 0)}</td>
                        <td className="py-2 px-2 cue-muted">{Number(row?.framesFor || 0)} - {Number(row?.framesAgainst || 0)} ({Number(row?.frameDiff || 0)})</td>
                        <td className="py-2 px-2">{Number(row?.matchPoints || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
};

export default ClubPublicTournamentParticipantPanel;
