-- AlterEnum: Remove INTERESTED from PipelineStage
-- First ensure no rows reference INTERESTED (they were migrated to REQUESTED_CIM)
ALTER TYPE "PipelineStage" RENAME TO "PipelineStage_old";

CREATE TYPE "PipelineStage" AS ENUM ('CONTACTING', 'REQUESTED_CIM', 'SIGNED_NDA', 'DUE_DILIGENCE', 'OFFER_SENT', 'COUNTER_OFFER_RECEIVED', 'UNDER_CONTRACT', 'CLOSED_WON', 'CLOSED_LOST', 'ON_HOLD');

ALTER TABLE "Opportunity" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Opportunity" ALTER COLUMN "stage" TYPE "PipelineStage" USING ("stage"::text::"PipelineStage");
ALTER TABLE "Opportunity" ALTER COLUMN "stage" SET DEFAULT 'CONTACTING'::"PipelineStage";

ALTER TABLE "StageChange" ALTER COLUMN "fromStage" TYPE "PipelineStage" USING ("fromStage"::text::"PipelineStage");
ALTER TABLE "StageChange" ALTER COLUMN "toStage" TYPE "PipelineStage" USING ("toStage"::text::"PipelineStage");

DROP TYPE "PipelineStage_old";
