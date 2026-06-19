-- Remove legacy room-based scoring infrastructure.
-- Keep Match and MatchPlayer for historical viewing.

ALTER TABLE "Match" DROP CONSTRAINT IF EXISTS "Match_room_id_fkey";
DROP INDEX IF EXISTS "Match_room_id_idx";

DROP TABLE IF EXISTS "MatchInvite";
DROP TABLE IF EXISTS "Room";
DROP TABLE IF EXISTS "RoomCodeSequence";

DROP TABLE IF EXISTS "Event";
DROP TABLE IF EXISTS "FoulTotals";
DROP TABLE IF EXISTS "MatchStats";

DROP TYPE IF EXISTS "BallName";
DROP TYPE IF EXISTS "EventType";
