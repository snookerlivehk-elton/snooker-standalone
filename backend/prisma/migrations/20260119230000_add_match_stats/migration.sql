-- Add missing columns to MatchPlayer table
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "avg_break_time_ms" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "max_break_time_ms" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "break_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "max_break_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "foul_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "quick_shot_rate" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "safe_success_rate" DECIMAL(65,30) NOT NULL DEFAULT 0;
-- pot_by_ball and shot_time_buckets might already exist, but adding just in case (defaults are tricky with JSONB in ALTER, usually need explicit SET)
-- Skipping JSONB columns as they are likely present from initial schema, or harder to default safely in one line without checking. 
-- The error was specifically about avg_break_time_ms.
