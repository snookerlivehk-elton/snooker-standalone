ALTER TABLE "Tournament"
ADD COLUMN IF NOT EXISTS "signupGuide" TEXT;

ALTER TABLE "ClubMessage"
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ClubMessage"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "ClubMessage_clubId_createdAt_idx" ON "ClubMessage"("clubId","createdAt");
CREATE INDEX IF NOT EXISTS "ClubMessage_clubId_deletedAt_idx" ON "ClubMessage"("clubId","deletedAt");
