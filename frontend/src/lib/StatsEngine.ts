import { RoomStorage, RoomEvent } from './RoomStorage';
import { State } from './State';
import { parseMatchName, normalizeKey } from './matchName';

export interface PlayerStats {
  playerIndex: number;
  totalShots: number;
  potCount: number;
  totalPoints: number;
  potRate: number; // potCount / totalShots
  // 新增：基於 pot 與 miss 的進球成功率
  potSuccessRate: number; // potCount / (potCount + missCount)
  potOverMissRate: number;
  avgShotTimeMs: number;
  // 新增：同一球手連續事件的平均出杆時間（局內平均）
  avgRoundShotTimeMs: number;
  // 新增：以每一次連杆（得分回合）為單位的平均用時
  avgBreakTimeMs: number;
  maxBreakTimeMs: number;
  breakCount: number;
  quickShotCount: number; // shotTimeMs <= 7000
  quickShotRate: number; // quickShotCount / totalShots
  maxBreakPoints: number;
  safeCount: number;
  safeSuccessRate: number;
  safeNumerator: number;
  safeDenominator: number;
  foulCount: number;
  // 新增：本方犯規累計給出的分數
  foulPointsGiven: number;
  // 新增：miss/switch 次數（用於進球成功率與其他比率）
  missCount: number;
  switchCount: number;
  // 新增：紅球/彩球成功率（以狀態機推演 mustPotRed）
  redSuccessRate: number; // red pots / red-required misses
  colorSuccessRate: number; // color pots / color-required misses
  redNumerator: number;
  redDenominator: number;
  colorNumerator: number;
  colorDenominator: number;
  // 新增：上手率與抗壓比率
  entryRate: number; // visits with red then color / visits with single red only
  entrySuccessRate: number; // streak>=4 visits / entryRedPotCount
  entryNumerator: number;
  entryDenominator: number;
  pressureRatio: number; // (pot+safe) / (foul+miss+switch) under pressure
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
  break20_29: number;
  break30_49: number;
  break50_79: number;
  break80_99: number;
  break100_146: number;
  break147: number;
}

export interface MatchStats {
  perPlayer: [PlayerStats, PlayerStats];
  eventsCount: number;
}

function computePerPlayerStatsFromEvents(
  events: RoomEvent[],
  playerIndex: number,
  redBallsInit?: number,
): PlayerStats {
  let totalShots = 0;
  let potCount = 0;
  let totalPoints = 0;
  let totalShotTime = 0;
  let totalRoundShotTime = 0; // 僅同一球手連續事件的時間差
  let totalRoundShotSegments = 0;
  let quickShotCount = 0;
  let maxBreakPoints = 0;
  let currentBreak = 0;
  let _currentBreakPotCount = 0;
  const breaks: number[] = [];
  let currentBreakTimeMs = 0;
  const breakTimesMs: number[] = [];
  let safeCount = 0;
  let foulCount = 0;
  let foulPointsGiven = 0;
  let missCount = 0;
  let switchCount = 0;
  // 狀態機：紅球/彩球要求與紅球餘數
  let redsRemaining = typeof redBallsInit === 'number' ? redBallsInit : 15;
  let mustPotRed = redsRemaining > 0;
  let isFreeBall = false;
  let isClearingColours = false;
  let clearingFreeChoicePending = false; // first color attempt after last red is free-choice
  let redRequiredMisses = 0;
  let colorRequiredMisses = 0;
  // 上手率：以訪問為單位
  let visitSingleRedOnly = 0;
  let visitRedThenColor = 0;
  let inVisit = false;
  let visitHadRed = false;
  let visitHadColor = false;
  let visitFirstEventProcessed = false;
  let visitFirstWasRedPot = false;
  let _visitFirstEntryCounted = false;
  let _visitPotCount = 0;
  let visitPotBallCount = 0; // reds may count >1 per event when using potMultipleReds
  let streak4PlusOnVisit = 0;
  let entryRedPotCount = 0;
  // Visit Duration (Break Time in user terms)
  let currentVisitDuration = 0;
  const visitDurations: number[] = [];

  // 抗壓比率：需要動態比分
  let scoreA = 0;
  let scoreB = 0;
  const isPressure = () => (redsRemaining < 2) && (Math.abs(scoreA - scoreB) < 5);
  let pressurePlus = 0; // pot + safe（在壓力區）
  let pressureMinus = 0; // foul + miss + switch（在壓力區）

  const potByBall = {
    red: 0,
    yellow: 0,
    green: 0,
    brown: 0,
    blue: 0,
    pink: 0,
    black: 0,
  };
  const shotTimeBuckets = [0, 0, 0, 0];
  let prevEventPlayerIndex: number | null = null;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    // 動態比分（用於抗壓判定）
    if (e.type === 'pot') {
      if (e.playerIndex === 0) scoreA += (e.points || 0);
      else scoreB += (e.points || 0);
    } else if (e.type === 'foul') {
      // 犯規分數記在對手身上
      if (e.playerIndex === 0) scoreB += (e.points || 0);
      else scoreA += (e.points || 0);
    }

    // When opponent commits a foul, the current player gains the penalty points
    if (e.playerIndex !== playerIndex) {
      if (e.type === 'foul') {
        totalPoints += e.points || 0;
      }
      // Break resets when turn changes
      if (currentBreak > maxBreakPoints) maxBreakPoints = currentBreak;
      if (currentBreak > 0) {
        breaks.push(currentBreak);
        breakTimesMs.push(currentBreakTimeMs);
      }
      currentBreak = 0;
      _currentBreakPotCount = 0;
      currentBreakTimeMs = 0;
      // 訪問切換：若先前在本方訪問中，完成結算
      if (inVisit) {
        if (visitPotBallCount >= 4) streak4PlusOnVisit++;
        if (visitHadRed) {
          if (visitHadColor) visitRedThenColor++;
          else visitSingleRedOnly++;
        }
        if (currentVisitDuration > 0) {
          visitDurations.push(currentVisitDuration);
          currentVisitDuration = 0;
        }
        inVisit = false; visitHadRed = false; visitHadColor = false;
        visitFirstEventProcessed = false; visitFirstWasRedPot = false; _visitFirstEntryCounted = false; _visitPotCount = 0; visitPotBallCount = 0;
      }
      prevEventPlayerIndex = e.playerIndex;
      continue;
    }
    // Count as a shot for time-based metrics
    totalShots++;
    const dt = typeof e.shotTimeMs === 'number' ? e.shotTimeMs : 0;
    if (dt > 0) {
      totalShotTime += dt;
      currentVisitDuration += dt; // Accumulate visit duration
      if (dt <= 7000) quickShotCount++;
      const s = dt / 1000;
      if (s <= 5) shotTimeBuckets[0]++;
      else if (s <= 10) shotTimeBuckets[1]++;
      else if (s <= 20) shotTimeBuckets[2]++;
      else shotTimeBuckets[3]++;
      // 局內平均（同一球手連續事件）
      if (prevEventPlayerIndex === playerIndex) {
        totalRoundShotTime += dt;
        totalRoundShotSegments++;
      }
    }

    if (e.type === 'pot') {
      const wasFreeBallPot = isFreeBall;
      potCount++;
      totalPoints += e.points || 0;
      currentBreak += e.points || 0;
      _currentBreakPotCount++;
      _visitPotCount++;
      if (dt > 0) {
        currentBreakTimeMs += dt;
      }
      // Count balls potted in this event (multi-red support)
      const ballsPotted = e.ballName === 'red' ? Math.max(1, Math.floor(e.points || 1)) : 1;
      visitPotBallCount += ballsPotted;
      if (e.ballName && potByBall[e.ballName] !== undefined) {
        // TypeScript treats potByBall as readonly via const assertion; copy and increment
        potByBall[e.ballName]++;
      }
      // 狀態機更新：紅/彩
      if (isFreeBall) {
        // 自由球後必須接彩
        mustPotRed = false;
        isFreeBall = false;
      } else if (e.ballName === 'red') {
        // potMultipleReds：points 可能代表一桿 N 顆紅
        const redsPotted = Math.max(1, Math.floor(e.points || 1));
        redsRemaining = Math.max(0, redsRemaining - redsPotted);
        mustPotRed = false;
        visitHadRed = true;
        if (redsRemaining === 0) {
          isClearingColours = true;
          clearingFreeChoicePending = true;
        }
      } else {
        // 彩球
        visitHadColor = true;
        if (redsRemaining > 0) {
          mustPotRed = true;
        } else {
          // 進入清彩階段：若仍有一次自由選彩機會，先消耗，不進入序列
          if (isClearingColours && clearingFreeChoicePending) {
            clearingFreeChoicePending = false;
          } else {
            isClearingColours = true;
          }
        }
      }
      if (!visitFirstEventProcessed) {
        visitFirstEventProcessed = true;
        visitFirstWasRedPot = e.ballName === 'red';
        const isEntryPot = visitFirstWasRedPot || (wasFreeBallPot && !isClearingColours);
        _visitFirstEntryCounted = isEntryPot;
        if (isEntryPot) entryRedPotCount++;
      }
    } else {
      if (currentBreak > 0 && dt > 0) {
        currentBreakTimeMs += dt;
      }
      // Non-pot by same player ends break
      if (currentBreak > maxBreakPoints) maxBreakPoints = currentBreak;
      if (currentBreak > 0) {
        breaks.push(currentBreak);
        breakTimesMs.push(currentBreakTimeMs);
      }
      currentBreak = 0;
      _currentBreakPotCount = 0;
      currentBreakTimeMs = 0;
      if (!visitFirstEventProcessed) {
        visitFirstEventProcessed = true;
        visitFirstWasRedPot = false;
        _visitFirstEntryCounted = false;
      }
    }

    if (e.type === 'safe') {
      safeCount++;
      // 抗壓加分
      if (isPressure()) pressurePlus++;
    }
    if (e.type === 'foul') {
      foulCount++;
      foulPointsGiven += (e.points || 0);
      // 抗壓減分
      if (isPressure()) pressureMinus++;
      // 若紅球因犯規已耗盡，下一桿直接按清彩序（不享自由選彩）
      if (redsRemaining === 0) {
        isClearingColours = true;
        clearingFreeChoicePending = false;
      }
    }
    if (e.type === 'miss') {
      missCount++;
      // 依狀態機判定 miss 的分母歸屬（包含清彩階段）
      if (redsRemaining > 0) {
        if (mustPotRed) redRequiredMisses++;
        else colorRequiredMisses++;
      } else {
        // 清彩階段任何未進球均屬彩球失誤
        colorRequiredMisses++;
      }
      // 訪問結束
      if (visitPotBallCount >= 4) streak4PlusOnVisit++;
      if (visitHadRed) {
        if (visitHadColor) visitRedThenColor++;
        else visitSingleRedOnly++;
      }
      if (currentVisitDuration > 0) {
        visitDurations.push(currentVisitDuration);
        currentVisitDuration = 0;
      }
      inVisit = false; visitHadRed = false; visitHadColor = false;
      visitFirstEventProcessed = false; visitFirstWasRedPot = false; _visitFirstEntryCounted = false; _visitPotCount = 0; visitPotBallCount = 0;
      // 清除最後紅後的一次自由選彩機會
      if (redsRemaining === 0 && isClearingColours && clearingFreeChoicePending) {
        clearingFreeChoicePending = false;
      }
      // 抗壓減分
      if (isPressure()) pressureMinus++;
    }
    if (e.type === 'switch') {
      switchCount++;
      // 訪問結束
      if (visitPotBallCount >= 4) streak4PlusOnVisit++;
      if (visitHadRed) {
        if (visitHadColor) visitRedThenColor++;
        else visitSingleRedOnly++;
      }
      if (inVisit && currentBreakTimeMs > 0) {
        breakTimesMs.push(currentBreakTimeMs);
        currentBreakTimeMs = 0;
      }
      if (currentVisitDuration > 0) {
        visitDurations.push(currentVisitDuration);
        currentVisitDuration = 0;
      }
      // 切換球手亦終止自由選彩機會
      if (redsRemaining === 0 && isClearingColours && clearingFreeChoicePending) {
        clearingFreeChoicePending = false;
      }
      inVisit = false; visitHadRed = false; visitHadColor = false;
      visitFirstEventProcessed = false; visitFirstWasRedPot = false; _visitFirstEntryCounted = false; _visitPotCount = 0; visitPotBallCount = 0;
      // 抗壓減分
      if (isPressure()) pressureMinus++;
    }
    if (e.type === 'freeBallToggle') {
      isFreeBall = !isFreeBall;
    }

    // 進入訪問（當前事件屬於本方，且先前非本方或起始）
    if (!inVisit && prevEventPlayerIndex !== playerIndex) {
      inVisit = true;
      visitHadRed = false;
      visitHadColor = false;
      visitFirstEventProcessed = false;
      visitFirstWasRedPot = false;
      _visitFirstEntryCounted = false;
      _visitPotCount = 0;
      visitPotBallCount = 0;
    }
    prevEventPlayerIndex = playerIndex;
  }
  if (currentBreak > maxBreakPoints) maxBreakPoints = currentBreak;
  if (currentBreak > 0) {
    breaks.push(currentBreak);
    breakTimesMs.push(currentBreakTimeMs);
  }
  // 訪問掃描結尾結算
  if (inVisit && visitHadRed) {
    if (visitHadColor) visitRedThenColor++;
    else visitSingleRedOnly++;
  }
  if (inVisit && visitPotBallCount >= 4) streak4PlusOnVisit++;

  const potRate = totalShots ? potCount / totalShots : 0;
  const avgShotTimeMs = totalShots ? totalShotTime / totalShots : 0;
  const quickShotRate = totalShots ? quickShotCount / totalShots : 0;
  const potSuccessRate = (potCount + missCount) ? (potCount / (potCount + missCount)) : 0;
  const potOverMissRate = missCount ? (potCount / missCount) : (potCount > 0 ? 1 : 0);
  const avgRoundShotTimeMs = totalRoundShotSegments ? (totalRoundShotTime / totalRoundShotSegments) : 0;
  const redPotTotal = potByBall.red;
  const redDenominatorFinal = redPotTotal + redRequiredMisses;
  const redSuccessRate = redDenominatorFinal ? (redPotTotal / redDenominatorFinal) : 0;
  const colorPotTotal = potByBall.yellow + potByBall.green + potByBall.brown + potByBall.blue + potByBall.pink + potByBall.black;
  const colorDenominatorFinal = colorPotTotal + colorRequiredMisses;
  const colorSuccessRate = colorDenominatorFinal ? (colorPotTotal / colorDenominatorFinal) : 0;
  const entryRate = visitSingleRedOnly ? (visitRedThenColor / visitSingleRedOnly) : 0;
  const entryAttemptsFinal = streak4PlusOnVisit + entryRedPotCount;
  const entrySuccessRate = entryAttemptsFinal ? (streak4PlusOnVisit / entryAttemptsFinal) : 0;
  const pressureRatio = pressureMinus ? (pressurePlus / pressureMinus) : 0;
  let break20_29 = 0, break30_49 = 0, break50_79 = 0, break80_99 = 0, break100_146 = 0, break147 = 0;
  for (const b of breaks) {
    if (b >= 20 && b <= 29) break20_29++;
    else if (b >= 30 && b <= 49) break30_49++;
    else if (b >= 50 && b <= 79) break50_79++;
    else if (b >= 80 && b <= 99) break80_99++;
    else if (b >= 100 && b <= 146) break100_146++;
    else if (b === 147) break147++;
  }
  let totalBreakTimeMs = 0;
  let maxBreakTimeMs = 0;
  // Use visitDurations for Break Time stats as per user definition (Switch-to-Switch)
  for (const t of visitDurations) {
    totalBreakTimeMs += t;
    if (t > maxBreakTimeMs) maxBreakTimeMs = t;
  }
  const visitCount = visitDurations.length;
  const avgBreakTimeMs = visitCount ? (totalBreakTimeMs / visitCount) : 0;
  const breakCount = breakTimesMs.length; // Keep tracking scoring breaks for count
  const safeDenominatorFinal = potCount + missCount;
  const safeSuccessRate = safeDenominatorFinal ? (safeCount / safeDenominatorFinal) : (safeCount > 0 ? 1 : 0);

  return {
    playerIndex,
    totalShots,
    potCount,
    totalPoints,
    potRate,
    potSuccessRate,
    potOverMissRate,
    avgShotTimeMs,
    avgRoundShotTimeMs,
    avgBreakTimeMs,
    maxBreakTimeMs,
    breakCount,
    quickShotCount,
    quickShotRate,
    maxBreakPoints,
  safeCount,
  safeSuccessRate,
  safeNumerator: safeCount,
  safeDenominator: safeDenominatorFinal,
    foulCount,
    foulPointsGiven,
    missCount,
    switchCount,
    redSuccessRate,
    colorSuccessRate,
    redNumerator: redPotTotal,
    redDenominator: redRequiredMisses,
    colorNumerator: colorPotTotal,
    colorDenominator: colorRequiredMisses,
    entryRate,
    entrySuccessRate,
    entryNumerator: streak4PlusOnVisit,
    entryDenominator: entryAttemptsFinal,
    pressureRatio,
    potByBall: potByBall,
    shotTimeBuckets,
    break20_29,
    break30_49,
    break50_79,
    break80_99,
    break100_146,
    break147,
  };
}

export const StatsEngine = {
  // Fallback-aware compute: prefer RoomStorage events; if empty and state provided, derive from state
  compute(roomId: string, gameState?: State | null): MatchStats {
    let events: RoomEvent[] = [];
    const stored = RoomStorage.getEvents(roomId) || [];
    if (stored.length > 0) {
      events = stored;
    } else if (gameState) {
      const shots = gameState.shotHistory || [];
      const derived: RoomEvent[] = [];
      let lastTs = shots.length ? (shots[0].timestamp || Date.now()) : Date.now();
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i] as any;
        const ts = typeof s.timestamp === 'number' ? s.timestamp : (lastTs + 1);
        const shotTimeMs = Math.max(0, ts - lastTs);
        lastTs = ts;
        const ev: RoomEvent = {
          type: (s.type === 'safety' ? 'safe' : s.type),
          playerIndex: s.player,
          playerMemberId: gameState.players[s.player]?.memberId || `P${s.player+1}`,
          ballName: s.ball,
          points: typeof s.points === 'number' ? s.points : 0,
          timestamp: ts,
          shotTimeMs,
        } as any;
        derived.push(ev);
        if (s.type === 'safety' || s.type === 'miss' || s.type === 'foul') {
          const sw: RoomEvent = {
            type: 'switch',
            playerIndex: s.player,
            playerMemberId: gameState.players[s.player]?.memberId || `P${s.player+1}`,
            timestamp: ts + 1,
            shotTimeMs: 1,
          } as any;
          derived.push(sw);
        }
      }
      derived.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      events = derived;
    } else {
      events = [];
    }
    const redBalls = gameState?.settings.redBalls;
    const p0 = computePerPlayerStatsFromEvents(events, 0, redBalls);
    const p1 = computePerPlayerStatsFromEvents(events, 1, redBalls);
    return { perPlayer: [p0, p1], eventsCount: events.length };
  },

  buildMatchRecord(roomId: string, gameState: State | null) {
    const events = RoomStorage.getEvents(roomId);
    const foulTotals = RoomStorage.getFoulTotals(roomId);
    const stats = this.compute(roomId, gameState);
    const startTs = events[0]?.timestamp ?? null;
    const endTs = events[events.length - 1]?.timestamp ?? null;
    let winnerIndex: number | null = null;
    if (gameState) {
      const totalRequired = gameState.settings.framesRequired;
      const a = gameState.players[0].framesWon;
      const b = gameState.players[1].framesWon;
      if (totalRequired % 2 === 0) {
        if ((a + b) >= totalRequired) {
          winnerIndex = a === b ? null : (a > b ? 0 : 1);
        }
      } else {
        // 憟撅嚗??憭撅??
        const framesToWin = Math.ceil(totalRequired / 2);
        if (a >= framesToWin) winnerIndex = 0;
        else if (b >= framesToWin) winnerIndex = 1;
        else winnerIndex = null;
      }
    }

    const nameRaw = gameState ? (gameState.settings.matchName || '') : '';
    const { namePart, codePart } = parseMatchName(nameRaw);
    const matchKeyNormalized = normalizeKey(namePart);

    return {
      roomId,
      match: gameState ? {
        name: gameState.settings.matchName,
        namePart: gameState.settings.matchNamePart ?? (namePart || null),
        matchKeyNormalized: gameState.settings.matchKeyNormalized ?? matchKeyNormalized,
        matchCode: gameState.settings.matchCode ?? (codePart || null),
        framesRequired: gameState.settings.framesRequired,
        redBalls: gameState.settings.redBalls,
        handicaps: gameState.settings.handicaps,
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
