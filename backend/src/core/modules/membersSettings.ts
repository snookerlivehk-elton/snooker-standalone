import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export type MembersModuleSettings = {
  emailRegistrationEnabled: boolean;
  phoneRegistrationEnabled: boolean;
  googleLoginEnabled: boolean;
  passwordResetEnabled: boolean;
  selfProfileEditEnabled: boolean;
  selfPasswordChangeEnabled: boolean;
};

export const DEFAULT_MEMBERS_MODULE_SETTINGS: MembersModuleSettings = {
  emailRegistrationEnabled: true,
  phoneRegistrationEnabled: true,
  googleLoginEnabled: true,
  passwordResetEnabled: true,
  selfProfileEditEnabled: true,
  selfPasswordChangeEnabled: true,
};

export function normalizeMembersModuleSettings(value: unknown): MembersModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    emailRegistrationEnabled: raw.emailRegistrationEnabled !== false,
    phoneRegistrationEnabled: raw.phoneRegistrationEnabled !== false,
    googleLoginEnabled: raw.googleLoginEnabled !== false,
    passwordResetEnabled: raw.passwordResetEnabled !== false,
    selfProfileEditEnabled: raw.selfProfileEditEnabled !== false,
    selfPasswordChangeEnabled: raw.selfPasswordChangeEnabled !== false,
  };
}

export async function getMembersModuleSettings(db?: DbClient): Promise<MembersModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'members' },
    select: { settingsJson: true },
  });
  return normalizeMembersModuleSettings(row?.settingsJson || DEFAULT_MEMBERS_MODULE_SETTINGS);
}

export async function updateMembersModuleSettings(
  patch: Partial<MembersModuleSettings>,
  db?: DbClient,
): Promise<MembersModuleSettings> {
  const current = await getMembersModuleSettings(db);
  const next = normalizeMembersModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'members',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}
