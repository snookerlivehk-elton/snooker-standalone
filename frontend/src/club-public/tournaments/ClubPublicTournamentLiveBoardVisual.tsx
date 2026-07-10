import React from 'react';

type ClubPublicTournamentLiveBoardVisualProps = {
  tournament: any;
  compact?: boolean;
  variant?: 'default' | 'hero';
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  normalizeTournamentFormat: (value: any) => any;
  formatTournamentParticipantLabel: (participant: any) => string;
};

function getUniqueFocusRows(tournament: any) {
  const rawRows = [
    ...(Array.isArray(tournament?.liveMatches) ? tournament.liveMatches : []),
    ...(Array.isArray(tournament?.readyMatches) ? tournament.readyMatches : []),
    ...(Array.isArray(tournament?.recentCompletedMatches) ? tournament.recentCompletedMatches : []),
  ];
  const seen = new Set<string>();
  return rawRows.filter((row: any, index: number) => {
    const key = String(row?.id || `focus-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFocusStages(
  focusRows: any[],
  format: any,
  participantCount: number,
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string,
) {
  const grouped = new Map<string, { label: string; total: number; live: number; ready: number; completed: number; roundNo: number }>();
  for (const row of focusRows) {
    const label = formatPublicTournamentStageLabel(row, format, participantCount);
    const status = String(row?.status || '').trim().toUpperCase();
    const existing = grouped.get(label) || {
      label,
      total: 0,
      live: 0,
      ready: 0,
      completed: 0,
      roundNo: Number(row?.round_no || 0),
    };
    existing.total += 1;
    if (status === 'LIVE') existing.live += 1;
    else if (status === 'READY') existing.ready += 1;
    else if (status === 'COMPLETED') existing.completed += 1;
    grouped.set(label, existing);
  }
  return [...grouped.values()].sort((a, b) => a.roundNo - b.roundNo);
}

function getFormatTheme(format: string) {
  if (format === 'LEAGUE') {
    return {
      accentClassName: 'accent-yellow',
      chipClassName: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100',
      panelClassName: 'border-emerald-400/20 bg-emerald-500/5',
      progressClassName: 'bg-emerald-400',
    };
  }
  return {
    accentClassName: 'accent-yellow',
    chipClassName: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-100',
    panelClassName: 'border-fuchsia-400/20 bg-fuchsia-500/5',
    progressClassName: 'bg-fuchsia-400',
  };
}

function getHeroTheme(format: string) {
  if (format === 'LEAGUE') {
    return {
      shellClassName: 'border-emerald-400/25 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(16,185,129,0.05),rgba(0,0,0,0.14))]',
      badgeClassName: 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100',
      accentDotClassName: 'bg-emerald-400',
    };
  }
  return {
    shellClassName: 'border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.2),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.03),rgba(168,85,247,0.05),rgba(0,0,0,0.14))]',
    badgeClassName: 'border-fuchsia-300/35 bg-fuchsia-500/12 text-fuchsia-100',
    accentDotClassName: 'bg-fuchsia-400',
  };
}

const ClubPublicTournamentLiveBoardVisual: React.FC<ClubPublicTournamentLiveBoardVisualProps> = ({
  tournament,
  compact = false,
  variant = 'default',
  formatPublicTournamentStageLabel,
  normalizeTournamentFormat,
  formatTournamentParticipantLabel,
}) => {
  const format = String(normalizeTournamentFormat(tournament?.format) || 'KNOCKOUT').toUpperCase();
  const participantCount = Number(tournament?.summary?.participantCount || 0);
  const totalMatches = Math.max(0, Number(tournament?.summary?.totalMatches || 0));
  const completedMatches = Math.max(0, Number(tournament?.summary?.completedMatchCount || 0));
  const focusRows = getUniqueFocusRows(tournament);
  const focusStages = buildFocusStages(focusRows, format, participantCount, formatPublicTournamentStageLabel);
  const topFocusRow = focusRows[0] || null;
  const progressPercent = totalMatches > 0 ? Math.min(100, Math.round((completedMatches / totalMatches) * 100)) : 0;
  const theme = getFormatTheme(format);
  const heroTheme = getHeroTheme(format);
  const liveCount = Number(tournament?.summary?.liveMatchCount || 0);
  const readyCount = Number(tournament?.summary?.readyMatchCount || 0);
  const completedCount = Number(tournament?.summary?.completedMatchCount || 0);
  const statusLabel = liveCount > 0 ? '現場焦點' : readyCount > 0 ? '即將上場' : completedCount > 0 ? '最新結果' : '賽事概覽';
  const featuredStages = focusStages.slice(0, variant === 'hero' ? 3 : (compact ? 2 : 4));

  if (variant === 'hero') {
    return (
      <div className={`rounded-2xl border p-5 ${heroTheme.shellClassName}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 lg:max-w-[52%]">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${heroTheme.badgeClassName}`}>
                <span className={`h-2 w-2 rounded-full ${heroTheme.accentDotClassName}`} />
                {format === 'LEAGUE' ? '聯賽模式主視覺' : '淘汰賽模式主視覺'}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold cue-muted">
                {statusLabel}
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                <div className="text-[11px] cue-muted">參賽 / 對局</div>
                <div className="mt-1 font-semibold">{participantCount > 0 ? `${participantCount} 人 / ${totalMatches} 場` : `${totalMatches} 場`}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                <div className="text-[11px] cue-muted">進行中 / 即將上場</div>
                <div className="mt-1 font-semibold">{`${liveCount} / ${readyCount}`}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
                <div className="text-[11px] cue-muted">已完成</div>
                <div className="mt-1 font-semibold">{completedCount} 場</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${theme.progressClassName}`} style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs cue-muted">
                <span>整體進度 {progressPercent}%</span>
                <span>{completedMatches} / {totalMatches} 場已完成</span>
              </div>
            </div>
          </div>

          <div className="flex-1 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold cue-muted">焦點輪次縮圖</div>
                <div className="text-sm cue-muted mt-1">先看主線或輪次節奏，再決定是否進入完整賽況。</div>
              </div>
              <div className={`text-sm font-semibold ${theme.accentClassName}`}>{format === 'LEAGUE' ? 'Standings-first' : 'Bracket-first'}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {featuredStages.length > 0 ? featuredStages.map((stage, index) => (
                <React.Fragment key={stage.label}>
                  <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${theme.chipClassName}`}>
                    {stage.label}
                  </div>
                  {index < featuredStages.length - 1 ? <div className="text-xs cue-muted">→</div> : null}
                </React.Fragment>
              )) : (
                <div className="text-sm cue-muted">目前尚未有可公開顯示的焦點輪次。</div>
              )}
            </div>
            {topFocusRow ? (
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="rounded-xl cue-surface px-3 py-3">
                  <div className="text-[11px] cue-muted">上線</div>
                  <div className="mt-1 font-semibold truncate">{formatTournamentParticipantLabel(topFocusRow?.player_a_participant)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs cue-muted">{focusStages[0]?.label || '焦點對賽'}</div>
                  <div className={`mt-1 text-xl font-extrabold ${theme.accentClassName}`}>
                    {Number(topFocusRow?.player_a_frames_won ?? 0)} : {Number(topFocusRow?.player_b_frames_won ?? 0)}
                  </div>
                </div>
                <div className="rounded-xl cue-surface px-3 py-3">
                  <div className="text-[11px] cue-muted">下線</div>
                  <div className="mt-1 font-semibold truncate">{formatTournamentParticipantLabel(topFocusRow?.player_b_participant)}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (format === 'LEAGUE') {
    return (
      <div className={`rounded-xl border p-4 ${theme.panelClassName}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wide cue-muted">聯賽模式縮覽</div>
            <div className="text-sm cue-muted mt-1">以輪次推進與最近焦點對局快速理解目前聯賽節奏。</div>
          </div>
          <div className={`text-lg font-extrabold ${theme.accentClassName}`}>{progressPercent}%</div>
        </div>
        <div className="mt-3">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full ${theme.progressClassName}`} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs cue-muted">
            <span>已完成 {completedMatches} / {totalMatches} 場</span>
            <span>{participantCount > 0 ? `${participantCount} 位參賽者` : '參賽資料整理中'}</span>
          </div>
        </div>
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {focusStages.slice(0, compact ? 2 : 4).map((stage) => (
            <div key={stage.label} className={`rounded-lg border px-3 py-2 text-xs ${theme.chipClassName}`}>
              <div className="font-semibold">{stage.label}</div>
              <div className="mt-1 opacity-80">{`${stage.live} live / ${stage.ready} ready / ${stage.completed} 完成`}</div>
            </div>
          ))}
        </div>
        {topFocusRow ? (
          <div className="mt-3 rounded-lg cue-surface px-3 py-2">
            <div className="text-[11px] cue-muted">目前焦點對賽</div>
            <div className="mt-1 text-sm font-semibold">
              {formatTournamentParticipantLabel(topFocusRow?.player_a_participant)} vs {formatTournamentParticipantLabel(topFocusRow?.player_b_participant)}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${theme.panelClassName}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-wide cue-muted">淘汰賽模式縮覽</div>
          <div className="text-sm cue-muted mt-1">先看主線推進到哪一輪，再決定是否點入完整進級表。</div>
        </div>
        <div className={`text-sm font-semibold ${theme.accentClassName}`}>{participantCount > 0 ? `${participantCount} 人` : '待整理'}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {focusStages.length > 0 ? focusStages.slice(0, compact ? 3 : 5).map((stage, index) => (
          <React.Fragment key={stage.label}>
            <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${theme.chipClassName}`}>
              {stage.label}
            </div>
            {index < Math.min(focusStages.length, compact ? 3 : 5) - 1 ? (
              <div className="text-xs cue-muted">→</div>
            ) : null}
          </React.Fragment>
        )) : (
          <div className="text-sm cue-muted">目前尚未有可公開顯示的焦點輪次。</div>
        )}
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <div className="rounded-lg cue-surface px-3 py-2">
          <div className="text-[11px] cue-muted">主線完成</div>
          <div className="mt-1 font-semibold">{completedMatches} / {totalMatches}</div>
        </div>
        <div className="rounded-lg cue-surface px-3 py-2">
          <div className="text-[11px] cue-muted">Live / Ready</div>
          <div className="mt-1 font-semibold">
            {Number(tournament?.summary?.liveMatchCount || 0)} / {Number(tournament?.summary?.readyMatchCount || 0)}
          </div>
        </div>
        {!compact ? (
          <div className="rounded-lg cue-surface px-3 py-2">
            <div className="text-[11px] cue-muted">最近結果</div>
            <div className="mt-1 font-semibold">{Number(tournament?.summary?.completedMatchCount || 0)} 場</div>
          </div>
        ) : null}
      </div>
      {topFocusRow ? (
        <div className="mt-3 rounded-lg cue-surface px-3 py-2">
          <div className="text-[11px] cue-muted">目前焦點對賽</div>
          <div className="mt-1 text-sm font-semibold">
            {formatTournamentParticipantLabel(topFocusRow?.player_a_participant)} vs {formatTournamentParticipantLabel(topFocusRow?.player_b_participant)}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ClubPublicTournamentLiveBoardVisual;
