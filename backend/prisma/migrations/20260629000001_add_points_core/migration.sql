CREATE TABLE IF NOT EXISTS "ClubPointsConfig" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'HKD',
  "pointsPerCurrency" DECIMAL(65,30) NOT NULL DEFAULT 1,
  "roundingMinutes" INTEGER NOT NULL DEFAULT 15,
  "minBillableMinutes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubPointsConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClubPointsConfig_clubId_key" ON "ClubPointsConfig"("clubId");

CREATE TABLE IF NOT EXISTS "PointsLedger" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "deltaPoints" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "refType" TEXT,
  "refId" TEXT,
  "createdByMemberId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PointsLedger_clubId_createdAt_idx" ON "PointsLedger"("clubId","createdAt");
CREATE INDEX IF NOT EXISTS "PointsLedger_memberId_createdAt_idx" ON "PointsLedger"("memberId","createdAt");
CREATE INDEX IF NOT EXISTS "PointsLedger_clubId_memberId_createdAt_idx" ON "PointsLedger"("clubId","memberId","createdAt");

CREATE TABLE IF NOT EXISTS "PointsBalance" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PointsBalance_clubId_memberId_key" ON "PointsBalance"("clubId","memberId");
CREATE INDEX IF NOT EXISTS "PointsBalance_clubId_idx" ON "PointsBalance"("clubId");
CREATE INDEX IF NOT EXISTS "PointsBalance_memberId_idx" ON "PointsBalance"("memberId");

DO $$
BEGIN
  ALTER TABLE "ClubPointsConfig"
    ADD CONSTRAINT "ClubPointsConfig_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PointsLedger"
    ADD CONSTRAINT "PointsLedger_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PointsLedger"
    ADD CONSTRAINT "PointsLedger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PointsLedger"
    ADD CONSTRAINT "PointsLedger_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PointsBalance"
    ADD CONSTRAINT "PointsBalance_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PointsBalance"
    ADD CONSTRAINT "PointsBalance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

