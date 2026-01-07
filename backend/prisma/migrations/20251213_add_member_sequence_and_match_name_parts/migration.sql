-- Add optional name/normalized/code fields to Match
ALTER TABLE "Match"
  ADD COLUMN "name_part" TEXT,
  ADD COLUMN "match_key_normalized" TEXT,
  ADD COLUMN "match_code" TEXT;

-- Index for normalized key lookups
CREATE INDEX IF NOT EXISTS "Match_match_key_normalized_idx" ON "Match"("match_key_normalized");

-- MemberSequence for district-based code generation
CREATE TABLE IF NOT EXISTS "MemberSequence" (
  "district_code" TEXT PRIMARY KEY,
  "next_seq" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at on change (PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'member_sequence_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION set_member_sequence_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."updated_at" := CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER member_sequence_set_updated_at
    BEFORE UPDATE ON "MemberSequence"
    FOR EACH ROW EXECUTE PROCEDURE set_member_sequence_updated_at();
  END IF;
END $$;