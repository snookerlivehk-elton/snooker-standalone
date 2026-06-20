import express from 'express';
import { getMyClubId, requireClubAdmin, requireMember, requireMemberCapability } from '../../core/club/access.js';
import { getBookingModuleSettings } from '../../core/modules/bookingSettings.js';
import { bookingService } from './service.js';

export function createBookingRouter() {
  const router = express.Router();

  router.post('/tables', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.createTable(clubId, req.body || {}));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  router.put('/tables/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.updateTable(clubId, req.params.id, req.body || {}));
    } catch (e: any) {
      const msg = String(e?.message || e);
      res.status(msg === 'Not found' ? 404 : 400).json({ error: msg });
    }
  });

  router.delete('/tables/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.deleteTable(clubId, req.params.id));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'Not found' ? 404 : 409;
      res.status(code).json({ error: msg });
    }
  });

  router.get('/pricing/my', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    res.json(await bookingService.listPricing(clubId));
  });

  router.post('/pricing', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.createPricing(clubId, req.body || {}));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  router.put('/pricing/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.updatePricing(clubId, req.params.id, req.body || {}));
    } catch (e: any) {
      const msg = String(e?.message || e);
      res.status(msg === 'Not found' ? 404 : 400).json({ error: msg });
    }
  });

  router.delete('/pricing/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.deletePricing(clubId, req.params.id));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'Not found' ? 404 : 409;
      res.status(code).json({ error: msg });
    }
  });

  router.get('/reservations', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const status = req.query.status == null ? undefined : String(req.query.status).toUpperCase();
    res.json(await bookingService.listReservations(clubId, status));
  });

  router.get('/reservations/pending', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    res.json(await bookingService.listPendingReservations(clubId));
  });

  router.post('/reservations/:id/confirm', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.confirmReservation(clubId, req.params.id));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'Not found' ? 404 : msg === 'Time slot taken' ? 409 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.post('/reservations/:id/cancel', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.cancelReservation(clubId, req.params.id, (req.body || {}).reason));
    } catch (e: any) {
      const msg = String(e?.message || e);
      res.status(msg === 'Not found' ? 404 : 400).json({ error: msg });
    }
  });

  router.get('/:clubId/tables', async (req, res) => {
    const { clubId } = req.params;
    res.json(await bookingService.listPublicTables(clubId));
  });

  router.get('/:clubId/pricing', async (req, res) => {
    try {
      res.json(await bookingService.listPublicPricing(req.params.clubId, req.query || {}));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  router.get('/:clubId/availability', async (req, res) => {
    try {
      res.json(await bookingService.listAvailability(req.params.clubId, req.query || {}));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  router.post('/reservations/manual', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
      res.json(await bookingService.createManualReservation(clubId, member.id, req.body || {}));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'Table not found' ? 404 : msg.includes('已被預約') || msg.includes('已被預約/封鎖') ? 409 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.post('/:clubId/reservations', async (req, res) => {
    const settings = await getBookingModuleSettings().catch(() => null);
    const member = await requireMemberCapability(req, res, 'booking.create', settings?.bookingCreateRequirement);
    if (!member) return;
    try {
      res.json(await bookingService.createMemberReservation(req.params.clubId, member.id, req.body || {}));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code =
        msg === 'Table not found' ? 404 :
        msg.includes('已被預約') ? 409 :
        400;
      res.status(code).json({ error: msg });
    }
  });

  router.get('/:clubId/reservations/my', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    res.json(await bookingService.listMyReservations(req.params.clubId, member.id));
  });

  router.post('/:clubId/reservations/:id/cancel', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    try {
      res.json(await bookingService.cancelMyReservation(req.params.clubId, member.id, req.params.id, (req.body || {}).reason));
    } catch (e: any) {
      const msg = String(e?.message || e);
      res.status(msg === 'Not found' ? 404 : 400).json({ error: msg });
    }
  });

  return router;
}
