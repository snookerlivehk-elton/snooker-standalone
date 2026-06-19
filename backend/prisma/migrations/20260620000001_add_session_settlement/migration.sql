-- Add settlement tracking for qr-session -> points flow

DO $$ BEGIN
  CREATE TYPE "SettlementPaymentMethod" AS ENUM ('POINTS', 'MANUAL', 'CASH', 'WALLET', 'PACKAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'QUOTED', 'AWAITING_CONFIRMATION', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE "SessionSettlement" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "paymentMethod" "SettlementPaymentMethod",
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "durationMinutes" INTEGER,
  "billableMinutes" INTEGER,
  "baseAmount" DECIMAL(65,30),
  "chargedAmount" DECIMAL(65,30),
  "chargedCurrency" TEXT,
  "quotePayload" JSONB,
  "pointsLedgerId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionSettlementAttempt" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "providerKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionSettlementAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DomainEventOutbox" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessionSettlement_sessionId_key" ON "SessionSettlement"("sessionId");
CREATE INDEX "SessionSettlement_clubId_status_createdAt_idx" ON "SessionSettlement"("clubId", "status", "createdAt");
CREATE INDEX "SessionSettlement_memberId_status_createdAt_idx" ON "SessionSettlement"("memberId", "status", "createdAt");
CREATE INDEX "SessionSettlement_tableId_createdAt_idx" ON "SessionSettlement"("tableId", "createdAt");
CREATE INDEX "SessionSettlementAttempt_settlementId_createdAt_idx" ON "SessionSettlementAttempt"("settlementId", "createdAt");
CREATE INDEX "SessionSettlementAttempt_providerKey_createdAt_idx" ON "SessionSettlementAttempt"("providerKey", "createdAt");
CREATE INDEX "DomainEventOutbox_eventType_createdAt_idx" ON "DomainEventOutbox"("eventType", "createdAt");
CREATE INDEX "DomainEventOutbox_aggregateType_aggregateId_idx" ON "DomainEventOutbox"("aggregateType", "aggregateId");
CREATE INDEX "DomainEventOutbox_processedAt_failedAt_idx" ON "DomainEventOutbox"("processedAt", "failedAt");

ALTER TABLE "SessionSettlement"
ADD CONSTRAINT "SessionSettlement_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SessionSettlement"
ADD CONSTRAINT "SessionSettlement_clubId_fkey"
FOREIGN KEY ("clubId") REFERENCES "ClubProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SessionSettlement"
ADD CONSTRAINT "SessionSettlement_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SessionSettlementAttempt"
ADD CONSTRAINT "SessionSettlementAttempt_settlementId_fkey"
FOREIGN KEY ("settlementId") REFERENCES "SessionSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
