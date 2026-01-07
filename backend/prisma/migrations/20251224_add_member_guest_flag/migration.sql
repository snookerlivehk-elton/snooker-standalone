-- Add guest flag to Member for non-member opponents
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "is_guest" BOOLEAN DEFAULT FALSE;
