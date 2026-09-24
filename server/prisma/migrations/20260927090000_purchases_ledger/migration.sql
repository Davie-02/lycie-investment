-- AlterTable
ALTER TABLE "MobilePayment" ADD COLUMN     "exchangeRate" DECIMAL(19,6),
ADD COLUMN     "purchaseId" UUID;

-- AlterTable
ALTER TABLE "PaymentSubmission" ADD COLUMN     "purchaseId" UUID;

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotal" DECIMAL(19,2) NOT NULL,
    "pricing" TEXT NOT NULL DEFAULT 'standard',
    "offerName" TEXT,
    "promoCode" TEXT,
    "dealId" TEXT,
    "discountAmount" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(19,2) NOT NULL,
    "amountPaid" DECIMAL(19,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "vehicleId" TEXT,
    "caseId" UUID,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "customerNote" TEXT,
    "staffNote" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(19,2) NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePayment" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'payment',
    "amount" DECIMAL(19,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "receivedAmount" DECIMAL(19,2),
    "receivedCurrency" TEXT,
    "exchangeRate" DECIMAL(19,6),
    "source" TEXT NOT NULL DEFAULT 'staff',
    "sourceRef" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "voidedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_reference_key" ON "Purchase"("reference");

-- CreateIndex
CREATE INDEX "Purchase_customerId_purchasedAt_idx" ON "Purchase"("customerId", "purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_status_purchasedAt_idx" ON "Purchase"("status", "purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_type_purchasedAt_idx" ON "Purchase"("type", "purchasedAt");

-- CreateIndex
CREATE INDEX "Purchase_pricing_purchasedAt_idx" ON "Purchase"("pricing", "purchasedAt");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_sortOrder_idx" ON "PurchaseItem"("purchaseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayment_sourceRef_key" ON "PurchasePayment"("sourceRef");

-- CreateIndex
CREATE INDEX "PurchasePayment_purchaseId_paidAt_idx" ON "PurchasePayment"("purchaseId", "paidAt");

-- CreateIndex
CREATE INDEX "PurchasePayment_paidAt_idx" ON "PurchasePayment"("paidAt");

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobilePayment" ADD CONSTRAINT "MobilePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CustomerCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

