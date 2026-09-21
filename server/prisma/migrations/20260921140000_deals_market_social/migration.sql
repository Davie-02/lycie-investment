-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('NEW', 'PUBLISHED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "priceUsd" INTEGER,
    "vehicleLabel" TEXT,
    "validUntil" TIMESTAMP(3),
    "howToGet" TEXT NOT NULL DEFAULT '',
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DealStatus" NOT NULL DEFAULT 'NEW',
    "origin" TEXT NOT NULL DEFAULT 'ai',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketReport" (
    "id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "results" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_status_createdAt_idx" ON "Deal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledFor_idx" ON "SocialPost"("status", "scheduledFor");

