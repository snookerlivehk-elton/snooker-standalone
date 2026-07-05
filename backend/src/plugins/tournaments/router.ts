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
        },
      });
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
