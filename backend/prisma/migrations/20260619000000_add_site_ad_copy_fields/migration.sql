-- Add configurable copy fields for homepage carousel items
ALTER TABLE "SiteAdItem"
ADD COLUMN "title" TEXT,
ADD COLUMN "subtitle" TEXT,
ADD COLUMN "ctaLabel" TEXT;
