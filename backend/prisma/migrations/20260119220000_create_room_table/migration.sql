-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "code" TEXT,
    "operator_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameState" JSONB,
    "scores" JSONB,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_operator_id_idx" ON "Room"("operator_id");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
