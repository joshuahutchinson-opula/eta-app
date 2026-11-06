-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "promotedUntil" TIMESTAMP(3),
ADD COLUMN     "videosUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TodayStory" (
    "id" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "publishOn" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "dek" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "coverVideo" TEXT,
    "body" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT,
    "eventId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "TodayStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TodayStory_city_publishOn_key" ON "TodayStory"("city", "publishOn");

-- AddForeignKey
ALTER TABLE "TodayStory" ADD CONSTRAINT "TodayStory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodayStory" ADD CONSTRAINT "TodayStory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodayStory" ADD CONSTRAINT "TodayStory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: vendors that already have videos count them from their last update.
UPDATE "Vendor" SET "videosUpdatedAt" = "updatedAt" WHERE cardinality("videos") > 0;
