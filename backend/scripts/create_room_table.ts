
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting manual table creation...');
  
  try {
    // Create Room table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Room" (
        "id" TEXT NOT NULL,
        "name" TEXT,
        "operator_id" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "gameState" JSONB,
        "scores" JSONB,
        CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created Room table (if not exists)');

    // Add columns if they don't exist (for updates)
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "gameState" JSONB;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "scores" JSONB;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "name" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "code" TEXT;`);
        console.log('Added columns to Room');
    } catch (e: any) {
        console.log('Error adding columns:', e.message);
    }

    // Add FK to Room (operator_id -> Member.id)
    // We check if constraint exists first to avoid error, or just try and catch
    try {
        await prisma.$executeRawUnsafe(`
        ALTER TABLE "Room" ADD CONSTRAINT "Room_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        `);
        console.log('Added FK Room_operator_id_fkey');
    } catch (e: any) {
        if (e.message.includes('already exists')) {
            console.log('FK Room_operator_id_fkey already exists');
        } else {
            console.log('Error adding FK (might already exist):', e.message);
        }
    }
    
    // Add relation from Match to Room
    // Check if column room_id exists in Match, if not add it
    // Wait, Match already has room_id in my schema analysis?
    // Let's check schema.prisma again. Match has `room_id String`.
    // In previous versions it might have been there.
    // If db push failed, maybe Match table doesn't have the FK to Room yet?
    // Let's try to add the FK from Match to Room.
    
    try {
        await prisma.$executeRawUnsafe(`
        ALTER TABLE "Match" ADD CONSTRAINT "Match_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        `);
        console.log('Added FK Match_room_id_fkey');
    } catch (e: any) {
         console.log('Error adding FK Match_room_id_fkey:', e.message);
    }

  } catch (err) {
    console.error('Error executing raw SQL:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
