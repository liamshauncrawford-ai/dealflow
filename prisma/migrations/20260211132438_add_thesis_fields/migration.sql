-- CreateEnum
CREATE TYPE "PrimaryTrade" AS ENUM ('STRUCTURED_CABLING', 'SECURITY_SURVEILLANCE', 'BUILDING_AUTOMATION_BMS', 'HVAC_CONTROLS', 'FIRE_ALARM', 'ELECTRICAL', 'AV_INTEGRATION', 'MANAGED_IT_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('TIER_1_ACTIVE', 'TIER_2_WATCH', 'TIER_3_DISQUALIFIED', 'OWNED');

-- CreateEnum
CREATE TYPE "RevenueConfidence" AS ENUM ('CONFIRMED', 'ESTIMATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RevenueTrend" AS ENUM ('GROWING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "IntegrationComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "KeyPersonRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('NOT_CONTACTED', 'COLD_OUTREACH_SENT', 'WARM_INTRO_MADE', 'IN_DIALOGUE', 'LOI_STAGE', 'DUE_DILIGENCE', 'CLOSED', 'DEAD');

-- CreateEnum
CREATE TYPE "ContactSentiment" AS ENUM ('COLD', 'LUKEWARM', 'WARM', 'HOT', 'ENGAGED', 'COMMITTED');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "education" TEXT,
ADD COLUMN     "estimatedAgeRange" TEXT,
ADD COLUMN     "familyBusiness" BOOLEAN,
ADD COLUMN     "foundedCompany" BOOLEAN,
ADD COLUMN     "hasPartner" BOOLEAN,
ADD COLUMN     "hasSuccessor" BOOLEAN,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "nextFollowUpDate" TIMESTAMP(3),
ADD COLUMN     "outreachStatus" "OutreachStatus",
ADD COLUMN     "ownershipPct" DOUBLE PRECISION,
ADD COLUMN     "partnerName" TEXT,
ADD COLUMN     "priorEmployers" TEXT[],
ADD COLUMN     "sentiment" "ContactSentiment",
ADD COLUMN     "successorName" TEXT,
ADD COLUMN     "yearsAtCompany" INTEGER,
ADD COLUMN     "yearsInIndustry" INTEGER;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "bonded" BOOLEAN,
ADD COLUMN     "certifications" TEXT[],
ADD COLUMN     "dcCertifications" TEXT[],
ADD COLUMN     "dcClients" TEXT[],
ADD COLUMN     "dcExperience" BOOLEAN,
ADD COLUMN     "dcRelevanceScore" INTEGER,
ADD COLUMN     "disqualificationReason" TEXT,
ADD COLUMN     "employeeSource" TEXT,
ADD COLUMN     "fitScore" INTEGER,
ADD COLUMN     "insured" BOOLEAN,
ADD COLUMN     "licenseNumbers" TEXT[],
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "primaryTrade" "PrimaryTrade",
ADD COLUMN     "revenueConfidence" "RevenueConfidence",
ADD COLUMN     "revenueSource" TEXT,
ADD COLUMN     "secondaryTrades" "PrimaryTrade"[],
ADD COLUMN     "sicCodes" TEXT[],
ADD COLUMN     "targetMultipleHigh" DOUBLE PRECISION DEFAULT 5.0,
ADD COLUMN     "targetMultipleLow" DOUBLE PRECISION DEFAULT 3.0,
ADD COLUMN     "tier" "Tier",
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "actualEbitda" DECIMAL(14,2),
ADD COLUMN     "actualEbitdaMargin" DOUBLE PRECISION,
ADD COLUMN     "actualRevenue" DECIMAL(14,2),
ADD COLUMN     "backlog" DECIMAL(14,2),
ADD COLUMN     "certificationTransferRisk" TEXT,
ADD COLUMN     "customerConcentration" DOUBLE PRECISION,
ADD COLUMN     "customerRetentionRisk" TEXT,
ADD COLUMN     "dealStructure" TEXT,
ADD COLUMN     "dueDiligenceStart" TIMESTAMP(3),
ADD COLUMN     "integrationComplexity" "IntegrationComplexity",
ADD COLUMN     "keyPersonRisk" "KeyPersonRisk",
ADD COLUMN     "loiDate" TIMESTAMP(3),
ADD COLUMN     "offeredMultiple" DOUBLE PRECISION,
ADD COLUMN     "recurringRevenuePct" DOUBLE PRECISION,
ADD COLUMN     "revenueTrend" "RevenueTrend",
ADD COLUMN     "synergyEstimate" DECIMAL(14,2),
ADD COLUMN     "targetCloseDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Listing_tier_idx" ON "Listing"("tier");

-- CreateIndex
CREATE INDEX "Listing_fitScore_idx" ON "Listing"("fitScore");

-- CreateIndex
CREATE INDEX "Listing_primaryTrade_idx" ON "Listing"("primaryTrade");
