
import { PrismaClient } from '@prisma/client';

async function testConn(url: string) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url,
      },
    },
  });
  try {
    console.log(`Testing ${url.replace(/:[^:@]+@/, ':***@')} ...`);
    await prisma.$connect();
    console.log('Success!');
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.log('Failed.');
    return false;
  }
}

async function main() {
  const passwords = ['postgres', 'password', '123456', 'admin', 'snooker'];
  
  for (const p of passwords) {
    const url = `postgresql://postgres:${p}@localhost:5432/snooker?schema=public`;
    if (await testConn(url)) {
      console.log(`FOUND VALID CREDENTIALS: ${url}`);
      return;
    }
  }
  console.log('No valid credentials found for postgres user.');
}

main();
