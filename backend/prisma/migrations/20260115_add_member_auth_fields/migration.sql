ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "password_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "password_salt" TEXT,
  ADD COLUMN IF NOT EXISTS "password_updated_at" TIMESTAMP(3);

