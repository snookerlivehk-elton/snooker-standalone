import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export type MemberRequirementLevel = 'BASIC_MEMBER' | 'VERIFIED_MEMBER';

export type TournamentsModuleSettings = {
  tournamentSignupRequirement: MemberRequirementLevel;
  signupCreatedEmailEnabled: boolean;
  signupConfirmedEmailEnabled: boolean;
  signupCancelledEmailEnabled: boolean;
};

export const DEFAULT_TOURNAMENTS_MODULE_SETTINGS: TournamentsModuleSettings = {
  tournamentSignupRequirement: 'VERIFIED_MEMBER',
  signupCreatedEmailEnabled: false,
  signupConfirmedEmailEnabled: false,
  signupCancelledEmailEnabled: false,
};

export function normalizeMemberRequirementLevel(value: unknown): MemberRequirementLevel {
  return String(value || '').trim().toUpperCase() === 'VERIFIED_MEMBER' ? 'VERIFIED_MEMBER' : 'BASIC_MEMBER';
}

export function normalizeTournamentsModuleSettings(value: unknown): TournamentsModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    tournamentSignupRequirement: normalizeMemberRequirementLevel(raw.tournamentSignupRequirement),
    signupCreatedEmailEnabled: raw.signupCreatedEmailEnabled === true,
    signupConfirmedEmailEnabled: raw.signupConfirmedEmailEnabled === true,
    signupCancelledEmailEnabled: raw.signupCancelledEmailEnabled === true,
  };
}

export async function getTournamentsModuleSettings(db?: DbClient): Promise<TournamentsModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'tournaments' },
    select: { settingsJson: true },
  });
  return normalizeTournamentsModuleSettings(row?.settingsJson || DEFAULT_TOURNAMENTS_MODULE_SETTINGS);
}

export async function updateTournamentsModuleSettings(
  patch: Partial<TournamentsModuleSettings>,
  db?: DbClient,
): Promise<TournamentsModuleSettings> {
  const current = await getTournamentsModuleSettings(db);
  const next = normalizeTournamentsModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'tournaments',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}
