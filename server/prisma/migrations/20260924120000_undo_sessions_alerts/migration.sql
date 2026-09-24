-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "lastTotpStep" INTEGER,
ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomerUser" ADD COLUMN     "sessionsRevokedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SavedVehicle" ADD COLUMN     "notifiedPrice" INTEGER;

-- AlterTable
ALTER TABLE "AdminActivity" ADD COLUMN     "undoOfId" TEXT,
ADD COLUMN     "undoable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "undoneAt" TIMESTAMP(3),
ADD COLUMN     "undoneBy" TEXT;

-- CreateTable
CREATE TABLE "ChangeRecord" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedSession" (
    "jti" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevokedSession_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "VehicleAlert" (
    "id" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "bodyType" TEXT,
    "maxPrice" INTEGER,
    "minYear" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRecord_activityId_seq_idx" ON "ChangeRecord"("activityId", "seq");

-- CreateIndex
CREATE INDEX "RevokedSession_expiresAt_idx" ON "RevokedSession"("expiresAt");

-- CreateIndex
CREATE INDEX "VehicleAlert_customerId_idx" ON "VehicleAlert"("customerId");

-- CreateIndex
CREATE INDEX "VehicleAlert_isActive_idx" ON "VehicleAlert"("isActive");

-- AddForeignKey
ALTER TABLE "ChangeRecord" ADD CONSTRAINT "ChangeRecord_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AdminActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAlert" ADD CONSTRAINT "VehicleAlert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

