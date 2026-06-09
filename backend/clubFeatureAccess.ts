import { Prisma, PrismaClient } from '@prisma/client';

export const CLUB_SCOPED_FEATURE_KEYS = ['points', 'tournaments'] as const;

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

export async function getClubFeatureAssignments(
  prisma: PrismaClient | Prisma.TransactionClient,
  clubIds: string[],
  featureKey: ClubScopedFeatureKey,
): Promise<Record<string, ClubFeatureAssignment>> {
  const ids = uniqIds(clubIds);
  const out: Record<string, ClubFeatureAssignment> = {};
  if (ids.length === 0) return out;

  const explicitRows = await prisma.clubFeatureAccess.findMany({
    where: { featureKey, clubId: { in: ids } },
    select: { clubId: true, enabled: true, updatedAt: true },
  });
  const explicitMap = new Map(explicitRows.map((row) => [row.clubId, row]));
  const unresolved = ids.filter((id) => !explicitMap.has(id));
  const legacyEnabledIds =
    unresolved.length > 0
      ? featureKey === 'points'
        ? await getLegacyPointsClubIds(prisma, unresolved)
        : featureKey === 'tournaments'
          ? await getLegacyTournamentsClubIds(prisma, unresolved)
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
        updatedAt: explicit.updatedAt ?? null,
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
