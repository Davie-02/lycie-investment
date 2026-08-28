-- CreateEnum
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "proofUrl" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSubmission_reference_key" ON "PaymentSubmission"("reference");

-- CreateIndex
CREATE INDEX "PaymentSubmission_customerId_createdAt_idx" ON "PaymentSubmission"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_accountId_createdAt_idx" ON "PaymentSubmission"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSubmission_status_createdAt_idx" ON "PaymentSubmission"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
