-- Add registration fields to Member
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "district_code" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "birth_date" TIMESTAMP(3);

-- Unique index on email (allows multiple NULLs in PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Member_email_key'
  ) THEN
    CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");
  END IF;
END $$;