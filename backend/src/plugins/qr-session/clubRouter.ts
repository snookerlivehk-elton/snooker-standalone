import express from 'express';
import { getMyClubId, requireClubAdmin } from '../../core/club/access.js';
import { qrSessionService } from './service.js';

export function createClubQrSessionRouter() {
  const router = express.Router();

  router.get('/tables/my', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    res.json(await qrSessionService.listTablesWithQr(clubId));
  });

  router.post('/tables/:id/qr/rotate', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await qrSessionService.rotateTableQr(clubId, String(req.params.id || '').trim()));
    } catch (e: any) {
      res.status(404).json({ error: String(e?.message || e) });
    }
  });

  router.get('/sessions/active', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    res.json(await qrSessionService.listActiveSessions(clubId));
  });

  router.post('/sessions/:id/end', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await qrSessionService.endSessionByOperator(clubId, member.id, String(req.params.id || '').trim()));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  return router;
}
