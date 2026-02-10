-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "dealValue" DOUBLE PRECISION,
ADD COLUMN     "lostCategory" TEXT,
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "winProbability" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_opportunityId_idx" ON "Task"("opportunityId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_isCompleted_idx" ON "Task"("isCompleted");

-- CreateIndex
CREATE INDEX "EmailLink_emailId_idx" ON "EmailLink"("emailId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
