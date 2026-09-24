-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'EMPLOYEE';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "department" TEXT,
ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissions" JSONB,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "stepUpUntil" TIMESTAMP(3),
ADD COLUMN     "tempPasswordExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomerUser" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" UUID;

-- AlterTable
ALTER TABLE "CustomerCase" ADD COLUMN     "eta" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "stage" TEXT,
ADD COLUMN     "trackingCode" TEXT;

-- AlterTable
ALTER TABLE "CustomerCaseUpdate" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stage" TEXT;

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobilePayment" (
    "id" TEXT NOT NULL,
    "customerId" UUID,
    "txRef" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "purpose" TEXT NOT NULL DEFAULT 'deposit',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider" TEXT NOT NULL DEFAULT 'paychangu',
    "checkoutUrl" TEXT,
    "providerData" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" UUID NOT NULL,
    "referredId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rewardAmount" INTEGER,
    "rewardNote" TEXT,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_startDate_idx" ON "LeaveRequest"("employeeId", "startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_startDate_idx" ON "LeaveRequest"("status", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "MobilePayment_txRef_key" ON "MobilePayment"("txRef");

-- CreateIndex
CREATE INDEX "MobilePayment_customerId_createdAt_idx" ON "MobilePayment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "MobilePayment_status_createdAt_idx" ON "MobilePayment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredId_key" ON "Referral"("referredId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerUser_referralCode_key" ON "CustomerUser"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCase_trackingCode_key" ON "CustomerCase"("trackingCode");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilePayment" ADD CONSTRAINT "MobilePayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

