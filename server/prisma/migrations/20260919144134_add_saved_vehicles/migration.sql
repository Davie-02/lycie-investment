-- CreateTable
CREATE TABLE "SavedVehicle" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedVehicle_customerId_createdAt_idx" ON "SavedVehicle"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedVehicle_customerId_vehicleId_key" ON "SavedVehicle"("customerId", "vehicleId");

-- AddForeignKey
ALTER TABLE "SavedVehicle" ADD CONSTRAINT "SavedVehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVehicle" ADD CONSTRAINT "SavedVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
