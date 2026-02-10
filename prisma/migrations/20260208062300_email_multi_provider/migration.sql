-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('MICROSOFT', 'GMAIL');

-- AlterTable: Add provider to EmailAccount
ALTER TABLE "EmailAccount" ADD COLUMN "provider" "EmailProvider" NOT NULL DEFAULT 'MICROSOFT';

-- AlterTable: Rename graphMessageId to externalMessageId on Email
ALTER TABLE "Email" RENAME COLUMN "graphMessageId" TO "externalMessageId";

-- AlterTable: Add new columns to Email
ALTER TABLE "Email" ADD COLUMN "bodyHtml" TEXT;
ALTER TABLE "Email" ADD COLUMN "isListingAlert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Email" ADD COLUMN "listingAlertParsed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Email_isListingAlert_idx" ON "Email"("isListingAlert");

-- Rename unique index from graphMessageId to externalMessageId
ALTER INDEX "Email_graphMessageId_key" RENAME TO "Email_externalMessageId_key";
