
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Trying to create a test table...');
    await prisma.$executeRawUnsafe(`CREATE TABLE "TestTable" (id SERIAL PRIMARY KEY, name TEXT);`);
    console.log('Created TestTable.');
    
    await prisma.$executeRawUnsafe(`DROP TABLE "TestTable";`);
    console.log('Dropped TestTable.');
    
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
