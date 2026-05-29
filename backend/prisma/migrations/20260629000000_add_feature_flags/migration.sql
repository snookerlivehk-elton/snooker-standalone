CREATE TABLE IF NOT EXISTS "FeatureFlag" (
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

INSERT INTO "FeatureFlag" ("key","enabled") VALUES
  ('booking', true),
  ('qr_session', true),
  ('points', true),
  ('highbreak', true),
  ('tournaments', true),
  ('club_messages', true),
  ('club_dashboard', true),
  ('system_portal', true),
  ('member_portal', true),
  ('scoring', true),
  ('live', true)
ON CONFLICT ("key") DO NOTHING;

