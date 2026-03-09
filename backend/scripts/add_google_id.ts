
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Attempting to add google_id column to Member table...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "google_id" TEXT;
    `);
    console.log('Column added (or existed).');
    
    console.log('Attempting to add unique constraint...');
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Member_google_id_key" ON "Member"("google_id");
    `);
    console.log('Unique constraint added.');
    
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
