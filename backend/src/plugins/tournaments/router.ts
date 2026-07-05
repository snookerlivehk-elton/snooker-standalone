import express from 'express';
import { randomUUID } from 'crypto';
import { getMyClubId, requireClubAdmin, requireMember, requireMemberCapability } from '../../core/club/access.js';
import { prisma } from '../../core/db/prisma.js';
import { getTournamentsModuleSettings } from '../../core/modules/tournamentsSettings.js';
import { buildWebAppUrl, sendEmailIfConfigured } from '../../core/notifications/email.js';
import { buildLeagueStandings, tournamentsService } from './service.js';

function escapeHtml(value: any) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDisplayDateTime(value: any) {
  if (!value) return '待定';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '待定';
  return new Intl.DateTimeFormat('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Hong_Kong',
  }).format(date);
}

function formatMemberLabel(member: any) {
  const code = String(member?.member_code || '').trim();
  const name = String(member?.name || '').trim();
  return [code, name].filter(Boolean).join(' ') || '未命名會員';
}

function getLeagueParticipantMatchResultKey(match: any, targetParticipantId: string) {
  const resultType = String(match?.result_type || 'STANDARD').trim().toUpperCase();
  const winnerParticipantId = String(match?.winner_participant_id || '').trim();
  if (resultType === 'BYE') return 'BYE';
  if (!winnerParticipantId) return 'DRAW';
  return winnerParticipantId === targetParticipantId ? 'WIN' : 'LOSS';
}

function buildLeagueParticipantRoundLabel(match: any) {
  const roundNo = Number(match?.round_no || 0);
  return roundNo > 0 ? `第 ${roundNo} 輪` : 'League';
}

function buildPublicLeagueParticipantDetail(options: {
  tournament: any;
  participant: any;
  standings: any[];
  matches: any[];
}) {
  const { tournament, participant, standings, matches } = options;
  const participantId = String(participant?.id || '').trim();
  const memberId = String(participant?.member_id || participant?.member?.id || '').trim();
  const standing = standings.find((row: any) => String(row?.participantId || '') === participantId) || null;

  const participantMatches = matches
    .filter((match: any) => (
      String(match?.player_a_participant_id || '') === participantId
      || String(match?.player_b_participant_id || '') === participantId
    ))
    .map((match: any) => {
      const isA = String(match?.player_a_participant_id || '') === participantId;
      const opponent = isA ? match?.player_b_participant : match?.player_a_participant;
      const resultKey = getLeagueParticipantMatchResultKey(match, participantId);
      const breaks = (Array.isArray(match?.break_records) ? match.break_records : [])
        .filter((row: any) => String(row?.member_id || row?.member?.id || '') === memberId)
        .map((row: any) => ({
          id: String(row?.id || ''),
          frameNo: row?.frame_no == null ? null : Number(row.frame_no || 0),
          points: Number(row?.points || 0),
          recordedAt: row?.recorded_at ?? null,
          note: row?.note ? String(row.note) : null,
          opponent: opponent?.member ? {
            id: String(opponent.member.id || ''),
            name: String(opponent.member.name || ''),
            memberCode: String(opponent.member.member_code || ''),
          } : null,
          roundLabel: buildLeagueParticipantRoundLabel(match),
          matchId: String(match?.id || ''),
        }));
      return {
        id: String(match?.id || ''),
        roundNo: Number(match?.round_no || 0),
        roundLabel: buildLeagueParticipantRoundLabel(match),
        matchNo: Number(match?.match_no || 0),
        resultType: String(match?.result_type || 'STANDARD').trim().toUpperCase(),
        resultKey,
        resultLabel:
          resultKey === 'WIN'
            ? '勝'
            : resultKey === 'LOSS'
              ? '負'
              : resultKey === 'BYE'
                ? '輪空'
                : '和',
        status: String(match?.status || '').trim().toUpperCase(),
        scheduledAt: match?.scheduled_at ?? null,
        startedAt: match?.started_at ?? null,
        endedAt: match?.ended_at ?? null,
        framesWon: Number(isA ? match?.player_a_frames_won || 0 : match?.player_b_frames_won || 0),
        framesLost: Number(isA ? match?.player_b_frames_won || 0 : match?.player_a_frames_won || 0),
        totalPoints: Number(isA ? match?.player_a_total_points || 0 : match?.player_b_total_points || 0),
        totalPointsAgainst: Number(isA ? match?.player_b_total_points || 0 : match?.player_a_total_points || 0),
        maxBreak: Number(isA ? match?.player_a_max_break || 0 : match?.player_b_max_break || 0),
        breaks20Plus: Number(isA ? match?.player_a_20_plus_count || 0 : match?.player_b_20_plus_count || 0),
        opponent: opponent?.member ? {
          id: String(opponent.member.id || ''),
          name: String(opponent.member.name || ''),
          memberCode: String(opponent.member.member_code || ''),
          participantId: String(opponent?.id || ''),
        } : null,
        breaks,
      };
    })
    .sort((a: any, b: any) => {
      if (a.roundNo !== b.roundNo) return a.roundNo - b.roundNo;
      return a.matchNo - b.matchNo;
    });

  const breakRows = participantMatches
    .flatMap((match: any) => match.breaks)
    .sort((a: any, b: any) => {
      const aTime = a?.recordedAt ? new Date(String(a.recordedAt)).getTime() : 0;
      const bTime = b?.recordedAt ? new Date(String(b.recordedAt)).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return Number(b?.points || 0) - Number(a?.points || 0);
    });

  const completedMatches = participantMatches.filter((match: any) => String(match?.status || '') === 'COMPLETED');

  const summary = participantMatches.reduce((acc: any, match: any) => {
    if (match.resultKey === 'WIN') acc.wins += 1;
    else if (match.resultKey === 'LOSS') acc.losses += 1;
    else if (match.resultKey === 'DRAW') acc.draws += 1;
    acc.totalPoints += Number(match?.totalPoints || 0);
    acc.totalPointsAgainst += Number(match?.totalPointsAgainst || 0);
    acc.highestBreak = Math.max(acc.highestBreak, Number(match?.maxBreak || 0));
    acc.breaks20Plus += Number(match?.breaks20Plus || 0);
    acc.played += String(match?.status || '') === 'COMPLETED' ? 1 : 0;
    return acc;
  }, {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    totalPoints: 0,
    totalPointsAgainst: 0,
    highestBreak: 0,
    breaks20Plus: 0,
  });

  const completedMatchCount = Math.max(0, Number(summary.played || 0));
  const avgPointsPerMatch = completedMatchCount > 0 ? summary.totalPoints / completedMatchCount : 0;
  const avgBreaks20PlusPerMatch = completedMatchCount > 0 ? summary.breaks20Plus / completedMatchCount : 0;

  const recentForm = [...completedMatches]
    .sort((a: any, b: any) => {
      const aTime = a?.endedAt
        ? new Date(String(a.endedAt)).getTime()
        : a?.startedAt
          ? new Date(String(a.startedAt)).getTime()
          : a?.scheduledAt
            ? new Date(String(a.scheduledAt)).getTime()
            : 0;
      const bTime = b?.endedAt
        ? new Date(String(b.endedAt)).getTime()
        : b?.startedAt
          ? new Date(String(b.startedAt)).getTime()
          : b?.scheduledAt
            ? new Date(String(b.scheduledAt)).getTime()
            : 0;
      if (aTime !== bTime) return bTime - aTime;
      if (a.roundNo !== b.roundNo) return b.roundNo - a.roundNo;
      return b.matchNo - a.matchNo;
    })
    .slice(0, 5)
    .map((match: any) => ({
      id: match.id,
      roundLabel: match.roundLabel,
      opponent: match.opponent,
      resultKey: match.resultKey,
      resultLabel: match.resultLabel,
      framesWon: match.framesWon,
      framesLost: match.framesLost,
      totalPoints: match.totalPoints,
      totalPointsAgainst: match.totalPointsAgainst,
      maxBreak: match.maxBreak,
      breaks20Plus: match.breaks20Plus,
      endedAt: match.endedAt,
    }));

  const opponentStatsMap = new Map<string, any>();
  for (const match of participantMatches) {
    const opponentKey = String(match?.opponent?.participantId || match?.opponent?.id || 'BYE');
    const existing = opponentStatsMap.get(opponentKey) || {
      opponent: match?.opponent || null,
      played: 0,
      completed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      totalPoints: 0,
      totalPointsAgainst: 0,
      highestBreak: 0,
      breaks20Plus: 0,
    };
    existing.played += 1;
    if (match.resultKey === 'WIN') existing.wins += 1;
    else if (match.resultKey === 'LOSS') existing.losses += 1;
    else if (match.resultKey === 'DRAW') existing.draws += 1;
    if (String(match?.status || '') === 'COMPLETED') existing.completed += 1;
    existing.totalPoints += Number(match?.totalPoints || 0);
    existing.totalPointsAgainst += Number(match?.totalPointsAgainst || 0);
    existing.highestBreak = Math.max(existing.highestBreak, Number(match?.maxBreak || 0));
    existing.breaks20Plus += Number(match?.breaks20Plus || 0);
    opponentStatsMap.set(opponentKey, existing);
  }

  const opponentStats = Array.from(opponentStatsMap.values())
    .map((row: any) => ({
      ...row,
      avgPointsPerMatch: row.completed > 0 ? row.totalPoints / row.completed : 0,
      avgBreaks20PlusPerMatch: row.completed > 0 ? row.breaks20Plus / row.completed : 0,
      pointsDiff: row.totalPoints - row.totalPointsAgainst,
    }))
    .sort((a: any, b: any) => {
      if (b.completed !== a.completed) return b.completed - a.completed;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
      return String(a?.opponent?.name || '').localeCompare(String(b?.opponent?.name || ''));
    });

  return {
    tournament: {
      id: String(tournament?.id || ''),
      title: String(tournament?.title || ''),
      format: 'LEAGUE',
      startsAt: tournament?.startsAt ?? null,
      workflowStatus: String(tournament?.workflow_status || ''),
      status: String(tournament?.status || ''),
      club: tournament?.club || null,
    },
    participant: {
      id: participantId,
      memberId,
      seed: participant?.seed ?? null,
      status: String(participant?.status || ''),
      finalRank: participant?.final_rank ?? null,
      member: participant?.member || null,
    },
    standing: standing ? {
      position: Number(standing?.position || 0),
      played: Number(standing?.played || 0),
      won: Number(standing?.won || 0),
      drawn: Number(standing?.drawn || 0),
      lost: Number(standing?.lost || 0),
      matchPoints: Number(standing?.matchPoints || 0),
      framesFor: Number(standing?.framesFor || 0),
      framesAgainst: Number(standing?.framesAgainst || 0),
      frameDiff: Number(standing?.frameDiff || 0),
    } : null,
    summary: {
      played: summary.played,
      wins: summary.wins,
      draws: summary.draws,
      losses: summary.losses,
      totalPoints: summary.totalPoints,
      totalPointsAgainst: summary.totalPointsAgainst,
      pointsDiff: summary.totalPoints - summary.totalPointsAgainst,
      highestBreak: summary.highestBreak,
      breaks20Plus: summary.breaks20Plus,
      matchPoints: Number(standing?.matchPoints || 0),
      avgPointsPerMatch,
      avgBreaks20PlusPerMatch,
    },
    breaks: breakRows,
    matches: participantMatches,
    recentForm,
    opponentStats,
  };
}

async function sendTournamentSignupNotificationEmail(options: {
  type: 'created' | 'confirmed' | 'cancelled';
  clubId: string;
  tournamentId: string;
  signupId: string;
}) {
  const settings = await getTournamentsModuleSettings().catch(() => null);
  const enabled =
    options.type === 'created'
      ? settings?.signupCreatedEmailEnabled
      : options.type === 'confirmed'
        ? settings?.signupConfirmedEmailEnabled
        : settings?.signupCancelledEmailEnabled;
  if (!enabled) return;

  const [club, tournament, signup] = await Promise.all([
    prisma.clubProfile.findUnique({
      where: { id: options.clubId },
      include: { member: { select: { email: true } } },
    }),
    prisma.tournament.findUnique({
      where: { id: options.tournamentId },
      select: { id: true, title: true, startsAt: true, signupClosesAt: true },
    }),
    prisma.tournamentSignup.findUnique({
      where: { id: options.signupId },
      include: { member: { select: { name: true, member_code: true, email: true } } },
    }),
  ]);

  if (!club || !tournament || !signup?.member) return;

  const tournamentTitle = String(tournament.title || '未命名比賽').trim();
  const clubName = String(club.name || '').trim() || '場館';
  const memberLabel = formatMemberLabel(signup.member);
  const venueDashboardUrl = buildWebAppUrl('/venue/dashboard?tab=content');
  const memberInboxUrl = buildWebAppUrl('/me');
  const startsAtText = formatDisplayDateTime(tournament.startsAt);
  const signupClosesAtText = formatDisplayDateTime(tournament.signupClosesAt);

  try {
    if (options.type === 'created') {
      const to = String(club.email || club.member?.email || '').trim();
      if (!to) return;
      await sendEmailIfConfigured({
        to,
        subject: `新比賽報名待確認：${tournamentTitle}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>新比賽報名待確認</h2>
            <p><strong>場館：</strong>${escapeHtml(clubName)}</p>
            <p><strong>比賽：</strong>${escapeHtml(tournamentTitle)}</p>
            <p><strong>會員：</strong>${escapeHtml(memberLabel)}</p>
            <p><strong>開賽時間：</strong>${escapeHtml(startsAtText)}</p>
            <p><strong>截止報名：</strong>${escapeHtml(signupClosesAtText)}</p>
            <p><a href="${escapeHtml(venueDashboardUrl)}">前往場館比賽工作台處理報名</a></p>
          </div>
        `,
      });
      return;
    }

    const to = String(signup.member.email || '').trim();
    if (!to) return;
    const subject = options.type === 'confirmed'
      ? `比賽報名已確認：${tournamentTitle}`
      : `比賽報名已取消：${tournamentTitle}`;
    const heading = options.type === 'confirmed' ? '你的比賽報名已確認' : '你的比賽報名已取消';
    const statusText = options.type === 'confirmed' ? '已確認' : '已取消';

    await sendEmailIfConfigured({
      to,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>${escapeHtml(heading)}</h2>
          <p><strong>場館：</strong>${escapeHtml(clubName)}</p>
          <p><strong>比賽：</strong>${escapeHtml(tournamentTitle)}</p>
          <p><strong>會員：</strong>${escapeHtml(memberLabel)}</p>
          <p><strong>狀態：</strong>${escapeHtml(statusText)}</p>
          <p><strong>開賽時間：</strong>${escapeHtml(startsAtText)}</p>
          <p><a href="${escapeHtml(memberInboxUrl)}">前往會員中心查看最新狀態</a></p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[tournaments] Failed to send signup notification email', {
      type: options.type,
      tournamentId: options.tournamentId,
      signupId: options.signupId,
      error,
    });
  }
}

export function createTournamentRouter() {
  const router = express.Router();

  router.get('/tournaments', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      const rows = await prisma.tournament.findMany({
        where: { clubId },
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
      });
      const ids = rows.map((r) => r.id);
      const counts = ids.length > 0
        ? await prisma.tournamentSignup.groupBy({
            by: ['tournamentId', 'status'],
            where: { tournamentId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED'] } },
            _count: { _all: true },
          })
        : [];
      const map = new Map<string, { pending: number; confirmed: number }>();
      for (const c of counts) {
        const tid = String((c as any).tournamentId);
        const st = String((c as any).status);
        const cur = map.get(tid) || { pending: 0, confirmed: 0 };
        if (st === 'PENDING') cur.pending = (c as any)._count._all;
        if (st === 'CONFIRMED') cur.confirmed = (c as any)._count._all;
        map.set(tid, cur);
      }
      res.json(rows.map((t) => {
        const c = map.get(t.id) || { pending: 0, confirmed: 0 };
        return { ...t, pendingCount: c.pending, confirmedCount: c.confirmed, signupCount: c.pending + c.confirmed };
      }));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/tournaments', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const payload = req.body || {};
    const title = String(payload.title || '').trim();
    const description = payload.description == null ? null : String(payload.description).trim() || null;
    const signupGuide = payload.signupGuide == null ? null : String(payload.signupGuide).trim() || null;
    const format = String(payload.format || '').trim().toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
    const seedMode = String(payload.seedMode || 'MANUAL').trim().toUpperCase();
    const capacity = Number(payload.capacity ?? 32);
    const bestOfFrames = payload.bestOfFrames == null || payload.bestOfFrames === '' ? null : Number(payload.bestOfFrames);
    const pointsWin = payload.pointsWin == null || payload.pointsWin === '' ? 3 : Number(payload.pointsWin);
    const pointsDraw = payload.pointsDraw == null || payload.pointsDraw === '' ? 1 : Number(payload.pointsDraw);
    const pointsLoss = payload.pointsLoss == null || payload.pointsLoss === '' ? 0 : Number(payload.pointsLoss);
    const startsAtRaw = payload.startsAt;
    const signupClosesAtRaw = payload.signupClosesAt ?? payload.deadline;
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!['KNOCKOUT', 'LEAGUE'].includes(format)) return res.status(400).json({ error: 'format invalid' });
    const cap = Number.isFinite(capacity) ? Math.max(1, Math.min(512, Math.floor(capacity))) : 32;
    if (bestOfFrames != null && (!Number.isFinite(bestOfFrames) || bestOfFrames <= 0)) return res.status(400).json({ error: 'bestOfFrames invalid' });
    if (!Number.isFinite(pointsWin)) return res.status(400).json({ error: 'pointsWin invalid' });
    if (!Number.isFinite(pointsDraw)) return res.status(400).json({ error: 'pointsDraw invalid' });
    if (!Number.isFinite(pointsLoss)) return res.status(400).json({ error: 'pointsLoss invalid' });
    const startsAt = startsAtRaw ? new Date(String(startsAtRaw)) : null;
    if (startsAtRaw && (!startsAt || Number.isNaN(startsAt.getTime()))) return res.status(400).json({ error: 'startsAt invalid' });
    const signupClosesAt = signupClosesAtRaw ? new Date(String(signupClosesAtRaw)) : null;
    if (signupClosesAtRaw && (!signupClosesAt || Number.isNaN(signupClosesAt.getTime()))) return res.status(400).json({ error: 'signupClosesAt invalid' });
    try {
      const row = await prisma.tournament.create({
        data: {
          id: randomUUID(),
          clubId,
          status: 'DRAFT',
          title,
          description,
          signupGuide,
          format,
          seed_mode: seedMode === 'RANDOM' || seedMode === 'RANKING' ? seedMode : 'MANUAL',
          best_of_frames: bestOfFrames == null ? null : Math.max(1, Math.floor(bestOfFrames)),
          points_win: Math.max(0, Math.floor(pointsWin)),
          points_draw: Math.max(0, Math.floor(pointsDraw)),
          points_loss: Math.max(0, Math.floor(pointsLoss)),
          capacity: cap,
          startsAt,
          signupClosesAt,
        },
      });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.put('/tournaments/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};
    const patch: any = {};
    if (payload.title != null) patch.title = String(payload.title || '').trim();
    if (payload.description !== undefined) patch.description = payload.description == null ? null : String(payload.description).trim() || null;
    if (payload.signupGuide !== undefined) patch.signupGuide = payload.signupGuide == null ? null : String(payload.signupGuide).trim() || null;
    if (payload.format !== undefined) {
      const format = String(payload.format || '').trim().toUpperCase();
      if (format && !['KNOCKOUT', 'LEAGUE'].includes(format)) {
        return res.status(400).json({ error: 'format invalid' });
      }
      patch.format = format || 'KNOCKOUT';
    }
    if (payload.seedMode !== undefined) {
      const seedMode = String(payload.seedMode || '').trim().toUpperCase();
      if (seedMode && !['MANUAL', 'RANKING', 'RANDOM'].includes(seedMode)) {
        return res.status(400).json({ error: 'seedMode invalid' });
      }
      patch.seed_mode = seedMode || 'MANUAL';
    }
    if (payload.capacity != null) {
      const n = Number(payload.capacity);
      if (!Number.isFinite(n)) return res.status(400).json({ error: 'capacity invalid' });
      patch.capacity = Math.max(1, Math.min(512, Math.floor(n)));
    }
    if (payload.bestOfFrames !== undefined) {
      const v = payload.bestOfFrames;
      if (v == null || String(v).trim() === '') {
        patch.best_of_frames = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'bestOfFrames invalid' });
        patch.best_of_frames = Math.max(1, Math.floor(n));
      }
    }
    if (payload.pointsWin !== undefined) {
      const n = Number(payload.pointsWin);
      if (!Number.isFinite(n)) return res.status(400).json({ error: 'pointsWin invalid' });
      patch.points_win = Math.max(0, Math.floor(n));
    }
    if (payload.pointsDraw !== undefined) {
      const n = Number(payload.pointsDraw);
      if (!Number.isFinite(n)) return res.status(400).json({ error: 'pointsDraw invalid' });
      patch.points_draw = Math.max(0, Math.floor(n));
    }
    if (payload.pointsLoss !== undefined) {
      const n = Number(payload.pointsLoss);
      if (!Number.isFinite(n)) return res.status(400).json({ error: 'pointsLoss invalid' });
      patch.points_loss = Math.max(0, Math.floor(n));
    }
    if (payload.startsAt !== undefined) {
      const v = payload.startsAt;
      const d = v == null || String(v).trim() === '' ? null : new Date(String(v));
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ error: 'startsAt invalid' });
      patch.startsAt = d;
    }
    if (payload.signupClosesAt !== undefined) {
      const v = payload.signupClosesAt;
      const d = v == null || String(v).trim() === '' ? null : new Date(String(v));
      if (d && Number.isNaN(d.getTime())) return res.status(400).json({ error: 'signupClosesAt invalid' });
      patch.signupClosesAt = d;
    }
    try {
      const cur = await prisma.tournament.findUnique({ where: { id } });
      if (!cur || cur.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
      if (patch.title != null && !patch.title) return res.status(400).json({ error: 'title required' });
      const row = await prisma.tournament.update({ where: { id }, data: patch });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/tournaments/:id/publish', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const cur = await prisma.tournament.findUnique({ where: { id } });
      if (!cur || cur.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
      const row = await prisma.tournament.update({ where: { id }, data: { status: 'PUBLISHED' } });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/tournaments/:id/close', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const cur = await prisma.tournament.findUnique({ where: { id } });
      if (!cur || cur.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
      const row = await prisma.tournament.update({ where: { id }, data: { status: 'CLOSED' } });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/tournaments/:id/signups', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const status = String(req.query.status || 'PENDING').toUpperCase();
    const whereStatus = status === 'ALL' ? undefined : status;
    try {
      const t = await prisma.tournament.findUnique({ where: { id } });
      if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
      const where: any = { tournamentId: id };
      if (whereStatus) where.status = whereStatus;
      const rows = await prisma.tournamentSignup.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
        include: { member: { select: { id: true, name: true, member_code: true, email: true } } },
      });
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/tournaments/:id/signups/:signupId/confirm', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const signupId = String(req.params.signupId || '').trim();
    try {
      const t = await prisma.tournament.findUnique({ where: { id } });
      if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
      const s = await prisma.tournamentSignup.findUnique({
        where: { id: signupId },
        include: { member: { select: { id: true, name: true, member_code: true, email: true } } },
      });
      if (!s || s.tournamentId !== id) return res.status(404).json({ error: 'Not found' });
      const updated = await prisma.tournamentSignup.update({ where: { id: signupId }, data: { status: 'CONFIRMED' } });
      await sendTournamentSignupNotificationEmail({ type: 'confirmed', clubId, tournamentId: id, signupId });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/tournaments/:id/signups/:signupId/cancel', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const signupId = String(req.params.signupId || '').trim();
    try {
      const t = await prisma.tournament.findUnique({ where: { id } });
      if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
      const s = await prisma.tournamentSignup.findUnique({
        where: { id: signupId },
        include: { member: { select: { id: true, name: true, member_code: true, email: true } } },
      });
      if (!s || s.tournamentId !== id) return res.status(404).json({ error: 'Not found' });
      const updated = await prisma.tournamentSignup.update({ where: { id: signupId }, data: { status: 'CANCELLED' } });
      await sendTournamentSignupNotificationEmail({ type: 'cancelled', clubId, tournamentId: id, signupId });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/tournaments/:id/participants', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.listParticipants(clubId, id);
      res.json(rows);
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/participants/generate', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.generateParticipants(clubId, id);
      res.json({ ok: true, participants: rows });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.put('/tournaments/:id/participants/:participantId', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const participantId = String(req.params.participantId || '').trim();
    try {
      const rows = await tournamentsService.updateParticipantSeed(clubId, id, participantId, req.body?.seed);
      res.json({ ok: true, participants: rows });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.put('/tournaments/:id/seed-mode', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const result = await tournamentsService.updateSeedMode(clubId, id, req.body?.seedMode);
      res.json({ ok: true, tournament: result.tournament, participants: result.participants });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/schedule/knockout/generate', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.generateKnockoutSchedule(clubId, id);
      res.json({ ok: true, matches: rows });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/schedule/knockout/reset', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.resetKnockoutSchedule(clubId, id);
      res.json({ ok: true, participants: rows });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/schedule/league/generate', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.generateLeagueSchedule(clubId, id);
      res.json({ ok: true, matches: rows });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/schedule/league/reset', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.resetLeagueSchedule(clubId, id);
      res.json({ ok: true, participants: rows });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.get('/tournaments/:id/matches', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const rows = await tournamentsService.listMatches(clubId, id);
      res.json(rows);
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.get('/tournaments/:id/standings', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
      const result = await tournamentsService.getLeagueStandings(clubId, id);
      res.json(result);
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/matches/:matchId/result', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const matchId = String(req.params.matchId || '').trim();
    try {
      const row = await tournamentsService.recordMatchResult(clubId, id, matchId, req.body || {});
      res.json({ ok: true, match: row });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.post('/tournaments/:id/matches/:matchId/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const matchId = String(req.params.matchId || '').trim();
    try {
      const row = await tournamentsService.addMatchBreak(clubId, id, matchId, member.id, req.body || {});
      res.json({ ok: true, breakRecord: row });
    } catch (e: any) {
      const message = String(e?.message || e);
      res.status(message === 'Not found' ? 404 : 400).json({ error: message });
    }
  });

  router.get('/:clubId/tournaments/public', async (req, res) => {
    const { clubId } = req.params;
    const now = new Date();
    const memberId = String(req.headers['x-member-id'] || '').trim() || null;
    try {
      const rows = await prisma.tournament.findMany({
        where: { clubId, status: 'PUBLISHED' },
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });
      const ids = rows.map((r) => r.id);
      const counts = ids.length > 0
        ? await prisma.tournamentSignup.groupBy({
            by: ['tournamentId'],
            where: { tournamentId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED'] } },
            _count: { _all: true },
          })
        : [];
      const countMap = new Map(counts.map((c) => [c.tournamentId, c._count._all]));
      const myRows = memberId
        ? await prisma.tournamentSignup.findMany({
            where: { memberId, tournamentId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED'] } },
            select: { tournamentId: true, status: true, createdAt: true },
          })
        : [];
      const myMap = new Map(myRows.map((r) => [r.tournamentId, r]));
      res.json(rows.map((t) => {
        const opensOk = !t.signupOpensAt || t.signupOpensAt <= now;
        const closesOk = !t.signupClosesAt || t.signupClosesAt >= now;
        return {
          ...t,
          signupCount: countMap.get(t.id) || 0,
          signupOpen: opensOk && closesOk,
          mySignup: myMap.get(t.id) || null,
        };
      }));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/:clubId/tournaments/live/public', async (req, res) => {
    const { clubId } = req.params;
    try {
      const tournaments = await prisma.tournament.findMany({
        where: { clubId, status: 'PUBLISHED' },
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      });
      const ids = tournaments.map((row) => row.id);
      if (ids.length <= 0) return res.json([]);

      const matches = await prisma.tournamentMatch.findMany({
        where: {
          tournament_id: { in: ids },
        },
        orderBy: [{ tournament_id: 'asc' }, { round_no: 'asc' }, { match_no: 'asc' }],
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
          frames: {
            orderBy: [{ frame_no: 'asc' }],
          },
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

      const byTournamentId = new Map<string, any[]>();
      for (const row of matches) {
        const tournamentId = String((row as any)?.tournament_id || '');
        if (!byTournamentId.has(tournamentId)) byTournamentId.set(tournamentId, []);
        byTournamentId.get(tournamentId)!.push({
          ...row,
          breaks: Array.isArray((row as any)?.break_records) ? (row as any).break_records : [],
        });
      }

      const payload = tournaments.map((tournament) => {
        const tournamentMatches = byTournamentId.get(String(tournament.id)) || [];
        const liveMatches = tournamentMatches.filter((row: any) => {
          const status = String(row?.status || '').trim().toUpperCase();
          if (status === 'LIVE') return true;
          if (status === 'COMPLETED' || status === 'PENDING') return false;
          return Array.isArray(row?.frames) && row.frames.length > 0;
        });
        const readyMatches = tournamentMatches
          .filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY')
          .slice(0, 4);
        const recentCompletedMatches = tournamentMatches
          .filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED')
          .sort((a: any, b: any) => {
            const aEnded = a?.ended_at ? new Date(String(a.ended_at)).getTime() : 0;
            const bEnded = b?.ended_at ? new Date(String(b.ended_at)).getTime() : 0;
            return bEnded - aEnded;
          })
          .slice(0, 3);
        const completedMatchCount = tournamentMatches.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'COMPLETED').length;
        const readyMatchCount = tournamentMatches.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'READY').length;
        const pendingMatchCount = tournamentMatches.filter((row: any) => String(row?.status || '').trim().toUpperCase() === 'PENDING').length;

        return {
          id: tournament.id,
          title: tournament.title,
          format: tournament.format,
          bestOfFrames: (tournament as any).best_of_frames,
          workflow_status: tournament.workflow_status,
          startsAt: tournament.startsAt,
          liveMatches,
          readyMatches,
          recentCompletedMatches,
          summary: {
            totalMatches: tournamentMatches.length,
            liveMatchCount: liveMatches.length,
            readyMatchCount,
            completedMatchCount,
            pendingMatchCount,
          },
        };
      }).filter((row) => (
        row.summary.liveMatchCount > 0
        || row.summary.readyMatchCount > 0
        || row.summary.completedMatchCount > 0
      ));

      res.json(payload);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/:clubId/tournaments/:id/public', async (req, res) => {
    const { clubId, id } = req.params;
    const memberId = String(req.headers['x-member-id'] || '').trim() || null;
    try {
      const t = await prisma.tournament.findUnique({
        where: { id },
        include: {
          club: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
      });
      if (!t || t.clubId !== clubId || t.status !== 'PUBLISHED') return res.status(404).json({ error: 'Not found' });
      const signupCount = await prisma.tournamentSignup.count({ where: { tournamentId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
      const mySignup = memberId
        ? await prisma.tournamentSignup.findUnique({
            where: { tournamentId_memberId: { tournamentId: id, memberId } },
            select: { id: true, status: true, createdAt: true },
          })
        : null;
      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournament_id: id },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true } },
          signup: { select: { id: true, status: true, createdAt: true } },
        },
      });
      const rawMatches = await prisma.tournamentMatch.findMany({
        where: { tournament_id: id },
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
          frames: {
            orderBy: [{ frame_no: 'asc' }],
          },
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
      const matches = rawMatches.map((row: any) => ({
        ...row,
        breaks: Array.isArray(row?.break_records) ? row.break_records : [],
      }));
      const isLeague = String(t.format || '').toUpperCase() === 'LEAGUE';
      const standings = isLeague ? buildLeagueStandings(t, participants, matches) : [];
      const completedMatchCount = matches.filter((row: any) => String(row?.status || '').toUpperCase() === 'COMPLETED').length;
      const readyMatchCount = matches.filter((row: any) => String(row?.status || '').toUpperCase() === 'READY').length;
      const pendingMatchCount = matches.filter((row: any) => String(row?.status || '').toUpperCase() === 'PENDING').length;
      const podium = !isLeague
        ? {
            champion: participants.find((row: any) => Number(row?.final_rank || 0) === 1) || null,
            runnerUp: participants.find((row: any) => Number(row?.final_rank || 0) === 2) || null,
            semiFinalists: participants
              .filter((row: any) => Number(row?.final_rank || 0) === 3)
              .sort((a: any, b: any) => Number(a?.seed || 0) - Number(b?.seed || 0)),
          }
        : null;
      res.json({
        ...t,
        signupCount,
        mySignup,
        participants,
        matches,
        standings,
        summary: {
          participantCount: participants.filter((row: any) => String(row?.status || '').toUpperCase() === 'ACTIVE').length,
          totalParticipants: participants.length,
          totalMatches: matches.length,
          completedMatchCount,
          readyMatchCount,
          pendingMatchCount,
        },
        podium,
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/:clubId/tournaments/:id/participants/:participantId/public', async (req, res) => {
    const { clubId, id, participantId } = req.params;
    try {
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          club: {
            select: { id: true, name: true, logoUrl: true },
          },
        },
      });
      if (!tournament || tournament.clubId !== clubId || tournament.status !== 'PUBLISHED') {
        return res.status(404).json({ error: 'Not found' });
      }
      if (String(tournament.format || '').trim().toUpperCase() !== 'LEAGUE') {
        return res.status(400).json({ error: '只支援聯賽球手數據' });
      }

      const participants = await prisma.tournamentParticipant.findMany({
        where: { tournament_id: id },
        orderBy: [{ seed: 'asc' }, { created_at: 'asc' }],
        include: {
          member: { select: { id: true, name: true, member_code: true } },
        },
      });
      const participant = participants.find((row: any) => String(row?.id || '') === String(participantId));
      if (!participant) return res.status(404).json({ error: 'Not found' });

      const matches = await prisma.tournamentMatch.findMany({
        where: { tournament_id: id },
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
          frames: {
            orderBy: [{ frame_no: 'asc' }],
          },
          break_records: {
            where: {
              deleted_at: null,
              record_type: 'TOURNAMENT',
            },
            orderBy: [{ frame_no: 'asc' }, { recorded_at: 'asc' }, { created_at: 'asc' }],
            include: {
              member: { select: { id: true, name: true, member_code: true } },
            },
          },
        },
      });

      const standings = buildLeagueStandings(tournament, participants, matches);
      const detail = buildPublicLeagueParticipantDetail({
        tournament,
        participant,
        standings,
        matches,
      });
      res.json(detail);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/:clubId/tournaments/:id/signup', async (req, res) => {
    const settings = await getTournamentsModuleSettings().catch(() => null);
    const member = await requireMemberCapability(req, res, 'tournament.signup', settings?.tournamentSignupRequirement);
    if (!member) return;
    const memberId = member.id;
    const { clubId, id } = req.params;
    const now = new Date();
    try {
      const t = await prisma.tournament.findUnique({ where: { id } });
      if (!t || t.clubId !== clubId || t.status !== 'PUBLISHED') return res.status(404).json({ error: 'Not found' });
      if (t.signupOpensAt && t.signupOpensAt > now) return res.status(400).json({ error: '報名尚未開始' });
      if (t.signupClosesAt && t.signupClosesAt < now) return res.status(400).json({ error: '報名已截止' });
      const existing = await prisma.tournamentSignup.findUnique({
        where: { tournamentId_memberId: { tournamentId: id, memberId } },
      });
      if (existing && existing.status !== 'CANCELLED') return res.json({ ok: true, signup: existing, already: true });
      const count = await prisma.tournamentSignup.count({ where: { tournamentId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
      if (t.capacity != null && count >= t.capacity) return res.status(409).json({ error: '名額已滿' });
      const signup = existing
        ? await prisma.tournamentSignup.update({ where: { id: existing.id }, data: { status: 'PENDING' } })
        : await prisma.tournamentSignup.create({ data: { id: randomUUID(), tournamentId: id, memberId, status: 'PENDING' } });
      try {
        const m = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true, member_code: true } });
        const memberName = String(m?.name || '').trim();
        const memberCode = String(m?.member_code || '').trim();
        const who = [memberCode || '無', memberName].filter(Boolean).join(' ');
        const msgTitle = `比賽報名待確認：${t.title}`;
        const content = `會員：${who}\n狀態：待確認`;
        await prisma.clubMessage.create({ data: { clubId, title: msgTitle, content } });
      } catch {}
      await sendTournamentSignupNotificationEmail({ type: 'created', clubId, tournamentId: id, signupId: signup.id });
      res.json({ ok: true, signup });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
