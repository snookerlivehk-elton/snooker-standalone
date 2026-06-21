CREATE TYPE "TournamentMatchResultType" AS ENUM ('STANDARD', 'BYE', 'WALKOVER', 'FORFEIT');

ALTER TABLE "TournamentMatch"
  ADD COLUMN IF NOT EXISTS "result_type" "TournamentMatchResultType" NOT NULL DEFAULT 'STANDARD';

UPDATE "TournamentMatch"
SET "result_type" = 'BYE'
WHERE "winner_participant_id" IS NOT NULL
  AND COALESCE("player_a_frames_won", 0) = 0
  AND COALESCE("player_b_frames_won", 0) = 0
  AND NOT EXISTS (
    SELECT 1
    FROM "TournamentFrame" f
    WHERE f."tournament_match_id" = "TournamentMatch"."id"
  );
