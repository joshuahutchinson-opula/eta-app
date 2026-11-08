-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "bestTimes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "featuredUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "happyHourEnd" TEXT,
ADD COLUMN     "happyHourStart" TEXT,
ADD COLUMN     "heatLevel" INTEGER,
ADD COLUMN     "marketNote" TEXT,
ADD COLUMN     "marketTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "MomentPick" (
    "id" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "daypart" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "experienceId" TEXT,
    "eventId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "MomentPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MomentPick_city_active_idx" ON "MomentPick"("city", "active");

-- AddForeignKey
ALTER TABLE "MomentPick" ADD CONSTRAINT "MomentPick_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomentPick" ADD CONSTRAINT "MomentPick_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomentPick" ADD CONSTRAINT "MomentPick_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
