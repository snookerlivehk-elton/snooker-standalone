CREATE TYPE "TournamentLeagueRoundRobinMode" AS ENUM ('SINGLE', 'DOUBLE');

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "league_round_robin_mode" "TournamentLeagueRoundRobinMode" NOT NULL DEFAULT 'SINGLE';
