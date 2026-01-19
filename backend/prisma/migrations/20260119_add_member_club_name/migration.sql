-- Add club_name to Member for optional club affiliation
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "club_name" TEXT;

