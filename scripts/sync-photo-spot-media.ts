// scripts/sync-photo-spot-media.ts — bring the live photo spots in line with
// prisma/photo-spots.ts (location, description, best time) and
// prisma/photo-spot-media.ts (cover, gallery, videos) without reseeding.
// Updates spots by name and creates any that are missing; never deletes.
// Run: npx tsx scripts/sync-photo-spot-media.ts
import { PrismaClient } from '@prisma/client'
import { PHOTO_SPOTS } from '../prisma/photo-spots'
import { PHOTO_SPOT_MEDIA } from '../prisma/photo-spot-media'

const prisma = new PrismaClient()

async function main() {
  for (const spot of PHOTO_SPOTS) {
    const media = PHOTO_SPOT_MEDIA[spot.name]
    if (!media) { console.log(`no media for ${spot.name}, skipped`); continue }
    const { count } = await prisma.photoSpot.updateMany({ where: { name: spot.name }, data: { ...spot, ...media } })
    if (count > 0) { console.log(`updated ${spot.name}`); continue }
    await prisma.photoSpot.create({ data: { ...spot, ...media } })
    console.log(`created ${spot.name}`)
  }
}

main().finally(() => prisma.$disconnect())
