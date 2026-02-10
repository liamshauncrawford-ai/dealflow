-- AlterTable: Add emailAccountId and messageHash to Email
ALTER TABLE "Email" ADD COLUMN "emailAccountId" TEXT;
ALTER TABLE "Email" ADD COLUMN "messageHash" TEXT;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Email_emailAccountId_idx" ON "Email"("emailAccountId");
CREATE INDEX "Email_messageHash_idx" ON "Email"("messageHash");
