import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';

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

  await tx.tournamentMatch.update({
    where: { id: matchId },
    data: {
      player_a_20_plus_count: a.count,
      player_b_20_plus_count: b.count,
      player_a_max_break: Math.max(Number(match.player_a_max_break || 0), a.max),
      player_b_max_break: Math.max(Number(match.player_b_max_break || 0), b.max),
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

      const rounds = buildLeagueRoundRobinPairs(participants);
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
    return db.tournamentMatch.findMany({
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
        breaks: {
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
      const winnerParticipantId = playerAFramesWon === playerBFramesWon
        ? null
        : playerAFramesWon > playerBFramesWon
          ? match.player_a_participant_id
          : match.player_b_participant_id;
      if (!winnerParticipantId && format === 'KNOCKOUT') throw new Error('Knockout match cannot end in a draw');

      const updated = await tx.tournamentMatch.update({
        where: { id: matchId },
        data: {
          status: 'COMPLETED',
          result_type: 'STANDARD',
          started_at: toNullableDate(payload?.startedAt) ?? match.started_at ?? new Date(),
          ended_at: toNullableDate(payload?.endedAt) ?? new Date(),
          winner_participant_id: winnerParticipantId,
          player_a_frames_won: playerAFramesWon,
          player_b_frames_won: playerBFramesWon,
          player_a_total_points: playerATotalPoints,
          player_b_total_points: playerBTotalPoints,
          player_a_max_break: Math.max(Number(match.player_a_max_break || 0), playerAMaxBreakFromFrames),
          player_b_max_break: Math.max(Number(match.player_b_max_break || 0), playerBMaxBreakFromFrames),
        },
      });

      await recomputeMatchBreakStats(tx, matchId);
      if (format === 'KNOCKOUT') {
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
