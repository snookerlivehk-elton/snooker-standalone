import express from 'express';
import { requireMember } from '../../core/club/access.js';
import { qrSessionService } from './service.js';

type CreateMemberQrSessionRouterOptions = {
  getFeatureMap: () => Promise<Record<string, boolean>>;
  requireFeature: (key: 'qr_session') => express.RequestHandler;
};

export function createMemberQrSessionRouter(options: CreateMemberQrSessionRouterOptions) {
  const router = express.Router();

  router.get('/api/qr/table/info', options.requireFeature('qr_session'), async (req, res) => {
    try {
      const member = await requireMember(req, res);
      if (!member) return;
      const token = String((req.query as any).token || '').trim();
      if (!token) return res.status(400).json({ error: 'token required' });
      res.json(await qrSessionService.getTableInfo(member.id, token));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg.startsWith('feature_disabled:') ? 403 : msg === 'Table disabled' ? 409 : msg === 'Not found' ? 404 : 500;
      const body = msg.startsWith('feature_disabled:')
        ? { error: 'feature_disabled', feature: 'qr_session', scope: 'club', clubId: msg.split(':')[1] }
        : { error: msg };
      res.status(code).json(body);
    }
  });

  router.post('/api/qr/table/start-init', options.requireFeature('qr_session'), async (req, res) => {
    try {
      const member = await requireMember(req, res);
      if (!member) return;
      const token = String((req.body || {}).token || '').trim();
      if (!token) return res.status(400).json({ error: 'token required' });
      res.json(await qrSessionService.startInit(member.id, token, options.getFeatureMap));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code =
        msg.startsWith('feature_disabled:') ? 403 :
        msg === 'Table disabled' || msg === 'already_active' ? 409 :
        msg === 'Not found' ? 404 : 500;
      const body = msg.startsWith('feature_disabled:')
        ? { error: 'feature_disabled', feature: 'qr_session', scope: 'club', clubId: msg.split(':')[1] }
        : { error: msg };
      res.status(code).json(body);
    }
  });

  router.post('/api/qr/table/start-confirm', options.requireFeature('qr_session'), async (req, res) => {
    try {
      const member = await requireMember(req, res);
      if (!member) return;
      const confirmId = String((req.body || {}).confirmId || '').trim();
      if (!confirmId) return res.status(400).json({ error: 'confirmId required' });
      res.json(await qrSessionService.confirmStart(member.id, confirmId));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'already_active' ? 409 : msg === 'expired' ? 410 : msg === 'forbidden' || msg === 'feature_disabled' ? 403 : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.post('/api/qr/table/end-init', options.requireFeature('qr_session'), async (req, res) => {
    try {
      const member = await requireMember(req, res);
      if (!member) return;
      const token = String((req.body || {}).token || '').trim();
      if (!token) return res.status(400).json({ error: 'token required' });
      res.json(await qrSessionService.endInit(member.id, token, options.getFeatureMap));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code =
        msg.startsWith('feature_disabled:') ? 403 :
        msg === 'no_active_session' ? 404 :
        msg === 'Not found' ? 404 : 500;
      const body = msg.startsWith('feature_disabled:')
        ? { error: 'feature_disabled', feature: 'qr_session', scope: 'club', clubId: msg.split(':')[1] }
        : { error: msg };
      res.status(code).json(body);
    }
  });

  router.post('/api/qr/table/end-confirm', options.requireFeature('qr_session'), async (req, res) => {
    try {
      const member = await requireMember(req, res);
      if (!member) return;
      const confirmId = String((req.body || {}).confirmId || '').trim();
      if (!confirmId) return res.status(400).json({ error: 'confirmId required' });
      const featureMap = await options.getFeatureMap();
      res.json(await qrSessionService.confirmEnd(member.id, confirmId, featureMap));
    } catch (e: any) {
      const msg = String(e?.message || e);
      const code = msg === 'expired' ? 410 : msg === 'forbidden' ? 403 : 400;
      res.status(code).json({ error: msg });
    }
  });

  return router;
}
