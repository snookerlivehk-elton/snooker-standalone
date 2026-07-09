type BuildLeagueSchedulePrintHtmlArgs = {
  buildMatchMeta: (row: any) => string;
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  filteredLeagueRounds: any[];
  filteredMatchesRows: any[];
  formatMatchResultTypeLabel: (value: any) => string;
  formatMatchStatusLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  participantsCount: number;
  quickLabel: string;
  selectedTournamentBestOf: any;
  statusLabel: string;
  summary: {
    rounds: number;
    total: number;
    completed: number;
    live: number;
    ready: number;
    pending: number;
    scheduledCount: number;
    tableAssignedCount: number;
    scorableCount: number;
  };
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

function getPrintStatusTone(value: any) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'COMPLETED') return { className: 'status-completed', dotClassName: 'dot-completed' };
  if (normalized === 'LIVE') return { className: 'status-live', dotClassName: 'dot-live' };
  if (normalized === 'READY') return { className: 'status-ready', dotClassName: 'dot-ready' };
  return { className: 'status-pending', dotClassName: 'dot-pending' };
}

export function buildLeagueSchedulePrintHtml({
  buildMatchMeta,
  buildMatchProgressSummary,
  filteredLeagueRounds,
  filteredMatchesRows,
  formatMatchResultTypeLabel,
  formatMatchStatusLabel,
  formatParticipantLabel,
  participantsCount,
  quickLabel,
  selectedTournamentBestOf,
  statusLabel,
  summary,
  title,
}: BuildLeagueSchedulePrintHtmlArgs) {
  return `<!doctype html>
<html lang="zh-HK">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - 聯賽模式賽程 PDF</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Microsoft JhengHei", sans-serif; color: #111827; background: #fff; }
    .page { padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0; font-size: 20px; }
    .hero { border: 1px solid #dbe4ff; border-radius: 18px; padding: 20px 22px; background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%); margin-bottom: 18px; }
    .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .hero-badge { display: inline-flex; align-items: center; border: 1px solid #bfdbfe; background: #dbeafe; color: #1d4ed8; border-radius: 999px; padding: 6px 10px; font-size: 12px; font-weight: 700; }
    .hero-meta { color: #475569; font-size: 13px; margin-top: 6px; }
    .hero-side { text-align: right; font-size: 12px; color: #475569; }
    .hero-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .hero-stat { border: 1px solid #e2e8f0; border-radius: 14px; background: rgba(255,255,255,0.7); padding: 12px; }
    .hero-stat-label { font-size: 12px; color: #64748b; margin-bottom: 6px; }
    .hero-stat-value { font-size: 24px; font-weight: 700; }
    .subtitle { color: #4b5563; font-size: 13px; margin-bottom: 16px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .chip { border: 1px solid #d1d5db; border-radius: 999px; padding: 6px 10px; font-size: 12px; background: #f9fafb; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #fafafa; }
    .summary-title { font-size: 12px; color: #6b7280; margin-bottom: 8px; }
    .summary-value { font-size: 20px; font-weight: 700; }
    .overview { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; background: #fff; margin-bottom: 20px; }
    .overview-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; }
    .overview-note { font-size: 12px; color: #64748b; }
    .round { margin-bottom: 22px; page-break-inside: avoid; }
    .round-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .round-title { font-size: 18px; font-weight: 700; color: #0f172a; }
    .round-subtitle { font-size: 12px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; vertical-align: top; text-align: left; font-size: 12px; }
    th { background: #f3f4f6; color: #374151; }
    .vs { font-weight: 700; }
    .muted { color: #6b7280; font-size: 11px; margin-top: 4px; }
    .status { font-weight: 700; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 10px; border: 1px solid #e5e7eb; font-size: 11px; font-weight: 700; }
    .status-completed { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .status-live { background: #fff7ed; color: #c2410c; border-color: #fdba74; }
    .status-ready { background: #eff6ff; color: #1d4ed8; border-color: #93c5fd; }
    .status-pending { background: #f8fafc; color: #475569; border-color: #cbd5e1; }
    .dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
    .dot-completed { background: #10b981; }
    .dot-live { background: #f97316; }
    .dot-ready { background: #3b82f6; }
    .dot-pending { background: #94a3b8; }
    .round-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .match-card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px; background: #fff; page-break-inside: avoid; }
    .match-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
    .match-code { font-size: 12px; color: #64748b; font-weight: 700; }
    .players { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 10px; }
    .player-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 12px; }
    .player-row + .player-row { border-top: 1px solid #e5e7eb; }
    .player-name { font-size: 15px; font-weight: 700; }
    .score { font-size: 18px; font-weight: 700; color: #0f172a; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
    .meta-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; background: #f8fafc; }
    .meta-label { font-size: 11px; color: #64748b; margin-bottom: 3px; }
    .meta-value { font-size: 12px; color: #111827; font-weight: 600; }
    .note-line { margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 8px; font-size: 11px; color: #64748b; min-height: 28px; }
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
    <section class="hero">
      <div class="hero-top">
        <div>
          <div class="hero-badge">聯賽模式賽程列印版</div>
          <h1>${escapeHtml(title)}</h1>
          <div class="hero-meta">聯賽專用列印版面 · 依目前工作台篩選結果生成</div>
        </div>
        <div class="hero-side">
          <div>參賽人數：${escapeHtml(participantsCount)}</div>
          <div>匯出時間：${escapeHtml(new Date().toLocaleString('zh-HK'))}</div>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-label">匯出輪次</div>
          <div class="hero-stat-value">${escapeHtml(summary.rounds)}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">匯出場數</div>
          <div class="hero-stat-value">${escapeHtml(summary.total)}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">可記分對局</div>
          <div class="hero-stat-value">${escapeHtml(summary.scorableCount)}</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-label">已編球枱</div>
          <div class="hero-stat-value">${escapeHtml(summary.tableAssignedCount)}</div>
        </div>
      </div>
    </section>
    <div class="subtitle">聯賽模式賽程匯出 · 可直接在列印視窗另存為 PDF</div>
    <div class="meta">
      <div class="chip">快捷篩選：${escapeHtml(quickLabel)}</div>
      <div class="chip">狀態篩選：${escapeHtml(statusLabel)}</div>
      <div class="chip">匯出輪次：${escapeHtml(filteredLeagueRounds.length)}</div>
      <div class="chip">匯出場數：${escapeHtml(filteredMatchesRows.length)}</div>
    </div>
    <section class="overview">
      <div class="overview-head">
        <h2>聯賽總覽</h2>
        <div class="overview-note">列印版會先顯示輪次總覽，再列出每輪對局卡。</div>
      </div>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-title">已完成</div>
          <div class="summary-value">${escapeHtml(summary.completed)}</div>
          <div class="muted">目前已完成對局</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">進行中 / 就緒</div>
          <div class="summary-value">${escapeHtml(summary.live + summary.ready)}</div>
          <div class="muted">進行中 ${escapeHtml(summary.live)} · 就緒 ${escapeHtml(summary.ready)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">待定</div>
          <div class="summary-value">${escapeHtml(summary.pending)}</div>
          <div class="muted">尚未就緒或未排妥</div>
        </div>
        <div class="summary-card">
          <div class="summary-title">已排時間</div>
          <div class="summary-value">${escapeHtml(summary.scheduledCount)}</div>
          <div class="muted">含已排時間對局</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 16%">輪次</th>
            <th style="width: 12%">場數</th>
            <th style="width: 14%">已完成</th>
            <th style="width: 14%">進行中</th>
            <th style="width: 14%">就緒</th>
            <th style="width: 14%">待定</th>
            <th style="width: 16%">備註</th>
          </tr>
        </thead>
        <tbody>
          ${filteredLeagueRounds.map((round: any) => `
            <tr>
              <td><strong>${escapeHtml(round.label)}</strong></td>
              <td>${escapeHtml(round.summary.total)}</td>
              <td>${escapeHtml(round.summary.completedCount)}</td>
              <td>${escapeHtml(round.summary.liveCount)}</td>
              <td>${escapeHtml(round.summary.readyCount)}</td>
              <td>${escapeHtml(round.summary.pendingCount)}</td>
              <td>${escapeHtml(round.summary.completedCount === round.summary.total ? '本輪已完成' : '進行中 / 待續')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
    <div class="summary-grid">
      ${filteredLeagueRounds.map((round: any) => `
        <div class="summary-card">
          <div class="summary-title">${escapeHtml(round.label)}</div>
          <div class="summary-value">${escapeHtml(round.summary.total)}</div>
          <div class="muted">進行中 ${escapeHtml(round.summary.liveCount)} · 就緒 ${escapeHtml(round.summary.readyCount)} · 已完成 ${escapeHtml(round.summary.completedCount)}</div>
        </div>
      `).join('')}
    </div>
    ${filteredLeagueRounds.map((round: any) => `
      <section class="round">
        <div class="round-header">
          <div class="round-title">${escapeHtml(round.label)}</div>
          <div class="round-subtitle">共 ${escapeHtml(round.summary.total)} 場</div>
        </div>
        <div class="round-grid">
          ${round.items.map((row: any) => {
            const statusTone = getPrintStatusTone(row?.status);
            return `
            <article class="match-card">
              <div class="match-head">
                <div>
                  <div class="match-code">M${escapeHtml(row?.match_no || '-')} · ${escapeHtml(round.label)}</div>
                  <div class="muted">${escapeHtml(formatMatchResultTypeLabel(row?.result_type))}</div>
                </div>
                <span class="status-pill ${statusTone.className}">
                  <span class="dot ${statusTone.dotClassName}"></span>
                  ${escapeHtml(formatMatchStatusLabel(row?.status))}
                </span>
              </div>
              <div class="players">
                <div class="player-row">
                  <div class="player-name">${escapeHtml(formatParticipantLabel(row?.player_a_participant))}</div>
                  <div class="score">${escapeHtml(Number(row?.player_a_frames_won ?? 0))}</div>
                </div>
                <div class="player-row">
                  <div class="player-name">${escapeHtml(formatParticipantLabel(row?.player_b_participant))}</div>
                  <div class="score">${escapeHtml(Number(row?.player_b_frames_won ?? 0))}</div>
                </div>
              </div>
              <div class="meta-grid">
                <div class="meta-box">
                  <div class="meta-label">賽程</div>
                  <div class="meta-value">${escapeHtml(buildMatchMeta(row))}</div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">進度</div>
                  <div class="meta-value">${escapeHtml(buildMatchProgressSummary(row, selectedTournamentBestOf))}</div>
                </div>
              </div>
              <div class="note-line">現場備註：</div>
            </article>
          `;
          }).join('')}
        </div>
      </section>
    `).join('')}
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
