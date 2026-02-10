-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('BIZBUYSELL', 'BIZQUEST', 'DEALSTREAM', 'TRANSWORLD', 'LOOPNET', 'BUSINESSBROKER', 'MANUAL');

-- CreateEnum
CREATE TYPE "DedupStatus" AS ENUM ('PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('CONTACTING', 'INTERESTED', 'REQUESTED_CIM', 'SIGNED_NDA', 'DUE_DILIGENCE', 'OFFER_SENT', 'COUNTER_OFFER_RECEIVED', 'UNDER_CONTRACT', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScrapeStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_LISTING', 'LISTING_UPDATED', 'LISTING_REMOVED', 'COOKIE_EXPIRED', 'SCRAPE_FAILED', 'DEDUP_CANDIDATE', 'EMAIL_RECEIVED');

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "businessName" TEXT,
    "description" TEXT,
    "askingPrice" DECIMAL(14,2),
    "revenue" DECIMAL(14,2),
    "ebitda" DECIMAL(14,2),
    "sde" DECIMAL(14,2),
    "cashFlow" DECIMAL(14,2),
    "inventory" DECIMAL(14,2),
    "ffe" DECIMAL(14,2),
    "realEstate" DECIMAL(14,2),
    "inferredEbitda" DECIMAL(14,2),
    "inferredSde" DECIMAL(14,2),
    "inferenceMethod" TEXT,
    "inferenceConfidence" DOUBLE PRECISION,
    "priceToEbitda" DOUBLE PRECISION,
    "priceToSde" DOUBLE PRECISION,
    "priceToRevenue" DOUBLE PRECISION,
    "city" TEXT,
    "state" TEXT,
    "county" TEXT,
    "zipCode" TEXT,
    "metroArea" TEXT,
    "fullAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "industry" TEXT,
    "category" TEXT,
    "subcategory" TEXT,
    "naicsCode" TEXT,
    "brokerName" TEXT,
    "brokerCompany" TEXT,
    "brokerPhone" TEXT,
    "brokerEmail" TEXT,
    "sellerFinancing" BOOLEAN,
    "employees" INTEGER,
    "established" INTEGER,
    "reasonForSale" TEXT,
    "facilities" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "listingDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dedupGroupId" TEXT,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingSource" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceId" TEXT,
    "rawData" JSONB,
    "rawTitle" TEXT,
    "rawPrice" DECIMAL(14,2),
    "rawRevenue" DECIMAL(14,2),
    "rawCashFlow" DECIMAL(14,2),
    "firstScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupGroup" (
    "id" TEXT NOT NULL,
    "primaryListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DedupGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DedupCandidate" (
    "id" TEXT NOT NULL,
    "listingAId" TEXT NOT NULL,
    "listingBId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "nameScore" DOUBLE PRECISION,
    "locationScore" DOUBLE PRECISION,
    "priceScore" DOUBLE PRECISION,
    "revenueScore" DOUBLE PRECISION,
    "descriptionScore" DOUBLE PRECISION,
    "status" "DedupStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DedupCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" "PipelineStage" NOT NULL DEFAULT 'CONTACTING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "contactedAt" TIMESTAMP(3),
    "cimRequestedAt" TIMESTAMP(3),
    "ndaSignedAt" TIMESTAMP(3),
    "offerSentAt" TIMESTAMP(3),
    "underContractAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "offerPrice" DECIMAL(14,2),
    "offerTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageChange" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStage" "PipelineStage" NOT NULL,
    "toStage" "PipelineStage" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "listingId" TEXT,
    "opportunityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "syncCursor" TEXT,
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "graphMessageId" TEXT NOT NULL,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "conversationId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "importance" TEXT,
    "webLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLink" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "linkedBy" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCookie" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "cookieData" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCookie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "status" "ScrapeStatus" NOT NULL DEFAULT 'PENDING',
    "listingsFound" INTEGER NOT NULL DEFAULT 0,
    "listingsNew" INTEGER NOT NULL DEFAULT 0,
    "listingsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeSchedule" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingTag" (
    "listingId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ListingTag_pkey" PRIMARY KEY ("listingId","tagId")
);

-- CreateTable
CREATE TABLE "OpportunityTag" (
    "opportunityId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "OpportunityTag_pkey" PRIMARY KEY ("opportunityId","tagId")
);

-- CreateTable
CREATE TABLE "IndustryMultiple" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "category" TEXT,
    "sdeLow" DOUBLE PRECISION,
    "sdeMedian" DOUBLE PRECISION,
    "sdeHigh" DOUBLE PRECISION,
    "ebitdaLow" DOUBLE PRECISION,
    "ebitdaMedian" DOUBLE PRECISION,
    "ebitdaHigh" DOUBLE PRECISION,
    "revenueLow" DOUBLE PRECISION,
    "revenueMedian" DOUBLE PRECISION,
    "revenueHigh" DOUBLE PRECISION,
    "ebitdaMarginLow" DOUBLE PRECISION,
    "ebitdaMarginMedian" DOUBLE PRECISION,
    "ebitdaMarginHigh" DOUBLE PRECISION,
    "source" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryMultiple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "listingId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Listing_city_state_idx" ON "Listing"("city", "state");

-- CreateIndex
CREATE INDEX "Listing_industry_idx" ON "Listing"("industry");

-- CreateIndex
CREATE INDEX "Listing_askingPrice_idx" ON "Listing"("askingPrice");

-- CreateIndex
CREATE INDEX "Listing_ebitda_idx" ON "Listing"("ebitda");

-- CreateIndex
CREATE INDEX "Listing_sde_idx" ON "Listing"("sde");

-- CreateIndex
CREATE INDEX "Listing_inferredEbitda_idx" ON "Listing"("inferredEbitda");

-- CreateIndex
CREATE INDEX "Listing_inferredSde_idx" ON "Listing"("inferredSde");

-- CreateIndex
CREATE INDEX "Listing_isHidden_isActive_idx" ON "Listing"("isHidden", "isActive");

-- CreateIndex
CREATE INDEX "Listing_dedupGroupId_idx" ON "Listing"("dedupGroupId");

-- CreateIndex
CREATE INDEX "Listing_lastSeenAt_idx" ON "Listing"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Listing_metroArea_idx" ON "Listing"("metroArea");

-- CreateIndex
CREATE UNIQUE INDEX "ListingSource_sourceUrl_key" ON "ListingSource"("sourceUrl");

-- CreateIndex
CREATE INDEX "ListingSource_platform_idx" ON "ListingSource"("platform");

-- CreateIndex
CREATE INDEX "ListingSource_listingId_idx" ON "ListingSource"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingSource_platform_sourceId_key" ON "ListingSource"("platform", "sourceId");

-- CreateIndex
CREATE INDEX "DedupCandidate_status_idx" ON "DedupCandidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DedupCandidate_listingAId_listingBId_key" ON "DedupCandidate"("listingAId", "listingBId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_listingId_key" ON "Opportunity"("listingId");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- CreateIndex
CREATE INDEX "Opportunity_priority_idx" ON "Opportunity"("priority");

-- CreateIndex
CREATE INDEX "StageChange_opportunityId_idx" ON "StageChange"("opportunityId");

-- CreateIndex
CREATE INDEX "Note_listingId_idx" ON "Note"("listingId");

-- CreateIndex
CREATE INDEX "Note_opportunityId_idx" ON "Note"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_email_key" ON "EmailAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Email_graphMessageId_key" ON "Email"("graphMessageId");

-- CreateIndex
CREATE INDEX "Email_fromAddress_idx" ON "Email"("fromAddress");

-- CreateIndex
CREATE INDEX "Email_conversationId_idx" ON "Email"("conversationId");

-- CreateIndex
CREATE INDEX "Email_sentAt_idx" ON "Email"("sentAt");

-- CreateIndex
CREATE INDEX "EmailLink_opportunityId_idx" ON "EmailLink"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailLink_emailId_opportunityId_key" ON "EmailLink"("emailId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCookie_platform_key" ON "PlatformCookie"("platform");

-- CreateIndex
CREATE INDEX "ScrapeRun_platform_idx" ON "ScrapeRun"("platform");

-- CreateIndex
CREATE INDEX "ScrapeRun_status_idx" ON "ScrapeRun"("status");

-- CreateIndex
CREATE INDEX "ScrapeRun_createdAt_idx" ON "ScrapeRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeSchedule_platform_key" ON "ScrapeSchedule"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "IndustryMultiple_industry_idx" ON "IndustryMultiple"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "IndustryMultiple_industry_category_key" ON "IndustryMultiple"("industry", "category");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_dedupGroupId_fkey" FOREIGN KEY ("dedupGroupId") REFERENCES "DedupGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingSource" ADD CONSTRAINT "ListingSource_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChange" ADD CONSTRAINT "StageChange_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLink" ADD CONSTRAINT "EmailLink_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLink" ADD CONSTRAINT "EmailLink_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingTag" ADD CONSTRAINT "ListingTag_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingTag" ADD CONSTRAINT "ListingTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTag" ADD CONSTRAINT "OpportunityTag_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityTag" ADD CONSTRAINT "OpportunityTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
