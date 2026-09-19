-- CreateTable
CREATE TABLE "VisitorSubmission" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentiment" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqSuggestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "askCount" INTEGER NOT NULL DEFAULT 1,
    "samples" TEXT[],
    "needsInput" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "publishedFaqId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitorSubmission_kind_status_createdAt_idx" ON "VisitorSubmission"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FaqSuggestion_status_askCount_idx" ON "FaqSuggestion"("status", "askCount");
