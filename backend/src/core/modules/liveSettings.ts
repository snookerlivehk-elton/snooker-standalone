import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export type LiveModuleSettings = {
  venuePublishingEnabled: boolean;
  syncToClubMessagesEnabled: boolean;
  announcementCreatedEmailEnabled: boolean;
  announcementUpdatedEmailEnabled: boolean;
  announcementDeletedEmailEnabled: boolean;
};

export const DEFAULT_LIVE_MODULE_SETTINGS: LiveModuleSettings = {
  venuePublishingEnabled: true,
  syncToClubMessagesEnabled: true,
  announcementCreatedEmailEnabled: false,
  announcementUpdatedEmailEnabled: false,
  announcementDeletedEmailEnabled: false,
};

export function normalizeLiveModuleSettings(value: unknown): LiveModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    venuePublishingEnabled: raw.venuePublishingEnabled !== false,
    syncToClubMessagesEnabled: raw.syncToClubMessagesEnabled !== false,
    announcementCreatedEmailEnabled: raw.announcementCreatedEmailEnabled === true,
    announcementUpdatedEmailEnabled: raw.announcementUpdatedEmailEnabled === true,
    announcementDeletedEmailEnabled: raw.announcementDeletedEmailEnabled === true,
  };
}

export async function getLiveModuleSettings(db?: DbClient): Promise<LiveModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'live' },
    select: { settingsJson: true },
  });
  return normalizeLiveModuleSettings(row?.settingsJson || DEFAULT_LIVE_MODULE_SETTINGS);
}

export async function updateLiveModuleSettings(
  patch: Partial<LiveModuleSettings>,
  db?: DbClient,
): Promise<LiveModuleSettings> {
  const current = await getLiveModuleSettings(db);
  const next = normalizeLiveModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'live',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}
