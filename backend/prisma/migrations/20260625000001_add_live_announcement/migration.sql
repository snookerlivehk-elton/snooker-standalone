CREATE TABLE IF NOT EXISTS "LiveAnnouncement" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMPTZ NOT NULL,
  "liveUrl" TEXT NOT NULL,
  "createdByMemberId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ,
  CONSTRAINT "LiveAnnouncement_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LiveAnnouncement_clubId_fkey'
  ) THEN
    ALTER TABLE "LiveAnnouncement"
    ADD CONSTRAINT "LiveAnnouncement_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LiveAnnouncement_createdByMemberId_fkey'
  ) THEN
    ALTER TABLE "LiveAnnouncement"
    ADD CONSTRAINT "LiveAnnouncement_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LiveAnnouncement_clubId_startsAt_idx" ON "LiveAnnouncement"("clubId", "startsAt");
CREATE INDEX IF NOT EXISTS "LiveAnnouncement_startsAt_idx" ON "LiveAnnouncement"("startsAt");
CREATE INDEX IF NOT EXISTS "LiveAnnouncement_deletedAt_idx" ON "LiveAnnouncement"("deletedAt");

