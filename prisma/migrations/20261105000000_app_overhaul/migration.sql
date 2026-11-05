-- App overhaul (November 2026): vendor QR proof-of-visit, fair-price flag,
-- Instagram story mentions, WhatsApp opt-in, trip mode, partner properties,
-- welcome rewards, story place/event links, Plan B outdoor flag and
-- shareable trip recaps. Purely additive: new nullable/defaulted columns
-- and new tables only; no existing data changes.

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('HOTEL', 'VILLA');

-- CreateEnum
CREATE TYPE "MentionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "accuracy" DOUBLE PRECISION,
ADD COLUMN     "distanceM" INTEGER,
ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'gps';

-- AlterTable
ALTER TABLE "Experience" ADD COLUMN     "outdoor" BOOLEAN;

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'catalog',
ADD COLUMN     "requiresVisit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "placeVendorId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeNudgeSentAt" TIMESTAMP(3),
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "notifyTrips" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "partnerJoinedAt" TIMESTAMP(3),
ADD COLUMN     "partnerPropertyId" TEXT,
ADD COLUMN     "stayAccommodationId" TEXT,
ADD COLUMN     "stayCity" "City",
ADD COLUMN     "stayName" TEXT,
ADD COLUMN     "tripEnd" TIMESTAMP(3),
ADD COLUMN     "tripStart" TIMESTAMP(3),
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "fairPrice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fairPriceConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "qrIssuedAt" TIMESTAMP(3),
ADD COLUMN     "qrToken" TEXT;

-- CreateTable
CREATE TABLE "PartnerProperty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PartnerKind" NOT NULL DEFAULT 'HOTEL',
    "city" "City" NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "welcomeRewardId" TEXT,

    CONSTRAINT "PartnerProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstagramMention" (
    "id" TEXT NOT NULL,
    "igSenderId" TEXT NOT NULL,
    "igUsername" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'image',
    "igMessageId" TEXT,
    "status" "MentionStatus" NOT NULL DEFAULT 'PENDING',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkInId" TEXT,

    CONSTRAINT "InstagramMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripRecap" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TripRecap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProperty_code_key" ON "PartnerProperty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramMention_igMessageId_key" ON "InstagramMention"("igMessageId");

-- CreateIndex
CREATE INDEX "InstagramMention_vendorId_status_expiresAt_idx" ON "InstagramMention"("vendorId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TripRecap_token_key" ON "TripRecap"("token");

-- CreateIndex
CREATE UNIQUE INDEX "TripRecap_userId_start_end_key" ON "TripRecap"("userId", "start", "end");

-- CreateIndex
CREATE INDEX "CheckIn_vendorId_createdAt_idx" ON "CheckIn"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckIn_userId_createdAt_idx" ON "CheckIn"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "User_instagramHandle_idx" ON "User"("instagramHandle");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_qrToken_key" ON "Vendor"("qrToken");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_partnerPropertyId_fkey" FOREIGN KEY ("partnerPropertyId") REFERENCES "PartnerProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_placeVendorId_fkey" FOREIGN KEY ("placeVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProperty" ADD CONSTRAINT "PartnerProperty_welcomeRewardId_fkey" FOREIGN KEY ("welcomeRewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMention" ADD CONSTRAINT "InstagramMention_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMention" ADD CONSTRAINT "InstagramMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstagramMention" ADD CONSTRAINT "InstagramMention_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "CheckIn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripRecap" ADD CONSTRAINT "TripRecap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

