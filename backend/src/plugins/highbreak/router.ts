import express from 'express';
import { randomUUID } from 'crypto';
import { getMyClubId, requireClubAdmin } from '../../core/club/access.js';
import { prisma } from '../../core/db/prisma.js';
import { parseLimit, parseMonthRangeUtc } from '../../core/utils/query.js';

type BreakRecordType = 'VENUE' | 'TOURNAMENT';

function normalizeBreakRecordType(raw: any): BreakRecordType | null {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'VENUE' || value === 'TOURNAMENT') return value;
  return null;
}

export function createClubHighbreakRouter() {
  const router = express.Router();

  router.post('/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const payload = req.body || {};
    const targetMemberId = String(payload.memberId || '').trim();
    const points = Number(payload.points);
    const recordedAtRaw = payload.recordedAt;
    const videoUrl = payload.videoUrl == null ? null : String(payload.videoUrl).trim() || null;
    const note = payload.note == null ? null : String(payload.note).trim() || null;

    if (!targetMemberId) return res.status(400).json({ error: 'memberId required' });
    if (!Number.isFinite(points) || points <= 0) return res.status(400).json({ error: 'points invalid' });

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_memberId: { clubId, memberId: targetMemberId } },
    });
    if (!membership) return res.status(400).json({ error: 'Member not in club' });

    const recorded_at = recordedAtRaw ? new Date(String(recordedAtRaw)) : new Date();
    if (recordedAtRaw && Number.isNaN(recorded_at.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });

    const row = await prisma.breakRecord.create({
      data: {
        id: randomUUID(),
        club_id: clubId,
        member_id: targetMemberId,
        record_type: 'VENUE',
        points: Math.floor(points),
        recorded_at,
        video_url: videoUrl,
        note,
        created_by_member_id: member.id,
      },
      include: {
        member: { select: { id: true, name: true, email: true, member_code: true } },
        tournament: { select: { id: true, title: true, startsAt: true } },
      },
    });
    res.json(row);
  });

  router.get('/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const { month, memberId } = req.query as any;
    const where: any = { club_id: clubId, deleted_at: null, record_type: 'VENUE' };
    if (memberId) where.member_id = String(memberId).trim();
    if (month) {
      const range = parseMonthRangeUtc(String(month));
      if (!range) return res.status(400).json({ error: 'month invalid' });
      where.recorded_at = { gte: range.start, lt: range.end };
    }
    const rows = await prisma.breakRecord.findMany({
      where,
      orderBy: [{ recorded_at: 'desc' }],
      include: {
        member: { select: { id: true, name: true, email: true, member_code: true } },
        tournament: { select: { id: true, title: true, startsAt: true } },
      },
    });
    res.json(rows);
  });

  router.get('/:clubId/leaderboard/highest', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 10) || 10));

    const rows = await prisma.breakRecord.findMany({
      where: { club_id: clubId, deleted_at: null, record_type: 'VENUE' },
      orderBy: [{ points: 'desc' }, { recorded_at: 'desc' }],
      take: limit,
      include: {
        member: { select: { id: true, name: true, email: true, member_code: true } },
        tournament: { select: { id: true, title: true, startsAt: true } },
      },
    });
    res.json(rows);
  });

  router.get('/:clubId/leaderboard/monthly', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const month = req.query.month ? String(req.query.month) : '';
    const range = month ? parseMonthRangeUtc(month) : null;
    if (month && !range) return res.status(400).json({ error: 'month invalid' });

    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 10) || 10));

    const where: any = { club_id: clubId, deleted_at: null, record_type: 'VENUE' };
    if (range) where.recorded_at = { gte: range.start, lt: range.end };

    const grouped = await prisma.breakRecord.groupBy({
      by: ['member_id'],
      where,
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
      take: limit,
    });

    const ids = grouped.map((g) => g.member_id);
    const members = ids.length === 0 ? [] : await prisma.member.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, member_code: true },
    });
    const map = new Map(members.map((m) => [m.id, m]));

    res.json(grouped.map((g) => ({
      member: map.get(g.member_id) || { id: g.member_id, name: '-', email: null, member_code: null },
      totalPoints: g._sum.points || 0,
    })));
  });

  return router;
}

async function listPublicHighbreakClubIds(regionCode?: string, districtCode?: string) {
  const memberWhere: any = {};
  if (regionCode) memberWhere.region_code = regionCode;
  if (districtCode) memberWhere.district_code = districtCode;
  const rows = await prisma.clubProfile.findMany({
    where: {
      publicEnabled: true,
      publicShowHighbreak: true,
      ...(Object.keys(memberWhere).length > 0 ? { member: memberWhere } : {}),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function listPublicHighbreakMemberIds(regionCode?: string, districtCode?: string) {
  const rows = await prisma.member.findMany({
    where: {
      public_highbreak_enabled: true,
      ...(regionCode ? { region_code: regionCode } : {}),
      ...(districtCode ? { district_code: districtCode } : {}),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export function createSystemHighbreakRouter(adminAuth: express.RequestHandler) {
  const router = express.Router();

  router.get('/api/leaderboard/members/highest', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const [clubIds, memberIds] = await Promise.all([
        listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined),
        listPublicHighbreakMemberIds(regionCode || undefined, districtCode || undefined),
      ]);
      if (clubIds.length === 0 || memberIds.length === 0) return res.json([]);
      const rows = await prisma.breakRecord.groupBy({
        by: ['member_id'],
        where: { deleted_at: null, record_type: 'VENUE', club_id: { in: clubIds }, member_id: { in: memberIds } },
        _max: { points: true },
        orderBy: [{ _max: { points: 'desc' } }, { member_id: 'asc' }],
        take,
      });
      const ids = rows.map((r) => r.member_id);
      const members = await prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, member_code: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));
      res.json(rows.map((r) => ({
        memberId: r.member_id,
        member: memberMap.get(r.member_id) || null,
        points: r._max.points || 0,
      })));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/members/monthly', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const month = String(req.query.month || '').trim();
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const range = parseMonthRangeUtc(month);
      if (!range) return res.status(400).json({ error: 'month invalid' });

      const [clubIds, memberIds] = await Promise.all([
        listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined),
        listPublicHighbreakMemberIds(regionCode || undefined, districtCode || undefined),
      ]);
      if (clubIds.length === 0 || memberIds.length === 0) return res.json([]);
      const rows = await prisma.breakRecord.groupBy({
        by: ['member_id'],
        where: { deleted_at: null, record_type: 'VENUE', recorded_at: { gte: range.start, lt: range.end }, club_id: { in: clubIds }, member_id: { in: memberIds } },
        _sum: { points: true },
        orderBy: [{ _sum: { points: 'desc' } }, { member_id: 'asc' }],
        take,
      });
      const ids = rows.map((r) => r.member_id);
      const members = await prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, member_code: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));
      res.json(rows.map((r) => ({
        memberId: r.member_id,
        member: memberMap.get(r.member_id) || null,
        points: r._sum.points || 0,
      })));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/clubs/highest', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const clubIds = await listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined);
      if (clubIds.length === 0) return res.json([]);
      const rows = await prisma.breakRecord.groupBy({
        by: ['club_id'],
        where: { deleted_at: null, record_type: 'VENUE', club_id: { in: clubIds } },
        _max: { points: true },
        orderBy: [{ _max: { points: 'desc' } }, { club_id: 'asc' }],
        take,
      });
      const ids = rows.map((r) => r.club_id);
      const clubs = await prisma.clubProfile.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } },
      });
      const clubMap = new Map(clubs.map((c) => [c.id, c]));
      res.json(rows.map((r) => {
        const club = clubMap.get(r.club_id);
        return {
          clubId: r.club_id,
          club: club ? { ...club, name: club.name || club.member?.name || '' } : null,
          points: r._max.points || 0,
        };
      }));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/clubs/monthly', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const month = String(req.query.month || '').trim();
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const range = parseMonthRangeUtc(month);
      if (!range) return res.status(400).json({ error: 'month invalid' });

      const clubIds = await listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined);
      if (clubIds.length === 0) return res.json([]);
      const rows = await prisma.breakRecord.groupBy({
        by: ['club_id'],
        where: { deleted_at: null, record_type: 'VENUE', recorded_at: { gte: range.start, lt: range.end }, club_id: { in: clubIds } },
        _sum: { points: true },
        orderBy: [{ _sum: { points: 'desc' } }, { club_id: 'asc' }],
        take,
      });
      const ids = rows.map((r) => r.club_id);
      const clubs = await prisma.clubProfile.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } },
      });
      const clubMap = new Map(clubs.map((c) => [c.id, c]));
      res.json(rows.map((r) => {
        const club = clubMap.get(r.club_id);
        return {
          clubId: r.club_id,
          club: club ? { ...club, name: club.name || club.member?.name || '' } : null,
          points: r._sum.points || 0,
        };
      }));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/admin/breaks', adminAuth, async (req, res) => {
    try {
      const page = Number((req.query.page as string) || '1');
      const pageSize = Number((req.query.pageSize as string) || '50');
      const take = Math.max(1, Math.min(Number.isFinite(pageSize) ? Math.floor(pageSize) : 50, 200));
      const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
      const skip = Math.max(0, (safePage - 1) * take);

      const memberId = String((req.query.memberId as string) || '').trim();
      const clubId = String((req.query.clubId as string) || '').trim();
      const month = String((req.query.month as string) || '').trim();
      const q = String((req.query.q as string) || '').trim();
      const recordType = normalizeBreakRecordType(req.query.recordType);
      const includeDeleted = String((req.query.includeDeleted as string) || '').trim() === '1';

      const where: any = {};
      if (!includeDeleted) where.deleted_at = null;
      if (memberId) where.member_id = memberId;
      if (clubId) where.club_id = clubId;
      if (recordType) where.record_type = recordType;
      if (month) {
        const range = parseMonthRangeUtc(month);
        if (!range) return res.status(400).json({ error: 'month invalid' });
        where.recorded_at = { gte: range.start, lt: range.end };
      }
      if (q) {
        where.OR = [
          { note: { contains: q, mode: 'insensitive' } },
          { video_url: { contains: q, mode: 'insensitive' } },
          { member: { name: { contains: q, mode: 'insensitive' } } },
          { member: { member_code: { contains: q, mode: 'insensitive' } } },
          { club: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }

      const [total, rows] = await prisma.$transaction([
        prisma.breakRecord.count({ where }),
        prisma.breakRecord.findMany({
          where,
          orderBy: [{ recorded_at: 'desc' }, { id: 'desc' }],
          skip,
          take,
          include: {
            member: { select: { id: true, name: true, member_code: true } },
            club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
            tournament: { select: { id: true, title: true, startsAt: true } },
          },
        }),
      ]);

      const breaks = rows.map((r: any) => ({
        ...r,
        club: r.club
          ? {
              ...r.club,
              name: r.club.name || r.club.member?.name || '',
            }
          : null,
      }));

      res.json({ total, page: safePage, pageSize: take, breaks });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.patch('/api/admin/breaks/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: '缺少 break ID' });

      const body = (req.body || {}) as {
        points?: number;
        recordedAt?: string;
        videoUrl?: string | null;
        note?: string | null;
        restore?: boolean;
      };

      const data: any = {
        updated_at: new Date(),
        updated_by_admin: 'super_admin',
      };

      if (body.points !== undefined) {
        const p = Number(body.points);
        if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ error: 'points invalid' });
        data.points = Math.floor(p);
      }
      if (body.recordedAt !== undefined) {
        const d = new Date(String(body.recordedAt || ''));
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });
        data.recorded_at = d;
      }
      if (body.videoUrl !== undefined) data.video_url = body.videoUrl ? String(body.videoUrl).trim() : null;
      if (body.note !== undefined) data.note = body.note ? String(body.note).trim() : null;
      if (body.restore) {
        data.deleted_at = null;
        data.deleted_by_admin = null;
        data.delete_reason = null;
      }

      const row = await prisma.breakRecord.update({
        where: { id },
        data,
      });
      res.json(row);
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'break 不存在' });
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.delete('/api/admin/breaks/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: '缺少 break ID' });
      const reasonRaw = (req.body || {}).reason;
      const reason = reasonRaw == null ? null : String(reasonRaw).trim() || null;

      const row = await prisma.breakRecord.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          deleted_by_admin: 'super_admin',
          delete_reason: reason,
          updated_at: new Date(),
          updated_by_admin: 'super_admin',
        },
      });
      res.json(row);
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'break 不存在' });
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  return router;
}
