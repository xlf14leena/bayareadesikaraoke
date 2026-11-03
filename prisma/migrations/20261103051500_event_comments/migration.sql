-- AlterTable
ALTER TABLE "EventDate" ADD COLUMN     "commentsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EventComment" (
    "id" TEXT NOT NULL,
    "eventDateId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "parentId" TEXT,
    "isQuestion" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventComment_eventDateId_createdAt_idx" ON "EventComment"("eventDateId", "createdAt");

-- CreateIndex
CREATE INDEX "EventComment_parentId_idx" ON "EventComment"("parentId");

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

