-- AlterTable
ALTER TABLE "DealDocument" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "uploadedAt" TIMESTAMP(3),
ALTER COLUMN "filePath" DROP NOT NULL;
