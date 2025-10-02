import { RoomStorage } from './RoomStorage';
import { State } from './State';

export interface PlayerStats {
  playerIndex: number;
  totalShots: number;
  potCount: number;
  totalPoints: number;
  potRate: number; // potCount / totalShots
  avgShotTimeMs: number;
  quickShotCount: number; // shotTimeMs <= 7000
  quickShotRate: number; // quickShotCount / totalShots
  maxBreakPoints: number;
  safeCount: number;
  safeSuccessRate: number; // safe → opponent next miss/foul
  foulCount: number;
  potByBall: {
    red: number;
    yellow: number;
    green: number;
    brown: number;
    blue: number;
    pink: number;
    black: number;
  };
  shotTimeBuckets: number[]; // [0-5s, 5-10s, 10-20s, >20s]
}

export interface MatchStats {
  perPlayer: [PlayerStats, PlayerStats];
  eventsCount: number;
}

function computePerPlayerStats(roomId: string, playerIndex: number): PlayerStats {
  const events = RoomStorage.getEvents(roomId);
  let totalShots = 0;
  let potCount = 0;
  let totalPoints = 0;
  let totalShotTime = 0;
  let quickShotCount = 0;
  let maxBreakPoints = 0;
  let currentBreak = 0;
  let safeCount = 0;
  let safeSuccess = 0;
  let foulCount = 0;
  const potByBall = {
    red: 0,
    yellow: 0,
    green: 0,
    brown: 0,
    blue: 0,
    pink: 0,
    black: 0,
  } as const;
  const shotTimeBuckets = [0, 0, 0, 0];

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.playerIndex !== playerIndex) {
      // Break resets when turn changes
      if (currentBreak > maxBreakPoints) maxBreakPoints = currentBreak;
      currentBreak = 0;
      continue;
    }
    // Count as a shot for time-based metrics
    totalShots++;
    if (typeof e.shotTimeMs === 'number') {
      totalShotTime += e.shotTimeMs;
      if (e.shotTimeMs <= 7000) quickShotCount++;
      const s = e.shotTimeMs / 1000;
      if (s <= 5) shotTimeBuckets[0]++;
      else if (s <= 10) shotTimeBuckets[1]++;
      else if (s <= 20) shotTimeBuckets[2]++;
      else shotTimeBuckets[3]++;
    }

    if (e.type === 'pot') {
      potCount++;
      totalPoints += e.points || 0;
      currentBreak += e.points || 0;
      if (e.ballName && potByBall[e.ballName] !== undefined) {
        // TypeScript treats potByBall as readonly via const assertion; copy and increment
        (potByBall as any)[e.ballName]++;
      }
    } else {
      // Non-pot by same player ends break
      if (currentBreak > maxBreakPoints) maxBreakPoints = currentBreak;
      currentBreak = 0;
    }

    if (e.type === 'safe') {
      safeCount++;
      // Check opponent next event outcome
      const next = events[i + 1];
      if (next && next.playerIndex !== playerIndex && (next.type === 'miss' || next.type === 'foul')) {
        safeSuccess++;
      }
    }
    if (e.type === 'foul') {
      foulCount++;
    }
  }
  if (currentBreak > maxBreakPoints) maxBreakPoints = currentBreak;

  const potRate = totalShots ? potCount / totalShots : 0;
  const avgShotTimeMs = totalShots ? totalShotTime / totalShots : 0;
  const quickShotRate = totalShots ? quickShotCount / totalShots : 0;

  return {
    playerIndex,
    totalShots,
    potCount,
    totalPoints,
    potRate,
    avgShotTimeMs,
    quickShotCount,
    quickShotRate,
    maxBreakPoints,
    safeCount,
    safeSuccessRate: safeCount ? safeSuccess / safeCount : 0,
    foulCount,
    potByBall: potByBall as any,
    shotTimeBuckets,
  };
}

export const StatsEngine = {
  compute(roomId: string): MatchStats {
    const events = RoomStorage.getEvents(roomId);
    const p0 = computePerPlayerStats(roomId, 0);
    const p1 = computePerPlayerStats(roomId, 1);
    return { perPlayer: [p0, p1], eventsCount: events.length };
  },

  buildMatchRecord(roomId: string, gameState: State | null) {
    const events = RoomStorage.getEvents(roomId);
    const foulTotals = RoomStorage.getFoulTotals(roomId);
    const stats = this.compute(roomId);
    const startTs = events[0]?.timestamp ?? null;
    const endTs = events[events.length - 1]?.timestamp ?? null;
    const winnerIndex = gameState
      ? (gameState.players[0].framesWon >= gameState.settings.framesRequired
          ? 0
          : (gameState.players[1].framesWon >= gameState.settings.framesRequired ? 1 : null))
      : null;

    return {
      roomId,
      match: gameState ? {
        name: gameState.settings.matchName,
        framesRequired: gameState.settings.framesRequired,
        redBalls: gameState.settings.redBalls,
      } : null,
      players: gameState ? gameState.players.map(p => ({
        name: p.name,
        memberId: p.memberId,
        framesWon: p.framesWon,
        score: p.score,
      })) : [],
      winnerIndex,
      timestamps: { start: startTs, end: endTs },
      foulTotals,
      stats,
      events,
      version: 1,
    };
  },
};