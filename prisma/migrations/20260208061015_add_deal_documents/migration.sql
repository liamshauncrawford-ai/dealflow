-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CIM', 'FINANCIAL_MODEL', 'FINANCIAL_STATEMENT', 'TAX_RETURN', 'LOI', 'NDA', 'VALUATION', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'IMPORT';

-- CreateTable
CREATE TABLE "DealDocument" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "category" "DocumentCategory" NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealDocument_opportunityId_idx" ON "DealDocument"("opportunityId");

-- CreateIndex
CREATE INDEX "DealDocument_category_idx" ON "DealDocument"("category");

-- AddForeignKey
ALTER TABLE "DealDocument" ADD CONSTRAINT "DealDocument_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
