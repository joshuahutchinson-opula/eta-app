-- Explore mode (November 2026): vendor location status, more secret-spot
-- categories, quests (checkpoints, progress, hits) and the last Explore
-- position on the account. Additive only; existing vendors start as
-- UNCONFIRMED.

-- CreateEnum
CREATE TYPE "VendorLocationStatus" AS ENUM ('CONFIRMED', 'UNCONFIRMED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GemCategory" ADD VALUE 'STREET_ART';
ALTER TYPE "GemCategory" ADD VALUE 'SWIMMING_SPOT';
ALTER TYPE "GemCategory" ADD VALUE 'LOCAL_FAVOURITE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "exploreLastAt" TIMESTAMP(3),
ADD COLUMN     "exploreLastLat" DOUBLE PRECISION,
ADD COLUMN     "exploreLastLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "locationAccuracyM" DOUBLE PRECISION,
ADD COLUMN     "locationSource" TEXT,
ADD COLUMN     "locationStatus" "VendorLocationStatus" NOT NULL DEFAULT 'UNCONFIRMED',
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "badgeName" TEXT NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 200,
    "rewardId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "vendorId" TEXT,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCheckpoint" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "clue" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 75,
    "questId" TEXT NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "QuestCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" TEXT NOT NULL,
    "reached" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCheckpointHit" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progressId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,

    CONSTRAINT "QuestCheckpointHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quest_slug_key" ON "Quest"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCheckpoint_questId_order_key" ON "QuestCheckpoint"("questId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_questId_userId_key" ON "QuestProgress"("questId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCheckpointHit_progressId_checkpointId_key" ON "QuestCheckpointHit"("progressId", "checkpointId");

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpoint" ADD CONSTRAINT "QuestCheckpoint_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpoint" ADD CONSTRAINT "QuestCheckpoint_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpointHit" ADD CONSTRAINT "QuestCheckpointHit_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "QuestProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCheckpointHit" ADD CONSTRAINT "QuestCheckpointHit_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "QuestCheckpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

