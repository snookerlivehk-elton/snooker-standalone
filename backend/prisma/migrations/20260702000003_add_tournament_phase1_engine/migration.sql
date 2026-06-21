DO $$
BEGIN
  CREATE TYPE "TournamentFormat" AS ENUM ('KNOCKOUT', 'LEAGUE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TournamentWorkflowStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'SEEDED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TournamentParticipantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'DISQUALIFIED', 'ELIMINATED', 'CHAMPION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TournamentMatchStatus" AS ENUM ('PENDING', 'READY', 'LIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "BreakRecord"
  ADD COLUMN IF NOT EXISTS "tournament_match_id" TEXT,
  ADD COLUMN IF NOT EXISTS "frame_no" INTEGER,
  ADD COLUMN IF NOT EXISTS "threshold_snapshot" INTEGER;

ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "format" "TournamentFormat",
  ADD COLUMN IF NOT EXISTS "workflow_status" "TournamentWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "race_to" INTEGER,
  ADD COLUMN IF NOT EXISTS "best_of_frames" INTEGER,
  ADD COLUMN IF NOT EXISTS "table_count" INTEGER,
  ADD COLUMN IF NOT EXISTS "points_win" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "points_draw" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "points_loss" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tracked_break_threshold" INTEGER NOT NULL DEFAULT 20;

UPDATE "Tournament"
SET "workflow_status" = CASE
  WHEN "status" = 'PUBLISHED' THEN 'REGISTRATION'::"TournamentWorkflowStatus"
  WHEN "status" = 'CLOSED' THEN 'COMPLETED'::"TournamentWorkflowStatus"
  ELSE 'DRAFT'::"TournamentWorkflowStatus"
END
WHERE "workflow_status" = 'DRAFT';

CREATE TABLE IF NOT EXISTS "TournamentParticipant" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "signup_id" TEXT,
  "seed" INTEGER,
  "group_no" INTEGER,
  "lane_no" INTEGER,
  "checked_in" BOOLEAN NOT NULL DEFAULT false,
  "final_rank" INTEGER,
  "status" "TournamentParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TournamentMatch" (
  "id" TEXT NOT NULL,
  "tournament_id" TEXT NOT NULL,
  "stage_code" TEXT,
  "round_no" INTEGER,
  "match_no" INTEGER,
  "table_no" TEXT,
  "scheduled_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  "player_a_participant_id" TEXT,
  "player_b_participant_id" TEXT,
  "winner_participant_id" TEXT,
  "status" "TournamentMatchStatus" NOT NULL DEFAULT 'PENDING',
  "best_of_frames" INTEGER,
  "player_a_frames_won" INTEGER NOT NULL DEFAULT 0,
  "player_b_frames_won" INTEGER NOT NULL DEFAULT 0,
  "player_a_total_points" INTEGER NOT NULL DEFAULT 0,
  "player_b_total_points" INTEGER NOT NULL DEFAULT 0,
  "player_a_max_break" INTEGER NOT NULL DEFAULT 0,
  "player_b_max_break" INTEGER NOT NULL DEFAULT 0,
  "player_a_20_plus_count" INTEGER NOT NULL DEFAULT 0,
  "player_b_20_plus_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TournamentFrame" (
  "id" TEXT NOT NULL,
  "tournament_match_id" TEXT NOT NULL,
  "frame_no" INTEGER NOT NULL,
  "winner_participant_id" TEXT,
  "player_a_score" INTEGER NOT NULL DEFAULT 0,
  "player_b_score" INTEGER NOT NULL DEFAULT 0,
  "player_a_highest_break" INTEGER NOT NULL DEFAULT 0,
  "player_b_highest_break" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMPTZ,
  "ended_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentFrame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentParticipant_tournament_id_member_id_key"
  ON "TournamentParticipant"("tournament_id", "member_id");
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentParticipant_signup_id_key"
  ON "TournamentParticipant"("signup_id");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_tournament_id_seed_idx"
  ON "TournamentParticipant"("tournament_id", "seed");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_tournament_id_group_no_idx"
  ON "TournamentParticipant"("tournament_id", "group_no");
CREATE INDEX IF NOT EXISTS "TournamentParticipant_member_id_created_at_idx"
  ON "TournamentParticipant"("member_id", "created_at");

CREATE INDEX IF NOT EXISTS "TournamentMatch_tournament_id_stage_code_round_no_match_no_idx"
  ON "TournamentMatch"("tournament_id", "stage_code", "round_no", "match_no");
CREATE INDEX IF NOT EXISTS "TournamentMatch_tournament_id_status_scheduled_at_idx"
  ON "TournamentMatch"("tournament_id", "status", "scheduled_at");

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentFrame_tournament_match_id_frame_no_key"
  ON "TournamentFrame"("tournament_match_id", "frame_no");

CREATE INDEX IF NOT EXISTS "BreakRecord_tournament_match_id_recorded_at_idx"
  ON "BreakRecord"("tournament_match_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "Tournament_clubId_workflow_status_idx"
  ON "Tournament"("clubId", "workflow_status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakRecord_tournament_match_id_fkey'
  ) THEN
    ALTER TABLE "BreakRecord"
      ADD CONSTRAINT "BreakRecord_tournament_match_id_fkey"
      FOREIGN KEY ("tournament_match_id") REFERENCES "TournamentMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentParticipant_tournament_id_fkey'
  ) THEN
    ALTER TABLE "TournamentParticipant"
      ADD CONSTRAINT "TournamentParticipant_tournament_id_fkey"
      FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentParticipant_member_id_fkey'
  ) THEN
    ALTER TABLE "TournamentParticipant"
      ADD CONSTRAINT "TournamentParticipant_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentParticipant_signup_id_fkey'
  ) THEN
    ALTER TABLE "TournamentParticipant"
      ADD CONSTRAINT "TournamentParticipant_signup_id_fkey"
      FOREIGN KEY ("signup_id") REFERENCES "TournamentSignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentMatch_tournament_id_fkey'
  ) THEN
    ALTER TABLE "TournamentMatch"
      ADD CONSTRAINT "TournamentMatch_tournament_id_fkey"
      FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentMatch_player_a_participant_id_fkey'
  ) THEN
    ALTER TABLE "TournamentMatch"
      ADD CONSTRAINT "TournamentMatch_player_a_participant_id_fkey"
      FOREIGN KEY ("player_a_participant_id") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentMatch_player_b_participant_id_fkey'
  ) THEN
    ALTER TABLE "TournamentMatch"
      ADD CONSTRAINT "TournamentMatch_player_b_participant_id_fkey"
      FOREIGN KEY ("player_b_participant_id") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentMatch_winner_participant_id_fkey'
  ) THEN
    ALTER TABLE "TournamentMatch"
      ADD CONSTRAINT "TournamentMatch_winner_participant_id_fkey"
      FOREIGN KEY ("winner_participant_id") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentFrame_tournament_match_id_fkey'
  ) THEN
    ALTER TABLE "TournamentFrame"
      ADD CONSTRAINT "TournamentFrame_tournament_match_id_fkey"
      FOREIGN KEY ("tournament_match_id") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TournamentFrame_winner_participant_id_fkey'
  ) THEN
    ALTER TABLE "TournamentFrame"
      ADD CONSTRAINT "TournamentFrame_winner_participant_id_fkey"
      FOREIGN KEY ("winner_participant_id") REFERENCES "TournamentParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
