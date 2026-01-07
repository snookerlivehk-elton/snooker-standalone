-- Add handicap columns to Match
ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "handicap0" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "handicap1" INTEGER DEFAULT 0;

-- Add unique constraint for upsert on MatchPlayer (match_id, member_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'match_id_member_id'
  ) THEN
    CREATE UNIQUE INDEX "match_id_member_id" ON "MatchPlayer"("match_id","member_id");
  END IF;
END $$;
