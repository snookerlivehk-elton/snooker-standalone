DO $$
BEGIN
  CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT','PUBLISHED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TournamentSignupStatus" AS ENUM ('PENDING','CONFIRMED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Tournament" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 32,
  "startsAt" TIMESTAMPTZ,
  "signupOpensAt" TIMESTAMPTZ,
  "signupClosesAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Tournament_clubId_status_idx" ON "Tournament"("clubId","status");
CREATE INDEX IF NOT EXISTS "Tournament_clubId_startsAt_idx" ON "Tournament"("clubId","startsAt");

CREATE TABLE IF NOT EXISTS "TournamentSignup" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "status" "TournamentSignupStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentSignup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TournamentSignup_tournamentId_memberId_key" ON "TournamentSignup"("tournamentId","memberId");
CREATE INDEX IF NOT EXISTS "TournamentSignup_memberId_createdAt_idx" ON "TournamentSignup"("memberId","createdAt");
CREATE INDEX IF NOT EXISTS "TournamentSignup_tournamentId_createdAt_idx" ON "TournamentSignup"("tournamentId","createdAt");
CREATE INDEX IF NOT EXISTS "TournamentSignup_status_idx" ON "TournamentSignup"("status");

DO $$
BEGIN
  ALTER TABLE "Tournament"
    ADD CONSTRAINT "Tournament_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TournamentSignup"
    ADD CONSTRAINT "TournamentSignup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TournamentSignup"
    ADD CONSTRAINT "TournamentSignup_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
