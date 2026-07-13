type PodiumBlock = {
  champion: any;
  runnerUp: any;
  thirdPlace: any;
  fourthPlace: any;
  semiFinalists: any[];
};

export type TournamentPodiumSummary = PodiumBlock & {
  isGoldSilverCup: boolean;
  goldCup: PodiumBlock | null;
  silverCup: PodiumBlock | null;
};

function sortBySeed(items: any[]) {
  return [...items].sort((a: any, b: any) => Number(a?.seed || 0) - Number(b?.seed || 0));
}

function buildEmptyPodiumBlock(): PodiumBlock {
  return {
    champion: null,
    runnerUp: null,
    thirdPlace: null,
    fourthPlace: null,
    semiFinalists: [],
  };
}

function getMatchLoserId(match: any) {
  const winnerId = String(match?.winner_participant_id || '');
  const playerAId = String(match?.player_a_participant_id || '');
  const playerBId = String(match?.player_b_participant_id || '');
  if (!winnerId || !playerAId || !playerBId) return '';
  if (winnerId === playerAId) return playerBId;
  if (winnerId === playerBId) return playerAId;
  return '';
}

function buildStandardKnockoutPodium(participantsRows: any[], matchesRows: any[]): PodiumBlock {
  const participantsById = new Map<string, any>(participantsRows.map((row: any) => [String(row?.id || ''), row]));
  const completedMainMatches = matchesRows.filter((row: any) => {
    const stageCode = String(row?.stage_code || '').trim().toUpperCase();
    return stageCode === 'KNOCKOUT_MAIN' && String(row?.status || '').trim().toUpperCase() === 'COMPLETED';
  });
  const finalRoundNo = Math.max(0, ...completedMainMatches.map((row: any) => Number(row?.round_no || 0)));
  const finalMatch = completedMainMatches.find((row: any) => Number(row?.round_no || 0) === finalRoundNo) || null;
  const thirdPlaceMatch = matchesRows.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === 'KNOCKOUT_THIRD_PLACE') || null;
  const semiFinalMatches = completedMainMatches.filter((row: any) => Number(row?.round_no || 0) === finalRoundNo - 1);

  const champion = participantsRows.find((row: any) => Number(row?.final_rank || 0) === 1)
    || (finalMatch ? participantsById.get(String(finalMatch?.winner_participant_id || '')) || null : null);
  const runnerUp = participantsRows.find((row: any) => Number(row?.final_rank || 0) === 2)
    || (finalMatch ? participantsById.get(getMatchLoserId(finalMatch)) || null : null);
  const thirdPlace = participantsRows.find((row: any) => Number(row?.final_rank || 0) === 3)
    || (thirdPlaceMatch ? participantsById.get(String(thirdPlaceMatch?.winner_participant_id || '')) || null : null);
  const fourthPlace = participantsRows.find((row: any) => Number(row?.final_rank || 0) === 4)
    || (thirdPlaceMatch ? participantsById.get(getMatchLoserId(thirdPlaceMatch)) || null : null);
  const semiFinalists = thirdPlace || fourthPlace
    ? []
    : sortBySeed(semiFinalMatches
        .map((row: any) => participantsById.get(getMatchLoserId(row)) || null)
        .filter(Boolean));

  return {
    champion: champion || null,
    runnerUp: runnerUp || null,
    thirdPlace: thirdPlace || null,
    fourthPlace: fourthPlace || null,
    semiFinalists,
  };
}

function buildCupPodium(participantsById: Map<string, any>, matchesRows: any[], mainStageCode: string, thirdPlaceStageCode: string): PodiumBlock {
  const completedMainMatches = matchesRows.filter((row: any) => (
    String(row?.stage_code || '').trim().toUpperCase() === mainStageCode
    && String(row?.status || '').trim().toUpperCase() === 'COMPLETED'
  ));
  if (completedMainMatches.length <= 0) return buildEmptyPodiumBlock();
  const finalRoundNo = Math.max(0, ...completedMainMatches.map((row: any) => Number(row?.round_no || 0)));
  const finalMatch = completedMainMatches.find((row: any) => Number(row?.round_no || 0) === finalRoundNo) || null;
  const thirdPlaceMatch = matchesRows.find((row: any) => String(row?.stage_code || '').trim().toUpperCase() === thirdPlaceStageCode) || null;
  const semiFinalMatches = completedMainMatches.filter((row: any) => Number(row?.round_no || 0) === finalRoundNo - 1);
  const thirdPlace = thirdPlaceMatch ? participantsById.get(String(thirdPlaceMatch?.winner_participant_id || '')) || null : null;
  const fourthPlace = thirdPlaceMatch ? participantsById.get(getMatchLoserId(thirdPlaceMatch)) || null : null;
  const semiFinalists = thirdPlace || fourthPlace
    ? []
    : sortBySeed(semiFinalMatches
        .map((row: any) => participantsById.get(getMatchLoserId(row)) || null)
        .filter(Boolean));
  return {
    champion: finalMatch ? participantsById.get(String(finalMatch?.winner_participant_id || '')) || null : null,
    runnerUp: finalMatch ? participantsById.get(getMatchLoserId(finalMatch)) || null : null,
    thirdPlace,
    fourthPlace,
    semiFinalists,
  };
}

export function buildTournamentPodiumSummary(participantsRows: any[], matchesRows: any[]): TournamentPodiumSummary {
  const normalizedStageCodes = matchesRows.map((row: any) => String(row?.stage_code || '').trim().toUpperCase());
  const isGoldSilverCup = normalizedStageCodes.some((stageCode: string) => stageCode.startsWith('GOLD_') || stageCode.startsWith('SILVER_'));
  if (!isGoldSilverCup) {
    const basic = buildStandardKnockoutPodium(participantsRows, matchesRows);
    return {
      ...basic,
      isGoldSilverCup: false,
      goldCup: null,
      silverCup: null,
    };
  }

  const participantsById = new Map<string, any>(participantsRows.map((row: any) => [String(row?.id || ''), row]));
  const goldCup = buildCupPodium(participantsById, matchesRows, 'GOLD_MAIN', 'GOLD_THIRD_PLACE');
  const silverCup = buildCupPodium(participantsById, matchesRows, 'SILVER_MAIN', 'SILVER_THIRD_PLACE');

  return {
    ...goldCup,
    isGoldSilverCup: true,
    goldCup,
    silverCup,
  };
}
