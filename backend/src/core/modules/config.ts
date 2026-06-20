import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { MODULE_MANIFESTS, getModuleManifest, type ModuleManifest } from './registry.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export function buildDefaultSystemModuleConfig(module: ModuleManifest, sortOrder: number) {
  return {
    enabledGlobally: module.defaultEnabled,
    publicVisible: module.supportsPublicRoutes,
    homeVisible: module.supportsHomeSection,
    allowClubEnable: !!module.supportsClubAssignment,
    sortOrder,
  };
}

export function buildDefaultClubModuleConfig(module: ModuleManifest) {
  return {
    enabledForClub: false,
    publicVisible: module.supportsPublicRoutes && module.supportsHomeSection,
  };
}

export async function syncModuleRegistry(db?: DbClient) {
  const runner = getDb(db);
  for (const [index, module] of MODULE_MANIFESTS.entries()) {
    const defaultConfig = buildDefaultSystemModuleConfig(module, index);
    await runner.systemModule.upsert({
      where: { code: module.code },
      update: {
        name: module.label,
        description: module.description,
        category: module.category,
        pluginId: module.pluginId,
        defaultEnabled: module.defaultEnabled,
        supportsClubAssignment: !!module.supportsClubAssignment,
        supportsPublicRoutes: module.supportsPublicRoutes,
        supportsHomeSection: module.supportsHomeSection,
        supportsVenueAdmin: module.supportsVenueAdmin,
        supportsSuperAdmin: module.supportsSuperAdmin,
      },
      create: {
        code: module.code,
        name: module.label,
        description: module.description,
        category: module.category,
        pluginId: module.pluginId,
        defaultEnabled: module.defaultEnabled,
        supportsClubAssignment: !!module.supportsClubAssignment,
        supportsPublicRoutes: module.supportsPublicRoutes,
        supportsHomeSection: module.supportsHomeSection,
        supportsVenueAdmin: module.supportsVenueAdmin,
        supportsSuperAdmin: module.supportsSuperAdmin,
      },
    });
    await runner.systemModuleConfig.upsert({
      where: { moduleCode: module.code },
      update: module.code === 'club_messages'
        ? {
            allowClubEnable: defaultConfig.allowClubEnable,
            publicVisible: defaultConfig.publicVisible,
          }
        : {
            allowClubEnable: defaultConfig.allowClubEnable,
          },
      create: {
        moduleCode: module.code,
        ...defaultConfig,
      },
    });
  }
}

export async function listSystemModulesWithConfig(db?: DbClient) {
  const rows = await getDb(db).systemModule.findMany({
    include: { config: true },
    orderBy: [{ code: 'asc' }],
  });
  return rows.sort((a, b) => {
    const sortA = a.config?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const sortB = b.config?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (sortA !== sortB) return sortA - sortB;
    return String(a.code).localeCompare(String(b.code));
  });
}

export async function upsertSystemModuleConfig(
  moduleCode: string,
  patch: Partial<{
    enabledGlobally: boolean;
    publicVisible: boolean;
    homeVisible: boolean;
    allowClubEnable: boolean;
    sortOrder: number;
    settingsJson: any;
  }>,
  db?: DbClient,
) {
  const module = getModuleManifest(moduleCode);
  if (!module) throw new Error('module_not_found');
  const runner = getDb(db);
  const defaultConfig = buildDefaultSystemModuleConfig(module, 0);
  return runner.systemModuleConfig.upsert({
    where: { moduleCode: module.code },
    update: patch,
    create: {
      moduleCode: module.code,
      ...defaultConfig,
      ...patch,
    },
  });
}

export async function upsertClubModuleConfig(
  clubId: string,
  moduleCode: string,
  patch: Partial<{
    enabledForClub: boolean;
    publicVisible: boolean;
    settingsJson: any;
  }>,
  db?: DbClient,
) {
  const module = getModuleManifest(moduleCode);
  if (!module) throw new Error('module_not_found');
  const runner = getDb(db);
  const defaultConfig = buildDefaultClubModuleConfig(module);
  return runner.clubModuleConfig.upsert({
    where: { clubId_moduleCode: { clubId, moduleCode: module.code } },
    update: patch,
    create: {
      clubId,
      moduleCode: module.code,
      ...defaultConfig,
      ...patch,
    },
  });
}

export type ResolvedModuleState = ModuleManifest & {
  enabledGlobally: boolean;
  publicVisible: boolean;
  homeVisible: boolean;
  allowClubEnable: boolean;
  sortOrder: number;
  effectivePublicVisible: boolean;
  effectiveHomeVisible: boolean;
};

export async function listResolvedModuleStates(db?: DbClient): Promise<ResolvedModuleState[]> {
  const defaults = MODULE_MANIFESTS.map((module, index) => {
    const cfg = buildDefaultSystemModuleConfig(module, index);
    return {
      ...module,
      enabledGlobally: cfg.enabledGlobally,
      publicVisible: cfg.publicVisible,
      homeVisible: cfg.homeVisible,
      allowClubEnable: cfg.allowClubEnable,
      sortOrder: cfg.sortOrder,
      effectivePublicVisible: module.supportsPublicRoutes && cfg.enabledGlobally && cfg.publicVisible,
      effectiveHomeVisible: module.supportsHomeSection && cfg.enabledGlobally && cfg.publicVisible && cfg.homeVisible,
    } satisfies ResolvedModuleState;
  });

  try {
    const rows = await getDb(db).systemModuleConfig.findMany({
      select: {
        moduleCode: true,
        enabledGlobally: true,
        publicVisible: true,
        homeVisible: true,
        allowClubEnable: true,
        sortOrder: true,
      },
    });
    const byCode = new Map(rows.map((row) => [row.moduleCode, row]));
    return defaults
      .map((row) => {
        const cfg = byCode.get(row.code);
        if (!cfg) return row;
        return {
          ...row,
          enabledGlobally: cfg.enabledGlobally,
          publicVisible: cfg.publicVisible,
          homeVisible: cfg.homeVisible,
          allowClubEnable: cfg.allowClubEnable,
          sortOrder: cfg.sortOrder,
          effectivePublicVisible: row.supportsPublicRoutes && cfg.enabledGlobally && cfg.publicVisible,
          effectiveHomeVisible: row.supportsHomeSection && cfg.enabledGlobally && cfg.publicVisible && cfg.homeVisible,
        } satisfies ResolvedModuleState;
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || String(a.code).localeCompare(String(b.code)));
  } catch {
    return defaults.sort((a, b) => a.sortOrder - b.sortOrder || String(a.code).localeCompare(String(b.code)));
  }
}
