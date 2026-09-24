-- AlterTable
ALTER TABLE "VehicleAlert" ADD COLUMN     "sentVehicleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

