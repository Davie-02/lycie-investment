-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomerUser" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);
