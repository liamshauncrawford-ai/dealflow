-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('EMAIL', 'PHONE', 'IN_PERSON', 'LINKEDIN', 'BROKER');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('COLD_OUTREACH', 'WARM_INTRODUCTION', 'INITIAL_RESPONSE', 'DISCOVERY_CALL', 'LOI_TERM_SHEET', 'DUE_DILIGENCE', 'CLOSING', 'DEAD_PASSED', 'LISTING_ALERT', 'BROKER_UPDATE');

-- AlterTable: Listing gap fields
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "dbaName" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "licenseState" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "synergyNotes" TEXT;

-- AlterTable: Contact gap fields
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "familyMembersInBusiness" TEXT[];
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lastInteractionDate" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "lastInteractionType" "InteractionType";

-- AlterTable: Email category field
ALTER TABLE "Email" ADD COLUMN IF NOT EXISTS "emailCategory" "EmailCategory";
