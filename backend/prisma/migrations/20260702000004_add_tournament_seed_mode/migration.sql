CREATE TYPE "TournamentSeedMode" AS ENUM ('MANUAL', 'RANKING', 'RANDOM');

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "seed_mode" "TournamentSeedMode" NOT NULL DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS "Tournament_clubId_seed_mode_idx"
  ON "Tournament"("clubId", "seed_mode");
