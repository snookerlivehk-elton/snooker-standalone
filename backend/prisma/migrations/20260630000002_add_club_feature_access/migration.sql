CREATE TABLE IF NOT EXISTS "ClubFeatureAccess" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubFeatureAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClubFeatureAccess_clubId_featureKey_key"
  ON "ClubFeatureAccess"("clubId", "featureKey");

CREATE INDEX IF NOT EXISTS "ClubFeatureAccess_featureKey_enabled_idx"
  ON "ClubFeatureAccess"("featureKey", "enabled");

DO $$
BEGIN
  ALTER TABLE "ClubFeatureAccess"
    ADD CONSTRAINT "ClubFeatureAccess_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
