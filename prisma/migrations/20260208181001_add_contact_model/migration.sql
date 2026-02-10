-- CreateEnum
CREATE TYPE "ContactInterest" AS ENUM ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "role" TEXT,
    "interestLevel" "ContactInterest" NOT NULL DEFAULT 'UNKNOWN',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_opportunityId_idx" ON "Contact"("opportunityId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
