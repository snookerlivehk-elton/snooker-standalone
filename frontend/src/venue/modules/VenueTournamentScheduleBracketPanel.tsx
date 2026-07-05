import React, { useMemo, useState } from 'react';
import { formatKnockoutRoundLabel, formatLeagueRoundLabel } from './useTournamentStageViewData';

type VenueTournamentScheduleBracketPanelProps = {
  bracketColumns: any[];
  buildMatchProgressSummary: (match: any, tournamentBestOfRaw?: any) => string;
  formatDisplayDateTime: (value: any) => string;
  formatMatchResultTypeLabel: (value: any) => string;
  formatParticipantLabel: (participant: any) => string;
  isLeague: boolean;
  leagueRounds: any[];
  matchesLoading: boolean;
  matchesRows: any[];
  participantsCount: number;
  selectedMatchId: string;
  selectedTournamentBestOf: any;
  selectMatchForScoring: (row: any) => void;
  tournamentTitle?: string;
};

const VenueTournamentScheduleBracketPanel: React.FC<VenueTournamentScheduleBracketPanelProps> = ({
  bracketColumns,
  buildMatchProgressSummary,
  formatDisplayDateTime,
  formatMatchResultTypeLabel,
  formatParticipantLabel,
  isLeague,
  leagueRounds,
  matchesLoading,
  matchesRows,
  participantsCount,
  selectedMatchId,
  selectedTournamentBestOf,
  selectMatchForScoring,
  tournamentTitle = '',
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING'>('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'SCORABLE' | 'UNFINISHED'>('ALL');
  const [focusedRoundLabel, setFocusedRoundLabel] = useState<string>('ALL');

  const formatMatchStatusLabel = (value: any) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return '已完成';
    if (normalized === 'LIVE') return '進行中';
    if (normalized === 'READY') return '就緒';
    if (normalized === 'PENDING') return '待定';
    return normalized || '-';
  };

  const getMatchStatusTone = (value: any) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    if (normalized === 'LIVE') return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
    if (normalized === 'READY') return 'bg-sky-500/15 text-sky-300 border-sky-400/30';
    if (normalized === 'PENDING') return 'bg-white/5 text-slate-300 border-white/10';
    return 'bg-white/5 text-slate-300 border-white/10';
  };

  const buildMatchMeta = (row: any) => {
    const scheduledLabel = row?.scheduled_at ? formatDisplayDateTime(row?.scheduled_at) : '待定時間';
    const tableLabel = row?.table_no ? `球枱 ${row.table_no}` : '未編球枱';
    return `${scheduledLabel} · ${tableLabel}`;
  };

  const getBracketCardClassName = (row: any, canSelectMatch: boolean, selected: boolean) => {
    if (!canSelectMatch) return 'cue-border cue-surface-strong cue-muted cursor-not-allowed';
    const status = String(row?.status || '').trim().toUpperCase();
    if (selected) return 'border-yellow-400 bg-white/5 shadow-[0_0_0_1px_rgba(250,204,21,0.18)]';
    if (status === 'LIVE') return 'border-amber-400/70 bg-amber-500/10 hover:brightness-105';
    if (status === 'COMPLETED') return 'border-emerald-500/40 bg-emerald-500/5 hover:brightness-105';
    if (status === 'READY') return 'border-sky-500/40 bg-sky-500/5 hover:brightness-105';
    return 'cue-border cue-surface hover:brightness-95';
  };

  const matchesQuickFilter = (row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
    if (quickFilter === 'SCORABLE') return canRecordMatch;
    if (quickFilter === 'UNFINISHED') return status !== 'COMPLETED';
    return true;
  };

  const getRoundTheme = (label: string) => {
    if (label.includes('決賽')) {
      return {
        chipClassName: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/30',
        cardClassName: 'border-yellow-400/35 bg-yellow-500/8',
        headerClassName: 'text-yellow-200',
      };
    }
    if (label.includes('4 強')) {
      return {
        chipClassName: 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30',
        cardClassName: 'border-fuchsia-400/30 bg-fuchsia-500/8',
        headerClassName: 'text-fuchsia-200',
      };
    }
    if (label.includes('8 強')) {
      return {
        chipClassName: 'bg-sky-500/15 text-sky-200 border-sky-400/30',
        cardClassName: 'border-sky-400/30 bg-sky-500/8',
        headerClassName: 'text-sky-200',
      };
    }
    if (label.includes('預賽')) {
      return {
        chipClassName: 'bg-slate-500/15 text-slate-200 border-slate-400/30',
        cardClassName: 'border-slate-400/25 bg-slate-500/8',
        headerClassName: 'text-slate-100',
      };
    }
    return {
      chipClassName: 'bg-white/10 text-white border-white/15',
      cardClassName: 'cue-border cue-surface',
      headerClassName: 'text-white',
    };
  };

  const escapeHtml = (value: any) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const getPrintStatusTone = (value: any) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'COMPLETED') return { className: 'status-completed', dotClassName: 'dot-completed' };
    if (normalized === 'LIVE') return { className: 'status-live', dotClassName: 'dot-live' };
    if (normalized === 'READY') return { className: 'status-ready', dotClassName: 'dot-ready' };
    return { className: 'status-pending', dotClassName: 'dot-pending' };
  };

  const roundOptions = useMemo(() => bracketColumns.map((column: any) => String(column?.label || '')).filter(Boolean), [bracketColumns]);
  const effectiveFocusedRoundLabel = !isLeague && roundOptions.includes(focusedRoundLabel) ? focusedRoundLabel : 'ALL';

  const filteredMatchesRows = useMemo(() => {
    return matchesRows.filter((row: any) => {
      const status = String(row?.status || '').trim().toUpperCase();
      const statusOk = statusFilter === 'ALL' || status === statusFilter;
      if (!statusOk) return false;
      if (!matchesQuickFilter(row)) return false;
      if (isLeague || effectiveFocusedRoundLabel === 'ALL') return true;
      return formatKnockoutRoundLabel(row, participantsCount) === effectiveFocusedRoundLabel;
    });
  }, [effectiveFocusedRoundLabel, isLeague, matchesRows, participantsCount, quickFilter, statusFilter]);

  const filteredBracketColumns = useMemo(() => {
    return bracketColumns.map((column: any) => {
      const items = Array.isArray(column?.items)
        ? column.items.filter((row: any) => {
            const statusOk = statusFilter === 'ALL' || String(row?.status || '').trim().toUpperCase() === statusFilter;
            return statusOk && matchesQuickFilter(row);
          })
        : [];
      return {
        ...column,
        items,
        summary: {
          total: items.length,
          completedCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length,
          liveCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'LIVE').length,
          readyCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length,
          pendingCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length,
        },
      };
    });
  }, [bracketColumns, quickFilter, statusFilter]);

  const knockoutRoundCards = useMemo(() => {
    return filteredBracketColumns.map((column: any) => ({
      label: String(column?.label || ''),
      total: Number(column?.summary?.total || 0),
      liveCount: Number(column?.summary?.liveCount || 0),
      readyCount: Number(column?.summary?.readyCount || 0),
      completedCount: Number(column?.summary?.completedCount || 0),
      pendingCount: Number(column?.summary?.pendingCount || 0),
    }));
  }, [filteredBracketColumns]);

  const filteredLeagueRounds = useMemo(() => {
    if (!isLeague) return [];
    return leagueRounds
      .map((round: any) => {
        const label = String(round?.label || '');
        const items = filteredMatchesRows.filter((row: any) => formatLeagueRoundLabel(row) === label);
        return {
          ...round,
          label,
          items,
          summary: {
            total: items.length,
            completedCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length,
            liveCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'LIVE').length,
            readyCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length,
            pendingCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length,
          },
        };
      })
      .filter((round: any) => Array.isArray(round?.items) && round.items.length > 0);
  }, [filteredMatchesRows, isLeague, leagueRounds]);

  const leaguePrintSummary = useMemo(() => {
    if (!isLeague) return null;
    const rows = filteredMatchesRows;
    const scheduledCount = rows.filter((row: any) => !!row?.scheduled_at).length;
    const tableAssignedCount = rows.filter((row: any) => !!row?.table_no).length;
    const scorableCount = rows.filter((row: any) => {
      const status = String(row?.status || '').trim().toUpperCase();
      return !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
    }).length;
    return {
      rounds: filteredLeagueRounds.length,
      total: rows.length,
      completed: rows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED').length,
      live: rows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'LIVE').length,
      ready: rows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY').length,
      pending: rows.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'PENDING').length,
      scheduledCount,
      tableAssignedCount,
      scorableCount,
    };
  }, [filteredLeagueRounds, filteredMatchesRows, isLeague]);

  const statusFilterOptions: Array<{ key: 'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING'; label: string }> = [
    { key: 'ALL', label: '全部狀態' },
    { key: 'LIVE', label: '進行中' },
    { key: 'READY', label: '就緒' },
    { key: 'COMPLETED', label: '已完成' },
    { key: 'PENDING', label: '待定' },
  ];
  const quickFilterOptions: Array<{ key: 'ALL' | 'SCORABLE' | 'UNFINISHED'; label: string }> = [
    { key: 'ALL', label: '全部對局' },
    { key: 'SCORABLE', label: '只看可記分對局' },
    { key: 'UNFINISHED', label: '只看未完成' },
  ];

  const openPrintWindow = (html: string) => {
    const printWindow = window.open('about:blank', '_blank', 'width=1280,height=960');
    if (!printWindow) return null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    return printWindow;
  };

  const handleExportKnockoutPdf = () => {
    if (isLeague) return;

    const groupedRows = knockoutRoundCards.map((column) => ({
      label: column.label,
      items: filteredMatchesRows.filter((row: any) => formatKnockoutRoundLabel(row, participantsCount) === column.label),
      summary: column,
    })).filter((group) => group.items.length > 0);

    const focusLabel = effectiveFocusedRoundLabel === 'ALL' ? '全部輪次' : effectiveFocusedRoundLabel;
    const quickLabel = quickFilterOptions.find((option) => option.key === quickFilter)?.label || '全部對局';
    const statusLabel = statusFilterOptions.find((option) => option.key === statusFilter)?.label || '全部狀態';
    const title = String(tournamentTitle || 'Knockout 賽程');

    const html = `<!doctype html>
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

    openPrintWindow(html);
  };

  const handleExportLeaguePdf = () => {
    if (!isLeague) return;

    const quickLabel = quickFilterOptions.find((option) => option.key === quickFilter)?.label || '全部對局';
    const statusLabel = statusFilterOptions.find((option) => option.key === statusFilter)?.label || '全部狀態';
    const title = String(tournamentTitle || 'League 賽程');
    const summary = leaguePrintSummary || {
      rounds: 0,
      total: 0,
      completed: 0,
      live: 0,
      ready: 0,
      pending: 0,
      scheduledCount: 0,
      tableAssignedCount: 0,
      scorableCount: 0,
    };

    const html = `<!doctype html>
<html lang="zh-HK">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} - League 賽程 PDF</title>
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
          <div class="hero-badge">League Schedule Print</div>
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
    <div class="subtitle">League 賽程匯出 · 可直接在列印視窗另存為 PDF</div>
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

    openPrintWindow(html);
  };

  return (
    <>
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="font-semibold">{isLeague ? 'League 賽程' : 'Knockout 賽程'}</div>
      <div className="flex items-center gap-2">
        {!matchesLoading && matchesRows.length > 0 ? (
          <button
            type="button"
            onClick={isLeague ? handleExportLeaguePdf : handleExportKnockoutPdf}
            className="px-3 py-1.5 rounded cue-surface hover:brightness-95 text-xs font-semibold"
          >
            匯出 PDF
          </button>
        ) : null}
        <div className="text-xs cue-muted">{matchesLoading ? '讀取中…' : `${filteredMatchesRows.length} / ${matchesRows.length} 場`}</div>
      </div>
    </div>
    {matchesLoading ? (
      <div className="text-sm cue-muted">讀取中…</div>
    ) : matchesRows.length === 0 ? (
      <div className="text-sm cue-muted">尚未生成賽程</div>
    ) : (
      <>
        <div className="cue-surface rounded-lg p-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {quickFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setQuickFilter(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  quickFilter === option.key ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                }`}
              >
                {option.label}
              </button>
            ))}
            <div className="mx-1 h-4 w-px bg-white/10" />
            {statusFilterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStatusFilter(option.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === option.key ? 'bg-white/15 text-white border border-white/20' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                }`}
              >
                {option.label}
              </button>
            ))}
            {!isLeague ? (
              <>
                <div className="mx-1 h-4 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => setFocusedRoundLabel('ALL')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    effectiveFocusedRoundLabel === 'ALL' ? 'bg-white/15 text-white border border-white/20' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                  }`}
                >
                  全部輪次
                </button>
                {roundOptions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setFocusedRoundLabel(label)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      effectiveFocusedRoundLabel === label ? 'bg-yellow-500/15 text-yellow-200 border border-yellow-400/30' : 'cue-surface-strong cue-muted border border-white/10 hover:brightness-105'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </>
            ) : null}
          </div>
          <div className="text-xs cue-muted mt-2">
            {!isLeague && effectiveFocusedRoundLabel !== 'ALL'
              ? `目前焦點：${effectiveFocusedRoundLabel} · `
              : ''}
            快捷篩選：{quickFilterOptions.find((option) => option.key === quickFilter)?.label || '全部對局'} · 
            狀態篩選：{statusFilterOptions.find((option) => option.key === statusFilter)?.label || '全部狀態'}
          </div>
        </div>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="cue-muted border-b cue-border">
              <th className="py-2 px-2">輪次</th>
              <th className="py-2 px-2">對賽</th>
              <th className="py-2 px-2">狀態</th>
              <th className="py-2 px-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMatchesRows.map((row: any) => {
              const id = String(row?.id || '');
              const aLabel = formatParticipantLabel(row?.player_a_participant);
              const bLabel = formatParticipantLabel(row?.player_b_participant);
              const roundLabel = isLeague ? formatLeagueRoundLabel(row) : formatKnockoutRoundLabel(row, participantsCount);
              const roundTheme = getRoundTheme(roundLabel);
              const resultTypeLabel = formatMatchResultTypeLabel(row?.result_type);
              const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
              return (
                <tr key={id} className={`border-b cue-border hover:brightness-95 ${selectedMatchId === id ? 'bg-white/5' : ''}`}>
                  <td className="py-2 px-2 whitespace-nowrap">
                    <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${roundTheme.chipClassName}`}>{roundLabel}</div>
                    <div className="text-xs cue-muted mt-0.5">R{row?.round_no || '-'} / M{row?.match_no || '-'}</div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-semibold">{aLabel} vs {bLabel}</div>
                    <div className="text-xs cue-muted mt-1">{buildMatchMeta(row)}</div>
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getMatchStatusTone(row?.status)}`}>
                        {formatMatchStatusLabel(row?.status)}
                      </span>
                      <span className="text-xs cue-muted">{resultTypeLabel}</span>
                    </div>
                    <div className="text-xs cue-muted mt-1">
                      比分 {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <button
                      type="button"
                      disabled={!canRecordMatch}
                      className={`px-3 py-1 rounded text-sm font-semibold ${canRecordMatch ? 'cue-surface hover:brightness-95' : 'cue-surface-strong cue-muted'}`}
                      onClick={() => {
                        if (!canRecordMatch) return;
                        selectMatchForScoring(row);
                      }}
                    >
                      {!canRecordMatch ? '未就緒' : selectedMatchId === id ? '已選擇' : '記錄賽果'}
                    </button>
                    <div className="text-xs cue-muted mt-1">
                      {buildMatchProgressSummary(row, selectedTournamentBestOf)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
    )}
    {!isLeague && matchesRows.length > 0 ? (
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
                  onClick={() => setFocusedRoundLabel(isFocused ? 'ALL' : column.label)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isFocused
                      ? `${roundTheme.cardClassName} shadow-[0_0_0_1px_rgba(255,255,255,0.06)]`
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
                    {isFocused ? '再按一次返回全部輪次' : '按一下聚焦此輪'}
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
              const isFocusedColumn = effectiveFocusedRoundLabel === 'ALL' || effectiveFocusedRoundLabel === column.label;
              const roundTheme = getRoundTheme(String(column?.label || ''));
              return (
              <div key={column.label} className={`w-[19rem] xl:w-[21rem] 2xl:w-[23rem] shrink-0 transition-opacity ${isFocusedColumn ? 'opacity-100' : 'opacity-35'}`}>
                <div className="mb-3">
                  <div className={`font-semibold ${roundTheme.headerClassName}`}>{column.label}</div>
                  <div className="text-xs cue-muted mt-1">
                    {column.summary?.total || 0} 場
                    {Number(column.summary?.liveCount || 0) > 0 ? ` · 進行中 ${column.summary.liveCount}` : ''}
                    {Number(column.summary?.completedCount || 0) > 0 ? ` · 已完成 ${column.summary.completedCount}` : ''}
                  </div>
                </div>
                {column.items.length === 0 ? (
                  <div className="cue-surface-strong rounded-lg border cue-border p-3 text-sm cue-muted">此狀態篩選下沒有對局</div>
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
                      const canSelectMatch = !!aParticipantId && !!bParticipantId && String(row?.status || '').toUpperCase() !== 'PENDING';
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
                            className={`relative z-10 h-full w-full text-left rounded-lg border p-3 transition-colors ${selectedMatchId === id ? `${getBracketCardClassName(row, canSelectMatch, true)} ${roundTheme.cardClassName}` : getBracketCardClassName(row, canSelectMatch, false)}`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                              <span>M{row?.match_no || '-'}</span>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${getMatchStatusTone(row?.status)}`}>
                                {formatMatchStatusLabel(row?.status)}
                              </span>
                            </div>
                            <div className="text-[11px] cue-muted mb-2">{buildMatchMeta(row)}</div>
                            <div className={`font-semibold leading-snug whitespace-normal break-words ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{aLabel}</div>
                            <div className="text-sm cue-muted my-1">
                              {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                            </div>
                            <div className={`font-semibold leading-snug whitespace-normal break-words ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{bLabel}</div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                              <span className="cue-muted">{resultTypeLabel}</span>
                              <span className="cue-muted text-right">{buildMatchProgressSummary(row, selectedTournamentBestOf)}</span>
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
    ) : null}
    {isLeague && leagueRounds.length > 0 ? (
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
                  const canSelectMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && String(row?.status || '').toUpperCase() !== 'PENDING';
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!canSelectMatch}
                      onClick={() => {
                        if (!canSelectMatch) return;
                        selectMatchForScoring(row);
                      }}
                      className={`w-full rounded-lg border p-3 text-left ${!canSelectMatch ? 'cue-border cue-surface-strong cue-muted cursor-not-allowed' : selectedMatchId === id ? 'border-yellow-400 bg-white/5' : 'cue-border cue-surface hover:brightness-95'}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-1">
                        <span>M{row?.match_no || '-'}</span>
                        <span>{formatMatchResultTypeLabel(row?.result_type)}</span>
                      </div>
                      <div className="font-semibold truncate">{formatParticipantLabel(row?.player_a_participant)}</div>
                      <div className="text-xs cue-muted my-1">{Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}</div>
                      <div className="font-semibold truncate">{formatParticipantLabel(row?.player_b_participant)}</div>
                      <div className="text-xs cue-muted mt-2">{buildMatchProgressSummary(row, selectedTournamentBestOf)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : null}
  </>
  );
};

export default VenueTournamentScheduleBracketPanel;
