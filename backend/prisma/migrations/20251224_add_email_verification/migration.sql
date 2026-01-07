-- Email verification fields
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "email_verification_token" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verification_expires_at" TIMESTAMP(3);

-- Optional index on token for quick lookup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Member_email_verification_token_idx'
  ) THEN
    CREATE INDEX "Member_email_verification_token_idx" ON "Member"("email_verification_token");
  END IF;
END $$;
