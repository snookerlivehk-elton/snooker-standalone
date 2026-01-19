-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "operator_id" TEXT;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
