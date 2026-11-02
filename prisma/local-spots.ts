// prisma/local-spots.ts — mark cook shops, jerk centres and street food as
// local spots after seeding. Same rule as the 20261102000000_vendor_local_spot
// migration's backfill.
import type { PrismaClient } from '@prisma/client'

export const LOCAL_SPOT_PATTERN = '(cook ?shop|street[- ]food|jerk ?(centre|center|stand|hut|shack|pan|house)|jerk[a-z ]{0,20}(stand|window))'

export async function markLocalSpots(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "Vendor" SET "localSpot" = true WHERE "category" = 'FOOD' AND ("name" || ' ' || "description") ~* $1`,
    LOCAL_SPOT_PATTERN
  )
}
