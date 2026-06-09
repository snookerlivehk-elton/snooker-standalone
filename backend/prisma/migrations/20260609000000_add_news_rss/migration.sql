CREATE TABLE IF NOT EXISTS "AppLock" (
  "key" TEXT NOT NULL,
  "lockedUntil" TIMESTAMPTZ,
  "lockedBy" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppLock_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "NewsSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "feedUrl" TEXT NOT NULL,
  "siteUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "language" TEXT,
  "region" TEXT,
  "fetchEveryHours" INTEGER NOT NULL DEFAULT 72,
  "lastFetchAttemptAt" TIMESTAMPTZ,
  "lastFetchedAt" TIMESTAMPTZ,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NewsSource_enabled_lastFetchedAt_idx"
  ON "NewsSource"("enabled", "lastFetchedAt");

CREATE TABLE IF NOT EXISTS "NewsItem" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publishedAt" TIMESTAMPTZ,
  "author" TEXT,
  "summary" TEXT,
  "imageUrl" TEXT,
  "tags" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NewsItem_url_key"
  ON "NewsItem"("url");

CREATE INDEX IF NOT EXISTS "NewsItem_sourceId_publishedAt_idx"
  ON "NewsItem"("sourceId", "publishedAt");

CREATE INDEX IF NOT EXISTS "NewsItem_publishedAt_idx"
  ON "NewsItem"("publishedAt");

DO $$
BEGIN
  ALTER TABLE "NewsItem"
    ADD CONSTRAINT "NewsItem_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "NewsFetchLog" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ,
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "newCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NewsFetchLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NewsFetchLog_sourceId_startedAt_idx"
  ON "NewsFetchLog"("sourceId", "startedAt");

CREATE INDEX IF NOT EXISTS "NewsFetchLog_startedAt_idx"
  ON "NewsFetchLog"("startedAt");

DO $$
BEGIN
  ALTER TABLE "NewsFetchLog"
    ADD CONSTRAINT "NewsFetchLog_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "NewsSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

