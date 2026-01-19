ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "admin_member_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Match_admin_member_id_idx'
  ) THEN
    CREATE INDEX "Match_admin_member_id_idx" ON "Match"("admin_member_id");
  END IF;
END $$;

