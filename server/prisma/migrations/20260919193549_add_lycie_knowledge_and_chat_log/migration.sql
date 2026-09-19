-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'faq',
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LycieChatLog" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "model" TEXT,
    "outcome" TEXT NOT NULL,
    "helpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LycieChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeEntry_isActive_category_idx" ON "KnowledgeEntry"("isActive", "category");

-- CreateIndex
CREATE INDEX "LycieChatLog_createdAt_idx" ON "LycieChatLog"("createdAt");

-- CreateIndex
CREATE INDEX "LycieChatLog_outcome_createdAt_idx" ON "LycieChatLog"("outcome", "createdAt");

-- Full-text search over knowledge entries, done inside Postgres so no
-- document text has to leave the server to be indexed. An expression index
-- (rather than a stored column) keeps the Prisma model simple.
CREATE INDEX "KnowledgeEntry_fts_idx" ON "KnowledgeEntry" USING GIN (to_tsvector('english', "title" || ' ' || "content"));
