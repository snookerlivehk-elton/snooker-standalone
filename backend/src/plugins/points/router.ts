import express from 'express';
import { getMyClubId, requireClubAdmin, requireMember } from '../../core/club/access.js';
import { isFeatureEnabled, requireClubFeatureForClubId } from '../../core/features/featureAccess.js';
import { getPointsModuleSettings } from '../../core/modules/pointsSettings.js';
import { pointsService } from './service.js';

export function createPointsRouter() {
  const router = express.Router();

  router.get('/points/config', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    res.json(await pointsService.getConfigOrDefault(clubId));
  });

  router.put('/points/config', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const settings = await getPointsModuleSettings().catch(() => null);
    if (settings?.clubPointsConfigEditable === false) {
      return res.status(403).json({ error: 'points_config_edit_disabled' });
    }
    try {
      res.json(await pointsService.saveConfig(clubId, req.body || {}));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  router.get('/points/balances', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    res.json(await pointsService.listBalances(clubId));
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
    res.json(await pointsService.searchBalances(clubId, q, limit));
  });

  router.get('/points/my-balance', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const clubId = req.query.clubId == null ? '' : String(req.query.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    try {
      res.json(await pointsService.getMyBalance(clubId, member.id));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'Not in club' ? 403 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.get('/points/my-balances', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const globalEnabled = await isFeatureEnabled('points');
    if (!globalEnabled) return res.json([]);
    res.json(await pointsService.listMyBalances(member.id));
  });

  router.get('/points/ledger', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    res.json(await pointsService.getLedger(clubId, req.query || {}));
  });

  router.post('/points/adjust', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const settings = await getPointsModuleSettings().catch(() => null);
    if (settings?.manualAdjustmentEnabled === false) {
      return res.status(403).json({ error: 'points_manual_adjustment_disabled' });
    }
    try {
      res.json(await pointsService.adjustBalance(clubId, member.id, req.body || {}));
    } catch (e: any) {
      res.status(400).json({ error: String(e?.message || e) });
    }
  });

  return router;
}
