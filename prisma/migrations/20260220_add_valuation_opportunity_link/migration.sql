-- AlterTable
ALTER TABLE "ValuationModel" ADD COLUMN "opportunityId" TEXT;

-- CreateIndex
CREATE INDEX "ValuationModel_opportunityId_idx" ON "ValuationModel"("opportunityId");

-- AddForeignKey
ALTER TABLE "ValuationModel" ADD CONSTRAINT "ValuationModel_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
