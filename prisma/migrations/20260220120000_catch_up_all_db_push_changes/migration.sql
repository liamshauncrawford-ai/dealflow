-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "AddBackCategory" AS ENUM ('OWNER_COMPENSATION', 'PERSONAL_EXPENSES', 'ONE_TIME_COSTS', 'DISCRETIONARY', 'RELATED_PARTY', 'NON_CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('OPPORTUNITY', 'CONTACT', 'NOTE', 'DOCUMENT', 'TASK', 'EMAIL', 'FINANCIAL', 'USER', 'ACCESS');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'STAGE_CHANGED', 'LINKED', 'UNLINKED', 'SENT', 'UPLOADED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CablingOpportunityStatus" AS ENUM ('IDENTIFIED', 'PRE_RFQ', 'RFQ_RECEIVED', 'ESTIMATING', 'BID_SUBMITTED', 'BID_UNDER_REVIEW', 'AWARDED', 'CONTRACT_NEGOTIATION', 'MOBILIZING', 'IN_PROGRESS', 'PUNCH_LIST', 'COMPLETED', 'LOST', 'NO_BID');

-- CreateEnum
CREATE TYPE "CablingScope" AS ENUM ('BACKBONE_FIBER', 'HORIZONTAL_COPPER', 'CABLE_TRAY_PATHWAY', 'CABINET_RACK_INSTALL', 'MEET_ME_ROOM', 'SECURITY_ACCESS_CONTROL', 'CCTV_SURVEILLANCE', 'ENVIRONMENTAL_MONITORING', 'TESTING_CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailTemplateCategory" AS ENUM ('CIM_REQUEST', 'NDA_REQUEST', 'INTRODUCTION', 'FOLLOW_UP', 'LOI', 'GENERAL');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('OPERATING', 'UNDER_CONSTRUCTION', 'PLANNED', 'RUMORED');

-- CreateEnum
CREATE TYPE "FinancialDataSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'AI_EXTRACTION', 'CIM_PARSER');

-- CreateEnum
CREATE TYPE "FinancialPeriodType" AS ENUM ('ANNUAL', 'QUARTERLY', 'LTM', 'YTD', 'PROJECTED');

-- CreateEnum
CREATE TYPE "GCDCExperience" AS ENUM ('SPECIALIST', 'EXPERIENCED', 'SOME', 'NONE');

-- CreateEnum
CREATE TYPE "GCPriority" AS ENUM ('HIGHEST', 'HIGH', 'MODERATE', 'MONITOR');

-- CreateEnum
CREATE TYPE "GCRelationshipStatus" AS ENUM ('NO_CONTACT', 'IDENTIFIED', 'INTRODUCTION_MADE', 'MEETING_HELD', 'BID_INVITED', 'WORK_IN_PROGRESS');

-- CreateEnum
CREATE TYPE "OperatorRelationshipStatus" AS ENUM ('NO_CONTACT', 'IDENTIFIED', 'INTRODUCTION_MADE', 'MEETING_HELD', 'RFQ_RECEIVED', 'BID_SUBMITTED', 'CONTRACT_AWARDED', 'ACTIVE_WORK');

-- CreateEnum
CREATE TYPE "OperatorTier" AS ENUM ('TIER_1_ACTIVE_CONSTRUCTION', 'TIER_2_EXPANSION', 'TIER_3_EXISTING_MAINTENANCE', 'TIER_4_RUMORED');

-- CreateEnum
CREATE TYPE "SubQualificationStatus" AS ENUM ('NOT_APPLIED', 'APPLICATION_SUBMITTED', 'QUALIFIED', 'PREFERRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'STAGE_TRIGGER', 'FOLLOW_UP_CHAIN', 'STALE_DETECTION', 'OVERDUE_DETECTION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ACCESS_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'HIGH_SCORE_DISCOVERY';
ALTER TYPE "NotificationType" ADD VALUE 'DC_PROJECT_NEWS';
ALTER TYPE "NotificationType" ADD VALUE 'SCORE_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'ENRICHMENT_COMPLETE';
ALTER TYPE "NotificationType" ADD VALUE 'WEEKLY_BRIEF';
ALTER TYPE "NotificationType" ADD VALUE 'LEGISLATION_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'AGENT_ERROR';

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "aiClassifiedAt" TIMESTAMP(3),
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "inReplyToExternalId" TEXT,
ADD COLUMN     "isSent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "aiScore" INTEGER,
ADD COLUMN     "compositeScore" INTEGER,
ADD COLUMN     "deterministicScore" INTEGER,
ADD COLUMN     "enrichmentDate" TIMESTAMP(3),
ADD COLUMN     "enrichmentStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "gcRelationshipBoost" INTEGER DEFAULT 0,
ADD COLUMN     "lastScoredAt" TIMESTAMP(3),
ADD COLUMN     "nearestFacilityDistanceMi" DOUBLE PRECISION,
ADD COLUMN     "nearestFacilityId" TEXT,
ADD COLUMN     "recommendedAction" TEXT,
ADD COLUMN     "scoreChange" INTEGER DEFAULT 0,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "thesisAlignment" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionUrl" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "isEmailed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" TEXT DEFAULT 'normal',
ADD COLUMN     "readAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "source" "TaskSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "triggerStage" TEXT;

-- CreateTable
CREATE TABLE "AIAgentRun" (
    "id" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "apiCallsMade" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AIAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAnalysisResult" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT,
    "documentId" TEXT,
    "analysisType" TEXT NOT NULL,
    "resultData" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingId" TEXT,

    CONSTRAINT "AIAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddBack" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "category" "AddBackCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "confidence" DOUBLE PRECISION,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "includeInSde" BOOLEAN NOT NULL DEFAULT true,
    "includeInEbitda" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sourceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddBack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "summary" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CablingOpportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "operatorId" TEXT,
    "gcId" TEXT,
    "facilityId" TEXT,
    "facilityAddress" TEXT,
    "facilitySizeMW" DOUBLE PRECISION,
    "cablingScopes" "CablingScope"[],
    "estimatedValue" DECIMAL(14,2),
    "bidSubmittedValue" DECIMAL(14,2),
    "awardedValue" DECIMAL(14,2),
    "actualRevenue" DECIMAL(14,2),
    "marginPct" DOUBLE PRECISION,
    "rfqDate" TIMESTAMP(3),
    "bidDueDate" TIMESTAMP(3),
    "bidSubmittedDate" TIMESTAMP(3),
    "awardDate" TIMESTAMP(3),
    "constructionStart" TIMESTAMP(3),
    "constructionEnd" TIMESTAMP(3),
    "status" "CablingOpportunityStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "lossReason" TEXT,
    "competitorWhoWon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "surfacedFromNewsId" TEXT,
    "weightedValue" DECIMAL(14,2),
    "winProbabilityPct" DOUBLE PRECISION,

    CONSTRAINT "CablingOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DCFacility" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT DEFAULT 'CO',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacityMW" DOUBLE PRECISION,
    "sqft" INTEGER,
    "status" "FacilityStatus" NOT NULL DEFAULT 'OPERATING',
    "yearOpened" INTEGER,
    "yearExpectedCompletion" INTEGER,
    "tierCertification" TEXT,
    "generalContractorId" TEXT,
    "estimatedCablingScopeValue" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DCFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCenterOperator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCompany" TEXT,
    "hqLocation" TEXT,
    "hqState" TEXT,
    "website" TEXT,
    "tier" "OperatorTier" NOT NULL DEFAULT 'TIER_3_EXISTING_MAINTENANCE',
    "cablingOpportunityScore" INTEGER,
    "estimatedAnnualCablingRevenue" DECIMAL(14,2),
    "activeConstruction" BOOLEAN NOT NULL DEFAULT false,
    "constructionTimeline" TEXT,
    "phaseCount" INTEGER,
    "relationshipStatus" "OperatorRelationshipStatus" NOT NULL DEFAULT 'NO_CONTACT',
    "primaryContactName" TEXT,
    "primaryContactTitle" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "lastContactDate" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataCenterOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "category" "EmailTemplateCategory" NOT NULL DEFAULT 'GENERAL',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLineItem" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "rawLabel" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialPeriod" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "periodType" "FinancialPeriodType" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "label" TEXT,
    "dataSource" "FinancialDataSource" NOT NULL DEFAULT 'MANUAL',
    "sourceDocumentId" TEXT,
    "confidence" DOUBLE PRECISION,
    "totalRevenue" DECIMAL(14,2),
    "totalCogs" DECIMAL(14,2),
    "grossProfit" DECIMAL(14,2),
    "totalOpex" DECIMAL(14,2),
    "ebitda" DECIMAL(14,2),
    "depreciationAmort" DECIMAL(14,2),
    "ebit" DECIMAL(14,2),
    "interestExpense" DECIMAL(14,2),
    "taxExpense" DECIMAL(14,2),
    "netIncome" DECIMAL(14,2),
    "totalAddBacks" DECIMAL(14,2),
    "adjustedEbitda" DECIMAL(14,2),
    "sde" DECIMAL(14,2),
    "grossMargin" DOUBLE PRECISION,
    "ebitdaMargin" DOUBLE PRECISION,
    "adjustedEbitdaMargin" DOUBLE PRECISION,
    "netMargin" DOUBLE PRECISION,
    "notes" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralContractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hqLocation" TEXT,
    "website" TEXT,
    "coloradoOffice" BOOLEAN NOT NULL DEFAULT false,
    "coloradoOfficeAddress" TEXT,
    "dcExperienceLevel" "GCDCExperience" NOT NULL DEFAULT 'NONE',
    "notableDCProjects" TEXT[],
    "nationalDCClients" TEXT[],
    "approvedSubList" BOOLEAN NOT NULL DEFAULT false,
    "subQualificationStatus" "SubQualificationStatus" NOT NULL DEFAULT 'NOT_APPLIED',
    "qualificationDate" TIMESTAMP(3),
    "prequalificationRequirements" TEXT,
    "relationshipStatus" "GCRelationshipStatus" NOT NULL DEFAULT 'NO_CONTACT',
    "primaryContactName" TEXT,
    "primaryContactTitle" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "lastContactDate" TIMESTAMP(3),
    "nextFollowUp" TIMESTAMP(3),
    "notes" TEXT,
    "priority" "GCPriority" NOT NULL DEFAULT 'MONITOR',
    "estimatedAnnualOpportunity" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneralContractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketMetric" (
    "id" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "totalMwOperating" DOUBLE PRECISION,
    "totalMwUnderConstruction" DOUBLE PRECISION,
    "totalMwPlanned" DOUBLE PRECISION,
    "activeConstructionProjects" INTEGER,
    "estimatedCablingTam" DECIMAL(14,2),
    "gcCoveragePct" DOUBLE PRECISION,
    "weightedPipelineValue" DECIMAL(14,2),
    "targetsTracked" INTEGER,
    "actionableTargets" INTEGER,
    "legislationStatus" JSONB,

    CONSTRAINT "MarketMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "headline" TEXT,
    "rawContent" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "urgency" TEXT,
    "impactOnThesis" TEXT,
    "aiSummary" TEXT,
    "actionItems" JSONB,
    "relatedOperatorIds" JSONB,
    "relatedGcIds" JSONB,
    "relatedListingIds" JSONB,
    "estimatedCablingValue" DECIMAL(14,2),
    "classifiedAt" TIMESTAMP(3),
    "automationRanAt" TIMESTAMP(3),
    "surfacedTargetIds" JSONB,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollupModel" (
    "id" TEXT NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'Primary Roll-Up',
    "platformListingId" TEXT,
    "boltOnListingIds" JSONB,
    "synergyAssumptions" JSONB,
    "exitAssumptions" JSONB,
    "projectionData" JSONB,
    "valueBridgeData" JSONB,
    "aiCommentary" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RollupModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperConfig" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "frequency" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "lastActivePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationModel" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "modelName" TEXT,
    "inputs" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "aiCommentary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyBrief" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "thesisHealth" TEXT,
    "marketMomentum" TEXT,
    "rawBrief" JSONB,
    "keyDevelopments" JSONB,
    "recommendedActions" JSONB,
    "pipelineMetrics" JSONB,
    "marketMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_token" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "AIAgentRun_agentName_idx" ON "AIAgentRun"("agentName" ASC);

-- CreateIndex
CREATE INDEX "AIAgentRun_startedAt_idx" ON "AIAgentRun"("startedAt" ASC);

-- CreateIndex
CREATE INDEX "AIAgentRun_status_idx" ON "AIAgentRun"("status" ASC);

-- CreateIndex
CREATE INDEX "AIAnalysisResult_documentId_idx" ON "AIAnalysisResult"("documentId" ASC);

-- CreateIndex
CREATE INDEX "AIAnalysisResult_listingId_idx" ON "AIAnalysisResult"("listingId" ASC);

-- CreateIndex
CREATE INDEX "AIAnalysisResult_opportunityId_idx" ON "AIAnalysisResult"("opportunityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "AccessRequest_userId_key" ON "AccessRequest"("userId" ASC);

-- CreateIndex
CREATE INDEX "AddBack_category_idx" ON "AddBack"("category" ASC);

-- CreateIndex
CREATE INDEX "AddBack_periodId_idx" ON "AddBack"("periodId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_opportunityId_idx" ON "AuditLog"("opportunityId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId" ASC);

-- CreateIndex
CREATE INDEX "CablingOpportunity_facilityId_idx" ON "CablingOpportunity"("facilityId" ASC);

-- CreateIndex
CREATE INDEX "CablingOpportunity_gcId_idx" ON "CablingOpportunity"("gcId" ASC);

-- CreateIndex
CREATE INDEX "CablingOpportunity_operatorId_idx" ON "CablingOpportunity"("operatorId" ASC);

-- CreateIndex
CREATE INDEX "CablingOpportunity_status_idx" ON "CablingOpportunity"("status" ASC);

-- CreateIndex
CREATE INDEX "DCFacility_generalContractorId_idx" ON "DCFacility"("generalContractorId" ASC);

-- CreateIndex
CREATE INDEX "DCFacility_operatorId_idx" ON "DCFacility"("operatorId" ASC);

-- CreateIndex
CREATE INDEX "DCFacility_status_idx" ON "DCFacility"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DataCenterOperator_name_key" ON "DataCenterOperator"("name" ASC);

-- CreateIndex
CREATE INDEX "DataCenterOperator_relationshipStatus_idx" ON "DataCenterOperator"("relationshipStatus" ASC);

-- CreateIndex
CREATE INDEX "DataCenterOperator_tier_idx" ON "DataCenterOperator"("tier" ASC);

-- CreateIndex
CREATE INDEX "FinancialLineItem_category_idx" ON "FinancialLineItem"("category" ASC);

-- CreateIndex
CREATE INDEX "FinancialLineItem_periodId_idx" ON "FinancialLineItem"("periodId" ASC);

-- CreateIndex
CREATE INDEX "FinancialPeriod_opportunityId_idx" ON "FinancialPeriod"("opportunityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPeriod_opportunityId_periodType_year_quarter_key" ON "FinancialPeriod"("opportunityId" ASC, "periodType" ASC, "year" ASC, "quarter" ASC);

-- CreateIndex
CREATE INDEX "FinancialPeriod_year_idx" ON "FinancialPeriod"("year" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "GeneralContractor_name_key" ON "GeneralContractor"("name" ASC);

-- CreateIndex
CREATE INDEX "GeneralContractor_priority_idx" ON "GeneralContractor"("priority" ASC);

-- CreateIndex
CREATE INDEX "GeneralContractor_relationshipStatus_idx" ON "GeneralContractor"("relationshipStatus" ASC);

-- CreateIndex
CREATE INDEX "GeneralContractor_subQualificationStatus_idx" ON "GeneralContractor"("subQualificationStatus" ASC);

-- CreateIndex
CREATE INDEX "LoginHistory_createdAt_idx" ON "LoginHistory"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "LoginHistory_userId_idx" ON "LoginHistory"("userId" ASC);

-- CreateIndex
CREATE INDEX "MarketMetric_recordedAt_idx" ON "MarketMetric"("recordedAt" ASC);

-- CreateIndex
CREATE INDEX "NewsItem_category_idx" ON "NewsItem"("category" ASC);

-- CreateIndex
CREATE INDEX "NewsItem_fetchedAt_idx" ON "NewsItem"("fetchedAt" ASC);

-- CreateIndex
CREATE INDEX "NewsItem_urgency_idx" ON "NewsItem"("urgency" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_url_key" ON "NewsItem"("url" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ScraperConfig_sourceName_key" ON "ScraperConfig"("sourceName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE INDEX "ValuationModel_listingId_idx" ON "ValuationModel"("listingId" ASC);

-- CreateIndex
CREATE INDEX "WeeklyBrief_weekStart_idx" ON "WeeklyBrief"("weekStart" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "auth_account_provider_providerAccountId_key" ON "auth_account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_identifier_token_key" ON "verification_token"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "verification_token_token_key" ON "verification_token"("token" ASC);

-- CreateIndex
CREATE INDEX "Email_isSent_idx" ON "Email"("isSent" ASC);

-- CreateIndex
CREATE INDEX "Listing_compositeScore_idx" ON "Listing"("compositeScore" ASC);

-- CreateIndex
CREATE INDEX "Listing_enrichmentStatus_idx" ON "Listing"("enrichmentStatus" ASC);

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority" ASC);

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type" ASC);

-- CreateIndex
CREATE INDEX "Task_opportunityId_triggerStage_isCompleted_idx" ON "Task"("opportunityId" ASC, "triggerStage" ASC, "isCompleted" ASC);

-- AddForeignKey
ALTER TABLE "AIAnalysisResult" ADD CONSTRAINT "AIAnalysisResult_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAnalysisResult" ADD CONSTRAINT "AIAnalysisResult_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRequest" ADD CONSTRAINT "AccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddBack" ADD CONSTRAINT "AddBack_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CablingOpportunity" ADD CONSTRAINT "CablingOpportunity_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "DCFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CablingOpportunity" ADD CONSTRAINT "CablingOpportunity_gcId_fkey" FOREIGN KEY ("gcId") REFERENCES "GeneralContractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CablingOpportunity" ADD CONSTRAINT "CablingOpportunity_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "DataCenterOperator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCFacility" ADD CONSTRAINT "DCFacility_generalContractorId_fkey" FOREIGN KEY ("generalContractorId") REFERENCES "GeneralContractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCFacility" ADD CONSTRAINT "DCFacility_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "DataCenterOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLineItem" ADD CONSTRAINT "FinancialLineItem_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "FinancialPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialPeriod" ADD CONSTRAINT "FinancialPeriod_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationModel" ADD CONSTRAINT "ValuationModel_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
