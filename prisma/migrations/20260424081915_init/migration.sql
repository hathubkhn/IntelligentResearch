-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('CONFERENCE', 'JOURNAL', 'PREPRINT', 'WORKSHOP');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'ERROR');

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "year" INTEGER,
    "venue" TEXT,
    "venueType" "VenueType",
    "category" TEXT,
    "tags" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "paperUrl" TEXT,
    "codeUrl" TEXT,
    "openReviewUrl" TEXT,
    "arxivId" TEXT,
    "rawInput" TEXT NOT NULL,
    "tldr" TEXT,
    "problem" TEXT,
    "keyIdea" TEXT,
    "results" TEXT,
    "contributions" TEXT[],
    "methodDiagram" TEXT,
    "coverColor" TEXT,
    "status" "SummaryStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "collectionId" TEXT,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
