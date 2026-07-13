import React from 'react';

type ClubPublicTournamentLiveBoardVisualProps = {
  tournament: any;
  compact?: boolean;
  variant?: 'default' | 'hero' | 'mini';
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
  const grouped = new Map<string, { label: string; roundNo: number }>();
  for (const row of focusRows) {
    const label = formatPublicTournamentStageLabel(row, format, participantCount);
    const existing = grouped.get(label) || {
      label,
      roundNo: Number(row?.round_no || 0),
    };
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
    };
  }
  return {
    accentClassName: 'accent-yellow',
    chipClassName: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-100',
    panelClassName: 'border-fuchsia-400/20 bg-fuchsia-500/5',
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
  const focusRows = getUniqueFocusRows(tournament);
  const focusStages = buildFocusStages(focusRows, format, participantCount, formatPublicTournamentStageLabel);
  const topFocusRow = focusRows[0] || null;
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 xl:max-w-[52%]">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${heroTheme.badgeClassName}`}>
                <span className={`h-2 w-2 rounded-full ${heroTheme.accentDotClassName}`} />
                {format === 'LEAGUE' ? '聯賽模式主視覺' : '淘汰賽模式主視覺'}
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold cue-muted">
                {statusLabel}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
              <div className="text-xs font-semibold cue-muted">主視覺摘要</div>
              <div className="mt-2 text-sm cue-muted leading-6">
                {format === 'LEAGUE'
                  ? '將聯賽目前最值得分享的 podium 與焦點對賽收斂成海報式版面。'
                  : '將淘汰賽的主線推進與焦點對賽收斂成接近分享海報的閱讀方式。'}
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold cue-muted">海報主體</div>
                <div className="text-sm cue-muted mt-1">先掃讀主線輪次，再決定是否點入完整賽況。</div>
              </div>
              <div className={`text-sm font-semibold ${theme.accentClassName}`}>Poster-first</div>
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
              <div className="mt-5 grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center">
                <div className="min-w-0 rounded-xl cue-surface px-3 py-3">
                  <div className="text-[11px] cue-muted">球手 A</div>
                  <div className="mt-1 font-semibold truncate">{formatTournamentParticipantLabel(topFocusRow?.player_a_participant)}</div>
                </div>
                <div className="min-w-0 text-center">
                  <div className="text-xs cue-muted">{focusStages[0]?.label || '焦點對賽'}</div>
                  <div className={`mt-1 text-xl font-extrabold ${theme.accentClassName}`}>
                    {Number(topFocusRow?.player_a_frames_won ?? 0)} : {Number(topFocusRow?.player_b_frames_won ?? 0)}
                  </div>
                </div>
                <div className="min-w-0 rounded-xl cue-surface px-3 py-3">
                  <div className="text-[11px] cue-muted">球手 B</div>
                  <div className="mt-1 font-semibold truncate">{formatTournamentParticipantLabel(topFocusRow?.player_b_participant)}</div>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-white/10 bg-black/10 px-4 py-4 text-sm cue-muted">
                目前尚未形成可公開展示的焦點對賽，請點入完整賽況查看完整版面。
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'mini') {
    return (
      <div className={`rounded-2xl border p-4 ${heroTheme.shellClassName}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${heroTheme.badgeClassName}`}>
              <span className={`h-2 w-2 rounded-full ${heroTheme.accentDotClassName}`} />
              {format === 'LEAGUE' ? '聯賽模式' : '淘汰賽模式'}
            </div>
            <div className="mt-2 text-sm cue-muted">{statusLabel}</div>
          </div>
          <div className={`text-sm font-semibold ${theme.accentClassName}`}>海報模式</div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {featuredStages.length > 0 ? featuredStages.slice(0, 3).map((stage, index) => (
            <React.Fragment key={stage.label}>
              <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${theme.chipClassName}`}>
                {stage.label}
              </div>
              {index < Math.min(featuredStages.length, 3) - 1 ? <div className="text-xs cue-muted">→</div> : null}
            </React.Fragment>
          )) : (
            <div className="text-xs cue-muted">尚未形成可顯示的焦點輪次。</div>
          )}
        </div>

        {topFocusRow ? (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-3">
            <div className="min-w-0">
              <div className="text-[11px] cue-muted">球手 A</div>
              <div className="mt-1 truncate text-sm font-semibold">{formatTournamentParticipantLabel(topFocusRow?.player_a_participant)}</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] cue-muted">{focusStages[0]?.label || '焦點對賽'}</div>
              <div className={`mt-1 text-lg font-extrabold ${theme.accentClassName}`}>
                {Number(topFocusRow?.player_a_frames_won ?? 0)} : {Number(topFocusRow?.player_b_frames_won ?? 0)}
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-[11px] cue-muted">球手 B</div>
              <div className="mt-1 truncate text-sm font-semibold">{formatTournamentParticipantLabel(topFocusRow?.player_b_participant)}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-xs cue-muted">
            暫未形成可公開展示的焦點對賽。
          </div>
        )}
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
          <div className={`text-sm font-semibold ${theme.accentClassName}`}>{participantCount > 0 ? `${participantCount} 人` : '待整理'}</div>
        </div>
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {focusStages.slice(0, compact ? 2 : 4).map((stage) => (
            <div key={stage.label} className={`rounded-lg border px-3 py-2 text-xs ${theme.chipClassName}`}>
              <div className="font-semibold">{stage.label}</div>
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
