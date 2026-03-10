import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Attempting to add google_id column to Member table...');
  try {
    await prisma.$executeRaw`ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "google_id" TEXT;`;
    console.log('Successfully added google_id column.');
    
    await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Member_google_id_key" ON "Member"("google_id");`;
    console.log('Successfully added unique index on google_id.');
  } catch (e) {
    console.error('Error adding column:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
