CREATE TYPE IF NOT EXISTS "TableSessionStatus" AS ENUM ('ACTIVE','ENDED','CANCELLED');
CREATE TYPE IF NOT EXISTS "TableSessionEndSource" AS ENUM ('MEMBER','OPERATOR');
CREATE TYPE IF NOT EXISTS "TableSessionConfirmAction" AS ENUM ('START','END');

CREATE TABLE IF NOT EXISTS "TableQrToken" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "rotatedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TableQrToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TableQrToken_token_key" ON "TableQrToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "TableQrToken_tableId_key" ON "TableQrToken"("tableId");
CREATE INDEX IF NOT EXISTS "TableQrToken_clubId_idx" ON "TableQrToken"("clubId");

CREATE TABLE IF NOT EXISTS "TableSession" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "startedByMemberId" TEXT NOT NULL,
  "startAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "TableSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "endAt" TIMESTAMPTZ,
  "endedByMemberId" TEXT,
  "endedByOperatorId" TEXT,
  "endSource" "TableSessionEndSource",
  "billedMinutes" INTEGER,
  "chargedAmount" DECIMAL(65,30),
  "chargedCurrency" TEXT,
  "chargedPoints" INTEGER,
  "pointsLedgerId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TableSession_clubId_status_idx" ON "TableSession"("clubId","status");
CREATE INDEX IF NOT EXISTS "TableSession_tableId_status_idx" ON "TableSession"("tableId","status");
CREATE INDEX IF NOT EXISTS "TableSession_startedByMemberId_startAt_idx" ON "TableSession"("startedByMemberId","startAt");

CREATE TABLE IF NOT EXISTS "TableSessionConfirm" (
  "id" TEXT NOT NULL,
  "action" "TableSessionConfirmAction" NOT NULL,
  "token" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "sessionId" TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TableSessionConfirm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TableSessionConfirm_memberId_createdAt_idx" ON "TableSessionConfirm"("memberId","createdAt");
CREATE INDEX IF NOT EXISTS "TableSessionConfirm_token_createdAt_idx" ON "TableSessionConfirm"("token","createdAt");
CREATE INDEX IF NOT EXISTS "TableSessionConfirm_expiresAt_idx" ON "TableSessionConfirm"("expiresAt");

DO $$
BEGIN
  ALTER TABLE "TableQrToken"
    ADD CONSTRAINT "TableQrToken_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TableQrToken"
    ADD CONSTRAINT "TableQrToken_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "ClubTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TableSession"
    ADD CONSTRAINT "TableSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TableSession"
    ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "ClubTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TableSession"
    ADD CONSTRAINT "TableSession_startedByMemberId_fkey" FOREIGN KEY ("startedByMemberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TableSession"
    ADD CONSTRAINT "TableSession_endedByMemberId_fkey" FOREIGN KEY ("endedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TableSession"
    ADD CONSTRAINT "TableSession_endedByOperatorId_fkey" FOREIGN KEY ("endedByOperatorId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

