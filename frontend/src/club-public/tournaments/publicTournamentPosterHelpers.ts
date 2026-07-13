import {
  buildKnockoutBracketShareCardDataUrl,
  buildLeagueStandingsShareCardDataUrl,
} from '../../venue/modules/TournamentShareCards';

export function buildLeaguePosterRows(detail: any, formatTournamentParticipantLabel: (participant: any) => string) {
  const standings = Array.isArray(detail?.standings) ? detail.standings : [];
  return standings.slice(0, 8).map((row: any, index: number) => ({
    position: Number(row?.position || index + 1),
    label: String(row?.label || formatTournamentParticipantLabel(row?.participant) || '-'),
    played: Number(row?.played || 0),
    won: Number(row?.won || 0),
    drawn: Number(row?.drawn || 0),
    lost: Number(row?.lost || 0),
    matchPoints: Number(row?.matchPoints || 0),
    frameDiff: Number(row?.frameDiff || 0),
    breaks20Plus: Number(row?.breaks20Plus || 0),
    maxBreak: Number(row?.maxBreak || 0),
  }));
}

export function buildKnockoutPosterRounds(
  detail: any,
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string,
  formatTournamentParticipantLabel: (participant: any) => string,
  formatTournamentMatchStatusLabel: (value: any) => string,
) {
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const participantCount = Math.max(0, Number(detail?.summary?.participantCount || detail?.participants?.length || 0));
  const groups = new Map<string, { label: string; roundNo: number; items: any[] }>();
  for (const row of matches) {
    const label = formatPublicTournamentStageLabel(row, 'KNOCKOUT', participantCount);
    const key = `${Number(row?.round_no || 0)}-${label}`;
    const winnerId = String(row?.winner_participant_id || '');
    const aId = String(row?.player_a_participant_id || '');
    const bId = String(row?.player_b_participant_id || '');
    const item = {
      matchNo: Math.max(1, Number(row?.match_no || 1)),
      statusLabel: formatTournamentMatchStatusLabel(row?.status),
      playerALabel: formatTournamentParticipantLabel(row?.player_a_participant),
      playerBLabel: formatTournamentParticipantLabel(row?.player_b_participant),
      playerAFrames: Number(row?.player_a_frames_won || 0),
      playerBFrames: Number(row?.player_b_frames_won || 0),
      winnerSide: winnerId && winnerId === aId ? 'A' : winnerId && winnerId === bId ? 'B' : null,
    };
    const existing = groups.get(key) || {
      label,
      roundNo: Number(row?.round_no || 0),
      items: [],
    };
    existing.items.push(item);
    groups.set(key, existing);
  }
  return [...groups.values()]
    .sort((a, b) => a.roundNo - b.roundNo)
    .map((group) => ({
      label: group.label,
      total: group.items.length,
      completedCount: group.items.filter((item) => String(item?.statusLabel || '').includes('完成')).length,
      items: group.items.sort((a, b) => a.matchNo - b.matchNo),
    }));
}

export function buildKnockoutPosterSummaryCards(detail: any, formatTournamentParticipantLabel: (participant: any) => string) {
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const highestBreakCandidate = matches.reduce((best: any, row: any) => {
    const aBreak = Number(row?.player_a_max_break || 0);
    const bBreak = Number(row?.player_b_max_break || 0);
    const next = aBreak >= bBreak
      ? { breakValue: aBreak, detail: formatTournamentParticipantLabel(row?.player_a_participant) || '未有紀錄' }
      : { breakValue: bBreak, detail: formatTournamentParticipantLabel(row?.player_b_participant) || '未有紀錄' };
    return Number(next.breakValue || 0) > Number(best?.breakValue || 0) ? next : best;
  }, null);
  const highestScoringMatch = matches.reduce((best: any, row: any) => {
    const totalFrames = Number(row?.player_a_frames_won || 0) + Number(row?.player_b_frames_won || 0);
    if (totalFrames <= Number(best?.totalFrames || -1)) return best;
    return {
      totalFrames,
      value: `${Number(row?.player_a_frames_won || 0)}:${Number(row?.player_b_frames_won || 0)}`,
      detail: `${formatTournamentParticipantLabel(row?.player_a_participant)} vs ${formatTournamentParticipantLabel(row?.player_b_participant)}`,
    };
  }, null);
  const largestMarginMatch = matches.reduce((best: any, row: any) => {
    const diff = Math.abs(Number(row?.player_a_frames_won || 0) - Number(row?.player_b_frames_won || 0));
    if (diff <= Number(best?.diff || -1)) return best;
    return {
      diff,
      value: `${diff} 局`,
      detail: `${formatTournamentParticipantLabel(row?.player_a_participant)} ${Number(row?.player_a_frames_won || 0)}:${Number(row?.player_b_frames_won || 0)} ${formatTournamentParticipantLabel(row?.player_b_participant)}`,
    };
  }, null);
  return [
    { label: '最高單杆', value: highestBreakCandidate?.breakValue ? String(highestBreakCandidate.breakValue) : '-', detail: highestBreakCandidate?.detail || '未有紀錄' },
    { label: '最高得分', value: highestScoringMatch?.value || '-', detail: highestScoringMatch?.detail || '未有紀錄' },
    { label: '最高得失局', value: largestMarginMatch?.value || '-', detail: largestMarginMatch?.detail || '未有紀錄' },
  ];
}

export function buildPublicTournamentPosterDataUrl(options: {
  detail: any;
  formatPublicTournamentStageLabel: (row: any, format: any, participantCount: number) => string;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
}) {
  const {
    detail,
    formatPublicTournamentStageLabel,
    formatTournamentParticipantLabel,
    formatTournamentMatchStatusLabel,
  } = options;
  const isLeague = String(detail?.format || '').trim().toUpperCase() === 'LEAGUE';
  if (isLeague) {
    const rows = buildLeaguePosterRows(detail, formatTournamentParticipantLabel);
    if (rows.length <= 0) return '';
    return buildLeagueStandingsShareCardDataUrl({
      title: String(detail?.title || '聯賽模式積分榜'),
      dimensionLabel: '整個聯賽',
      pointsRuleLabel: `勝 ${Number(detail?.points_win ?? 3)} / 和 ${Number(detail?.points_draw ?? 1)} / 負 ${Number(detail?.points_loss ?? 0)}`,
      rows,
    });
  }
  const rounds = buildKnockoutPosterRounds(
    detail,
    formatPublicTournamentStageLabel,
    formatTournamentParticipantLabel,
    formatTournamentMatchStatusLabel,
  );
  if (rounds.length <= 0) return '';
  return buildKnockoutBracketShareCardDataUrl({
    title: String(detail?.title || '淘汰賽模式進級表'),
    focusLabel: '全部輪次',
    rounds,
    summaryCards: buildKnockoutPosterSummaryCards(detail, formatTournamentParticipantLabel),
  });
}
