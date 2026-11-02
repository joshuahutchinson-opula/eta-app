-- Local spots (November 2026): cook shops, jerk centres and street food,
-- for the "Most local" badge on generated routes. Purely additive.

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN "localSpot" BOOLEAN NOT NULL DEFAULT false;

-- Backfill food vendors that describe themselves as one. Keep in step with
-- LOCAL_SPOT_PATTERN in prisma/local-spots.ts.
UPDATE "Vendor" SET "localSpot" = true
WHERE "category" = 'FOOD'
  AND ("name" || ' ' || "description") ~* '(cook ?shop|street[- ]food|jerk ?(centre|center|stand|hut|shack|pan|house)|jerk[a-z ]{0,20}(stand|window))';
