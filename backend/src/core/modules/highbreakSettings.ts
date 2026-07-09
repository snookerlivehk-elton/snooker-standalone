import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { upsertClubModuleConfig, upsertSystemModuleConfig } from './config.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

function normalizeThresholdOptions(raw: unknown, fallback: number[]) {
  const source = Array.isArray(raw) ? raw : fallback;
  const normalized = Array.from(new Set(
    source
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 20)
      .map((value) => Math.floor(value)),
  )).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeThreshold(value: unknown, fallback: number, options: number[]) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) && numeric >= 20 ? Math.floor(numeric) : fallback;
  if (options.includes(safe)) return safe;
  const merged = normalizeThresholdOptions([...options, safe], options);
  return merged.includes(safe) ? safe : fallback;
}

export type HighbreakModuleSettings = {
  systemDisplayThresholdDefault: number;
  displayThresholdOptions: number[];
  defaultLeaderboardScope: 'ALL' | 'VENUE' | 'TOURNAMENT';
};

export type ClubHighbreakSettings = {
  displayThresholdMode: 'FOLLOW_SYSTEM' | 'CUSTOM';
  displayThresholdDefault: number;
};

export const DEFAULT_HIGHBREAK_MODULE_SETTINGS: HighbreakModuleSettings = {
  systemDisplayThresholdDefault: 40,
  displayThresholdOptions: [20, 30, 40, 50],
  defaultLeaderboardScope: 'ALL',
};

export const DEFAULT_CLUB_HIGHBREAK_SETTINGS: ClubHighbreakSettings = {
  displayThresholdMode: 'FOLLOW_SYSTEM',
  displayThresholdDefault: 40,
};

export function normalizeHighbreakModuleSettings(value: unknown): HighbreakModuleSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const displayThresholdOptions = normalizeThresholdOptions(
    raw.displayThresholdOptions,
    DEFAULT_HIGHBREAK_MODULE_SETTINGS.displayThresholdOptions,
  );
  const defaultLeaderboardScope = String(raw.defaultLeaderboardScope || DEFAULT_HIGHBREAK_MODULE_SETTINGS.defaultLeaderboardScope)
    .trim()
    .toUpperCase();
  return {
    systemDisplayThresholdDefault: normalizeThreshold(
      raw.systemDisplayThresholdDefault,
      DEFAULT_HIGHBREAK_MODULE_SETTINGS.systemDisplayThresholdDefault,
      displayThresholdOptions,
    ),
    displayThresholdOptions,
    defaultLeaderboardScope:
      defaultLeaderboardScope === 'VENUE' || defaultLeaderboardScope === 'TOURNAMENT'
        ? defaultLeaderboardScope
        : 'ALL',
  };
}

export function normalizeClubHighbreakSettings(value: unknown, moduleSettings?: HighbreakModuleSettings): ClubHighbreakSettings {
  const resolvedModuleSettings = moduleSettings || DEFAULT_HIGHBREAK_MODULE_SETTINGS;
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const mode = String(raw.displayThresholdMode || DEFAULT_CLUB_HIGHBREAK_SETTINGS.displayThresholdMode)
    .trim()
    .toUpperCase();
  return {
    displayThresholdMode: mode === 'CUSTOM' ? 'CUSTOM' : 'FOLLOW_SYSTEM',
    displayThresholdDefault: normalizeThreshold(
      raw.displayThresholdDefault,
      resolvedModuleSettings.systemDisplayThresholdDefault,
      resolvedModuleSettings.displayThresholdOptions,
    ),
  };
}

export async function getHighbreakModuleSettings(db?: DbClient): Promise<HighbreakModuleSettings> {
  const row = await getDb(db).systemModuleConfig.findUnique({
    where: { moduleCode: 'highbreak' },
    select: { settingsJson: true },
  });
  return normalizeHighbreakModuleSettings(row?.settingsJson || DEFAULT_HIGHBREAK_MODULE_SETTINGS);
}

export async function updateHighbreakModuleSettings(
  patch: Partial<HighbreakModuleSettings>,
  db?: DbClient,
): Promise<HighbreakModuleSettings> {
  const current = await getHighbreakModuleSettings(db);
  const next = normalizeHighbreakModuleSettings({
    ...current,
    ...patch,
  });
  await upsertSystemModuleConfig(
    'highbreak',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}

export async function getClubHighbreakSettings(clubId: string, db?: DbClient): Promise<ClubHighbreakSettings> {
  const [moduleSettings, row] = await Promise.all([
    getHighbreakModuleSettings(db),
    getDb(db).clubModuleConfig.findUnique({
      where: { clubId_moduleCode: { clubId, moduleCode: 'highbreak' } },
      select: { settingsJson: true },
    }),
  ]);
  return normalizeClubHighbreakSettings(row?.settingsJson || DEFAULT_CLUB_HIGHBREAK_SETTINGS, moduleSettings);
}

export async function updateClubHighbreakSettings(
  clubId: string,
  patch: Partial<ClubHighbreakSettings>,
  db?: DbClient,
): Promise<ClubHighbreakSettings> {
  const moduleSettings = await getHighbreakModuleSettings(db);
  const current = await getClubHighbreakSettings(clubId, db);
  const next = normalizeClubHighbreakSettings({
    ...current,
    ...patch,
  }, moduleSettings);
  await upsertClubModuleConfig(
    clubId,
    'highbreak',
    {
      settingsJson: next,
    },
    db,
  );
  return next;
}

export async function getEffectiveClubHighbreakSettings(clubId: string, db?: DbClient) {
  const [moduleSettings, clubSettings] = await Promise.all([
    getHighbreakModuleSettings(db),
    getClubHighbreakSettings(clubId, db),
  ]);
  const effectiveMinPoints = clubSettings.displayThresholdMode === 'CUSTOM'
    ? clubSettings.displayThresholdDefault
    : moduleSettings.systemDisplayThresholdDefault;
  return {
    moduleSettings,
    clubSettings,
    effectiveMinPoints,
  };
}
