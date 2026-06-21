import express from 'express';
import { randomUUID } from 'crypto';
import { getMyClubId, requireClubAdmin, requireMember, requireMemberCapability } from '../../core/club/access.js';
import { prisma } from '../../core/db/prisma.js';
import { getTournamentsModuleSettings } from '../../core/modules/tournamentsSettings.js';
import { tournamentsService } from './service.js';

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
    const seedMode = String(payload.seedMode || 'MANUAL').trim().toUpperCase();
    const capacity = Number(payload.capacity ?? 32);
    const startsAtRaw = payload.startsAt;
    const signupClosesAtRaw = payload.signupClosesAt ?? payload.deadline;
    if (!title) return res.status(400).json({ error: 'title required' });
    const cap = Number.isFinite(capacity) ? Math.max(1, Math.min(512, Math.floor(capacity))) : 32;
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
          seed_mode: seedMode === 'RANDOM' || seedMode === 'RANKING' ? seedMode : 'MANUAL',
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
      const s = await prisma.tournamentSignup.findUnique({ where: { id: signupId } });
      if (!s || s.tournamentId !== id) return res.status(404).json({ error: 'Not found' });
      const updated = await prisma.tournamentSignup.update({ where: { id: signupId }, data: { status: 'CONFIRMED' } });
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
      const s = await prisma.tournamentSignup.findUnique({ where: { id: signupId } });
      if (!s || s.tournamentId !== id) return res.status(404).json({ error: 'Not found' });
      const updated = await prisma.tournamentSignup.update({ where: { id: signupId }, data: { status: 'CANCELLED' } });
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
      const t = await prisma.tournament.findUnique({ where: { id } });
      if (!t || t.clubId !== clubId || t.status !== 'PUBLISHED') return res.status(404).json({ error: 'Not found' });
      const signupCount = await prisma.tournamentSignup.count({ where: { tournamentId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
      const mySignup = memberId
        ? await prisma.tournamentSignup.findUnique({
            where: { tournamentId_memberId: { tournamentId: id, memberId } },
            select: { id: true, status: true, createdAt: true },
          })
        : null;
      res.json({ ...t, signupCount, mySignup });
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
      res.json({ ok: true, signup });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
