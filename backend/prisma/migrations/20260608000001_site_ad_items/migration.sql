CREATE TABLE IF NOT EXISTS "SiteAdItem" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteAdItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SiteAdPlacementItem" (
  "id" TEXT NOT NULL,
  "placement" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteAdPlacementItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteAdPlacementItem_placement_itemId_key"
  ON "SiteAdPlacementItem"("placement", "itemId");

CREATE INDEX IF NOT EXISTS "SiteAdPlacementItem_placement_sort_idx"
  ON "SiteAdPlacementItem"("placement", "sort");

ALTER TABLE "SiteAdPlacementItem"
  ADD CONSTRAINT "SiteAdPlacementItem_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "SiteAdItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
