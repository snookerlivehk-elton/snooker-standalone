ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "access_expires_at" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "BreakRecord" (
    "id" TEXT NOT NULL,
    "club_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "video_url" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_member_id" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ,
    "updated_by_admin" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "deleted_by_admin" TEXT,
    "delete_reason" TEXT,
    CONSTRAINT "BreakRecord_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BreakRecord_club_id_fkey'
    ) THEN
        ALTER TABLE "BreakRecord"
        ADD CONSTRAINT "BreakRecord_club_id_fkey"
        FOREIGN KEY ("club_id") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BreakRecord_member_id_fkey'
    ) THEN
        ALTER TABLE "BreakRecord"
        ADD CONSTRAINT "BreakRecord_member_id_fkey"
        FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BreakRecord_created_by_member_id_fkey'
    ) THEN
        ALTER TABLE "BreakRecord"
        ADD CONSTRAINT "BreakRecord_created_by_member_id_fkey"
        FOREIGN KEY ("created_by_member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BreakRecord_club_id_recorded_at_idx" ON "BreakRecord"("club_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "BreakRecord_member_id_recorded_at_idx" ON "BreakRecord"("member_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "BreakRecord_club_id_member_id_recorded_at_idx" ON "BreakRecord"("club_id", "member_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "BreakRecord_club_id_points_idx" ON "BreakRecord"("club_id", "points");
CREATE INDEX IF NOT EXISTS "BreakRecord_deleted_at_idx" ON "BreakRecord"("deleted_at");
