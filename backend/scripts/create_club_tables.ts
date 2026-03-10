import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating Club tables...');
  
  try {
    // 1. Create ClubProfile table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClubProfile" (
        "id" TEXT NOT NULL,
        "memberId" TEXT NOT NULL,
        "name" TEXT,
        "intro" TEXT,
        "address" TEXT,
        "phone" TEXT,
        "email" TEXT,
        "logoUrl" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "ClubProfile_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created ClubProfile table');

    // 2. Create Unique Index on ClubProfile.memberId
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ClubProfile_memberId_key" ON "ClubProfile"("memberId");
    `);
    console.log('Created ClubProfile_memberId_key');

    // 3. Create ClubMember table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClubMember" (
        "id" TEXT NOT NULL,
        "clubId" TEXT NOT NULL,
        "memberId" TEXT NOT NULL,
        "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "ClubMember_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created ClubMember table');

    // 4. Create Unique Index on ClubMember(clubId, memberId)
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ClubMember_clubId_memberId_key" ON "ClubMember"("clubId", "memberId");
    `);
    console.log('Created ClubMember_clubId_memberId_key');

    // 5. Add Foreign Keys (Use DO block or try/catch to avoid error if exists, or just try)
    // Postgres doesn't support IF NOT EXISTS for constraints easily in one line.
    // We can try adding them and catch errors if they exist.
    
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ClubProfile" ADD CONSTRAINT "ClubProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
      console.log('Added ClubProfile_memberId_fkey');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('ClubProfile_memberId_fkey already exists');
      else console.warn('Error adding ClubProfile_memberId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
      console.log('Added ClubMember_clubId_fkey');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('ClubMember_clubId_fkey already exists');
      else console.warn('Error adding ClubMember_clubId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ClubMember" ADD CONSTRAINT "ClubMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
      console.log('Added ClubMember_memberId_fkey');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('ClubMember_memberId_fkey already exists');
      else console.warn('Error adding ClubMember_memberId_fkey:', e.message);
    }

    // 3. Create ClubMessage table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClubMessage" (
        "id" TEXT NOT NULL,
        "clubId" TEXT NOT NULL,
        "title" TEXT,
        "content" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "ClubMessage_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created ClubMessage table');

  } catch (e) {
    console.error('Error creating tables:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
