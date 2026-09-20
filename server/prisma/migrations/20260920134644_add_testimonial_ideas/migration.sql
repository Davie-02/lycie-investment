-- CreateTable
CREATE TABLE "TestimonialIdea" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestimonialIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestimonialIdea_status_score_idx" ON "TestimonialIdea"("status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "TestimonialIdea_source_sourceId_key" ON "TestimonialIdea"("source", "sourceId");
