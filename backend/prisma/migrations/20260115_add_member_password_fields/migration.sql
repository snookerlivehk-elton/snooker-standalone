-- Add password fields for Member authentication
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "password_salt" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "password_updated_at" TIMESTAMP(3);
