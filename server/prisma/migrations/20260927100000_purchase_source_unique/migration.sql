-- One purchase per website request (a hire booking paid online can't get two).
CREATE UNIQUE INDEX "Purchase_sourceType_sourceId_key" ON "Purchase"("sourceType", "sourceId");
