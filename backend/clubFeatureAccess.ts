import { Prisma, PrismaClient } from '@prisma/client';
import { getModuleManifestByFeatureKey } from './src/core/modules/registry.js';

export const CLUB_SCOPED_FEATURE_KEYS = ['points', 'tournaments', 'booking', 'qr_session'] as const;

export type ClubScopedFeatureKey = typeof CLUB_SCOPED_FEATURE_KEYS[number];
export type ClubFeatureSource = 'explicit' | 'legacy' | 'default_off';
export type ClubFeatureAssignment = {
  clubId: string;
  featureKey: ClubScopedFeatureKey;
  explicitEnabled: boolean | null;
  assignedEnabled: boolean;
  source: ClubFeatureSource;
  updatedAt: Date | null;
};

function uniqIds(ids: string[]) {
  return Array.from(new Set(ids.map((x) => String(x || '').trim()).filter(Boolean)));
}

export function isClubScopedFeatureKey(key: string): key is ClubScopedFeatureKey {
  return CLUB_SCOPED_FEATURE_KEYS.includes(key as ClubScopedFeatureKey);
}

async function getLegacyPointsClubIds(prisma: PrismaClient | Prisma.TransactionClient, clubIds: string[]) {
  const ids = uniqIds(clubIds);
  if (ids.length === 0) return new Set<string>();
  const [cfgRows, ledgerRows, balanceRows] = await Promise.all([
    prisma.clubPointsConfig.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.pointsLedger.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.pointsBalance.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
  ]);
  return new Set<string>([
    ...cfgRows.map((x) => x.clubId),
    ...ledgerRows.map((x) => x.clubId),
    ...balanceRows.map((x) => x.clubId),
  ]);
}

async function getLegacyTournamentsClubIds(prisma: PrismaClient | Prisma.TransactionClient, clubIds: string[]) {
  const ids = uniqIds(clubIds);
  if (ids.length === 0) return new Set<string>();
  const rows = await prisma.tournament.findMany({
    where: { clubId: { in: ids } },
    select: { clubId: true },
    distinct: ['clubId'],
  });
  return new Set<string>(rows.map((x) => x.clubId));
}

async function getLegacyBookingClubIds(prisma: PrismaClient | Prisma.TransactionClient, clubIds: string[]) {
  const ids = uniqIds(clubIds);
  if (ids.length === 0) return new Set<string>();
  const [tableRows, pricingRows, reservationRows, sessionRows] = await Promise.all([
    prisma.clubTable.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.tablePricingScheme.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.tableReservation.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.tableSession.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
  ]);
  return new Set<string>([
    ...tableRows.map((x) => x.clubId),
    ...pricingRows.map((x) => x.clubId),
    ...reservationRows.map((x) => x.clubId),
    ...sessionRows.map((x) => x.clubId),
  ]);
}

async function getLegacyQrSessionClubIds(prisma: PrismaClient | Prisma.TransactionClient, clubIds: string[]) {
  const ids = uniqIds(clubIds);
  if (ids.length === 0) return new Set<string>();
  const [qrRows, sessionRows, confirmRows] = await Promise.all([
    prisma.tableQrToken.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.tableSession.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
    prisma.tableSessionConfirm.findMany({
      where: { clubId: { in: ids } },
      select: { clubId: true },
      distinct: ['clubId'],
    }),
  ]);
  return new Set<string>([
    ...qrRows.map((x) => x.clubId),
    ...sessionRows.map((x) => x.clubId),
    ...confirmRows.map((x) => x.clubId),
  ]);
}

export async function getClubFeatureAssignments(
  prisma: PrismaClient | Prisma.TransactionClient,
  clubIds: string[],
  featureKey: ClubScopedFeatureKey,
): Promise<Record<string, ClubFeatureAssignment>> {
  const ids = uniqIds(clubIds);
  const out: Record<string, ClubFeatureAssignment> = {};
  if (ids.length === 0) return out;

  const moduleCode = getModuleManifestByFeatureKey(featureKey)?.code || null;
  const explicitMap = new Map<string, { enabled: boolean; updatedAt: Date | null }>();

  if (moduleCode) {
    try {
      const moduleRows = await prisma.clubModuleConfig.findMany({
        where: { moduleCode, clubId: { in: ids } },
        select: { clubId: true, enabledForClub: true, updatedAt: true },
      });
      for (const row of moduleRows) {
        explicitMap.set(row.clubId, {
          enabled: row.enabledForClub,
          updatedAt: row.updatedAt ?? null,
        });
      }
    } catch {}
  }

  const legacyExplicitRows = await prisma.clubFeatureAccess.findMany({
    where: { featureKey, clubId: { in: ids.filter((id) => !explicitMap.has(id)) } },
    select: { clubId: true, enabled: true, updatedAt: true },
  });
  for (const row of legacyExplicitRows) {
    explicitMap.set(row.clubId, {
      enabled: row.enabled,
      updatedAt: row.updatedAt ?? null,
    });
  }

  const unresolved = ids.filter((id) => !explicitMap.has(id));
  const legacyEnabledIds =
    unresolved.length > 0
      ? featureKey === 'points'
        ? await getLegacyPointsClubIds(prisma, unresolved)
        : featureKey === 'tournaments'
          ? await getLegacyTournamentsClubIds(prisma, unresolved)
          : featureKey === 'booking'
            ? await getLegacyBookingClubIds(prisma, unresolved)
            : featureKey === 'qr_session'
              ? await getLegacyQrSessionClubIds(prisma, unresolved)
          : new Set<string>()
      : new Set<string>();

  for (const clubId of ids) {
    const explicit = explicitMap.get(clubId);
    if (explicit) {
      out[clubId] = {
        clubId,
        featureKey,
        explicitEnabled: explicit.enabled,
        assignedEnabled: explicit.enabled !== false,
        source: 'explicit',
        updatedAt: explicit.updatedAt,
      };
      continue;
    }
    const legacyEnabled = legacyEnabledIds.has(clubId);
    out[clubId] = {
      clubId,
      featureKey,
      explicitEnabled: null,
      assignedEnabled: legacyEnabled,
      source: legacyEnabled ? 'legacy' : 'default_off',
      updatedAt: null,
    };
  }
  return out;
}

export async function getClubFeatureAssignment(
  prisma: PrismaClient | Prisma.TransactionClient,
  clubId: string,
  featureKey: ClubScopedFeatureKey,
): Promise<ClubFeatureAssignment> {
  const map = await getClubFeatureAssignments(prisma, [clubId], featureKey);
  return (
    map[clubId] || {
      clubId,
      featureKey,
      explicitEnabled: null,
      assignedEnabled: false,
      source: 'default_off',
      updatedAt: null,
    }
  );
}
