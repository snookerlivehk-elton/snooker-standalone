DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MemberTier') THEN
    CREATE TYPE "MemberTier" AS ENUM ('BASIC', 'VERIFIED');
  END IF;
END $$;

ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "member_tier" "MemberTier" NOT NULL DEFAULT 'BASIC';

UPDATE "Member"
SET "member_tier" = 'VERIFIED'
WHERE "email_verified_at" IS NOT NULL;
