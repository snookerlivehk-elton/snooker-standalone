import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';
import { hashPassword, makeSalt } from '../../core/members/utils.js';

const db = prisma as any;

type Side = 'A' | 'B';
type TournamentFormat = 'KNOCKOUT' | 'LEAGUE';
type TournamentSeedMode = 'MANUAL' | 'RANKING' | 'RANDOM';
type TournamentMatchResultType = 'STANDARD' | 'BYE' | 'WALKOVER' | 'FORFEIT';

type FrameInput = {
  frameNo?: any;
  winnerSide?: any;
  playerAScore?: any;
  playerBScore?: any;
  playerAHighestBreak?: any;
  playerBHighestBreak?: any;
  startedAt?: any;
  endedAt?: any;
};

function toInt(value: any, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function toNullableDate(value: any) {
  if (value == null || String(value).trim() === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new Error('date invalid');
  return d;
}

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function previousPowerOfTwo(n: number) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function pairParticipants<T extends { id: string }>(items: T[], bracketSize: number): Array<[T | null, T | null]> {
  const padded: Array<T | null> = [...items];
  while (padded.length < bracketSize) padded.push(null);
  const pairs: Array<[T | null, T | null]> = [];
  for (let i = 0; i < bracketSize / 2; i += 1) {
    pairs.push([padded[i] ?? null, padded[bracketSize - 1 - i] ?? null]);
  }
  return pairs;
}

function shuffleArray<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = next[i]!;
    next[i] = next[j]!;
    next[j] = current;
  }
  return next;
}

function normalizeFrames(framesRaw: any): Array<{
  frame_no: number;
  winner_side: Side | null;
  player_a_score: number;
  player_b_score: number;
  player_a_highest_break: number;
  player_b_highest_break: number;
  started_at: Date | null;
  ended_at: Date | null;
}> {
  const frames = Array.isArray(framesRaw) ? framesRaw : [];
  return frames.map((frame: FrameInput, index) => {
    const winnerSide = String(frame?.winnerSide || '').trim().toUpperCase();
    return {
      frame_no: Math.max(1, toInt(frame?.frameNo, index + 1)),
      winner_side: winnerSide === 'A' || winnerSide === 'B' ? (winnerSide as Side) : null,
      player_a_score: Math.max(0, toInt(frame?.playerAScore, 0)),
      player_b_score: Math.max(0, toInt(frame?.playerBScore, 0)),
      player_a_highest_break: Math.max(0, toInt(frame?.playerAHighestBreak, 0)),
      player_b_highest_break: Math.max(0, toInt(frame?.playerBHighestBreak, 0)),
      started_at: toNullableDate(frame?.startedAt),
      ended_at: toNullableDate(frame?.endedAt),
    };
  }).sort((a, b) => a.frame_no - b.frame_no);
}

function normalizeResultType(value: any): TournamentMatchResultType {
  const resultType = String(value || 'STANDARD').trim().toUpperCase();
  if (resultType === 'BYE' || resultType === 'WALKOVER' || resultType === 'FORFEIT') return resultType;
  return 'STANDARD';
}

function normalizeTournamentFormat(value: any): TournamentFormat {
  return String(value || '').trim().toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
}

function getTargetWins(bestOfRaw: any) {
  const bestOf = Math.max(1, Math.floor(Number(bestOfRaw || 1)));
  return Math.floor(bestOf / 2) + 1;
}

async function getOwnedTournament(clubId: string, tournamentId: string) {
  const tournament = await db.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament || tournament.clubId !== clubId) throw new Error('Not found');
  return tournament;
}

function normalizeSeedMode(value: any): TournamentSeedMode {
  const mode = String(value || 'MANUAL').trim().toUpperCase();
  if (mode === 'RANKING' || mode === 'RANDOM') return mode;
  return 'MANUAL';
}

function normalizeMethodZBatchLabel(value: any) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
  if (normalized) return normalized;
  return `TZ${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function normalizeMethodZPassword(value: any) {
  const password = String(value || 'Test1234');
  const pwLenOk = password.length >= 8;
  const pwHasNum = /\d/.test(password);
  const pwHasAlpha = /[A-Za-z]/.test(password);
  if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
    throw new Error('測試會員密碼不符合規則（至少8字元，需含英文字母與數字）');
  }
  return password;
}

function parseMethodZBatchLabelFromMemberCode(value: any) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^TZ-([A-Z0-9]+)-\d{2}$/);
  return match ? match[1] : '';
}

function randomInt(min: number, max: number) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function buildMethodZSimulationPlan(match: any, tournament: any, generateBreaks: boolean) {
  const bestOfFrames = Math.max(1, Math.floor(Number(match?.best_of_frames ?? tournament?.best_of_frames ?? 1) || 1));
  const targetWins = getTargetWins(bestOfFrames);
  const format = normalizeTournamentFormat(tournament?.format);
  const trackedBreakThreshold = Math.max(1, toInt(tournament?.tracked_break_threshold, 20));
  const winnerSide: Side = Math.random() < 0.5 ? 'A' : 'B';
  const frameWinners: Side[] = [];
  let aWins = 0;
  let bWins = 0;

  while (aWins < targetWins && bWins < targetWins && frameWinners.length < bestOfFrames) {
    const remainingFrames = bestOfFrames - frameWinners.length;
    const aNeeds = targetWins - aWins;
    const bNeeds = targetWins - bWins;

    let nextWinner: Side;
    if (remainingFrames <= aNeeds) nextWinner = 'A';
    else if (remainingFrames <= bNeeds) nextWinner = 'B';
    else {
      const bias = format === 'KNOCKOUT' ? 0.62 : 0.58;
      nextWinner = Math.random() < bias
        ? winnerSide
        : (winnerSide === 'A' ? 'B' : 'A');
    }

    frameWinners.push(nextWinner);
    if (nextWinner === 'A') aWins += 1;
    else bWins += 1;
  }

  const startedAt = new Date(Date.now() - randomInt(8, 90) * 60_000);
  const frames = frameWinners.map((frameWinner, index) => {
    const winnerScore = randomInt(55, 92);
    const loserScore = randomInt(0, Math.max(10, winnerScore - 8));
    const frameStartedAt = new Date(startedAt.getTime() + index * 9 * 60_000);
    const frameEndedAt = new Date(frameStartedAt.getTime() + randomInt(5, 9) * 60_000);
    return {
      frameNo: index + 1,
      winnerSide: frameWinner,
      playerAScore: frameWinner === 'A' ? winnerScore : loserScore,
      playerBScore: frameWinner === 'B' ? winnerScore : loserScore,
      playerAHighestBreak: 0,
      playerBHighestBreak: 0,
      startedAt: frameStartedAt.toISOString(),
      endedAt: frameEndedAt.toISOString(),
    };
  });

  const breakPlans: Array<{
    memberId: string;
    frameNo: number;
    points: number;
    recordedAt: string;
    note: string;
  }> = [];
  if (generateBreaks) {
    for (const frame of frames) {
      if (Math.random() > 0.55) continue;
      const memberId = frame.winnerSide === 'A'
        ? String(match?.player_a_participant?.member_id || '')
        : String(match?.player_b_participant?.member_id || '');
      if (!memberId) continue;
      const winnerScore = frame.winnerSide === 'A' ? Number(frame.playerAScore || 0) : Number(frame.playerBScore || 0);
      const points = Math.min(
        Math.max(trackedBreakThreshold, winnerScore - randomInt(0, 18)),
        randomInt(Math.max(trackedBreakThreshold, 22), Math.max(trackedBreakThreshold + 6, 96)),
      );
      breakPlans.push({
        memberId,
        frameNo: Number(frame.frameNo || 1),
        points,
        recordedAt: String(frame.endedAt || new Date().toISOString()),
        note: 'Method Z auto break',
      });
      if (frame.winnerSide === 'A') frame.playerAHighestBreak = points;
      else frame.playerBHighestBreak = points;
    }
  }

  if (generateBreaks && breakPlans.length === 0 && frames.length > 0) {
    const firstFrame = frames[0]!;
    const memberId = firstFrame.winnerSide === 'A'
      ? String(match?.player_a_participant?.member_id || '')
      : String(match?.player_b_participant?.member_id || '');
    if (memberId) {
      const points = Math.max(trackedBreakThreshold, Math.min(
        firstFrame.winnerSide === 'A' ? Number(firstFrame.playerAScore || 0) : Number(firstFrame.playerBScore || 0),
        trackedBreakThreshold + 18,
      ));
      breakPlans.push({
        memberId,
        frameNo: Number(firstFrame.frameNo || 1),
        points,
        recordedAt: String(firstFrame.endedAt || new Date().toISOString()),
        note: 'Method Z auto break',
      });
      if (firstFrame.winnerSide === 'A') firstFrame.playerAHighestBreak = points;
      else firstFrame.playerBHighestBreak = points;
    }
  }

  return {
    resultPayload: {
      resultType: 'STANDARD',
      frames,
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + frames.length * 10 * 60_000).toISOString(),
    },
    breakPlans,
    summary: {
      roundNo: Number(match?.round_no || 0),
      matchNo: Number(match?.match_no || 0),
      winnerSide: aWins > bWins ? 'A' : 'B',
      scoreLabel: `${aWins}:${bWins}`,
      breakCount: breakPlans.length,
      highestBreak: breakPlans.reduce((best, row) => Math.max(best, Number(row?.points || 0)), 0),
    },
  };
}

function buildLeagueRoundRobinPairs<T>(items: Array<T | null>): Array<Array<[T | null, T | null]>> {
  if (items.length <= 1) return [];
  const players = [...items];
  if (players.length % 2 === 1) players.push(null);
  const rounds: Array<Array<[T | null, T | null]>> = [];
  let rotation = [...players];
  const totalRounds = rotation.length - 1;
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const pairs: Array<[T | null, T | null]> = [];
    for (let i = 0; i < rotation.length / 2; i += 1) {
      const left = rotation[i] ?? null;
      const right = rotation[rotation.length - 1 - i] ?? null;
      pairs.push(roundIndex % 2 === 0 ? [left, right] : [right, left]);
    }
    rounds.push(pairs);
    const fixed = rotation[0] ?? null;
    const rest = rotation.slice(1);
    rest.unshift(rest.pop() ?? null);
    rotation = [fixed, ...rest];
  }
  return rounds;
}

export function buildLeagueStandings(tournament: any, participants: any[], matches: any[]) {
  const pointsWin = Math.max(0, Number(tournament?.points_win ?? 3));
  const pointsDraw = Math.max(0, Number(tournament?.points_draw ?? 1));
  const pointsLoss = Math.max(0, Number(tournament?.points_loss ?? 0));
  const map = new Map<string, any>();
  for (const participant of participants) {
    map.set(String(participant.id), {
      participantId: String(participant.id),
      participant,
      member: participant.member || null,
      seed: Number(participant.seed || 0),
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      matchPoints: 0,
      framesFor: 0,
      framesAgainst: 0,
      frameDiff: 0,
      totalPointsFor: 0,
      totalPointsAgainst: 0,
      totalPointsDiff: 0,
      maxBreak: 0,
      breaks20Plus: 0,
    });
  }

  for (const match of matches) {
    if (String(match?.status || '').toUpperCase() !== 'COMPLETED') continue;
    const aId = String(match?.player_a_participant_id || '');
    const bId = String(match?.player_b_participant_id || '');
    if (!aId || !bId) continue;
    const a = map.get(aId);
    const b = map.get(bId);
    if (!a || !b) continue;
    const aFrames = Number(match?.player_a_frames_won || 0);
    const bFrames = Number(match?.player_b_frames_won || 0);
    const aScore = Number(match?.player_a_total_points || 0);
    const bScore = Number(match?.player_b_total_points || 0);
    const aMaxBreak = Number(match?.player_a_max_break || 0);
    const bMaxBreak = Number(match?.player_b_max_break || 0);
    const a20Plus = Number(match?.player_a_20_plus_count || 0);
    const b20Plus = Number(match?.player_b_20_plus_count || 0);

    a.played += 1;
    b.played += 1;
    a.framesFor += aFrames;
    a.framesAgainst += bFrames;
    b.framesFor += bFrames;
    b.framesAgainst += aFrames;
    a.totalPointsFor += aScore;
    a.totalPointsAgainst += bScore;
    b.totalPointsFor += bScore;
    b.totalPointsAgainst += aScore;
    a.maxBreak = Math.max(a.maxBreak, aMaxBreak);
    b.maxBreak = Math.max(b.maxBreak, bMaxBreak);
    a.breaks20Plus += a20Plus;
    b.breaks20Plus += b20Plus;

    if (aFrames > bFrames) {
      a.won += 1;
      b.lost += 1;
      a.matchPoints += pointsWin;
      b.matchPoints += pointsLoss;
    } else if (bFrames > aFrames) {
      b.won += 1;
      a.lost += 1;
      b.matchPoints += pointsWin;
      a.matchPoints += pointsLoss;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.matchPoints += pointsDraw;
      b.matchPoints += pointsDraw;
    }
  }

  const rows = Array.from(map.values()).map((row) => ({
    ...row,
    frameDiff: row.framesFor - row.framesAgainst,
    totalPointsDiff: row.totalPointsFor - row.totalPointsAgainst,
  }));

  rows.sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.frameDiff !== a.frameDiff) return b.frameDiff - a.frameDiff;
    if (b.framesFor !== a.framesFor) return b.framesFor - a.framesFor;
    if (b.totalPointsDiff !== a.totalPointsDiff) return b.totalPointsDiff - a.totalPointsDiff;
    if (b.totalPointsFor !== a.totalPointsFor) return b.totalPointsFor - a.totalPointsFor;
    if (b.breaks20Plus !== a.breaks20Plus) return b.breaks20Plus - a.breaks20Plus;
    if (b.maxBreak !== a.maxBreak) return b.maxBreak - a.maxBreak;
    if (a.seed > 0 && b.seed > 0 && a.seed !== b.seed) return a.seed - b.seed;
    return String(a.member?.name || '').localeCompare(String(b.member?.name || ''));
  });

  return rows.map((row, index) => ({
    ...row,
    position: index + 1,
  }));
}

function normalizeLeagueRoundRobinMode(value: any): 'SINGLE' | 'DOUBLE' {
  return String(value || '').trim().toUpperCase() === 'DOUBLE' ? 'DOUBLE' : 'SINGLE';
}

async function listParticipantsForSeeding(tx: any, tournamentId: string) {
  return tx.tournamentParticipant.findMany({
    where: { tournament_id: tournamentId },
    orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
  });
}

async function reseedParticipants(tx: any, tournament: any) {
  const rows = await listParticipantsForSeeding(tx, tournament.id);
  if (rows.length === 0) return rows;

  const mode = normalizeSeedMode(tournament.seed_mode);
  let ordered = [...rows];

  if (mode === 'RANDOM') {
    ordered = shuffleArray(rows);
  } else if (mode === 'RANKING') {
    const clubMembers = await tx.clubMember.findMany({
      where: {
        clubId: tournament.clubId,
        memberId: { in: rows.map((row: any) => row.member_id) },
      },
      select: { memberId: true, rating: true, joinedAt: true },
    });
    const byMemberId = new Map<string, { rating: number; joinedAt: Date | null }>(
      clubMembers.map((row: any) => [String(row.memberId), { rating: Number(row.rating || 0), joinedAt: row.joinedAt || null }]),
    );
    ordered = [...rows].sort((a: any, b: any) => {
      const aMeta = byMemberId.get(String(a.member_id));
      const bMeta = byMemberId.get(String(b.member_id));
      const ratingDiff = Number(bMeta?.rating || 0) - Number(aMeta?.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      const joinedDiff = new Date(aMeta?.joinedAt || a.created_at).getTime() - new Date(bMeta?.joinedAt || b.created_at).getTime();
      if (joinedDiff !== 0) return joinedDiff;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index];
    const seed = index + 1;
    if (Number(row.seed || 0) === seed) continue;
    await tx.tournamentParticipant.update({
      where: { id: row.id },
      data: { seed },
    });
  }

  return listParticipantsForSeeding(tx, tournament.id);
}

async function recomputeMatchBreakStats(tx: any, matchId: string) {
  const match = await tx.tournamentMatch.findUnique({
    where: { id: matchId },
    include: {
      player_a_participant: { select: { id: true, member_id: true } },
      player_b_participant: { select: { id: true, member_id: true } },
      frames: {
        select: {
          player_a_highest_break: true,
          player_b_highest_break: true,
        },
      },
    },
  });
  if (!match) throw new Error('Not found');

  const rows = await tx.breakRecord.findMany({
    where: {
      tournament_match_id: matchId,
      deleted_at: null,
      record_type: 'TOURNAMENT',
    },
    select: { member_id: true, points: true },
  });

  const summarize = (memberId?: string | null) => {
    const mine = memberId ? rows.filter((r: any) => r.member_id === memberId) : [];
    return {
      count: mine.length,
      max: mine.reduce((best: number, row: any) => Math.max(best, Number(row.points || 0)), 0),
    };
  };

  const a = summarize(match.player_a_participant?.member_id);
  const b = summarize(match.player_b_participant?.member_id);
  const playerAMaxBreakFromFrames = Array.isArray(match.frames)
    ? match.frames.reduce((best: number, frame: any) => Math.max(best, Number(frame?.player_a_highest_break || 0)), 0)
    : 0;
  const playerBMaxBreakFromFrames = Array.isArray(match.frames)
    ? match.frames.reduce((best: number, frame: any) => Math.max(best, Number(frame?.player_b_highest_break || 0)), 0)
    : 0;

  await tx.tournamentMatch.update({
    where: { id: matchId },
    data: {
      player_a_20_plus_count: a.count,
      player_b_20_plus_count: b.count,
      player_a_max_break: Math.max(playerAMaxBreakFromFrames, a.max),
      player_b_max_break: Math.max(playerBMaxBreakFromFrames, b.max),
    },
  });
}

async function advanceKnockoutWinner(tx: any, tournamentId: string, match: any, winnerParticipantId: string | null) {
  if (!winnerParticipantId || !match.round_no || !match.match_no) return;
  const nextRoundNo = Number(match.round_no) + 1;
  const nextMatchNo = Math.ceil(Number(match.match_no) / 2);
  const nextMatch = await tx.tournamentMatch.findFirst({
    where: {
      tournament_id: tournamentId,
      round_no: nextRoundNo,
      match_no: nextMatchNo,
      stage_code: 'KNOCKOUT_MAIN',
    },
  });
  if (!nextMatch) return;

  const patch = Number(match.match_no) % 2 === 1
    ? { player_a_participant_id: winnerParticipantId }
    : { player_b_participant_id: winnerParticipantId };
  const nextPlayerA = patch.player_a_participant_id ?? nextMatch.player_a_participant_id;
  const nextPlayerB = patch.player_b_participant_id ?? nextMatch.player_b_participant_id;

  await tx.tournamentMatch.update({
    where: { id: nextMatch.id },
    data: {
      ...patch,
      status: nextPlayerA && nextPlayerB ? 'READY' : 'PENDING',
    },
  });
}

async function finalizeKnockoutMatch(tx: any, tournamentId: string, match: any, winnerParticipantId: string | null) {
  await advanceKnockoutWinner(tx, tournamentId, match, winnerParticipantId);

  const finalRound = await tx.tournamentMatch.aggregate({
    where: { tournament_id: tournamentId },
    _max: { round_no: true },
  });
  const maxRound = Number(finalRound?._max?.round_no || 0);
  const roundNo = Number(match.round_no || 0);
  const loserParticipantId = winnerParticipantId
    ? String(match.player_a_participant_id || '') === String(winnerParticipantId)
      ? match.player_b_participant_id
      : match.player_a_participant_id
    : null;
  if (loserParticipantId) {
    const eliminationRank = roundNo > 0 && maxRound > 0
      ? (2 ** Math.max(0, maxRound - roundNo)) + 1
      : null;
    await tx.tournamentParticipant.update({
      where: { id: loserParticipantId },
      data: {
        status: 'ELIMINATED',
        final_rank: eliminationRank,
      },
    });
  }
  if (winnerParticipantId && Number(match.round_no || 0) >= maxRound) {
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { workflow_status: 'COMPLETED' },
    });
    await tx.tournamentParticipant.update({
      where: { id: winnerParticipantId },
      data: { status: 'CHAMPION', final_rank: 1 },
    });
  } else {
    if (winnerParticipantId) {
      await tx.tournamentParticipant.update({
        where: { id: winnerParticipantId },
        data: { status: 'ACTIVE', final_rank: null },
      });
    }
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { workflow_status: 'IN_PROGRESS' },
    });
  }
}

async function finalizeLeagueProgress(tx: any, tournament: any) {
  const participants = await tx.tournamentParticipant.findMany({
    where: { tournament_id: tournament.id },
    orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
    include: {
      member: { select: { id: true, name: true, member_code: true, email: true } },
      signup: { select: { id: true, status: true, createdAt: true } },
    },
  });
  const matches = await tx.tournamentMatch.findMany({
    where: { tournament_id: tournament.id, stage_code: 'LEAGUE' },
    orderBy: [{ round_no: 'asc' }, { match_no: 'asc' }],
  });
  const standings = buildLeagueStandings(tournament, participants, matches);
  const standingsByParticipantId = new Map<string, any>(standings.map((row: any) => [String(row.participantId), row]));
  const totalMatches = matches.filter((row: any) => row?.player_a_participant_id && row?.player_b_participant_id).length;
  const completedMatches = matches.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length;
  const workflowStatus = totalMatches > 0 && completedMatches >= totalMatches
    ? 'COMPLETED'
    : completedMatches > 0
      ? 'IN_PROGRESS'
      : 'SEEDED';

  for (const participant of participants) {
    const currentStatus = String(participant?.status || '').toUpperCase();
    if (currentStatus === 'WITHDRAWN' || currentStatus === 'DISQUALIFIED') continue;
    const standing = standingsByParticipantId.get(String(participant.id));
    await tx.tournamentParticipant.update({
      where: { id: participant.id },
      data: {
        status: workflowStatus === 'COMPLETED' && standing?.position === 1 ? 'CHAMPION' : 'ACTIVE',
        final_rank: workflowStatus === 'COMPLETED' ? standing?.position || null : null,
      },
    });
  }

  await tx.tournament.update({
    where: { id: tournament.id },
    data: { workflow_status: workflowStatus },
  });

  return standings;
}

export const tournamentsService = {
  async listParticipants(clubId: string, tournamentId: string) {
    await getOwnedTournament(clubId, tournamentId);
    return db.tournamentParticipant.findMany({
      where: { tournament_id: tournamentId },
      orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
      include: {
        member: { select: { id: true, name: true, member_code: true, email: true } },
        signup: { select: { id: true, status: true, createdAt: true } },
      },
    });
  },

  async generateParticipants(clubId: string, tournamentId: string) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    return db.$transaction(async (tx: any) => {
      const existingMatches = await tx.tournamentMatch.count({
        where: { tournament_id: tournamentId },
      });
      if (existingMatches > 0) {
        throw new Error('Schedule already generated; participants cannot be regenerated now');
      }

      const confirmed = await tx.tournamentSignup.findMany({
        where: { tournamentId: tournamentId, status: 'CONFIRMED' },
        orderBy: [{ createdAt: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
        },
      });
      if (confirmed.length === 0) throw new Error('No confirmed signups yet');

      const existing = await tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
      });
      const byMemberId = new Map<string, any>(existing.map((row: any) => [row.member_id, row]));
      for (const signup of confirmed) {
        const current = byMemberId.get(signup.memberId);
        if (current) {
          await tx.tournamentParticipant.update({
            where: { id: current.id },
            data: {
              signup_id: signup.id,
              status: 'ACTIVE',
            },
          });
          continue;
        }
        await tx.tournamentParticipant.create({
          data: {
            id: randomUUID(),
            tournament_id: tournamentId,
            member_id: signup.memberId,
            signup_id: signup.id,
            status: 'ACTIVE',
          },
        });
      }

      await reseedParticipants(tx, tournament);

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { workflow_status: 'REGISTRATION' },
      });

      return tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      });
    });
  },

  async updateParticipantSeed(clubId: string, tournamentId: string, participantId: string, desiredSeedRaw: any) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const desiredSeed = Math.max(1, toInt(desiredSeedRaw, 1));
    return db.$transaction(async (tx: any) => {
      const existingCount = await tx.tournamentMatch.count({ where: { tournament_id: tournamentId } });
      if (existingCount > 0) throw new Error('Schedule already generated; seed cannot be changed now');

      const participants = await tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      });
      if (participants.length === 0) throw new Error('No participants');

      const currentIndex = participants.findIndex((row: any) => row.id === participantId);
      if (currentIndex < 0) throw new Error('Not found');

      const next = [...participants];
      const [target] = next.splice(currentIndex, 1);
      const insertIndex = Math.min(next.length, Math.max(0, desiredSeed - 1));
      next.splice(insertIndex, 0, target);

      for (let index = 0; index < next.length; index += 1) {
        const row = next[index];
        const seed = index + 1;
        if (Number(row.seed || 0) === seed) continue;
        await tx.tournamentParticipant.update({
          where: { id: row.id },
          data: { seed },
        });
      }

      if (normalizeSeedMode(tournament.seed_mode) !== 'MANUAL') {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { seed_mode: 'MANUAL' },
        });
      }

      return tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      });
    });
  },

  async updateSeedMode(clubId: string, tournamentId: string, seedModeRaw: any) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const seedMode = normalizeSeedMode(seedModeRaw);
    return db.$transaction(async (tx: any) => {
      const existingCount = await tx.tournamentMatch.count({ where: { tournament_id: tournamentId } });
      if (existingCount > 0) throw new Error('Schedule already generated; seed mode cannot be changed now');

      const updatedTournament = await tx.tournament.update({
        where: { id: tournamentId },
        data: { seed_mode: seedMode },
      });
      const participants = await reseedParticipants(tx, updatedTournament);
      return { tournament: updatedTournament, participants };
    });
  },

  async bootstrapTestData(clubId: string, tournamentId: string, optionsRaw: any) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const count = Math.max(2, Math.min(64, toInt(optionsRaw?.count, 6)));
    const batchLabel = normalizeMethodZBatchLabel(optionsRaw?.batchLabel);
    const password = normalizeMethodZPassword(optionsRaw?.password);
    const includeParticipants = optionsRaw?.includeParticipants === false ? false : true;
    const includeSchedule = optionsRaw?.includeSchedule === false ? false : true;
    const shouldGenerateParticipants = includeSchedule ? true : includeParticipants;
    const format = normalizeTournamentFormat(tournament.format);

    const [existingSignupCount, existingMatchCount] = await Promise.all([
      db.tournamentSignup.count({ where: { tournamentId } }),
      db.tournamentMatch.count({ where: { tournament_id: tournamentId } }),
    ]);
    const capacity = Math.max(2, toInt(tournament.capacity, 32));
    if (existingSignupCount + count > capacity) {
      throw new Error(`測試會員會超出賽事名額上限（目前 ${existingSignupCount} / ${capacity}）`);
    }
    if ((shouldGenerateParticipants || includeSchedule) && existingMatchCount > 0) {
      throw new Error('現有賽程已存在，請先使用空白賽事或重建賽程後再執行方法 Z');
    }

    const createdMembers = await db.$transaction(async (tx: any) => {
      const nextMembers: Array<{
        id: string;
        name: string;
        email: string;
        memberCode: string;
      }> = [];

      for (let index = 0; index < count; index += 1) {
        const serial = String(index + 1).padStart(2, '0');
        const memberCode = `TZ-${batchLabel}-${serial}`;
        const email = `methodz+${batchLabel.toLowerCase()}-${serial}@local.test`;
        const name = `方法Z測試球手 ${batchLabel}-${serial}`;
        const salt = makeSalt();
        const digest = hashPassword(password, salt);

        const existingMember = await tx.member.findFirst({
          where: {
            OR: [
              { member_code: memberCode },
              { email },
            ],
          },
          select: { id: true },
        });
        if (existingMember) {
          throw new Error(`Batch ${batchLabel} 已存在，請改用另一個批次代號`);
        }

        const memberId = randomUUID();
        await tx.member.create({
          data: {
            id: memberId,
            name,
            email,
            member_code: memberCode,
            member_tier: 'VERIFIED',
            email_verified_at: new Date(),
            password_salt: salt,
            password_hash: digest,
            password_updated_at: new Date(),
            club_name: 'Method Z Test',
          },
        });

        await tx.tournamentSignup.create({
          data: {
            id: randomUUID(),
            tournamentId,
            memberId,
            status: 'CONFIRMED',
          },
        });

        nextMembers.push({
          id: memberId,
          name,
          email,
          memberCode,
        });
      }

      return nextMembers;
    });

    let participants: any[] = [];
    if (shouldGenerateParticipants) {
      participants = await tournamentsService.generateParticipants(clubId, tournamentId);
    }

    let matches: any[] = [];
    if (includeSchedule) {
      matches = format === 'LEAGUE'
        ? await tournamentsService.generateLeagueSchedule(clubId, tournamentId)
        : await tournamentsService.generateKnockoutSchedule(clubId, tournamentId);
    }

    return {
      batchLabel,
      password,
      format,
      createdMembers,
      createdSignupCount: createdMembers.length,
      generatedParticipants: shouldGenerateParticipants,
      generatedSchedule: includeSchedule,
      participantCount: shouldGenerateParticipants ? participants.length : null,
      matchCount: includeSchedule ? matches.length : null,
    };
  },

  async simulateTestProgress(clubId: string, tournamentId: string, operatorMemberId: string, optionsRaw: any) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const mode = String(optionsRaw?.mode || 'FULL').trim().toUpperCase() === 'PARTIAL' ? 'PARTIAL' : 'FULL';
    const targetRound = Math.max(0, toInt(optionsRaw?.targetRound, 0));
    const maxMatches = Math.max(0, toInt(optionsRaw?.maxMatches, 0));
    const generateBreaks = optionsRaw?.generateBreaks === false ? false : true;
    const simulatedMatches: any[] = [];

    for (let safety = 0; safety < 256; safety += 1) {
      const matches = await db.tournamentMatch.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ round_no: 'asc' }, { match_no: 'asc' }],
        include: {
          player_a_participant: { select: { id: true, member_id: true } },
          player_b_participant: { select: { id: true, member_id: true } },
        },
      });

      const remainingAllowance = maxMatches > 0 ? maxMatches - simulatedMatches.length : Number.MAX_SAFE_INTEGER;
      if (remainingAllowance <= 0) break;

      const eligible = matches.filter((match: any) => {
        const status = String(match?.status || '').trim().toUpperCase();
        const roundNo = Number(match?.round_no || 0);
        if (!match?.player_a_participant_id || !match?.player_b_participant_id) return false;
        if (status !== 'READY' && status !== 'LIVE') return false;
        if (mode === 'PARTIAL' && targetRound > 0 && roundNo > targetRound) return false;
        return true;
      });
      if (eligible.length === 0) break;

      let progressed = false;
      for (const match of eligible) {
        if (maxMatches > 0 && simulatedMatches.length >= maxMatches) break;
        const plan = buildMethodZSimulationPlan(match, tournament, generateBreaks);
        await tournamentsService.recordMatchResult(clubId, tournamentId, String(match.id), plan.resultPayload);
        for (const breakPayload of plan.breakPlans) {
          await tournamentsService.addMatchBreak(clubId, tournamentId, String(match.id), operatorMemberId, breakPayload);
        }
        simulatedMatches.push({
          matchId: String(match.id || ''),
          roundNo: Number(match?.round_no || 0),
          matchNo: Number(match?.match_no || 0),
          scoreLabel: plan.summary.scoreLabel,
          winnerSide: plan.summary.winnerSide,
          breakCount: plan.summary.breakCount,
          highestBreak: plan.summary.highestBreak,
        });
        progressed = true;
      }

      if (!progressed || mode === 'PARTIAL') break;
    }

    if (simulatedMatches.length === 0) throw new Error('目前沒有可模擬的對局');
    return {
      mode,
      targetRound: targetRound || null,
      maxMatches: maxMatches || null,
      generateBreaks,
      simulatedCount: simulatedMatches.length,
      simulatedMatches,
    };
  },

  async cleanupTestData(clubId: string, tournamentId: string, optionsRaw: any) {
    await getOwnedTournament(clubId, tournamentId);
    const batchLabel = String(optionsRaw?.batchLabel || '').trim().toUpperCase();
    const removeMembers = optionsRaw?.removeMembers === false ? false : true;

    const signups = await db.tournamentSignup.findMany({
      where: {
        tournamentId,
        member: batchLabel
          ? { member_code: { startsWith: `TZ-${batchLabel}-` } }
          : { member_code: { startsWith: 'TZ-' } },
      },
      include: {
        member: {
          select: { id: true, member_code: true, email: true },
        },
      },
    });
    if (signups.length === 0) {
      throw new Error(batchLabel ? `找不到 batch ${batchLabel} 的方法 Z 測試資料` : '目前賽事找不到方法 Z 測試資料');
    }

    const memberIds = Array.from(new Set<string>(
      signups
        .map((row: any) => String(row?.memberId || row?.member?.id || ''))
        .filter((value: string) => !!value),
    ));
    const detectedBatches = Array.from(new Set<string>(
      signups
        .map((row: any) => parseMethodZBatchLabelFromMemberCode(row?.member?.member_code))
        .filter((value: string) => !!value),
    ));

    return db.$transaction(async (tx: any) => {
      const matches = await tx.tournamentMatch.findMany({
        where: { tournament_id: tournamentId },
        select: { id: true },
      });
      const matchIds = matches
        .map((row: any) => String(row.id || ''))
        .filter((value: string) => !!value);

      let deletedBreakCount = 0;
      let deletedFrameCount = 0;
      let deletedMatchCount = 0;
      if (matchIds.length > 0) {
        deletedBreakCount = await tx.breakRecord.count({
          where: { tournament_match_id: { in: matchIds } },
        });
        deletedFrameCount = await tx.tournamentFrame.count({
          where: { tournament_match_id: { in: matchIds } },
        });
        await tx.breakRecord.deleteMany({
          where: { tournament_match_id: { in: matchIds } },
        });
        await tx.tournamentFrame.deleteMany({
          where: { tournament_match_id: { in: matchIds } },
        });
        const deletedMatches = await tx.tournamentMatch.deleteMany({
          where: { id: { in: matchIds } },
        });
        deletedMatchCount = Number(deletedMatches.count || 0);
      }

      const deletedParticipants = await tx.tournamentParticipant.deleteMany({
        where: {
          tournament_id: tournamentId,
          member_id: { in: memberIds },
        },
      });
      const deletedSignups = await tx.tournamentSignup.deleteMany({
        where: {
          tournamentId,
          memberId: { in: memberIds },
        },
      });

      let deletedMemberCount = 0;
      if (removeMembers) {
        const removableMemberIds: string[] = [];
        for (const memberId of memberIds) {
          const [signupCount, participantCount, breakCount] = await Promise.all([
            tx.tournamentSignup.count({ where: { memberId } }),
            tx.tournamentParticipant.count({ where: { member_id: memberId } }),
            tx.breakRecord.count({ where: { member_id: memberId } }),
          ]);
          if (signupCount === 0 && participantCount === 0 && breakCount === 0) {
            removableMemberIds.push(memberId);
          }
        }
        if (removableMemberIds.length > 0) {
          const deletedMembers = await tx.member.deleteMany({
            where: {
              id: { in: removableMemberIds },
              club_name: 'Method Z Test',
            },
          });
          deletedMemberCount = Number(deletedMembers.count || 0);
        }
      }

      const remainingParticipants = await tx.tournamentParticipant.count({
        where: { tournament_id: tournamentId },
      });
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { workflow_status: remainingParticipants > 0 ? 'REGISTRATION' : 'DRAFT' },
      });

      return {
        batchLabel: batchLabel || null,
        detectedBatches,
        deletedSignupCount: Number(deletedSignups.count || 0),
        deletedParticipantCount: Number(deletedParticipants.count || 0),
        deletedMemberCount,
        deletedMatchCount,
        deletedFrameCount,
        deletedBreakCount,
      };
    });
  },

  async getLeagueStandings(clubId: string, tournamentId: string) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const format = normalizeTournamentFormat(tournament.format);
    if (format !== 'LEAGUE') throw new Error('Tournament format is not LEAGUE');

    const [participants, matches] = await Promise.all([
      db.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      }),
      db.tournamentMatch.findMany({
        where: { tournament_id: tournamentId, stage_code: 'LEAGUE' },
        orderBy: [{ round_no: 'asc' }, { match_no: 'asc' }],
      }),
    ]);

    const standings = buildLeagueStandings(tournament, participants, matches);
    return {
      standings,
      completedMatchCount: matches.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length,
      totalMatchCount: matches.length,
    };
  },

  async generateKnockoutSchedule(clubId: string, tournamentId: string) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const format = normalizeTournamentFormat(tournament.format);
    if (format !== 'KNOCKOUT') throw new Error('Tournament format is not KNOCKOUT');

    return db.$transaction(async (tx: any) => {
      const existingCount = await tx.tournamentMatch.count({ where: { tournament_id: tournamentId } });
      if (existingCount > 0) throw new Error('Schedule already generated');

      const participants = await tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId, status: 'ACTIVE' },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true } },
        },
      });
      if (participants.length < 2) throw new Error('At least 2 active participants required');

      const bracketSize = nextPowerOfTwo(participants.length);
      const hasPreliminaryRound = participants.length !== previousPowerOfTwo(participants.length);
      const totalRounds = Math.ceil(Math.log2(bracketSize));
      const roundOnePairs = pairParticipants(participants, bracketSize);

      const created: any[] = [];
      for (let round = 1; round <= totalRounds; round += 1) {
        const matchCount = bracketSize / (2 ** round);
        for (let matchNo = 1; matchNo <= matchCount; matchNo += 1) {
          const pair = round === 1 ? roundOnePairs[matchNo - 1] : [null, null];
          const [a, b] = pair || [null, null];
          const autoWinner = a && !b ? a.id : (!a && b ? b.id : null);
          const stageCode = round === 1 && hasPreliminaryRound ? 'KNOCKOUT_PRELIM' : 'KNOCKOUT_MAIN';
          const row = await tx.tournamentMatch.create({
            data: {
              id: randomUUID(),
              tournament_id: tournamentId,
              stage_code: stageCode,
              round_no: round,
              match_no: matchNo,
              player_a_participant_id: a?.id || null,
              player_b_participant_id: b?.id || null,
              winner_participant_id: autoWinner,
              status: autoWinner ? 'COMPLETED' : (a && b ? 'READY' : 'PENDING'),
              result_type: autoWinner ? 'BYE' : 'STANDARD',
              best_of_frames: tournament.best_of_frames ?? null,
            },
          });
          created.push(row);
        }
      }

      for (const row of created.filter((item) => Number(item.round_no || 0) === 1 && item.winner_participant_id)) {
        await advanceKnockoutWinner(tx, tournamentId, row, row.winner_participant_id);
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { workflow_status: 'SEEDED' },
      });

      return created;
    });
  },

  async generateLeagueSchedule(clubId: string, tournamentId: string) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const format = normalizeTournamentFormat(tournament.format);
    if (format !== 'LEAGUE') throw new Error('Tournament format is not LEAGUE');

    return db.$transaction(async (tx: any) => {
      const existingCount = await tx.tournamentMatch.count({ where: { tournament_id: tournamentId } });
      if (existingCount > 0) throw new Error('Schedule already generated');

      const participants = await tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId, status: 'ACTIVE' },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true } },
        },
      });
      if (participants.length < 2) throw new Error('At least 2 active participants required');

      const baseRounds = buildLeagueRoundRobinPairs(participants);
      const roundRobinMode = normalizeLeagueRoundRobinMode(tournament.league_round_robin_mode);
      const rounds = roundRobinMode === 'DOUBLE'
        ? [
            ...baseRounds,
            ...baseRounds.map((roundPairs) => roundPairs.map(([a, b]) => [b, a] as [any, any])),
          ]
        : baseRounds;
      const created: any[] = [];
      for (let roundIndex = 0; roundIndex < rounds.length; roundIndex += 1) {
        const roundPairs = rounds[roundIndex] || [];
        let matchNo = 1;
        for (const [a, b] of roundPairs) {
          if (!a || !b) continue;
          const row = await tx.tournamentMatch.create({
            data: {
              id: randomUUID(),
              tournament_id: tournamentId,
              stage_code: 'LEAGUE',
              round_no: roundIndex + 1,
              match_no: matchNo,
              player_a_participant_id: (a as any)?.id || null,
              player_b_participant_id: (b as any)?.id || null,
              status: 'READY',
              result_type: 'STANDARD',
              best_of_frames: tournament.best_of_frames ?? null,
            },
          });
          created.push(row);
          matchNo += 1;
        }
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { workflow_status: 'SEEDED' },
      });

      return created;
    });
  },

  async resetKnockoutSchedule(clubId: string, tournamentId: string) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const format = normalizeTournamentFormat(tournament.format);
    if (format !== 'KNOCKOUT') throw new Error('Tournament format is not KNOCKOUT');

    return db.$transaction(async (tx: any) => {
      const matches = await tx.tournamentMatch.findMany({
        where: { tournament_id: tournamentId },
        select: {
          id: true,
          started_at: true,
          ended_at: true,
        },
      });
      if (matches.length === 0) throw new Error('Schedule not generated yet');

      const matchIds = matches.map((row: any) => String(row.id || '')).filter(Boolean);
      const hasStartedMatch = matches.some((row: any) => row?.started_at || row?.ended_at);
      if (hasStartedMatch) throw new Error('Schedule already started and cannot be reset');

      const framesCount = matchIds.length > 0
        ? await tx.tournamentFrame.count({
            where: { tournament_match_id: { in: matchIds } },
          })
        : 0;
      if (framesCount > 0) throw new Error('Schedule already started and cannot be reset');

      const breaksCount = matchIds.length > 0
        ? await tx.breakRecord.count({
            where: { tournament_match_id: { in: matchIds } },
          })
        : 0;
      if (breaksCount > 0) throw new Error('Schedule already started and cannot be reset');

      if (matchIds.length > 0) {
        await tx.tournamentMatch.deleteMany({
          where: { id: { in: matchIds } },
        });
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { workflow_status: 'REGISTRATION' },
      });

      return tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      });
    });
  },

  async resetLeagueSchedule(clubId: string, tournamentId: string) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const format = normalizeTournamentFormat(tournament.format);
    if (format !== 'LEAGUE') throw new Error('Tournament format is not LEAGUE');

    return db.$transaction(async (tx: any) => {
      const matches = await tx.tournamentMatch.findMany({
        where: { tournament_id: tournamentId, stage_code: 'LEAGUE' },
        select: {
          id: true,
          started_at: true,
          ended_at: true,
        },
      });
      if (matches.length === 0) throw new Error('Schedule not generated yet');

      const matchIds = matches.map((row: any) => String(row.id || '')).filter(Boolean);
      const hasStartedMatch = matches.some((row: any) => row?.started_at || row?.ended_at);
      if (hasStartedMatch) throw new Error('Schedule already started and cannot be reset');

      const framesCount = matchIds.length > 0
        ? await tx.tournamentFrame.count({
            where: { tournament_match_id: { in: matchIds } },
          })
        : 0;
      if (framesCount > 0) throw new Error('Schedule already started and cannot be reset');

      const breaksCount = matchIds.length > 0
        ? await tx.breakRecord.count({
            where: { tournament_match_id: { in: matchIds } },
          })
        : 0;
      if (breaksCount > 0) throw new Error('Schedule already started and cannot be reset');

      if (matchIds.length > 0) {
        await tx.tournamentMatch.deleteMany({
          where: { id: { in: matchIds } },
        });
      }

      await tx.tournamentParticipant.updateMany({
        where: {
          tournament_id: tournamentId,
          status: { in: ['ACTIVE', 'CHAMPION'] },
        },
        data: {
          status: 'ACTIVE',
          final_rank: null,
        },
      });

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { workflow_status: 'REGISTRATION' },
      });

      return tx.tournamentParticipant.findMany({
        where: { tournament_id: tournamentId },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true, email: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      });
    });
  },

  async listMatches(clubId: string, tournamentId: string) {
    await getOwnedTournament(clubId, tournamentId);
    const rows = await db.tournamentMatch.findMany({
      where: { tournament_id: tournamentId },
      orderBy: [{ round_no: 'asc' }, { match_no: 'asc' }],
      include: {
        player_a_participant: {
          include: { member: { select: { id: true, name: true, member_code: true } } },
        },
        player_b_participant: {
          include: { member: { select: { id: true, name: true, member_code: true } } },
        },
        winner_participant: {
          include: { member: { select: { id: true, name: true, member_code: true } } },
        },
        frames: { orderBy: [{ frame_no: 'asc' }] },
        break_records: {
          where: {
            deleted_at: null,
            record_type: 'TOURNAMENT',
          },
          orderBy: [{ frame_no: 'asc' }, { recorded_at: 'desc' }],
          include: {
            member: { select: { id: true, name: true, member_code: true } },
          },
        },
      },
    });
    return rows.map((row: any) => ({
      ...row,
      breaks: Array.isArray(row?.break_records) ? row.break_records : [],
    }));
  },

  async recordMatchResult(clubId: string, tournamentId: string, matchId: string, payload: any) {
    await getOwnedTournament(clubId, tournamentId);
    return db.$transaction(async (tx: any) => {
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
      });
      if (!tournament) throw new Error('Not found');
      const format = normalizeTournamentFormat(tournament.format);
      const match = await tx.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
          player_a_participant: { select: { id: true, member_id: true } },
          player_b_participant: { select: { id: true, member_id: true } },
        },
      });
      if (!match || match.tournament_id !== tournamentId) throw new Error('Not found');
      if (!match.player_a_participant_id || !match.player_b_participant_id) {
        throw new Error('Match is not ready for result entry');
      }
      if (String(match.status || '').toUpperCase() === 'PENDING') {
        throw new Error('Match is still pending players');
      }

      const resultType = normalizeResultType(payload?.resultType);
      if (resultType === 'WALKOVER' || resultType === 'FORFEIT') {
        const winnerSide = String(payload?.winnerSide || '').trim().toUpperCase();
        const winnerParticipantId = winnerSide === 'A'
          ? match.player_a_participant_id
          : winnerSide === 'B'
            ? match.player_b_participant_id
            : null;
        if (!winnerParticipantId) throw new Error('winnerSide required for walkover/forfeit');

        await tx.tournamentFrame.deleteMany({
          where: { tournament_match_id: matchId },
        });
        await tx.breakRecord.deleteMany({
          where: { tournament_match_id: matchId },
        });

        const updated = await tx.tournamentMatch.update({
          where: { id: matchId },
          data: {
            status: 'COMPLETED',
            result_type: resultType,
            started_at: toNullableDate(payload?.startedAt) ?? match.started_at ?? new Date(),
            ended_at: toNullableDate(payload?.endedAt) ?? new Date(),
            winner_participant_id: winnerParticipantId,
            player_a_frames_won: winnerSide === 'A' ? 1 : 0,
            player_b_frames_won: winnerSide === 'B' ? 1 : 0,
            player_a_total_points: 0,
            player_b_total_points: 0,
            player_a_max_break: 0,
            player_b_max_break: 0,
            player_a_20_plus_count: 0,
            player_b_20_plus_count: 0,
          },
        });

        if (format === 'KNOCKOUT') {
          await finalizeKnockoutMatch(tx, tournamentId, updated, winnerParticipantId);
        } else {
          await finalizeLeagueProgress(tx, tournament);
        }

        return tx.tournamentMatch.findUnique({
          where: { id: matchId },
          include: { frames: { orderBy: [{ frame_no: 'asc' }] } },
        });
      }

      const frames = normalizeFrames(payload?.frames);
      if (frames.length === 0) throw new Error('frames required');
      if (frames.some((frame) => !frame.winner_side)) throw new Error('Every frame must have a winner');

      await tx.tournamentFrame.deleteMany({
        where: { tournament_match_id: matchId },
      });

      for (const frame of frames) {
        const winnerParticipantId = frame.winner_side === 'A'
          ? match.player_a_participant_id
          : frame.winner_side === 'B'
            ? match.player_b_participant_id
            : null;
        await tx.tournamentFrame.create({
          data: {
            id: randomUUID(),
            tournament_match_id: matchId,
            frame_no: frame.frame_no,
            winner_participant_id: winnerParticipantId,
            player_a_score: frame.player_a_score,
            player_b_score: frame.player_b_score,
            player_a_highest_break: frame.player_a_highest_break,
            player_b_highest_break: frame.player_b_highest_break,
            started_at: frame.started_at,
            ended_at: frame.ended_at,
          },
        });
      }

      const playerAFramesWon = frames.filter((frame) => frame.winner_side === 'A').length;
      const playerBFramesWon = frames.filter((frame) => frame.winner_side === 'B').length;
      const playerATotalPoints = frames.reduce((sum, frame) => sum + frame.player_a_score, 0);
      const playerBTotalPoints = frames.reduce((sum, frame) => sum + frame.player_b_score, 0);
      const playerAMaxBreakFromFrames = frames.reduce((best, frame) => Math.max(best, frame.player_a_highest_break), 0);
      const playerBMaxBreakFromFrames = frames.reduce((best, frame) => Math.max(best, frame.player_b_highest_break), 0);
      const bestOfFrames = Math.max(1, Math.floor(Number(match.best_of_frames ?? tournament.best_of_frames ?? 1) || 1));
      const targetWins = getTargetWins(bestOfFrames);
      const hasReachedTargetWins = playerAFramesWon >= targetWins || playerBFramesWon >= targetWins;
      const hasUsedAllFrames = frames.length >= bestOfFrames;
      const isMatchCompleted = format === 'KNOCKOUT'
        ? hasReachedTargetWins
        : hasReachedTargetWins || hasUsedAllFrames;
      const winnerParticipantId = playerAFramesWon === playerBFramesWon
        ? null
        : playerAFramesWon > playerBFramesWon
          ? match.player_a_participant_id
          : match.player_b_participant_id;
      if (String(match.status || '').toUpperCase() === 'COMPLETED' && !isMatchCompleted) {
        throw new Error('Completed match cannot be reverted to partial score');
      }
      if (isMatchCompleted && !winnerParticipantId && format === 'KNOCKOUT') throw new Error('Knockout match cannot end in a draw');

      const updated = await tx.tournamentMatch.update({
        where: { id: matchId },
        data: {
          status: isMatchCompleted ? 'COMPLETED' : 'LIVE',
          result_type: 'STANDARD',
          started_at: toNullableDate(payload?.startedAt) ?? match.started_at ?? new Date(),
          ended_at: isMatchCompleted ? (toNullableDate(payload?.endedAt) ?? new Date()) : null,
          winner_participant_id: isMatchCompleted ? winnerParticipantId : null,
          player_a_frames_won: playerAFramesWon,
          player_b_frames_won: playerBFramesWon,
          player_a_total_points: playerATotalPoints,
          player_b_total_points: playerBTotalPoints,
          player_a_max_break: Math.max(Number(match.player_a_max_break || 0), playerAMaxBreakFromFrames),
          player_b_max_break: Math.max(Number(match.player_b_max_break || 0), playerBMaxBreakFromFrames),
        },
      });

      await recomputeMatchBreakStats(tx, matchId);
      if (!isMatchCompleted) {
        await tx.tournament.update({
          where: { id: tournamentId },
          data: { workflow_status: 'IN_PROGRESS' },
        });
      } else if (format === 'KNOCKOUT') {
        await finalizeKnockoutMatch(tx, tournamentId, updated, winnerParticipantId);
      } else {
        await finalizeLeagueProgress(tx, tournament);
      }

      return tx.tournamentMatch.findUnique({
        where: { id: matchId },
        include: { frames: { orderBy: [{ frame_no: 'asc' }] } },
      });
    });
  },

  async addMatchBreak(clubId: string, tournamentId: string, matchId: string, operatorMemberId: string, payload: any) {
    const tournament = await getOwnedTournament(clubId, tournamentId);
    const threshold = Math.max(1, Number(tournament.tracked_break_threshold || 20));
    const memberId = String(payload?.memberId || '').trim();
    const points = Math.floor(Number(payload?.points));
    const frameNo = Math.max(1, toInt(payload?.frameNo, 1));
    const recordedAt = toNullableDate(payload?.recordedAt) ?? new Date();
    const note = payload?.note == null ? null : String(payload.note).trim() || null;

    if (!memberId) throw new Error('memberId required');
    if (!Number.isFinite(points) || points < threshold) throw new Error(`points must be >= ${threshold}`);

    return db.$transaction(async (tx: any) => {
      const match = await tx.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
          player_a_participant: { select: { id: true, member_id: true } },
          player_b_participant: { select: { id: true, member_id: true } },
        },
      });
      if (!match || match.tournament_id !== tournamentId) throw new Error('Not found');

      const allowedMemberIds = new Set([
        match.player_a_participant?.member_id,
        match.player_b_participant?.member_id,
      ].filter(Boolean));
      if (!allowedMemberIds.has(memberId)) throw new Error('memberId not in match');

      const row = await tx.breakRecord.create({
        data: {
          id: randomUUID(),
          club_id: clubId,
          member_id: memberId,
          record_type: 'TOURNAMENT',
          tournament_id: tournamentId,
          tournament_match_id: matchId,
          frame_no: frameNo,
          threshold_snapshot: threshold,
          points,
          recorded_at: recordedAt,
          note,
          created_by_member_id: operatorMemberId,
        },
      });

      const frame = await tx.tournamentFrame.findUnique({
        where: { tournament_match_id_frame_no: { tournament_match_id: matchId, frame_no: frameNo } },
      });
      if (frame) {
        const isA = match.player_a_participant?.member_id === memberId;
        await tx.tournamentFrame.update({
          where: { id: frame.id },
          data: isA
            ? { player_a_highest_break: Math.max(Number(frame.player_a_highest_break || 0), points) }
            : { player_b_highest_break: Math.max(Number(frame.player_b_highest_break || 0), points) },
        });
      }

      await recomputeMatchBreakStats(tx, matchId);
      return row;
    });
  },
};
