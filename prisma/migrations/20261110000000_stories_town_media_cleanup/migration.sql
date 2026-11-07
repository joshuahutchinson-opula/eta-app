-- Reports about mood media go with it (the enum value is dropped below).
DELETE FROM "Report" WHERE "targetType" = 'MOOD_MEDIA';

-- AlterEnum
BEGIN;
CREATE TYPE "ReportTarget_new" AS ENUM ('MOMENT', 'STORY', 'REVIEW', 'HIDDEN_GEM');
ALTER TABLE "Report" ALTER COLUMN "targetType" TYPE "ReportTarget_new" USING ("targetType"::text::"ReportTarget_new");
ALTER TYPE "ReportTarget" RENAME TO "ReportTarget_old";
ALTER TYPE "ReportTarget_new" RENAME TO "ReportTarget";
DROP TYPE "ReportTarget_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "MoodMedia" DROP CONSTRAINT "MoodMedia_moodId_fkey";

-- DropForeignKey
ALTER TABLE "MoodMedia" DROP CONSTRAINT "MoodMedia_userId_fkey";

-- DropForeignKey
ALTER TABLE "TodayStory" DROP CONSTRAINT "TodayStory_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "TodayStory" DROP CONSTRAINT "TodayStory_eventId_fkey";

-- DropForeignKey
ALTER TABLE "TodayStory" DROP CONSTRAINT "TodayStory_createdById_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "stagePromptSnoozedUntil";

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "closeFriends" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "drawingUrl" TEXT,
ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overlays" JSONB;

-- AlterTable
ALTER TABLE "TownMedia" ADD COLUMN     "license" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "urlSd" TEXT;

-- DropTable
DROP TABLE "MoodMedia";

-- DropTable
DROP TABLE "TodayStory";

-- CreateTable
CREATE TABLE "StoryReply" (
    "id" TEXT NOT NULL,
    "text" TEXT,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "StoryReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloseFriend" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,

    CONSTRAINT "CloseFriend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryReply_storyId_createdAt_idx" ON "StoryReply"("storyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloseFriend_ownerId_friendId_key" ON "CloseFriend"("ownerId", "friendId");

-- AddForeignKey
ALTER TABLE "StoryReply" ADD CONSTRAINT "StoryReply_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryReply" ADD CONSTRAINT "StoryReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloseFriend" ADD CONSTRAINT "CloseFriend_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

