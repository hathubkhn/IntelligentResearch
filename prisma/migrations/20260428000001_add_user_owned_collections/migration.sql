-- AlterTable Paper: add optional userId
ALTER TABLE "Paper" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- AlterTable Collection: add optional userId
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- CreateTable UserCollectionItem
CREATE TABLE IF NOT EXISTS "UserCollectionItem" (
    "id" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,

    CONSTRAINT "UserCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserCollectionItem_collectionId_paperId_key"
  ON "UserCollectionItem"("collectionId", "paperId");

-- AddForeignKey Paper.userId -> User
ALTER TABLE "Paper"
  ADD CONSTRAINT "Paper_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

-- AddForeignKey Collection.userId -> User
ALTER TABLE "Collection"
  ADD CONSTRAINT "Collection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

-- AddForeignKey UserCollectionItem.collectionId -> Collection
ALTER TABLE "UserCollectionItem"
  ADD CONSTRAINT "UserCollectionItem_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey UserCollectionItem.paperId -> Paper
ALTER TABLE "UserCollectionItem"
  ADD CONSTRAINT "UserCollectionItem_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
