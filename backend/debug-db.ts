
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing DB connection...');
    const count = await prisma.member.count();
    console.log('Member count:', count);
    
    console.log('Fetching members...');
    const members = await prisma.member.findMany({
      take: 5,
      orderBy: { created_at: 'desc' }
    });
    console.log('Members fetched:', members.length);
    console.log('Success!');
  } catch (err: any) {
    console.error('Error occurred:', err);
    console.error('Stack:', err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
