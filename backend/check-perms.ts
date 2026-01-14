
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Try to add a dummy column to MatchPlayer to check ownership
    await prisma.$executeRawUnsafe(`ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "temp_check" INT;`);
    console.log('Have permission on MatchPlayer');
    await prisma.$executeRawUnsafe(`ALTER TABLE "MatchPlayer" DROP COLUMN "temp_check";`);
  } catch (err: any) {
    console.log('No permission on MatchPlayer:', err.message);
  }
  
  try {
    // Try to add a dummy column to Match to check ownership
    await prisma.$executeRawUnsafe(`ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "temp_check" INT;`);
    console.log('Have permission on Match');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Match" DROP COLUMN "temp_check";`);
  } catch (err: any) {
    console.log('No permission on Match:', err.message);
  }
}

main();
