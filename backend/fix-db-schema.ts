
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Fixing database schema manually...');

    // 1. Ensure MemberRole enum exists
    try {
      await prisma.$executeRawUnsafe(`CREATE TYPE "MemberRole" AS ENUM ('MEMBER', 'ADMIN');`);
      console.log('Created MemberRole enum.');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('MemberRole enum already exists.');
      } else {
        console.warn('Could not create MemberRole enum:', e.message);
      }
    }

    // 2. Add missing columns to Member table
    const columns = [
      { name: 'region_code', type: 'TEXT' },
      { name: 'is_guest', type: 'BOOLEAN DEFAULT false' },
      { name: 'role', type: '"MemberRole" DEFAULT \'MEMBER\'' },
      { name: 'membership_expires_at', type: 'TIMESTAMP(3)' },
      { name: 'email_verified_at', type: 'TIMESTAMP(3)' },
      { name: 'email_verification_token', type: 'TEXT' },
      { name: 'email_verification_expires_at', type: 'TIMESTAMP(3)' }
    ];

    for (const col of columns) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type};`);
        console.log(`Added column ${col.name}.`);
      } catch (e: any) {
         console.error(`Failed to add column ${col.name}:`, e.message);
      }
    }
    
    // 3. Make sure MemberCodeSequence exists (it appeared in schema but check if table exists)
    // Actually, let's just focus on Member for now to fix the 500 error.

    console.log('Schema fix completed.');
    
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
