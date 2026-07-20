import 'dotenv/config';
import { prisma } from '../src/core/db/prisma.js';
import { createClubTables } from './create_club_tables.js';

async function main() {
  console.log('Running manual club schema bootstrap...');
  await createClubTables(prisma);
  console.log('Club schema bootstrap completed.');
}

main()
  .catch((error) => {
    console.error('Club schema bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
