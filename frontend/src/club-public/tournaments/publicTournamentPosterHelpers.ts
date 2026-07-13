import {
  buildKnockoutBracketShareCardPreviewItems,
  buildLeagueStandingsShareCardDataUrl,
} from '../../venue/modules/TournamentShareCards';
import { formatKnockoutRoundLabel } from '../../venue/modules/useTournamentStageViewData';
import { buildTournamentPodiumSummary } from '../../lib/tournamentPodium';

export type PublicTournamentPosterPreviewItem = {
  imageUrl: string;
  title: string;
};

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
  formatTournamentParticipantLabel: (participant: any) => string,
  formatTournamentMatchStatusLabel: (value: any) => string,
) {
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const participantCount = Math.max(0, Number(detail?.summary?.participantCount || detail?.participants?.length || 0));
  const groups = new Map<string, { label: string; roundNo: number; items: any[] }>();
  for (const row of matches) {
    const label = formatKnockoutRoundLabel(row, participantCount);
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

function buildGoldSilverCupPosterSummaryCards(detail: any, formatTournamentParticipantLabel: (participant: any) => string) {
  const participants = Array.isArray(detail?.participants) ? detail.participants : [];
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const podiumSummary = buildTournamentPodiumSummary(participants, matches);
  const goldCup = podiumSummary?.goldCup;
  const silverCup = podiumSummary?.silverCup;
  return [
    {
      label: '金杯冠軍',
      value: formatTournamentParticipantLabel(goldCup?.champion),
      detail: goldCup?.runnerUp ? `亞軍 ${formatTournamentParticipantLabel(goldCup.runnerUp)}` : '亞軍待定',
    },
    {
      label: '金杯季軍',
      value: formatTournamentParticipantLabel(goldCup?.thirdPlace),
      detail: goldCup?.fourthPlace ? `殿軍 ${formatTournamentParticipantLabel(goldCup.fourthPlace)}` : '殿軍待定',
    },
    {
      label: '銀杯冠軍',
      value: formatTournamentParticipantLabel(silverCup?.champion),
      detail: silverCup?.runnerUp ? `亞軍 ${formatTournamentParticipantLabel(silverCup.runnerUp)}` : '亞軍待定',
    },
  ];
}

export async function buildPublicTournamentPosterDataUrl(options: {
  detail: any;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
}) {
  const items = await buildPublicTournamentPosterPreviewItems(options);
  return items[items.length - 1]?.imageUrl || '';
}

export async function buildPublicTournamentPosterPreviewItems(options: {
  detail: any;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
}): Promise<PublicTournamentPosterPreviewItem[]> {
  const {
    detail,
    formatTournamentParticipantLabel,
    formatTournamentMatchStatusLabel,
  } = options;
  const venueName = String(
    detail?.club?.name
    || detail?.tournament?.club?.name
    || detail?.clubName
    || '',
  ).trim();
  const venueLogoUrl = String(
    detail?.club?.logoUrl
    || detail?.club?.logo_url
    || detail?.tournament?.club?.logoUrl
    || detail?.tournament?.club?.logo_url
    || detail?.clubLogoUrl
    || '',
  ).trim();
  const normalizedFormat = String(detail?.format || '').trim().toUpperCase();
  const isLeague = normalizedFormat === 'LEAGUE';
  const isGoldSilverCup = normalizedFormat === 'GOLD_SILVER_CUP';
  if (isLeague) {
    const rows = buildLeaguePosterRows(detail, formatTournamentParticipantLabel);
    if (rows.length <= 0) return [];
    const imageUrl = await buildLeagueStandingsShareCardDataUrl({
      title: String(detail?.title || '聯賽模式積分榜'),
      venueName,
      venueLogoUrl,
      dimensionLabel: '整個聯賽',
      pointsRuleLabel: `勝 ${Number(detail?.points_win ?? 3)} / 和 ${Number(detail?.points_draw ?? 1)} / 負 ${Number(detail?.points_loss ?? 0)}`,
      rows,
    });
    return [{
      imageUrl,
      title: `${String(detail?.title || '聯賽模式積分榜')} 海報`,
    }];
  }
  const rounds = buildKnockoutPosterRounds(
    detail,
    formatTournamentParticipantLabel,
    formatTournamentMatchStatusLabel,
  );
  if (rounds.length <= 0) return [];
  const posterTitle = String(detail?.title || (isGoldSilverCup ? '金銀杯模式進級表' : '淘汰賽模式進級表'));
  const previewItems = await buildKnockoutBracketShareCardPreviewItems({
    title: posterTitle,
    venueName,
    venueLogoUrl,
    focusLabel: isGoldSilverCup ? '金銀杯雙線進級表' : '全部輪次',
    rounds,
    summaryCards: isGoldSilverCup
      ? buildGoldSilverCupPosterSummaryCards(detail, formatTournamentParticipantLabel)
      : buildKnockoutPosterSummaryCards(detail, formatTournamentParticipantLabel),
  });
  return previewItems.map((item) => ({
    imageUrl: item.imageUrl,
    title: `${posterTitle} · ${item.focusLabel}`,
  }));
}
