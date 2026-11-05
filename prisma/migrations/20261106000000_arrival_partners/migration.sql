-- Arrival flow and partner properties (November 2026): stays become
-- listings with book-direct contacts, partner-linked vendors and events,
-- host's picks, airport transfer services and transfer bookings, partner
-- owners, and a dropped-pin stay location. Additive only.

-- AlterTable
ALTER TABLE "Accommodation" ADD COLUMN     "bookingUrl" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "dropoff" TEXT,
ADD COLUMN     "pickup" TEXT,
ADD COLUMN     "transferServiceId" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "partnerPropertyId" TEXT;

-- AlterTable
ALTER TABLE "PartnerProperty" ADD COLUMN     "accommodationId" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stayLat" DOUBLE PRECISION,
ADD COLUMN     "stayLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "partnerPropertyId" TEXT;

-- CreateTable
CREATE TABLE "HostPick" (
    "id" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partnerPropertyId" TEXT NOT NULL,
    "vendorId" TEXT,
    "experienceId" TEXT,
    "eventId" TEXT,

    CONSTRAINT "HostPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferService" (
    "id" TEXT NOT NULL,
    "airport" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "baseFare" DOUBLE PRECISION NOT NULL,
    "perKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "readyMinutes" INTEGER NOT NULL DEFAULT 15,
    "driverName" TEXT,
    "driverPhoto" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "TransferService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HostPick_partnerPropertyId_sortOrder_idx" ON "HostPick"("partnerPropertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransferService_airport_active_idx" ON "TransferService"("airport", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProperty_accommodationId_key" ON "PartnerProperty"("accommodationId");

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_partnerPropertyId_fkey" FOREIGN KEY ("partnerPropertyId") REFERENCES "PartnerProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_transferServiceId_fkey" FOREIGN KEY ("transferServiceId") REFERENCES "TransferService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_partnerPropertyId_fkey" FOREIGN KEY ("partnerPropertyId") REFERENCES "PartnerProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProperty" ADD CONSTRAINT "PartnerProperty_accommodationId_fkey" FOREIGN KEY ("accommodationId") REFERENCES "Accommodation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProperty" ADD CONSTRAINT "PartnerProperty_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostPick" ADD CONSTRAINT "HostPick_partnerPropertyId_fkey" FOREIGN KEY ("partnerPropertyId") REFERENCES "PartnerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostPick" ADD CONSTRAINT "HostPick_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostPick" ADD CONSTRAINT "HostPick_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostPick" ADD CONSTRAINT "HostPick_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferService" ADD CONSTRAINT "TransferService_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

