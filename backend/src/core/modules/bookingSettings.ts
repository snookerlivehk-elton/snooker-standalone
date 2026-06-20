import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export type MemberRequirementLevel = 'BASIC_MEMBER' | 'VERIFIED_MEMBER';

export type BookingModuleSettings = {
  bookingCreateRequirement: MemberRequirementLevel;
  reservationCreatedEmailEnabled: boolean;
  reservationConfirmedEmailEnabled: boolean;
  reservationCancelledEmailEnabled: boolean;
};

export const DEFAULT_BOOKING_MODULE_SETTINGS: BookingModuleSettings = {
  bookingCreateRequirement: 'VERIFIED_MEMBER',
  reservationCreatedEmailEnabled: false,
  reservationConfirmedEmailEnabled: false,
  reservationCancelledEmailEnabled: false,
};

export function normalizeMemberRequirementLevel(value: unknown): MemberRequirementLevel {
  return String(value || '').trim().toUpperCase() === 'VERIFIED_MEMBER' ? 'VERIFIED_MEMBER' : 'BASIC_MEMBER';
}

export function normalizeBookingModuleSettings(value: unknown): BookingModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    bookingCreateRequirement: normalizeMemberRequirementLevel(raw.bookingCreateRequirement),
    reservationCreatedEmailEnabled: raw.reservationCreatedEmailEnabled === true,
    reservationConfirmedEmailEnabled: raw.reservationConfirmedEmailEnabled === true,
    reservationCancelledEmailEnabled: raw.reservationCancelledEmailEnabled === true,
  };
}

export async function getBookingModuleSettings(db?: DbClient): Promise<BookingModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'booking' },
    select: { settingsJson: true },
  });
  return normalizeBookingModuleSettings(row?.settingsJson || DEFAULT_BOOKING_MODULE_SETTINGS);
}

export async function updateBookingModuleSettings(
  patch: Partial<BookingModuleSettings>,
  db?: DbClient,
): Promise<BookingModuleSettings> {
  const current = await getBookingModuleSettings(db);
  const next = normalizeBookingModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'booking',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}
