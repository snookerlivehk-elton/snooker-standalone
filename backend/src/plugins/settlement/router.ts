import express from 'express';
import { getMyClubId, requireMember } from '../../core/club/access.js';
import { settlementService } from './service.js';

type CreateSettlementRouterOptions = {
  adminAuth: express.RequestHandler;
};

export function createSettlementRouter(options: CreateSettlementRouterOptions) {
  const router = express.Router();

  router.get('/api/settlements/my', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    try {
      res.json(await settlementService.listMySettlements(member.id, req.query.limit));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/settlements/:id', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    try {
      const adminClubId = member.role === 'ADMIN' ? await getMyClubId(member.id) : null;
      res.json(await settlementService.getSettlementForMember(req.params.id, member, adminClubId));
    } catch (e: any) {
      const msg = String(e?.message || e);
      res.status(msg === 'Not found' ? 404 : 400).json({ error: msg });
    }
  });

  router.post('/api/settlements/:id/confirm', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    try {
      res.json(await settlementService.confirmSettlement(req.params.id, member.id));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'Not found' ? 404 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.get('/api/admin/settlements', options.adminAuth, async (req, res) => {
    try {
      res.json(await settlementService.listSettlements(req.query.limit, req.query.status));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  return router;
}
