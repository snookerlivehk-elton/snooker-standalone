CREATE TABLE IF NOT EXISTS "SystemModule" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "pluginId" TEXT,
  "defaultEnabled" BOOLEAN NOT NULL DEFAULT true,
  "supportsClubAssignment" BOOLEAN NOT NULL DEFAULT false,
  "supportsPublicRoutes" BOOLEAN NOT NULL DEFAULT false,
  "supportsHomeSection" BOOLEAN NOT NULL DEFAULT false,
  "supportsVenueAdmin" BOOLEAN NOT NULL DEFAULT false,
  "supportsSuperAdmin" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemModule_pkey" PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS "SystemModuleConfig" (
  "moduleCode" TEXT NOT NULL,
  "enabledGlobally" BOOLEAN NOT NULL DEFAULT true,
  "publicVisible" BOOLEAN NOT NULL DEFAULT false,
  "homeVisible" BOOLEAN NOT NULL DEFAULT false,
  "allowClubEnable" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "settingsJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemModuleConfig_pkey" PRIMARY KEY ("moduleCode")
);

CREATE TABLE IF NOT EXISTS "ClubModuleConfig" (
  "id" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "moduleCode" TEXT NOT NULL,
  "enabledForClub" BOOLEAN NOT NULL DEFAULT false,
  "publicVisible" BOOLEAN NOT NULL DEFAULT false,
  "settingsJson" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClubModuleConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClubModuleConfig_clubId_moduleCode_key"
  ON "ClubModuleConfig"("clubId", "moduleCode");

CREATE INDEX IF NOT EXISTS "ClubModuleConfig_moduleCode_enabledForClub_idx"
  ON "ClubModuleConfig"("moduleCode", "enabledForClub");

CREATE INDEX IF NOT EXISTS "ClubModuleConfig_clubId_enabledForClub_idx"
  ON "ClubModuleConfig"("clubId", "enabledForClub");

DO $$
BEGIN
  ALTER TABLE "SystemModuleConfig"
    ADD CONSTRAINT "SystemModuleConfig_moduleCode_fkey"
    FOREIGN KEY ("moduleCode") REFERENCES "SystemModule"("code") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ClubModuleConfig"
    ADD CONSTRAINT "ClubModuleConfig_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ClubModuleConfig"
    ADD CONSTRAINT "ClubModuleConfig_moduleCode_fkey"
    FOREIGN KEY ("moduleCode") REFERENCES "SystemModule"("code") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
