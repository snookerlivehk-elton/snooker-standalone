-- Add phone login fields for Member authentication
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "phone_country" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "phone_number" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "phone_e164" TEXT;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "phone_verified_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Member_phone_e164_key'
  ) THEN
    CREATE UNIQUE INDEX "Member_phone_e164_key" ON "Member"("phone_e164");
  END IF;
END $$;

