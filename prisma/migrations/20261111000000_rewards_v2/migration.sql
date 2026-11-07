-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "priority" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "earlyAccessUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "spendAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'all',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'eta',
ADD COLUMN     "createdByVendorId" TEXT,
ADD COLUMN     "dailyCap" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "monthlyBudget" INTEGER NOT NULL DEFAULT 300,
ADD COLUMN     "rotatingQr" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthday" TEXT,
ADD COLUMN     "isMock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "tierSeen" TEXT NOT NULL DEFAULT 'VISITOR';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "indoor" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "city" "City",
    "vendorId" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Boost" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "startMin" INTEGER,
    "endMin" INTEGER,
    "days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "city" "City",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cause" (
    "id" TEXT NOT NULL,
    "city" "City" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "goalPoints" INTEGER NOT NULL,
    "unitPoints" INTEGER NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "raisedPoints" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "causeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointsLedger_userId_createdAt_idx" ON "PointsLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsLedger_city_createdAt_idx" ON "PointsLedger"("city", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointsLedger_userId_reason_sourceId_key" ON "PointsLedger"("userId", "reason", "sourceId");

-- CreateIndex
CREATE INDEX "Boost_city_active_idx" ON "Boost"("city", "active");

-- CreateIndex
CREATE INDEX "Boost_vendorId_idx" ON "Boost"("vendorId");

-- CreateIndex
CREATE INDEX "Cause_city_active_idx" ON "Cause"("city", "active");

-- CreateIndex
CREATE INDEX "Donation_causeId_createdAt_idx" ON "Donation"("causeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_key_key" ON "UserBadge"("userId", "key");

-- CreateIndex
CREATE INDEX "FraudAlert_resolvedAt_createdAt_idx" ON "FraudAlert"("resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "Redemption_rewardId_createdAt_idx" ON "Redemption"("rewardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boost" ADD CONSTRAINT "Boost_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_causeId_fkey" FOREIGN KEY ("causeId") REFERENCES "Cause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------- Data ----------

-- Lifetime points start as everything earned so far: what's left to spend
-- plus what's already been spent on rewards.
UPDATE "User" u SET "lifetimePoints" = u."points" + COALESCE((SELECT SUM(r."pointCost") FROM "Redemption" r WHERE r."userId" = u."id"), 0);

-- Existing users have already seen the tier they're at (no surprise
-- celebration on first open).
UPDATE "User" SET "tierSeen" = CASE
  WHEN "lifetimePoints" >= 6000 THEN 'YAADIE'
  WHEN "lifetimePoints" >= 2000 THEN 'INSIDER'
  WHEN "lifetimePoints" >= 500 THEN 'EXPLORER'
  ELSE 'VISITOR' END;

-- The new tier ladder: Visitor, Explorer, Insider, Yaadie.
UPDATE "Reward" SET "minTier" = CASE "minTier"
  WHEN 'WANDERER' THEN NULL
  WHEN 'TRAILBLAZER' THEN 'INSIDER'
  WHEN 'LOCAL_LEGEND' THEN 'YAADIE'
  ELSE "minTier" END
WHERE "minTier" IS NOT NULL;

-- Rewards hub filters.
UPDATE "Reward" r SET "category" = CASE
  WHEN r."minTier" IS NOT NULL THEN 'insider'
  WHEN EXISTS (SELECT 1 FROM "RewardVendor" rv WHERE rv."rewardId" = r."id") THEN 'vendor'
  ELSE 'eta' END;

-- High-value rewards get rotating voucher QR codes.
UPDATE "Reward" SET "rotatingQr" = true WHERE "cost" >= 1500;

-- Spas and wellness spots count as indoor for rainy-day boosts.
UPDATE "Vendor" SET "indoor" = true WHERE "category" = 'WELLNESS';

-- Give Back: Negril's cause.
INSERT INTO "Cause" ("id", "city", "title", "body", "imageUrl", "goalPoints", "unitPoints", "unitLabel", "raisedPoints", "active", "createdAt", "updatedAt")
VALUES (
  'cause-negril-melissa',
  'NEGRIL',
  'Help Negril Rebuild After Hurricane Melissa',
  'Hurricane Melissa tore roofs off homes and small businesses across Negril. Your points go straight to rebuilding and recovery, with local partners buying the supplies and doing the work.',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200',
  250000,
  500,
  'roofing supplies for a local family or small business',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
