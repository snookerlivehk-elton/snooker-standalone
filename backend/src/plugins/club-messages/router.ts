import express from 'express';
import { randomUUID } from 'crypto';
import { getMyClubId, requireClubAdmin, requireMember } from '../../core/club/access.js';
import { isSystemClubMessageTitle } from '../../core/club/messages.js';
import { prisma } from '../../core/db/prisma.js';
import { getClubMessagesModuleSettings } from '../../core/modules/clubMessagesSettings.js';

export function createClubMessageRouter() {
  const router = express.Router();

  router.post('/broadcast', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;
    const { title, content } = req.body;
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.venuePublishingEnabled === false) {
      return res.status(403).json({ error: 'club_messages_publish_disabled' });
    }

    try {
      const club = await prisma.clubProfile.findUnique({ where: { memberId } });
      if (!club) return res.status(403).json({ error: 'Club profile not found' });

      const message = await prisma.clubMessage.create({
        data: {
          clubId: club.id,
          title,
          content,
          deletedAt: null,
        },
      });
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/messages', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.memberInboxEnabled === false) return res.json([]);

    try {
      const memberships = await prisma.clubMember.findMany({
        where: { memberId },
        select: { clubId: true },
      });

      const clubIds = memberships.map((m) => m.clubId);
      if (clubIds.length === 0) return res.json([]);

      const messages = await prisma.clubMessage.findMany({
        where: { clubId: { in: clubIds }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { club: { select: { name: true, logoUrl: true } } },
      });
      let readRows: any[] = [];
      try {
        readRows = await prisma.$queryRawUnsafe(`SELECT "messageId" FROM "ClubMessageRead" WHERE "memberId"=$1`, memberId);
      } catch {}
      const readSet = new Set(readRows.map((r) => String(r.messageId)));
      let hiddenRows: any[] = [];
      try {
        hiddenRows = await prisma.$queryRawUnsafe(`SELECT "messageId" FROM "ClubMessageHide" WHERE "memberId"=$1`, memberId);
      } catch {}
      const hiddenSet = new Set(hiddenRows.map((r) => String(r.messageId)));
      const visible = messages.filter((m) => !hiddenSet.has(m.id));
      const withRead = visible.map((m) => ({ ...m, read: readSet.has(m.id) }));
      res.json(withRead);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  router.get('/messages/:id', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = req.params.id;
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.memberInboxEnabled === false) return res.status(404).json({ error: 'Not found' });
    try {
      try {
        const hidden: any[] = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM "ClubMessageHide" WHERE "memberId"=$1 AND "messageId"=$2 LIMIT 1`,
          memberId,
          id,
        );
        if (hidden.length > 0) return res.status(404).json({ error: 'Not found' });
      } catch {}
      const message = await prisma.clubMessage.findUnique({
        where: { id },
        include: { club: { select: { name: true, logoUrl: true } } },
      });
      if (!message || (message as any).deletedAt != null) return res.status(404).json({ error: 'Not found' });
      let read = false;
      try {
        const rows: any[] = await prisma.$queryRawUnsafe(
          `SELECT 1 FROM "ClubMessageRead" WHERE "memberId"=$1 AND "messageId"=$2 LIMIT 1`,
          memberId,
          id,
        );
        read = rows.length > 0;
      } catch {}
      res.json({ ...message, read });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/messages/:id/read', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = req.params.id;
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.memberInboxEnabled === false) return res.json({ ok: true });
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM "ClubMessageRead" WHERE "memberId"=$1 AND "messageId"=$2 LIMIT 1`,
        memberId,
        id,
      );
      if (rows.length === 0) {
        const rid = randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "ClubMessageRead"("id","memberId","messageId","readAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)`,
          rid,
          memberId,
          id,
        );
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.post('/messages/hide', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const ids = (req.body || {}).ids;
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.memberInboxEnabled === false) return res.json({ ok: true, hidden: 0 });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "ClubMessageHide"(
            "id" text PRIMARY KEY,
            "memberId" text NOT NULL,
            "messageId" text NOT NULL,
            "hiddenAt" timestamptz DEFAULT CURRENT_TIMESTAMP,
            UNIQUE("memberId","messageId")
        )`,
      );
      const uniqueIds = Array.from(new Set(ids.map((x: any) => String(x).trim()).filter(Boolean)));
      for (const mid of uniqueIds) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "ClubMessageHide"("id","memberId","messageId","hiddenAt")
             VALUES ($1,$2,$3,CURRENT_TIMESTAMP)
             ON CONFLICT ("memberId","messageId") DO NOTHING`,
          randomUUID(),
          memberId,
          mid,
        );
      }
      res.json({ ok: true, hidden: uniqueIds.length });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/:clubId/messages/public', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 30) || 30));
    try {
      const rows = await prisma.clubMessage.findMany({
        where: {
          clubId,
          deletedAt: null,
          NOT: [{ title: '新預約待確認' }],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const filtered = rows.filter((m) => !isSystemClubMessageTitle((m as any).title));
      res.json(filtered);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.get('/club-messages', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));
    try {
      const rows = await prisma.clubMessage.findMany({
        where: { clubId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const filtered = rows.filter((m) => !isSystemClubMessageTitle((m as any).title));
      res.json(filtered);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.put('/club-messages/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.venuePublishingEnabled === false) {
      return res.status(403).json({ error: 'club_messages_publish_disabled' });
    }
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};
    const patch: any = {};
    if (payload.title !== undefined) patch.title = payload.title == null ? null : String(payload.title || '').trim() || null;
    if (payload.content !== undefined) patch.content = String(payload.content || '').trim();
    try {
      const row = await prisma.clubMessage.findUnique({ where: { id } });
      if (!row || row.clubId !== clubId || row.deletedAt != null) return res.status(404).json({ error: 'Not found' });
      if (isSystemClubMessageTitle((row as any).title)) return res.status(400).json({ error: '不可編輯系統訊息' });
      if (patch.content != null && !patch.content) return res.status(400).json({ error: 'content required' });
      const updated = await prisma.clubMessage.update({ where: { id }, data: patch });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  router.delete('/club-messages/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const settings = await getClubMessagesModuleSettings().catch(() => null);
    if (settings?.venuePublishingEnabled === false) {
      return res.status(403).json({ error: 'club_messages_publish_disabled' });
    }
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
      const row = await prisma.clubMessage.findUnique({ where: { id } });
      if (!row || row.clubId !== clubId || row.deletedAt != null) return res.status(404).json({ error: 'Not found' });
      if (isSystemClubMessageTitle((row as any).title)) return res.status(400).json({ error: '不可刪除系統訊息' });
      const updated = await prisma.clubMessage.update({ where: { id }, data: { deletedAt: new Date() } });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
