DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BreakRecordType') THEN
    CREATE TYPE "BreakRecordType" AS ENUM ('VENUE', 'TOURNAMENT');
  END IF;
END $$;

ALTER TABLE "BreakRecord"
  ADD COLUMN IF NOT EXISTS "record_type" "BreakRecordType" NOT NULL DEFAULT 'VENUE';

ALTER TABLE "BreakRecord"
  ADD COLUMN IF NOT EXISTS "tournament_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakRecord_tournament_id_fkey'
  ) THEN
    ALTER TABLE "BreakRecord"
      ADD CONSTRAINT "BreakRecord_tournament_id_fkey"
      FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BreakRecord_record_type_recorded_at_idx" ON "BreakRecord"("record_type", "recorded_at");
CREATE INDEX IF NOT EXISTS "BreakRecord_record_type_club_id_recorded_at_idx" ON "BreakRecord"("record_type", "club_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "BreakRecord_record_type_member_id_recorded_at_idx" ON "BreakRecord"("record_type", "member_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "BreakRecord_tournament_id_recorded_at_idx" ON "BreakRecord"("tournament_id", "recorded_at");
