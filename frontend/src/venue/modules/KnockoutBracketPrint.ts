type BuildKnockoutBracketPrintHtmlArgs = {
  buildMatchMeta: (row: any) => string;
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  filteredMatchesRows: any[];
  focusLabel: string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatMatchStatusLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  groupedRows: Array<{
    label: string;
    items: any[];
    summary: any;
  }>;
  knockoutRoundCards: any[];
  quickLabel: string;
  selectedTournamentBestOf: any;
  statusLabel: string;
  title: string;
};

function escapeHtml(value: any) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildKnockoutBracketPrintHtml({
  buildMatchMeta,
  buildMatchProgressSummary,
  filteredMatchesRows,
  focusLabel,
  formatMatchResultTypeLabel,
  formatMatchStatusLabel,
  formatParticipantLabel,
  groupedRows,
  knockoutRoundCards,
  quickLabel,
  selectedTournamentBestOf,
  statusLabel,
  title,
}: BuildKnockoutBracketPrintHtmlArgs) {
  return `<!doctype html>
<html lang="zh-HK">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - Knockout 賽程 PDF</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Microsoft JhengHei", sans-serif; color: #111827; background: #fff; }
    .page { padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .subtitle { color: #4b5563; font-size: 13px; margin-bottom: 16px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .chip { border: 1px solid #d1d5db; border-radius: 999px; padding: 6px 10px; font-size: 12px; background: #f9fafb; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fafafa; }
    .summary-title { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .summary-value { font-size: 20px; font-weight: 700; }
    .bracket-grid { display: grid; grid-template-columns: repeat(${Math.max(1, groupedRows.length)}, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .bracket-column { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; background: #fff; }
    .bracket-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; background: #f8fafc; }
    .bracket-card + .bracket-card { margin-top: 10px; }
    .player-name { font-weight: 700; line-height: 1.35; word-break: break-word; }
    .round { margin-bottom: 22px; page-break-inside: avoid; }
    .round-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .round-title { font-size: 18px; font-weight: 700; }
    .round-subtitle { font-size: 12px; color: #6b7280; }
    .round-theme-y { color: #92400e; }
    .round-theme-f { color: #86198f; }
    .round-theme-s { color: #075985; }
    .round-theme-g { color: #334155; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; vertical-align: top; text-align: left; font-size: 12px; }
    th { background: #f3f4f6; color: #374151; }
    .vs { font-weight: 700; }
    .muted { color: #6b7280; font-size: 11px; margin-top: 4px; }
    .status { font-weight: 700; }
    .footer { margin-top: 20px; font-size: 11px; color: #6b7280; }
    @page { size: A4 landscape; margin: 12mm; }
    @media print {
      .page { padding: 0; }
      .round { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">Knockout 賽程匯出 · 可直接在列印視窗另存為 PDF</div>
    <div class="meta">
      <div class="chip">焦點輪次：${escapeHtml(focusLabel)}</div>
      <div class="chip">快捷篩選：${escapeHtml(quickLabel)}</div>
      <div class="chip">狀態篩選：${escapeHtml(statusLabel)}</div>
      <div class="chip">匯出場數：${escapeHtml(filteredMatchesRows.length)}</div>
    </div>
    <div class="summary-grid">
      ${knockoutRoundCards.map((column) => `
        <div class="summary-card">
          <div class="summary-title">${escapeHtml(column.label)}</div>
          <div class="summary-value">${escapeHtml(column.total)}</div>
          <div class="muted">進行中 ${escapeHtml(column.liveCount)} · 就緒 ${escapeHtml(column.readyCount)} · 已完成 ${escapeHtml(column.completedCount)}</div>
        </div>
      `).join('')}
    </div>
    <div class="bracket-grid">
      ${groupedRows.map((group) => `
        <section class="bracket-column">
          <div class="round-header">
            <div class="round-title">${escapeHtml(group.label)}</div>
            <div class="round-subtitle">${escapeHtml(group.summary.total)} 場</div>
          </div>
          ${group.items.map((row: any) => `
            <article class="bracket-card">
              <div class="muted">M${escapeHtml(row?.match_no || '-')} · ${escapeHtml(formatMatchStatusLabel(row?.status))}</div>
              <div class="player-name">${escapeHtml(formatParticipantLabel(row?.player_a_participant))}</div>
              <div class="muted">${escapeHtml(Number(row?.player_a_frames_won ?? 0))} : ${escapeHtml(Number(row?.player_b_frames_won ?? 0))}</div>
              <div class="player-name">${escapeHtml(formatParticipantLabel(row?.player_b_participant))}</div>
              <div class="muted">${escapeHtml(buildMatchMeta(row))}</div>
            </article>
          `).join('')}
        </section>
      `).join('')}
    </div>
    ${groupedRows.map((group) => {
      const themeClass = group.label.includes('決賽')
        ? 'round-theme-y'
        : group.label.includes('4 強')
          ? 'round-theme-f'
          : group.label.includes('8 強')
            ? 'round-theme-s'
            : group.label.includes('預賽')
              ? 'round-theme-g'
              : '';
      return `
      <section class="round">
        <div class="round-header">
          <div class="round-title ${themeClass}">${escapeHtml(group.label)}</div>
          <div class="round-subtitle">共 ${escapeHtml(group.summary.total)} 場</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 11%">場次</th>
              <th style="width: 29%">對賽</th>
              <th style="width: 20%">賽程</th>
              <th style="width: 12%">狀態</th>
              <th style="width: 10%">比分</th>
              <th style="width: 18%">進度</th>
            </tr>
          </thead>
          <tbody>
            ${group.items.map((row: any) => `
              <tr>
                <td>
                  <div>M${escapeHtml(row?.match_no || '-')}</div>
                  <div class="muted">R${escapeHtml(row?.round_no || '-')}</div>
                </td>
                <td>
                  <div class="vs">${escapeHtml(formatParticipantLabel(row?.player_a_participant))} vs ${escapeHtml(formatParticipantLabel(row?.player_b_participant))}</div>
                  <div class="muted">${escapeHtml(formatMatchResultTypeLabel(row?.result_type))}</div>
                </td>
                <td>${escapeHtml(buildMatchMeta(row))}</td>
                <td><span class="status">${escapeHtml(formatMatchStatusLabel(row?.status))}</span></td>
                <td>${escapeHtml(Number(row?.player_a_frames_won ?? 0))} : ${escapeHtml(Number(row?.player_b_frames_won ?? 0))}</td>
                <td>${escapeHtml(buildMatchProgressSummary(row, selectedTournamentBestOf))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>
      `;
    }).join('')}
    <div class="footer">由場館工作台產生 · ${escapeHtml(new Date().toLocaleString('zh-HK'))}</div>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
      }, 200);
    });
  </script>
</body>
</html>`;
}
