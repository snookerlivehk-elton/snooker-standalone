import express from 'express';
import { randomUUID } from 'crypto';
import { getClubFeatureAssignments, isClubScopedFeatureKey } from '../../../clubFeatureAccess.js';
import { prisma } from '../../core/db/prisma.js';

type FeatureCatalogItem = {
  key: string;
  label: string;
  defaultEnabled: boolean;
};

type FeatureRouterOptions = {
  adminAuth: express.RequestHandler;
  featureCatalog: readonly FeatureCatalogItem[];
  getFeatureMap: () => Promise<Record<string, boolean>>;
  invalidateFeatureCache: () => void;
};

export function createAdminFeatureRouter(options: FeatureRouterOptions) {
  const { adminAuth, featureCatalog, getFeatureMap, invalidateFeatureCache } = options;
  const router = express.Router();

  router.get('/api/admin/features', adminAuth, async (_req, res) => {
    const map = await getFeatureMap();
    const rows = featureCatalog.map((f) => ({
      key: f.key,
      label: f.label,
      enabled: map[f.key],
      defaultEnabled: f.defaultEnabled,
    }));
    res.json({ features: rows });
  });

  router.put('/api/admin/features', adminAuth, async (req, res) => {
    const updates = (req.body || {}).updates;
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates_required' });
    const allowed = new Set(featureCatalog.map((f) => f.key));
    const normalized = updates
      .map((u: any) => ({ key: String(u?.key || '').trim(), enabled: !!u?.enabled }))
      .filter((u: any) => allowed.has(u.key as any));
    const unique = new Map<string, boolean>();
    for (const u of normalized) unique.set(u.key, u.enabled);
    const items = Array.from(unique.entries());
    await prisma.$transaction(items.map(([key, enabled]) => prisma.featureFlag.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    })));
    invalidateFeatureCache();
    const map = await getFeatureMap();
    res.json({ ok: true, features: map });
  });

  router.get('/api/admin/club-features/:featureKey', adminAuth, async (req, res) => {
    try {
      const featureKey = String(req.params.featureKey || '').trim();
      if (!isClubScopedFeatureKey(featureKey)) {
        return res.status(400).json({ error: 'unsupported_feature_key' });
      }
      const globalMap = await getFeatureMap();
      const clubs = await prisma.clubProfile.findMany({
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          updatedAt: true,
          memberId: true,
          member: {
            select: {
              id: true,
              name: true,
              email: true,
              is_enabled: true,
              access_expires_at: true,
              created_at: true,
            },
          },
        },
      });
      const assignments = await getClubFeatureAssignments(prisma, clubs.map((club) => club.id), featureKey);
      res.json({
        featureKey,
        globalEnabled: globalMap[featureKey] !== false,
        clubs: clubs.map((club) => {
          const assignment = assignments[club.id];
          return {
            clubId: club.id,
            clubName: String(club.name || club.member?.name || '').trim(),
            adminMemberId: club.memberId,
            adminName: club.member?.name || '',
            adminEmail: club.member?.email || '',
            adminEnabled: club.member?.is_enabled !== false,
            accessExpiresAt: club.member?.access_expires_at ?? null,
            createdAt: club.member?.created_at ?? null,
            updatedAt: club.updatedAt,
            explicitEnabled: assignment?.explicitEnabled ?? null,
            assignedEnabled: assignment?.assignedEnabled ?? false,
            effectiveEnabled: globalMap[featureKey] !== false && (assignment?.assignedEnabled ?? false),
            source: assignment?.source ?? 'default_off',
            assignmentUpdatedAt: assignment?.updatedAt ?? null,
          };
        }),
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.put('/api/admin/club-features/:featureKey/:clubId', adminAuth, async (req, res) => {
    try {
      const featureKey = String(req.params.featureKey || '').trim();
      const clubId = String(req.params.clubId || '').trim();
      if (!isClubScopedFeatureKey(featureKey)) {
        return res.status(400).json({ error: 'unsupported_feature_key' });
      }
      if (!clubId) return res.status(400).json({ error: 'clubId_required' });
      if (typeof (req.body || {}).enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled_required' });
      }
      const club = await prisma.clubProfile.findUnique({ where: { id: clubId }, select: { id: true } });
      if (!club) return res.status(404).json({ error: 'club_not_found' });
      const enabled = Boolean((req.body || {}).enabled);
      const row = await prisma.clubFeatureAccess.upsert({
        where: { clubId_featureKey: { clubId, featureKey } },
        update: { enabled },
        create: { id: randomUUID(), clubId, featureKey, enabled },
        select: { clubId: true, featureKey: true, enabled: true, updatedAt: true },
      });
      const globalMap = await getFeatureMap();
      res.json({
        ok: true,
        featureKey,
        clubId,
        explicitEnabled: row.enabled,
        assignedEnabled: row.enabled,
        effectiveEnabled: globalMap[featureKey] !== false && row.enabled,
        updatedAt: row.updatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  return router;
}
