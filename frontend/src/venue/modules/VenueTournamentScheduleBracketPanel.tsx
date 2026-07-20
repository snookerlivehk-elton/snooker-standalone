import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TournamentPosterLightbox, { type TournamentPosterLightboxItem } from '../../components/TournamentPosterLightbox';
import { formatKnockoutRoundLabel, formatLeagueRoundLabel } from './useTournamentStageViewData';
import { buildKnockoutBracketPrintHtml } from './KnockoutBracketPrint';
import { buildLeagueSchedulePrintHtml } from './LeagueSchedulePrint';
import { buildKnockoutBracketShareCardPreviewItems, downloadKnockoutBracketShareCard } from './TournamentShareCards';
import LeagueSchedulePanel from './VenueTournamentLeagueSchedulePanel';
import KnockoutBracketPanel from './VenueTournamentKnockoutBracketPanel';
import VenueTournamentMatchesFilters, { type MatchQuickFilterKey, type MatchStatusFilterKey } from './VenueTournamentMatchesFilters';
import VenueTournamentMatchesTable from './VenueTournamentMatchesTable';

type ScheduleFilterPreset = {
  token: string;
  quickFilter?: MatchQuickFilterKey;
  statusFilter?: MatchStatusFilterKey;
  focusedRoundLabel?: string;
};

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
  thirdPlaceMatch?: any;
  externalFilterPreset?: ScheduleFilterPreset | null;
  tournamentTitle?: string;
  venueName?: string;
  venueLogoUrl?: string;
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
  thirdPlaceMatch = null,
  externalFilterPreset = null,
  tournamentTitle = '',
  venueName,
  venueLogoUrl,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LIVE' | 'READY' | 'COMPLETED' | 'PENDING'>('ALL');
  const [quickFilter, setQuickFilter] = useState<'ALL' | 'SCORABLE' | 'UNFINISHED'>('ALL');
  const [focusedRoundLabel, setFocusedRoundLabel] = useState<string>('ALL');
  const [shareCardPreviewItems, setShareCardPreviewItems] = useState<TournamentPosterLightboxItem[]>([]);
  const [shareCardPreviewLoading, setShareCardPreviewLoading] = useState(false);
  const [shareCardPreviewIndex, setShareCardPreviewIndex] = useState(0);
  const [shareCardPreviewOpen, setShareCardPreviewOpen] = useState(false);

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

  const matchesQuickFilter = useCallback((row: any) => {
    const status = String(row?.status || '').trim().toUpperCase();
    const canRecordMatch = !!row?.player_a_participant_id && !!row?.player_b_participant_id && status !== 'PENDING';
    if (quickFilter === 'SCORABLE') return canRecordMatch;
    if (quickFilter === 'UNFINISHED') return status !== 'COMPLETED';
    return true;
  }, [quickFilter]);

  const getRoundTheme = (label: string) => {
    if (label.includes('季軍戰')) {
      return {
        chipClassName: 'bg-orange-500/15 text-orange-200 border-orange-400/30',
        cardClassName: 'border-orange-400/30 bg-orange-500/8',
        headerClassName: 'text-orange-200',
      };
    }
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

  const roundOptions = useMemo(() => bracketColumns.map((column: any) => String(column?.label || '')).filter(Boolean), [bracketColumns]);
  const effectiveFocusedRoundLabel = !isLeague && roundOptions.includes(focusedRoundLabel) ? focusedRoundLabel : 'ALL';

  useEffect(() => {
    if (!externalFilterPreset) return;
    if (externalFilterPreset.quickFilter) setQuickFilter(externalFilterPreset.quickFilter);
    if (externalFilterPreset.statusFilter) setStatusFilter(externalFilterPreset.statusFilter);
    if (externalFilterPreset.focusedRoundLabel !== undefined) {
      setFocusedRoundLabel(externalFilterPreset.focusedRoundLabel);
    }
  }, [externalFilterPreset]);

  const filteredMatchesRows = useMemo(() => {
    return matchesRows.filter((row: any) => {
      const status = String(row?.status || '').trim().toUpperCase();
      const statusOk = statusFilter === 'ALL' || status === statusFilter;
      if (!statusOk) return false;
      if (!matchesQuickFilter(row)) return false;
      if (isLeague || effectiveFocusedRoundLabel === 'ALL') return true;
      return formatKnockoutRoundLabel(row, participantsCount) === effectiveFocusedRoundLabel;
    });
  }, [effectiveFocusedRoundLabel, isLeague, matchesQuickFilter, matchesRows, participantsCount, statusFilter]);

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
  }, [bracketColumns, matchesQuickFilter, statusFilter]);

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
  const selectedMatchRow = useMemo(
    () => matchesRows.find((row: any) => String(row?.id || '') === selectedMatchId) || null,
    [matchesRows, selectedMatchId],
  );
  const selectedRoundContextLabel = selectedMatchRow
    ? (isLeague
      ? formatLeagueRoundLabel(selectedMatchRow)
      : formatKnockoutRoundLabel(selectedMatchRow, participantsCount))
    : '';
  const selectedMatchContextLabel = selectedMatchRow
    ? `${selectedRoundContextLabel} · M${Math.max(1, Number(selectedMatchRow?.match_no || 1))}`
    : '';
  const thirdPlaceSelected = thirdPlaceMatch && String(thirdPlaceMatch?.id || '') === selectedMatchId;
  const thirdPlaceLabel = thirdPlaceMatch ? formatKnockoutRoundLabel(thirdPlaceMatch, participantsCount) : '季軍戰';

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

  const knockoutShareSummaryCards = useMemo(() => {
    if (isLeague) return [];
    const highestBreakCandidate = filteredMatchesRows.reduce((best: any, row: any) => {
      const aBreak = Number(row?.player_a_max_break || 0);
      const bBreak = Number(row?.player_b_max_break || 0);
      const next = aBreak >= bBreak
        ? {
            breakValue: aBreak,
            playerLabel: formatParticipantLabel(row?.player_a_participant),
          }
        : {
            breakValue: bBreak,
            playerLabel: formatParticipantLabel(row?.player_b_participant),
          };
      return Number(next.breakValue || 0) > Number(best?.breakValue || 0) ? next : best;
    }, null);
    const highestScoringMatch = filteredMatchesRows.reduce((best: any, row: any) => {
      const totalFrames = Number(row?.player_a_frames_won || 0) + Number(row?.player_b_frames_won || 0);
      if (totalFrames <= Number(best?.totalFrames || -1)) return best;
      return {
        totalFrames,
        valueLabel: `${Number(row?.player_a_frames_won || 0)}:${Number(row?.player_b_frames_won || 0)}`,
        detailLabel: `${formatParticipantLabel(row?.player_a_participant)} vs ${formatParticipantLabel(row?.player_b_participant)}`,
      };
    }, null);
    const largestMarginMatch = filteredMatchesRows.reduce((best: any, row: any) => {
      const diff = Math.abs(Number(row?.player_a_frames_won || 0) - Number(row?.player_b_frames_won || 0));
      if (diff <= Number(best?.diff || -1)) return best;
      return {
        diff,
        valueLabel: `${diff} 局`,
        detailLabel: `${formatParticipantLabel(row?.player_a_participant)} ${Number(row?.player_a_frames_won || 0)}:${Number(row?.player_b_frames_won || 0)} ${formatParticipantLabel(row?.player_b_participant)}`,
      };
    }, null);
    return [
      {
        label: '最高單杆',
        value: highestBreakCandidate?.breakValue ? String(highestBreakCandidate.breakValue) : '-',
        detail: highestBreakCandidate?.playerLabel || '未有紀錄',
      },
      {
        label: '最高得分',
        value: highestScoringMatch?.valueLabel || '-',
        detail: highestScoringMatch?.detailLabel || '未有紀錄',
      },
      {
        label: '最高得失局',
        value: largestMarginMatch?.valueLabel || '-',
        detail: largestMarginMatch?.detailLabel || '未有紀錄',
      },
    ];
  }, [filteredMatchesRows, formatParticipantLabel, isLeague]);

  const knockoutShareRounds = useMemo(() => {
    if (isLeague) return [];
    return filteredBracketColumns.map((column: any) => ({
      label: String(column?.label || '-'),
      total: Number(column?.summary?.total || column?.items?.length || 0),
      completedCount: Number(column?.summary?.completedCount || 0),
      items: (Array.isArray(column?.items) ? column.items : []).map((row: any) => {
        const winnerId = String(row?.winner_participant_id || '');
        const aParticipantId = String(row?.player_a_participant_id || '');
        const bParticipantId = String(row?.player_b_participant_id || '');
        return {
          matchNo: Math.max(1, Number(row?.match_no || 1)),
          statusLabel: formatMatchStatusLabel(row?.status),
          playerALabel: formatParticipantLabel(row?.player_a_participant),
          playerBLabel: formatParticipantLabel(row?.player_b_participant),
          playerAFrames: Number(row?.player_a_frames_won || 0),
          playerBFrames: Number(row?.player_b_frames_won || 0),
          winnerSide: winnerId && winnerId === aParticipantId ? 'A' : winnerId && winnerId === bParticipantId ? 'B' : null,
        };
      }),
    }));
  }, [filteredBracketColumns, formatParticipantLabel, isLeague]);

  useEffect(() => {
    let cancelled = false;
    if (isLeague || knockoutShareRounds.length <= 0) {
      setShareCardPreviewItems([]);
      return;
    }
    setShareCardPreviewLoading(true);
    buildKnockoutBracketShareCardPreviewItems({
      title: String(tournamentTitle || '淘汰賽模式進級表'),
      venueName,
      venueLogoUrl,
      focusLabel: effectiveFocusedRoundLabel === 'ALL' ? '全部輪次' : effectiveFocusedRoundLabel,
      summaryCards: knockoutShareSummaryCards,
      rounds: knockoutShareRounds,
    })
      .then((items) => {
        if (cancelled) return;
        setShareCardPreviewItems(items.map((item) => ({
          imageUrl: item.imageUrl,
          title: `${String(tournamentTitle || '淘汰賽模式進級表')} · ${item.focusLabel}`,
        })));
      })
      .catch(() => {
        if (!cancelled) setShareCardPreviewItems([]);
      })
      .finally(() => {
        if (!cancelled) setShareCardPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveFocusedRoundLabel, isLeague, knockoutShareRounds, knockoutShareSummaryCards, tournamentTitle, venueLogoUrl, venueName]);

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
    const title = String(tournamentTitle || '淘汰賽賽程');
    const html = buildKnockoutBracketPrintHtml({
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
    });
    openPrintWindow(html);
  };

  const handleExportLeaguePdf = () => {
    if (!isLeague) return;

    const quickLabel = quickFilterOptions.find((option) => option.key === quickFilter)?.label || '全部對局';
    const statusLabel = statusFilterOptions.find((option) => option.key === statusFilter)?.label || '全部狀態';
    const title = String(tournamentTitle || '聯賽賽程');
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
    const html = buildLeagueSchedulePrintHtml({
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
    });
    openPrintWindow(html);
  };

  const handleDownloadKnockoutShareCard = () => {
    if (isLeague || filteredBracketColumns.length <= 0) return;
    downloadKnockoutBracketShareCard({
      title: String(tournamentTitle || '淘汰賽模式進級表'),
      venueName,
      venueLogoUrl,
      focusLabel: effectiveFocusedRoundLabel === 'ALL' ? '全部輪次' : effectiveFocusedRoundLabel,
      summaryCards: knockoutShareSummaryCards,
      rounds: knockoutShareRounds,
    });
  };

  return (
    <>
    <div className="rounded-lg border cue-border bg-black/10 p-3 mb-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="font-semibold">{isLeague ? '聯賽賽程工具列' : '淘汰賽賽程工具列'}</div>
          <div className="text-xs cue-muted mt-1">
            {isLeague
              ? '先用這裡收窄範圍，再到下方對局清單與 rounds 視圖處理實際對局。'
              : '先用這裡收窄範圍，再到下方對局清單或 bracket 視圖處理實際對局。'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!matchesLoading && matchesRows.length > 0 ? (
            !isLeague ? (
              <button
                type="button"
                onClick={handleDownloadKnockoutShareCard}
                className="px-3 py-1.5 rounded cue-button text-xs font-semibold"
              >
                {shareCardPreviewItems.length > 1 ? `下載整組分享圖 PNG（${shareCardPreviewItems.length} 張）` : '下載分享圖 PNG'}
              </button>
            ) : null
          ) : null}
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
        <div className="text-sm cue-muted mt-3">讀取中…</div>
      ) : matchesRows.length === 0 ? (
        <div className="text-sm cue-muted mt-3">尚未生成賽程</div>
      ) : (
        <VenueTournamentMatchesFilters
          effectiveFocusedRoundLabel={effectiveFocusedRoundLabel}
          isLeague={isLeague}
          quickFilter={quickFilter}
          quickFilterOptions={quickFilterOptions}
          roundOptions={roundOptions}
          setFocusedRoundLabel={setFocusedRoundLabel}
          setQuickFilter={setQuickFilter}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
          statusFilterOptions={statusFilterOptions}
        />
      )}
    </div>
    {!isLeague && !matchesLoading && matchesRows.length > 0 ? (
      <div className="rounded-lg border cue-border bg-black/10 p-3 mb-3">
        <div className="flex flex-col gap-1 mb-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="font-semibold">分享海報預覽</div>
            <div className="text-xs cue-muted mt-1">
              {shareCardPreviewItems.length > 1
                ? `目前篩選條件會輸出 ${shareCardPreviewItems.length} 張海報，包含初期分組與後段總覽。`
                : '目前篩選條件會輸出單張海報，可先在這裡檢查版面。'}
            </div>
          </div>
          <div className="text-xs cue-muted">
            {shareCardPreviewLoading ? '生成預覽中…' : shareCardPreviewItems.length > 0 ? `${shareCardPreviewItems.length} 張` : '尚未生成預覽'}
          </div>
        </div>
        {shareCardPreviewLoading ? (
          <div className="text-sm cue-muted">正在生成海報預覽…</div>
        ) : shareCardPreviewItems.length <= 0 ? (
          <div className="text-sm cue-muted">目前沒有可預覽的分享海報。</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {shareCardPreviewItems.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                type="button"
                onClick={() => {
                  setShareCardPreviewIndex(index);
                  setShareCardPreviewOpen(true);
                }}
                className="group rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-white/20"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm font-semibold truncate">{item.title}</div>
                  <div className="text-[11px] cue-muted">點擊放大</div>
                </div>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="aspect-[16/9] w-full object-contain transition group-hover:scale-[1.01]"
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    ) : null}
    {!matchesLoading && matchesRows.length > 0 ? (
      <div className={`rounded-lg border bg-black/10 p-3 mb-3 ${
        selectedMatchRow ? 'border-yellow-400/35 shadow-[0_0_0_1px_rgba(250,204,21,0.12)]' : 'cue-border'
      }`}>
        <div className="flex flex-col gap-1 mb-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="font-semibold">對局清單</div>
            <div className="text-xs cue-muted mt-1">
              這裡保留完整名單視角，方便快速掃描全部符合篩選條件的對局。
            </div>
          </div>
          <div className="text-xs cue-muted">
            {selectedMatchContextLabel
              ? `目前已選中：${selectedMatchContextLabel}`
              : isLeague
                ? '輪次卡片在下方獨立顯示，避免和清單互相搶視線。'
                : 'Bracket 視圖在下方獨立顯示，避免和清單混在一起。'}
          </div>
        </div>
        <VenueTournamentMatchesTable
          buildMatchMeta={buildMatchMeta}
          buildMatchProgressSummary={buildMatchProgressSummary}
          filteredMatchesRows={filteredMatchesRows}
          formatMatchResultTypeLabel={formatMatchResultTypeLabel}
          formatMatchStatusLabel={formatMatchStatusLabel}
          formatParticipantLabel={formatParticipantLabel}
          getMatchStatusTone={getMatchStatusTone}
          getRoundTheme={getRoundTheme}
          isLeague={isLeague}
          participantsCount={participantsCount}
          selectedMatchId={selectedMatchId}
          selectedTournamentBestOf={selectedTournamentBestOf}
          selectMatchForScoring={selectMatchForScoring}
        />
      </div>
    ) : null}
    {!isLeague && matchesRows.length > 0 ? (
      <div className={`rounded-lg border bg-black/10 p-3 ${
        selectedMatchRow ? 'border-yellow-400/45 shadow-[0_0_0_1px_rgba(250,204,21,0.14)]' : 'cue-border'
      }`}>
        <div className="mb-3">
          <div className="font-semibold">淘汰賽籤表視圖</div>
          <div className="text-xs cue-muted mt-1">
            {selectedMatchContextLabel
              ? `目前記分區對應：${selectedMatchContextLabel}`
              : '這裡專注顯示 Knockout 推進結構，與上方清單分開，方便同時掌握輪次層級與單場處理。'}
          </div>
        </div>
        <KnockoutBracketPanel
          buildMatchMeta={buildMatchMeta}
          buildMatchProgressSummary={buildMatchProgressSummary}
          effectiveFocusedRoundLabel={effectiveFocusedRoundLabel}
          filteredBracketColumns={filteredBracketColumns}
          formatMatchResultTypeLabel={formatMatchResultTypeLabel}
          formatMatchStatusLabel={formatMatchStatusLabel}
          formatParticipantLabel={formatParticipantLabel}
          getBracketCardClassName={getBracketCardClassName}
          getMatchStatusTone={getMatchStatusTone}
          getRoundTheme={getRoundTheme}
          knockoutRoundCards={knockoutRoundCards}
          onFocusRound={setFocusedRoundLabel}
          selectMatchForScoring={selectMatchForScoring}
          selectedMatchId={selectedMatchId}
          selectedTournamentBestOf={selectedTournamentBestOf}
        />
        {thirdPlaceMatch ? (
          <div className={`mt-4 rounded-lg border p-3 ${
            thirdPlaceSelected ? 'border-yellow-400/45 bg-yellow-500/10 shadow-[0_0_0_1px_rgba(250,204,21,0.14)]' : 'cue-border cue-surface'
          }`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <div className="font-semibold">{thirdPlaceLabel}</div>
                <div className="text-xs cue-muted mt-1">獨立於主線進級表顯示，不與決賽共用 bracket 欄位。</div>
              </div>
              <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${getMatchStatusTone(thirdPlaceMatch?.status)}`}>
                {formatMatchStatusLabel(thirdPlaceMatch?.status)}
              </div>
            </div>
            <button
              type="button"
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selectedMatchId === String(thirdPlaceMatch?.id || '')
                  ? 'border-yellow-400/45 bg-yellow-500/10'
                  : 'cue-border cue-surface hover:brightness-95'
              }`}
              onClick={() => {
                if (!thirdPlaceMatch?.player_a_participant_id || !thirdPlaceMatch?.player_b_participant_id) return;
                selectMatchForScoring(thirdPlaceMatch);
              }}
            >
              <div className="flex items-center justify-between gap-2 text-xs cue-muted mb-2">
                <span>{thirdPlaceLabel} · M{thirdPlaceMatch?.match_no || '-'}</span>
                <span>{formatMatchResultTypeLabel(thirdPlaceMatch?.result_type)}</span>
              </div>
              <div className="font-semibold">{formatParticipantLabel(thirdPlaceMatch?.player_a_participant)}</div>
              <div className="text-sm cue-muted my-1">
                {Number(thirdPlaceMatch?.player_a_frames_won ?? 0)} : {Number(thirdPlaceMatch?.player_b_frames_won ?? 0)}
              </div>
              <div className="font-semibold">{formatParticipantLabel(thirdPlaceMatch?.player_b_participant)}</div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="cue-muted">{buildMatchMeta(thirdPlaceMatch)}</span>
                <span className="cue-muted text-right">
                  {buildMatchProgressSummary(thirdPlaceMatch, selectedTournamentBestOf)}
                </span>
              </div>
            </button>
          </div>
        ) : null}
      </div>
    ) : null}
    {isLeague && leagueRounds.length > 0 ? (
      <div className={`rounded-lg border bg-black/10 p-3 ${
        selectedMatchRow ? 'border-yellow-400/45 shadow-[0_0_0_1px_rgba(250,204,21,0.14)]' : 'cue-border'
      }`}>
        <div className="mb-3">
          <div className="font-semibold">聯賽輪次視圖</div>
          <div className="text-xs cue-muted mt-1">
            {selectedMatchContextLabel
              ? `目前記分區對應：${selectedMatchContextLabel}`
              : '這裡專注輪次摘要與目前要處理的 rounds，和上方篩選工具列、對局清單分開。'}
          </div>
        </div>
        <LeagueSchedulePanel
          buildMatchProgressSummary={buildMatchProgressSummary}
          filteredLeagueRounds={filteredLeagueRounds}
          formatMatchResultTypeLabel={formatMatchResultTypeLabel}
          formatParticipantLabel={formatParticipantLabel}
          selectMatchForScoring={selectMatchForScoring}
          selectedMatchId={selectedMatchId}
          selectedTournamentBestOf={selectedTournamentBestOf}
        />
      </div>
    ) : null}
    <TournamentPosterLightbox
      open={shareCardPreviewOpen}
      posters={shareCardPreviewItems}
      initialIndex={shareCardPreviewIndex}
      onClose={() => setShareCardPreviewOpen(false)}
    />
  </>
  );
};

export default VenueTournamentScheduleBracketPanel;
