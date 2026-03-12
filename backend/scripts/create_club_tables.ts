import { PrismaClient } from '@prisma/client';

export async function createClubTables(prisma: PrismaClient) {
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

    // 5. Add Foreign Keys
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

    // 6. Create ClubMessage table
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

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClubMessageRead" (
        "id" TEXT NOT NULL,
        "memberId" TEXT NOT NULL,
        "messageId" TEXT NOT NULL,
        "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClubMessageRead_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ClubMessageRead_memberId_messageId_key" ON "ClubMessageRead"("memberId","messageId");`);
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ClubMessageRead" ADD CONSTRAINT "ClubMessageRead_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (e.message.includes('already exists')) { /* no-op */ } else console.warn('Error adding ClubMessageRead_memberId_fkey:', e.message);
    }
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ClubMessageRead" ADD CONSTRAINT "ClubMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ClubMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (e.message.includes('already exists')) { /* no-op */ } else console.warn('Error adding ClubMessageRead_messageId_fkey:', e.message);
    }

    // 7. Create MatchInvite table (targeted invitations for members to join a room/match)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MatchInvite" (
        "id" TEXT NOT NULL,
        "roomId" TEXT NOT NULL,
        "operatorId" TEXT,
        "memberId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "acceptedAt" TIMESTAMP(3),
        CONSTRAINT "MatchInvite_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created MatchInvite table');
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MatchInvite_token_key" ON "MatchInvite"("token");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchInvite_roomId_idx" ON "MatchInvite"("roomId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MatchInvite_memberId_idx" ON "MatchInvite"("memberId");`);
    // Add FKs best-effort (may fail if already exists)
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "MatchInvite" ADD CONSTRAINT "MatchInvite_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
      console.log('Added MatchInvite_memberId_fkey');
    } catch (e: any) {
      if (e.message.includes('already exists')) console.log('MatchInvite_memberId_fkey already exists');
      else console.warn('Error adding MatchInvite_memberId_fkey:', e.message);
    }

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClubTable" (
        "id" TEXT NOT NULL,
        "clubId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClubTable_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClubTable_clubId_active_idx" ON "ClubTable"("clubId", "active");`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TablePricingScheme" (
        "id" TEXT NOT NULL,
        "clubId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "price" DECIMAL(65,30),
        "rulesJson" JSONB NOT NULL,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TablePricingScheme_pkey" PRIMARY KEY ("id")
      );
    `);
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "TablePricingScheme" ADD COLUMN IF NOT EXISTS "price" DECIMAL(65,30);`);
    } catch {}
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TablePricingScheme_clubId_active_idx" ON "TablePricingScheme"("clubId", "active");`);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TableReservation" (
        "id" TEXT NOT NULL,
        "clubId" TEXT NOT NULL,
        "tableId" TEXT NOT NULL,
        "memberId" TEXT NOT NULL,
        "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
        "startAt" TIMESTAMP(3) NOT NULL,
        "endAt" TIMESTAMP(3) NOT NULL,
        "pricingSchemeId" TEXT,
        "priceQuote" DECIMAL(65,30),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "confirmedAt" TIMESTAMP(3),
        "cancelledAt" TIMESTAMP(3),
        "cancelReason" TEXT,
        CONSTRAINT "TableReservation_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TableReservation_clubId_startAt_idx" ON "TableReservation"("clubId", "startAt");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TableReservation_tableId_startAt_idx" ON "TableReservation"("tableId", "startAt");`);

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "ClubTable" ADD CONSTRAINT "ClubTable_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.warn('Error adding ClubTable_clubId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TablePricingScheme" ADD CONSTRAINT "TablePricingScheme_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.warn('Error adding TablePricingScheme_clubId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.warn('Error adding TableReservation_clubId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "ClubTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.warn('Error adding TableReservation_tableId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.warn('Error adding TableReservation_memberId_fkey:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_pricingSchemeId_fkey" FOREIGN KEY ("pricingSchemeId") REFERENCES "TablePricingScheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
    } catch (e: any) {
      if (!e.message.includes('already exists')) console.warn('Error adding TableReservation_pricingSchemeId_fkey:', e.message);
    }

  } catch (e) {
    console.error('Error creating tables:', e);
  }
}
