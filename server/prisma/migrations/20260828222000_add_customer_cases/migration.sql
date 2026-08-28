-- CreateEnum
CREATE TYPE "CustomerCaseStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CustomerCase" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" TEXT,
    "hireVehicleId" TEXT,
    "title" TEXT NOT NULL,
    "status" "CustomerCaseStatus" NOT NULL DEFAULT 'REQUESTED',
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCaseUpdate" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "status" "CustomerCaseStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCaseUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerCase_customerId_updatedAt_idx" ON "CustomerCase"("customerId", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerCase_status_updatedAt_idx" ON "CustomerCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerCaseUpdate_caseId_createdAt_idx" ON "CustomerCaseUpdate"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerCase" ADD CONSTRAINT "CustomerCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCase" ADD CONSTRAINT "CustomerCase_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCase" ADD CONSTRAINT "CustomerCase_hireVehicleId_fkey" FOREIGN KEY ("hireVehicleId") REFERENCES "HireVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCaseUpdate" ADD CONSTRAINT "CustomerCaseUpdate_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CustomerCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
