-- CreateTable
CREATE TABLE "ContentLike" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentLike_kind_targetId_idx" ON "ContentLike"("kind", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLike_kind_targetId_visitorId_key" ON "ContentLike"("kind", "targetId", "visitorId");
