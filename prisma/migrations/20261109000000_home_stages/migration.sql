-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cruiseAllAboardAt" TIMESTAMP(3),
ADD COLUMN     "cruiseDay" TEXT,
ADD COLUMN     "cruisePort" "City",
ADD COLUMN     "stagePromptSnoozedUntil" TIMESTAMP(3),
ADD COLUMN     "travelerType" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bigNight" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TransferService" ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "meetPoint" TEXT,
ADD COLUMN     "plate" TEXT;

-- CreateTable
CREATE TABLE "TownMedia" (
    "id" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "daypart" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'photo',
    "url" TEXT NOT NULL,
    "poster" TEXT,
    "credit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "TownMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTrip" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VISIT',
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "city" "City" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "stayName" TEXT,
    "stayCity" "City",
    "stayAccommodationId" TEXT,
    "stayLat" DOUBLE PRECISION,
    "stayLng" DOUBLE PRECISION,
    "partnerPropertyId" TEXT,
    "arrivalAirport" TEXT,
    "arrivedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "welcomeBackRedemptionId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "TravelTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTripLeg" (
    "id" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "TravelTripLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTripMember" (
    "id" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TravelTripMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelTripChange" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "tripId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,

    CONSTRAINT "TravelTripChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewPrompt" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shownAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "ReviewPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingVisit" (
    "id" TEXT NOT NULL,
    "claimToken" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "distanceM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "vendorId" TEXT NOT NULL,
    "claimedById" TEXT,

    CONSTRAINT "PendingVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TownMedia_city_daypart_active_idx" ON "TownMedia"("city", "daypart", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TravelTrip_inviteCode_key" ON "TravelTrip"("inviteCode");

-- CreateIndex
CREATE INDEX "TravelTrip_ownerId_startDate_idx" ON "TravelTrip"("ownerId", "startDate");

-- CreateIndex
CREATE INDEX "TravelTripLeg_tripId_idx" ON "TravelTripLeg"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelTripMember_tripId_userId_key" ON "TravelTripMember"("tripId", "userId");

-- CreateIndex
CREATE INDEX "TravelTripChange_tripId_status_idx" ON "TravelTripChange"("tripId", "status");

-- CreateIndex
CREATE INDEX "ReviewPrompt_userId_day_idx" ON "ReviewPrompt"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewPrompt_userId_vendorId_day_key" ON "ReviewPrompt"("userId", "vendorId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvite_token_key" ON "EventInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvite_eventId_inviterId_key" ON "EventInvite"("eventId", "inviterId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingVisit_claimToken_key" ON "PendingVisit"("claimToken");

-- AddForeignKey
ALTER TABLE "TownMedia" ADD CONSTRAINT "TownMedia_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTrip" ADD CONSTRAINT "TravelTrip_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTripLeg" ADD CONSTRAINT "TravelTripLeg_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTripMember" ADD CONSTRAINT "TravelTripMember_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTripMember" ADD CONSTRAINT "TravelTripMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTripChange" ADD CONSTRAINT "TravelTripChange_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelTripChange" ADD CONSTRAINT "TravelTripChange_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPrompt" ADD CONSTRAINT "ReviewPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPrompt" ADD CONSTRAINT "ReviewPrompt_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingVisit" ADD CONSTRAINT "PendingVisit_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingVisit" ADD CONSTRAINT "PendingVisit_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: the trip dates already on accounts become their first travel trip.
INSERT INTO "TravelTrip" ("id", "kind", "status", "city", "startDate", "endDate", "stayName", "stayCity", "stayAccommodationId", "stayLat", "stayLng", "partnerPropertyId", "arrivedAt", "inviteCode", "createdAt", "updatedAt", "ownerId")
SELECT 'tt' || u."id", 'VISIT',
       CASE WHEN u."tripEnd" + interval '1 day' < now() THEN 'ENDED' WHEN u."tripStart" <= now() THEN 'ACTIVE' ELSE 'UPCOMING' END,
       COALESCE(u."stayCity", u."city"), u."tripStart", u."tripEnd", u."stayName", u."stayCity", u."stayAccommodationId", u."stayLat", u."stayLng", u."partnerPropertyId",
       CASE WHEN u."tripStart" <= now() THEN u."tripStart" ELSE NULL END,
       upper(substr(md5(u."id"), 1, 10)), now(), now(), u."id"
FROM "User" u
WHERE u."tripStart" IS NOT NULL AND u."tripEnd" IS NOT NULL AND u."deletedAt" IS NULL;

UPDATE "User" SET "travelerType" = 'VISITOR' WHERE "tripStart" IS NOT NULL AND "travelerType" IS NULL;
