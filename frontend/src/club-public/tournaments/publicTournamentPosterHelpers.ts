import {
  buildKnockoutBracketShareCardPreviewItems,
  buildLeagueStandingsShareCardDataUrl,
  buildKnockoutShareCardPlan,
  type LeagueShareRow,
  type KnockoutShareRound,
  type KnockoutShareSummaryCard,
} from '../../venue/modules/TournamentShareCards';
import { formatKnockoutRoundLabel } from '../../venue/modules/useTournamentStageViewData';
import { buildTournamentPodiumSummary } from '../../lib/tournamentPodium';

export type PublicTournamentPosterPreviewItem = {
  imageUrl: string;
  title: string;
};

export type PublicTournamentHtmlPosterItem = {
  title: string;
  modeLabel: string;
  venueName: string;
  venueLogoUrl: string;
  focusLabel: string;
  chips: string[];
  kind: 'league' | 'knockout';
  rows?: LeagueShareRow[];
  rounds?: KnockoutShareRound[];
  summaryCards?: KnockoutShareSummaryCard[];
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
      detail: '冠軍',
    },
    {
      label: '金杯亞軍',
      value: formatTournamentParticipantLabel(goldCup?.runnerUp),
      detail: '亞軍',
    },
    {
      label: '金杯季軍',
      value: formatTournamentParticipantLabel(goldCup?.thirdPlace),
      detail: '季軍',
    },
    {
      label: '銀杯冠軍',
      value: formatTournamentParticipantLabel(silverCup?.champion),
      detail: '冠軍',
    },
    {
      label: '銀杯亞軍',
      value: formatTournamentParticipantLabel(silverCup?.runnerUp),
      detail: '亞軍',
    },
    {
      label: '銀杯季軍',
      value: formatTournamentParticipantLabel(silverCup?.thirdPlace),
      detail: '季軍',
    },
  ];
}

function buildCupSpecificPosterSummaryCards(
  detail: any,
  formatTournamentParticipantLabel: (participant: any) => string,
  cup: 'gold' | 'silver',
): KnockoutShareSummaryCard[] {
  const participants = Array.isArray(detail?.participants) ? detail.participants : [];
  const matches = Array.isArray(detail?.matches) ? detail.matches : [];
  const podiumSummary = buildTournamentPodiumSummary(participants, matches);
  const cupSummary = cup === 'gold' ? podiumSummary?.goldCup : podiumSummary?.silverCup;
  const cupLabel = cup === 'gold' ? '金杯' : '銀杯';
  return [
    {
      label: `${cupLabel}冠軍`,
      value: formatTournamentParticipantLabel(cupSummary?.champion),
      detail: '冠軍',
    },
    {
      label: `${cupLabel}亞軍`,
      value: formatTournamentParticipantLabel(cupSummary?.runnerUp),
      detail: '亞軍',
    },
    {
      label: `${cupLabel}季軍`,
      value: formatTournamentParticipantLabel(cupSummary?.thirdPlace),
      detail: '季軍',
    },
  ];
}

function buildLeagueHtmlPosterItems(detail: any, venueName: string, venueLogoUrl: string, formatTournamentParticipantLabel: (participant: any) => string): PublicTournamentHtmlPosterItem[] {
  const rows = buildLeaguePosterRows(detail, formatTournamentParticipantLabel);
  if (rows.length <= 0) return [];
  return [{
    title: String(detail?.title || '聯賽模式積分榜'),
    modeLabel: 'LEAGUE MODE POSTER',
    venueName,
    venueLogoUrl,
    focusLabel: '整個聯賽',
    chips: [
      '整個聯賽',
      `共 ${rows.length} 位`,
      `勝 ${Number(detail?.points_win ?? 3)} / 和 ${Number(detail?.points_draw ?? 1)} / 負 ${Number(detail?.points_loss ?? 0)}`,
    ],
    kind: 'league',
    rows,
    summaryCards: [],
  }];
}

export function buildPublicTournamentHtmlPosterItems(options: {
  detail: any;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
}): PublicTournamentHtmlPosterItem[] {
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
    return buildLeagueHtmlPosterItems(detail, venueName, venueLogoUrl, formatTournamentParticipantLabel);
  }

  const rounds = buildKnockoutPosterRounds(
    detail,
    formatTournamentParticipantLabel,
    formatTournamentMatchStatusLabel,
  );
  if (rounds.length <= 0) return [];

  const posterTitle = String(detail?.title || (isGoldSilverCup ? '金銀杯模式進級表' : '淘汰賽模式進級表'));
  const mapPlanItems = (
    title: string,
    modeLabel: string,
    planItems: ReturnType<typeof buildKnockoutShareCardPlan>,
  ): PublicTournamentHtmlPosterItem[] => (
    planItems.map((item) => ({
      title: `${title} · ${item.focusLabel}`,
      modeLabel,
      venueName,
      venueLogoUrl,
      focusLabel: item.focusLabel,
      chips: [
        item.focusLabel,
        `共 ${item.rounds.length} 輪`,
        `完成 ${item.rounds.reduce((sum, round) => sum + Number(round?.completedCount || 0), 0)}/${item.rounds.reduce((sum, round) => sum + Number(round?.total || round?.items?.length || 0), 0)} 場`,
      ],
      kind: 'knockout',
      rounds: item.rounds,
      summaryCards: item.summaryCards,
    }))
  );

  if (isGoldSilverCup) {
    const goldRounds = rounds.filter((round) => String(round?.label || '').trim().startsWith('金杯'));
    const silverRounds = rounds.filter((round) => String(round?.label || '').trim().startsWith('銀杯'));
    const goldPlan = goldRounds.length > 0
      ? buildKnockoutShareCardPlan({
          title: `${posterTitle} - 金杯`,
          venueName,
          venueLogoUrl,
          focusLabel: '全部輪次',
          rounds: goldRounds,
          summaryCards: buildCupSpecificPosterSummaryCards(detail, formatTournamentParticipantLabel, 'gold'),
        })
      : [];
    const silverPlan = silverRounds.length > 0
      ? buildKnockoutShareCardPlan({
          title: `${posterTitle} - 銀杯`,
          venueName,
          venueLogoUrl,
          focusLabel: '全部輪次',
          rounds: silverRounds,
          summaryCards: buildCupSpecificPosterSummaryCards(detail, formatTournamentParticipantLabel, 'silver'),
        })
      : [];
    return [
      ...mapPlanItems(`${posterTitle} - 金杯`, 'KNOCKOUT MODE POSTER', goldPlan),
      ...mapPlanItems(`${posterTitle} - 銀杯`, 'KNOCKOUT MODE POSTER', silverPlan),
    ];
  }

  const planItems = buildKnockoutShareCardPlan({
    title: posterTitle,
    venueName,
    venueLogoUrl,
    focusLabel: '全部輪次',
    rounds,
    summaryCards: buildKnockoutPosterSummaryCards(detail, formatTournamentParticipantLabel),
  });
  return mapPlanItems(posterTitle, 'KNOCKOUT MODE POSTER', planItems);
}

export async function buildPublicTournamentPosterDataUrl(options: {
  detail: any;
  formatTournamentParticipantLabel: (participant: any) => string;
  formatTournamentMatchStatusLabel: (value: any) => string;
}) {
  const items = await buildPublicTournamentPosterPreviewItems(options);
  return items[0]?.imageUrl || '';
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
  if (isGoldSilverCup) {
    const goldRounds = rounds.filter((round) => String(round?.label || '').trim().startsWith('金杯'));
    const silverRounds = rounds.filter((round) => String(round?.label || '').trim().startsWith('銀杯'));
    const [goldPreviewItems, silverPreviewItems] = await Promise.all([
      goldRounds.length > 0
        ? buildKnockoutBracketShareCardPreviewItems({
            title: `${posterTitle} - 金杯`,
            venueName,
            venueLogoUrl,
            focusLabel: '全部輪次',
            rounds: goldRounds,
            summaryCards: buildCupSpecificPosterSummaryCards(detail, formatTournamentParticipantLabel, 'gold'),
          })
        : Promise.resolve([]),
      silverRounds.length > 0
        ? buildKnockoutBracketShareCardPreviewItems({
            title: `${posterTitle} - 銀杯`,
            venueName,
            venueLogoUrl,
            focusLabel: '全部輪次',
            rounds: silverRounds,
            summaryCards: buildCupSpecificPosterSummaryCards(detail, formatTournamentParticipantLabel, 'silver'),
          })
        : Promise.resolve([]),
    ]);
    return [
      ...goldPreviewItems.map((item) => ({
        imageUrl: item.imageUrl,
        title: `${posterTitle} - 金杯 · ${item.focusLabel}`,
      })),
      ...silverPreviewItems.map((item) => ({
        imageUrl: item.imageUrl,
        title: `${posterTitle} - 銀杯 · ${item.focusLabel}`,
      })),
    ];
  }
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
