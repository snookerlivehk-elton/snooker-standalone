-- Add scheduling fields for SiteAd
ALTER TABLE "SiteAd" ADD COLUMN IF NOT EXISTS "displaySeconds" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "SiteAd" ADD COLUMN IF NOT EXISTS "minIntervalMinutes" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "SiteAd" ADD COLUMN IF NOT EXISTS "maxIntervalMinutes" INTEGER NOT NULL DEFAULT 30;

UPDATE "SiteAd"
SET
  "displaySeconds" = COALESCE("displaySeconds", 15),
  "minIntervalMinutes" = COALESCE("minIntervalMinutes", 20),
  "maxIntervalMinutes" = COALESCE("maxIntervalMinutes", 30)
WHERE "id" IN ('system', 'venue', 'member');
