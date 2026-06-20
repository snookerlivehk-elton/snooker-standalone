import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export type ClubMessagesModuleSettings = {
  venuePublishingEnabled: boolean;
  memberInboxEnabled: boolean;
  messageCreatedEmailEnabled: boolean;
  messageUpdatedEmailEnabled: boolean;
  messageDeletedEmailEnabled: boolean;
};

export const DEFAULT_CLUB_MESSAGES_MODULE_SETTINGS: ClubMessagesModuleSettings = {
  venuePublishingEnabled: true,
  memberInboxEnabled: true,
  messageCreatedEmailEnabled: false,
  messageUpdatedEmailEnabled: false,
  messageDeletedEmailEnabled: false,
};

export function normalizeClubMessagesModuleSettings(value: unknown): ClubMessagesModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    venuePublishingEnabled: raw.venuePublishingEnabled !== false,
    memberInboxEnabled: raw.memberInboxEnabled !== false,
    messageCreatedEmailEnabled: raw.messageCreatedEmailEnabled === true,
    messageUpdatedEmailEnabled: raw.messageUpdatedEmailEnabled === true,
    messageDeletedEmailEnabled: raw.messageDeletedEmailEnabled === true,
  };
}

export async function getClubMessagesModuleSettings(db?: DbClient): Promise<ClubMessagesModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'club_messages' },
    select: { settingsJson: true },
  });
  return normalizeClubMessagesModuleSettings(row?.settingsJson || DEFAULT_CLUB_MESSAGES_MODULE_SETTINGS);
}

export async function updateClubMessagesModuleSettings(
  patch: Partial<ClubMessagesModuleSettings>,
  db?: DbClient,
): Promise<ClubMessagesModuleSettings> {
  const current = await getClubMessagesModuleSettings(db);
  const next = normalizeClubMessagesModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'club_messages',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}
