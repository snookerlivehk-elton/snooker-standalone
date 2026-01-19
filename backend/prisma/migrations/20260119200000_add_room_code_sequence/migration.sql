-- CreateTable
CREATE TABLE "RoomCodeSequence" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_code" TEXT NOT NULL DEFAULT 'AAAAA0000',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomCodeSequence_pkey" PRIMARY KEY ("id")
);
