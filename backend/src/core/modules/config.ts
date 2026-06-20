import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { MODULE_MANIFESTS, type ModuleManifest } from './registry.js';

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

    const defaultConfig = buildDefaultSystemModuleConfig(module, index);
    await runner.systemModuleConfig.upsert({
      where: { moduleCode: module.code },
      update: {
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
