-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('pot', 'foul', 'miss', 'safe', 'switch', 'newFrame', 'concede', 'freeBallToggle');

-- CreateEnum
CREATE TYPE "BallName" AS ENUM ('red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black');

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "member_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frames_required" INTEGER NOT NULL,
    "red_balls" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "winner_member_id" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "frames_won" INTEGER NOT NULL DEFAULT 0,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "pot_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "avg_shot_time_ms" INTEGER NOT NULL DEFAULT 0,
    "max_break_points" INTEGER NOT NULL DEFAULT 0,
    "foul_count" INTEGER NOT NULL DEFAULT 0,
    "quick_shot_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "safe_success_rate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pot_by_ball" JSONB NOT NULL,
    "shot_time_buckets" JSONB NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "match_id" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "type" "EventType" NOT NULL,
    "player_index" INTEGER NOT NULL,
    "player_member_id" TEXT NOT NULL,
    "ball_name" "BallName",
    "points" INTEGER,
    "timestamp" BIGINT,
    "shot_time_ms" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoulTotals" (
    "match_id" TEXT NOT NULL,
    "player0_total" INTEGER NOT NULL DEFAULT 0,
    "player1_total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FoulTotals_pkey" PRIMARY KEY ("match_id")
);

-- CreateTable
CREATE TABLE "MatchStats" (
    "match_id" TEXT NOT NULL,
    "events_count" INTEGER NOT NULL DEFAULT 0,
    "per_player" JSONB NOT NULL,

    CONSTRAINT "MatchStats_pkey" PRIMARY KEY ("match_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_member_code_key" ON "Member"("member_code");

-- CreateIndex
CREATE INDEX "Match_started_at_idx" ON "Match"("started_at");

-- CreateIndex
CREATE INDEX "Match_winner_member_id_idx" ON "Match"("winner_member_id");

-- CreateIndex
CREATE INDEX "Match_room_id_idx" ON "Match"("room_id");

-- CreateIndex
CREATE INDEX "MatchPlayer_match_id_member_id_idx" ON "MatchPlayer"("match_id", "member_id");

-- CreateIndex
CREATE INDEX "MatchPlayer_member_id_idx" ON "MatchPlayer"("member_id");

-- CreateIndex
CREATE INDEX "Event_match_id_idx_idx" ON "Event"("match_id", "idx");

-- CreateIndex
CREATE INDEX "Event_match_id_timestamp_idx" ON "Event"("match_id", "timestamp");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winner_member_id_fkey" FOREIGN KEY ("winner_member_id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoulTotals" ADD CONSTRAINT "FoulTotals_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStats" ADD CONSTRAINT "MatchStats_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
