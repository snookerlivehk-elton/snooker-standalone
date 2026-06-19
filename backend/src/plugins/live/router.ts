import express from 'express';
import { randomUUID } from 'crypto';
import { getMyClubId, requireClubAdmin } from '../../core/club/access.js';
import { prisma } from '../../core/db/prisma.js';
import { formatHongKongDateTime, normalizeHttpUrl } from '../../core/live/utils.js';

export function createLiveRouter() {
  const router = express.Router();

  router.post('/live-announcements', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const payload = req.body || {};
    const title = String(payload.title || '').trim();
    const startsAtRaw = payload.startsAt;
    const liveUrl = normalizeHttpUrl(payload.liveUrl);
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!startsAtRaw) return res.status(400).json({ error: 'startsAt required' });
    if (!liveUrl) return res.status(400).json({ error: 'liveUrl required' });
    const startsAt = new Date(String(startsAtRaw));
    if (!Number.isFinite(startsAt.getTime())) return res.status(400).json({ error: 'startsAt invalid' });

    const row = await prisma.liveAnnouncement.create({
      data: {
        id: randomUUID(),
        clubId,
        title,
        startsAt,
        liveUrl,
        createdByMemberId: member.id,
      },
    });
    try {
      const msgTitle = `直播通告：${title}`;
      const content = `日期時間：${formatHongKongDateTime(startsAt)}\n直播連結：${liveUrl}`;
      await prisma.clubMessage.create({ data: { clubId, title: msgTitle, content } });
    } catch {}
    res.json(row);
  });

  router.put('/live-announcements/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};

    const patch: any = {};
    if (payload.title != null) patch.title = String(payload.title || '').trim();
    if (payload.startsAt !== undefined) {
      const v = payload.startsAt;
      if (v == null || String(v).trim() === '') patch.startsAt = null;
      else {
        const d = new Date(String(v));
        if (!Number.isFinite(d.getTime())) return res.status(400).json({ error: 'startsAt invalid' });
        patch.startsAt = d;
      }
    }
    if (payload.liveUrl !== undefined) {
      const u = normalizeHttpUrl(payload.liveUrl);
      if (!u) return res.status(400).json({ error: 'liveUrl invalid' });
      patch.liveUrl = u;
    }

    try {
      const row = await prisma.liveAnnouncement.findUnique({ where: { id } });
      if (!row || row.clubId !== clubId || row.deletedAt != null) return res.status(404).json({ error: 'Not found' });
      if (patch.title != null && !patch.title) return res.status(400).json({ error: 'title required' });
      if (patch.startsAt === null) return res.status(400).json({ error: 'startsAt required' });
      const updated = await prisma.liveAnnouncement.update({
        where: { id },
        data: patch,
      });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/live-announcements', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const rows = await prisma.liveAnnouncement.findMany({
      where: { clubId, deletedAt: null },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(rows);
  });

  router.delete('/live-announcements/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const row = await prisma.liveAnnouncement.findUnique({ where: { id } });
    if (!row || row.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.liveAnnouncement.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json(updated);
  });

  router.get('/live-announcements/public', async (req, res) => {
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 20) || 20));
    const now = new Date();
    const rows = await prisma.liveAnnouncement.findMany({
      where: { deletedAt: null, startsAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
      orderBy: [{ startsAt: 'asc' }],
      take: limit,
      include: { club: { select: { id: true, name: true, logoUrl: true } } },
    });
    res.json(rows);
  });

  router.get('/:clubId/live-announcements/public', async (req, res) => {
    const { clubId } = req.params;
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(20, Math.max(1, Number(limitRaw || 5) || 5));
    const now = new Date();
    const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const recent = await prisma.liveAnnouncement.findMany({
      where: { clubId, deletedAt: null, startsAt: { gte: cutoff } },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
    if (recent.length >= limit) return res.json(recent);
    const more = await prisma.liveAnnouncement.findMany({
      where: { clubId, deletedAt: null },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    const seen = new Set(recent.map((x) => x.id));
    const merged = recent.concat(more.filter((x) => !seen.has(x.id))).slice(0, limit);
    res.json(merged);
  });

  return router;
}
