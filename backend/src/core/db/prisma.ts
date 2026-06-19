import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as typeof globalThis & {
  __snookerPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.__snookerPrisma ??
  new PrismaClient();

if (!globalForPrisma.__snookerPrisma) {
  globalForPrisma.__snookerPrisma = prisma;
}
