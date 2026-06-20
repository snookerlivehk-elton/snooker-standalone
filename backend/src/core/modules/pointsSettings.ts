import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export type PointsModuleSettings = {
  clubPointsConfigEditable: boolean;
  manualAdjustmentEnabled: boolean;
  manualAdjustmentEmailEnabled: boolean;
  settlementDeductionEmailEnabled: boolean;
};

export const DEFAULT_POINTS_MODULE_SETTINGS: PointsModuleSettings = {
  clubPointsConfigEditable: true,
  manualAdjustmentEnabled: true,
  manualAdjustmentEmailEnabled: false,
  settlementDeductionEmailEnabled: false,
};

export function normalizePointsModuleSettings(value: unknown): PointsModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    clubPointsConfigEditable: raw.clubPointsConfigEditable !== false,
    manualAdjustmentEnabled: raw.manualAdjustmentEnabled !== false,
    manualAdjustmentEmailEnabled: raw.manualAdjustmentEmailEnabled === true,
    settlementDeductionEmailEnabled: raw.settlementDeductionEmailEnabled === true,
  };
}

export async function getPointsModuleSettings(db?: DbClient): Promise<PointsModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'points' },
    select: { settingsJson: true },
  });
  return normalizePointsModuleSettings(row?.settingsJson || DEFAULT_POINTS_MODULE_SETTINGS);
}

export async function updatePointsModuleSettings(
  patch: Partial<PointsModuleSettings>,
  db?: DbClient,
): Promise<PointsModuleSettings> {
  const current = await getPointsModuleSettings(db);
  const next = normalizePointsModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'points',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}
