import { useMemo } from 'react';
import { buildTournamentPodiumSummary } from '../../lib/tournamentPodium';

const BRACKET_CARD_HEIGHT = 156;
const BRACKET_BASE_GAP = 18;
const BRACKET_CONNECTOR_HALF_GAP = 24;

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function formatKnockoutRoundLabel(match: any, participantCount: number) {
  const stageCode = String(match?.stage_code || '').trim().toUpperCase();
  if (stageCode === 'KNOCKOUT_THIRD_PLACE') return '季軍戰';
  if (stageCode === 'GOLD_THIRD_PLACE') return '金杯季軍戰';
  if (stageCode === 'SILVER_THIRD_PLACE') return '銀杯季軍戰';
  if (stageCode === 'SILVER_QUALIFIER') {
    const roundNo = Number(match?.round_no || 0);
    return roundNo > 0 ? `銀杯資格輪 ${roundNo}` : '銀杯資格輪';
  }
  if (stageCode === 'SILVER_MAIN') {
    const roundNo = Number(match?.round_no || 0);
    return roundNo > 0 ? `銀杯主賽 R${roundNo}` : '銀杯主賽';
  }
  const roundNo = Number(match?.round_no || 0);
  if (roundNo <= 0) return '-';
  const bracketSize = nextPowerOfTwo(Math.max(2, participantCount || 2));
  const hasPreliminaryRound = participantCount > 0 && participantCount !== bracketSize;
  const prefix = stageCode === 'GOLD_MAIN' ? '金杯 ' : '';
  if (hasPreliminaryRound && roundNo === 1) return `${prefix}預賽`.trim();
  const roundOffset = hasPreliminaryRound ? 1 : 0;
  const stageSize = bracketSize / (2 ** Math.max(0, roundNo - 1));
  if (stageSize <= 2) return `${prefix}決賽`.trim();
  if (stageSize === 4) return `${prefix}4 強`.trim();
  if (stageSize === 8) return `${prefix}8 強`.trim();
  if (stageSize === 16) return `${prefix}16 強`.trim();
  if (stageSize === 32) return `${prefix}32 強`.trim();
  if (stageSize === 64) return `${prefix}64 強`.trim();
  if (stageSize === 128) return `${prefix}128 強`.trim();
  if (stageSize === 256) return `${prefix}256 強`.trim();
  return `${prefix}Round ${Math.max(1, roundNo - roundOffset)}`.trim();
}

export function formatLeagueRoundLabel(match: any) {
  const roundNo = Number(match?.round_no || 0);
  return roundNo > 0 ? `第 ${roundNo} 輪` : '循環賽';
}

function buildKnockoutSummary(participantsRows: any[], matchesRows: any[]) {
  const participantCount = participantsRows.length;
  const bracketSize = participantCount > 1 ? nextPowerOfTwo(participantCount) : 0;
  const byeCount = participantCount > 1 ? Math.max(0, bracketSize - participantCount) : 0;
  const completedCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length;
  const readyCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length;
  const pendingCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length;
  return { participantCount, bracketSize, byeCount, completedCount, readyCount, pendingCount };
}

function buildLeagueSummary(participantsRows: any[], matchesRows: any[]) {
  const participantCount = participantsRows.length;
  const totalRounds = participantCount > 1 ? participantCount - 1 + (participantCount % 2 === 1 ? 1 : 0) : 0;
  const completedCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length;
  const readyCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length;
  const pendingCount = matchesRows.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length;
  return { participantCount, totalRounds, totalMatches: matchesRows.length, completedCount, readyCount, pendingCount };
}

function getBracketColumnPaddingTop(roundIndex: number) {
  if (roundIndex <= 0) return 0;
  return ((2 ** roundIndex) - 1) * (BRACKET_CARD_HEIGHT + BRACKET_BASE_GAP) / 2;
}

function getBracketColumnGap(roundIndex: number) {
  if (roundIndex <= 0) return BRACKET_BASE_GAP;
  return (2 ** roundIndex) * (BRACKET_CARD_HEIGHT + BRACKET_BASE_GAP) - BRACKET_CARD_HEIGHT;
}

function getBracketColumnHeight(matchCount: number) {
  if (matchCount <= 0) return BRACKET_CARD_HEIGHT;
  return matchCount * BRACKET_CARD_HEIGHT + Math.max(0, matchCount - 1) * BRACKET_BASE_GAP;
}

function getKnockoutStageSortValue(row: any) {
  const stageCode = String(row?.stage_code || '').trim().toUpperCase();
  const roundNo = Number(row?.round_no || 0);
  if (stageCode === 'KNOCKOUT_PRELIM') return 50 + roundNo;
  if (stageCode === 'KNOCKOUT_MAIN') return 100 + roundNo;
  if (stageCode === 'KNOCKOUT_THIRD_PLACE') return 180;
  if (stageCode === 'GOLD_MAIN') return 200 + roundNo;
  if (stageCode === 'GOLD_THIRD_PLACE') return 280;
  if (stageCode === 'SILVER_QUALIFIER') return 300 + roundNo;
  if (stageCode === 'SILVER_MAIN') return 400 + roundNo;
  if (stageCode === 'SILVER_THIRD_PLACE') return 480;
  return 999 + roundNo;
}

export function buildKnockoutBracketColumns(matchesRows: any[], participantsCount: number) {
  const grouped = new Map<string, { roundNo: number; items: Array<any> }>();
  for (const row of matchesRows.filter((candidate: any) => String(candidate?.stage_code || '').trim().toUpperCase() !== 'KNOCKOUT_THIRD_PLACE')) {
    const key = formatKnockoutRoundLabel(row, participantsCount);
    const roundNo = Number(row?.round_no || 0);
    const existing = grouped.get(key);
    if (existing) {
      existing.items.push(row);
      existing.roundNo = existing.roundNo > 0 ? Math.min(existing.roundNo, roundNo || existing.roundNo) : roundNo;
    } else {
      grouped.set(key, { roundNo, items: [row] });
    }
  }
  return Array.from(grouped.entries())
    .sort((a, b) => {
      const aSort = Math.min(...a[1].items.map((item: any) => getKnockoutStageSortValue(item)));
      const bSort = Math.min(...b[1].items.map((item: any) => getKnockoutStageSortValue(item)));
      if (aSort !== bSort) return aSort - bSort;
      return a[1].roundNo - b[1].roundNo;
    })
    .map(([label, group], roundIndex, allColumns) => {
      const items = [...group.items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0));
      const paddingTop = getBracketColumnPaddingTop(roundIndex);
      const gap = getBracketColumnGap(roundIndex);
      const cardCenters = items.map((_, itemIndex) => (
        paddingTop + itemIndex * (BRACKET_CARD_HEIGHT + gap) + BRACKET_CARD_HEIGHT / 2
      ));
      const connectors = roundIndex < allColumns.length - 1
        ? Array.from({ length: Math.floor(items.length / 2) }, (_unused, pairIndex) => {
            const topCenter = cardCenters[pairIndex * 2];
            const bottomCenter = cardCenters[pairIndex * 2 + 1];
            if (typeof topCenter !== 'number' || typeof bottomCenter !== 'number') return null;
            return {
              top: topCenter,
              height: Math.max(0, bottomCenter - topCenter),
            };
          }).filter(Boolean)
        : [];
      return {
        label,
        roundIndex,
        isFinal: roundIndex === allColumns.length - 1,
        items,
        summary: {
          total: items.length,
          completedCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length,
          liveCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'LIVE').length,
          readyCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length,
          pendingCount: items.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length,
        },
        paddingTop,
        gap,
        columnHeight: Math.max(
          getBracketColumnHeight(matchesRows.length),
          paddingTop + (items.length * BRACKET_CARD_HEIGHT) + Math.max(0, items.length - 1) * gap,
        ),
        connectors,
        cardHeight: BRACKET_CARD_HEIGHT,
        connectorHalfGap: BRACKET_CONNECTOR_HALF_GAP,
      };
    });
}

export function useTournamentStageViewData(participantsRows: any[], matchesRows: any[]) {
  const thirdPlaceMatch = useMemo(
    () => matchesRows.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'KNOCKOUT_THIRD_PLACE') || null,
    [matchesRows],
  );
  const bracketColumns = useMemo(
    () => buildKnockoutBracketColumns(matchesRows, participantsRows.length),
    [matchesRows, participantsRows.length],
  );

  const knockoutSummary = useMemo(() => buildKnockoutSummary(participantsRows, matchesRows), [participantsRows, matchesRows]);
  const leagueSummary = useMemo(() => buildLeagueSummary(participantsRows, matchesRows), [participantsRows, matchesRows]);

  const leagueRounds = useMemo(() => {
    const grouped = new Map<number, any[]>();
    for (const row of matchesRows) {
      const roundNo = Number(row?.round_no || 0);
      if (!grouped.has(roundNo)) grouped.set(roundNo, []);
      grouped.get(roundNo)?.push(row);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([roundNo, items]) => ({
        roundNo,
        label: roundNo > 0 ? `第 ${roundNo} 輪` : '循環賽',
        items: [...items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0)),
      }));
  }, [matchesRows]);

  const podiumSummary = useMemo(() => {
    return buildTournamentPodiumSummary(participantsRows, matchesRows);
  }, [matchesRows, participantsRows]);

  return {
    bracketColumns,
    knockoutSummary,
    leagueSummary,
    leagueRounds,
    podiumSummary,
    thirdPlaceMatch,
  };
}
