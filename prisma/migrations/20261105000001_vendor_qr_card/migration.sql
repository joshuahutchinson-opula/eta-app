-- Vendor QR cards get their own table so the secret can never ride along
-- on a Vendor row (the Vendor columns from the previous migration were
-- never populated). No existing data changes.

-- DropIndex
DROP INDEX "Vendor_qrToken_key";

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "qrIssuedAt",
DROP COLUMN "qrToken";

-- CreateTable
CREATE TABLE "VendorQrCard" (
    "vendorId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorQrCard_pkey" PRIMARY KEY ("vendorId")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorQrCard_token_key" ON "VendorQrCard"("token");

-- AddForeignKey
ALTER TABLE "VendorQrCard" ADD CONSTRAINT "VendorQrCard_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

