CREATE TABLE IF NOT EXISTS "EmailVerification" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ip" TEXT
);

CREATE INDEX IF NOT EXISTS "EmailVerification_email_idx" ON "EmailVerification"("email");
CREATE INDEX IF NOT EXISTS "EmailVerification_email_purpose_idx" ON "EmailVerification"("email","purpose");

