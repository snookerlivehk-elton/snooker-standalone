import express from 'express';
import { randomUUID } from 'crypto';
import { getClubFeatureAssignments } from '../../../clubFeatureAccess.js';
import { getMyClubId, requireClubAdmin, requireMember } from '../../core/club/access.js';
import { prisma } from '../../core/db/prisma.js';
import { isFeatureEnabled, requireClubFeatureForClubId } from '../../core/features/featureAccess.js';

export function createPointsRouter() {
  const router = express.Router();

  router.get('/points/config', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const row = await prisma.clubPointsConfig.findUnique({ where: { clubId } });
    res.json(row || { clubId, currencyCode: 'HKD', pointsPerCurrency: '1', roundingMinutes: 15, minBillableMinutes: 0 });
  });

  router.put('/points/config', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const payload = req.body || {};
    const currencyCode = String(payload.currencyCode || 'HKD').trim().toUpperCase();
    const pointsPerCurrencyRaw = payload.pointsPerCurrency;
    const roundingMinutesRaw = payload.roundingMinutes;
    const minBillableMinutesRaw = payload.minBillableMinutes;
    if (!/^[A-Z]{3}$/.test(currencyCode)) return res.status(400).json({ error: 'currencyCode invalid' });
    const ppc = Number(pointsPerCurrencyRaw);
    if (!Number.isFinite(ppc) || ppc <= 0) return res.status(400).json({ error: 'pointsPerCurrency invalid' });
    const roundingMinutes = Math.floor(Number(roundingMinutesRaw));
    if (!Number.isFinite(roundingMinutes) || roundingMinutes < 1 || roundingMinutes > 180) return res.status(400).json({ error: 'roundingMinutes invalid' });
    const minBillableMinutes = Math.floor(Number(minBillableMinutesRaw));
    if (!Number.isFinite(minBillableMinutes) || minBillableMinutes < 0 || minBillableMinutes > 720) return res.status(400).json({ error: 'minBillableMinutes invalid' });
    const existing = await prisma.clubPointsConfig.findUnique({ where: { clubId }, select: { id: true } });
    const row = await prisma.clubPointsConfig.upsert({
      where: { clubId },
      update: { currencyCode, pointsPerCurrency: String(ppc), roundingMinutes, minBillableMinutes },
      create: { id: existing?.id || randomUUID(), clubId, currencyCode, pointsPerCurrency: String(ppc), roundingMinutes, minBillableMinutes },
    });
    res.json(row);
  });

  router.get('/points/balances', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const memberships = await prisma.clubMember.findMany({
      where: { clubId },
      include: { member: { select: { id: true, name: true, email: true, member_code: true, phone: true, phone_e164: true } } },
      orderBy: [{ joinedAt: 'desc' }],
    });
    const ids = memberships.map((m: any) => m.memberId);
    const balances = ids.length === 0 ? [] : await prisma.pointsBalance.findMany({
      where: { clubId, memberId: { in: ids } },
      select: { memberId: true, balance: true, updatedAt: true },
    });
    const map = new Map(balances.map((b) => [b.memberId, b]));
    res.json(memberships.map((m: any) => {
      const b = map.get(m.memberId);
      return {
        member: m.member,
        memberId: m.memberId,
        balance: b?.balance ?? 0,
        updatedAt: b?.updatedAt ?? null,
      };
    }));
  });

  router.get('/points/balances/search', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const q = req.query.q == null ? '' : String(req.query.q || '').trim();
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20) || 20));
    const where: any = { clubId };
    if (q) {
      where.member = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { member_code: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { phone_e164: { contains: q, mode: 'insensitive' } },
        ],
      };
    }
    const memberships = await prisma.clubMember.findMany({
      where,
      take: limit,
      orderBy: [{ joinedAt: 'desc' }],
      include: { member: { select: { id: true, name: true, email: true, member_code: true, phone: true, phone_e164: true } } },
    });
    const ids = memberships.map((m: any) => m.memberId);
    const balances = ids.length === 0 ? [] : await prisma.pointsBalance.findMany({
      where: { clubId, memberId: { in: ids } },
      select: { memberId: true, balance: true, updatedAt: true },
    });
    const map = new Map(balances.map((b) => [b.memberId, b]));
    res.json(memberships.map((m: any) => {
      const b = map.get(m.memberId);
      return {
        member: m.member,
        memberId: m.memberId,
        balance: b?.balance ?? 0,
        updatedAt: b?.updatedAt ?? null,
      };
    }));
  });

  router.get('/points/my-balance', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const clubId = req.query.clubId == null ? '' : String(req.query.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const membership = await prisma.clubMember.findUnique({ where: { clubId_memberId: { clubId, memberId: member.id } } });
    if (!membership) return res.status(403).json({ error: 'Not in club' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const bal = await prisma.pointsBalance.findUnique({
      where: { clubId_memberId: { clubId, memberId: member.id } },
      select: { balance: true, updatedAt: true },
    });
    res.json({ clubId, memberId: member.id, balance: bal?.balance ?? 0, updatedAt: bal?.updatedAt ?? null });
  });

  router.get('/points/my-balances', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const globalEnabled = await isFeatureEnabled('points');
    if (!globalEnabled) return res.json([]);
    const memberships = await prisma.clubMember.findMany({
      where: { memberId: member.id },
      select: { clubId: true },
      orderBy: [{ joinedAt: 'desc' }],
      take: 200,
    });
    const clubIds = memberships.map((m) => m.clubId);
    const assignments = clubIds.length === 0 ? {} : await getClubFeatureAssignments(prisma, clubIds, 'points');
    const enabledClubIds = clubIds.filter((clubId) => assignments[clubId]?.assignedEnabled);
    const rows = enabledClubIds.length === 0 ? [] : await prisma.pointsBalance.findMany({
      where: { memberId: member.id, clubId: { in: enabledClubIds } },
      select: { clubId: true, balance: true, updatedAt: true },
    });
    const map = new Map(rows.map((r) => [r.clubId, r]));
    res.json(enabledClubIds.map((clubId) => {
      const r = map.get(clubId);
      return { clubId, balance: r?.balance ?? 0, updatedAt: r?.updatedAt ?? null };
    }));
  });

  router.get('/points/ledger', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));
    const memberId = req.query.memberId == null ? '' : String(req.query.memberId).trim();
    const fromRaw = req.query.from == null ? '' : String(req.query.from).trim();
    const toRaw = req.query.to == null ? '' : String(req.query.to).trim();
    const monthRaw = req.query.month == null ? '' : String(req.query.month).trim();
    const groupBy = req.query.groupBy == null ? '' : String(req.query.groupBy).trim();
    const includeTotal = String(req.query.includeTotal || '').trim() === '1';

    const where: any = { clubId };
    if (memberId) where.memberId = memberId;

    let from: Date | null = null;
    let to: Date | null = null;
    if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
      const y = Number(monthRaw.slice(0, 4));
      const m = Number(monthRaw.slice(5, 7));
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        to = new Date(Date.UTC(y, m, 1, 0, 0, 0));
      }
    }
    if (!from && fromRaw) {
      const d = new Date(fromRaw);
      if (Number.isFinite(d.getTime())) from = d;
    }
    if (!to && toRaw) {
      const d = new Date(toRaw);
      if (Number.isFinite(d.getTime())) to = d;
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    if (groupBy === 'month') {
      const rows = await prisma.pointsLedger.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: { createdAt: true, deltaPoints: true },
        take: 5000,
      });
      const map = new Map<string, { month: string; sumDelta: number; count: number }>();
      for (const r of rows) {
        const d = r.createdAt instanceof Date ? r.createdAt : new Date(String((r as any).createdAt));
        if (!Number.isFinite(d.getTime())) continue;
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const cur = map.get(month) || { month, sumDelta: 0, count: 0 };
        cur.sumDelta += Number(r.deltaPoints || 0);
        cur.count += 1;
        map.set(month, cur);
      }
      const out = Array.from(map.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
      res.json(out);
      return;
    }

    const [rows, agg] = await Promise.all([
      prisma.pointsLedger.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        include: {
          member: { select: { id: true, name: true, email: true, member_code: true, phone: true, phone_e164: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      includeTotal ? prisma.pointsLedger.aggregate({ where, _sum: { deltaPoints: true } }) : Promise.resolve(null as any),
    ]);

    if (includeTotal) {
      res.json({ rows, totalDelta: agg?._sum?.deltaPoints ?? 0 });
      return;
    }
    res.json(rows);
  });

  router.post('/points/adjust', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const payload = req.body || {};
    const targetMemberId = String(payload.memberId || '').trim();
    const delta = Math.floor(Number(payload.deltaPoints));
    const reason = String(payload.reason || '').trim();
    if (!targetMemberId) return res.status(400).json({ error: 'memberId required' });
    if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'deltaPoints invalid' });
    if (!reason) return res.status(400).json({ error: 'reason required' });
    const membership = await prisma.clubMember.findUnique({
      where: { clubId_memberId: { clubId, memberId: targetMemberId } },
    });
    if (!membership) return res.status(400).json({ error: 'Member not in club' });
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.pointsLedger.create({
        data: {
          id: randomUUID(),
          clubId,
          memberId: targetMemberId,
          deltaPoints: delta,
          reason,
          createdByMemberId: member.id,
          createdAt: now,
        },
      });
      return tx.pointsBalance.upsert({
        where: { clubId_memberId: { clubId, memberId: targetMemberId } },
        update: { balance: { increment: delta } },
        create: { id: randomUUID(), clubId, memberId: targetMemberId, balance: delta },
        select: { balance: true, updatedAt: true },
      });
    });
    res.json({ ok: true, memberId: targetMemberId, deltaPoints: delta, balance: result.balance, updatedAt: result.updatedAt });
  });

  return router;
}
