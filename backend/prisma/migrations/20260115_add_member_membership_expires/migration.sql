-- Add membership_expires_at column for member validity
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "membership_expires_at" TIMESTAMP(3);

