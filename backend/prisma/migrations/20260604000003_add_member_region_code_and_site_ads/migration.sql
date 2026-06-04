-- Add region_code to Member
ALTER TABLE "Member"
  ADD COLUMN IF NOT EXISTS "region_code" TEXT;

-- Create SiteAd table (simple per-placement ad slot)
CREATE TABLE IF NOT EXISTS "SiteAd" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteAd_pkey" PRIMARY KEY ("id")
);

-- Ensure default rows exist
INSERT INTO "SiteAd" ("id")
VALUES ('system'), ('venue'), ('member')
ON CONFLICT ("id") DO NOTHING;

