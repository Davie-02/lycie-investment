-- AlterTable
ALTER TABLE "ClearingRequest" ADD COLUMN     "preferredContact" TEXT;

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "preferredContact" TEXT;

-- AlterTable
ALTER TABLE "HireRequest" ADD COLUMN     "preferredContact" TEXT;

-- AlterTable
ALTER TABLE "ImportRequest" ADD COLUMN     "preferredContact" TEXT;

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "preferredContact" TEXT;

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "adminName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMessage" (
    "id" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requestType" TEXT,
    "requestId" TEXT,
    "sentByName" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactLog_requestType_requestId_idx" ON "ContactLog"("requestType", "requestId");

-- CreateIndex
CREATE INDEX "CustomerMessage_customerId_createdAt_idx" ON "CustomerMessage"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
