-- AlterTable
ALTER TABLE "ClearingRequest" ADD COLUMN     "customerId" UUID;

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "customerId" UUID;

-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "customerId" UUID;

-- AlterTable
ALTER TABLE "ImportRequest" ADD COLUMN     "customerId" UUID;

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "customerId" UUID;

-- CreateIndex
CREATE INDEX "ClearingRequest_customerId_createdAt_idx" ON "ClearingRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_customerId_createdAt_idx" ON "ContactMessage"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "HireRequest_customerId_createdAt_idx" ON "HireRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRequest_customerId_createdAt_idx" ON "ImportRequest"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_customerId_createdAt_idx" ON "Inquiry"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRequest" ADD CONSTRAINT "ImportRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClearingRequest" ADD CONSTRAINT "ClearingRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HireRequest" ADD CONSTRAINT "HireRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
