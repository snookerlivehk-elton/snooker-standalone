import express from 'express';
import { Prisma } from '@prisma/client';
import { getClubFeatureAssignment, type ClubScopedFeatureKey } from '../../../clubFeatureAccess.js';
import { prisma } from '../db/prisma.js';
import { FEATURE_CATALOG, FEATURE_DEFAULTS, getModuleManifestByFeatureKey } from '../modules/registry.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export async function getFeatureEnabledMap(featureKeys?: string[], db?: DbClient): Promise<Record<string, boolean>> {
  const requested = Array.isArray(featureKeys) && featureKeys.length
    ? FEATURE_CATALOG.filter((item) => featureKeys.includes(item.key))
    : FEATURE_CATALOG;
  if (requested.length === 0) return {};

  const runner = getDb(db);
  const defaults: Record<string, boolean> = {};
  for (const item of requested) defaults[item.key] = FEATURE_DEFAULTS[item.key] ?? item.defaultEnabled;

  const moduleCodeToFeatureKey = new Map(requested.map((item) => [item.moduleCode, item.key]));
  const moduleCodes = Array.from(moduleCodeToFeatureKey.keys());
  const resolved = new Set<string>();
  const out: Record<string, boolean> = { ...defaults };

  try {
    const configRows = await runner.systemModuleConfig.findMany({
      where: { moduleCode: { in: moduleCodes } },
      select: { moduleCode: true, enabledGlobally: true },
    });
    for (const row of configRows) {
      const featureKey = moduleCodeToFeatureKey.get(row.moduleCode);
      if (!featureKey) continue;
      out[featureKey] = row.enabledGlobally;
      resolved.add(featureKey);
    }
  } catch {}

  const unresolvedKeys = requested
    .map((item) => item.key)
    .filter((key) => !resolved.has(key));
  if (unresolvedKeys.length > 0) {
    try {
      const rows = await runner.featureFlag.findMany({
        where: { key: { in: unresolvedKeys } },
        select: { key: true, enabled: true },
      });
      for (const row of rows) out[row.key] = row.enabled;
    } catch {}
  }

  return out;
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const featureKey = String(key || '').trim();
  if (!featureKey) return true;

  if (getModuleManifestByFeatureKey(featureKey)) {
    const map = await getFeatureEnabledMap([featureKey]);
    return map[featureKey] ?? (FEATURE_DEFAULTS[featureKey] ?? true);
  }

  try {
    const row = await prisma.featureFlag.findUnique({ where: { key: featureKey }, select: { enabled: true } });
    if (row) return row.enabled;
  } catch {}
  return FEATURE_DEFAULTS[featureKey] ?? true;
}

export async function requireClubFeatureForClubId(
  res: express.Response,
  clubId: string,
  key: ClubScopedFeatureKey,
): Promise<boolean> {
  const globalEnabled = await isFeatureEnabled(key);
  if (!globalEnabled) {
    res.status(403).json({ error: 'feature_disabled', feature: key });
    return false;
  }
  const assignment = await getClubFeatureAssignment(prisma, clubId, key);
  if (!assignment.assignedEnabled) {
    res.status(403).json({ error: 'feature_disabled', feature: key, scope: 'club', clubId });
    return false;
  }
  return true;
}
