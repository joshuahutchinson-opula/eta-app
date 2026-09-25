// scripts/sync-photo-spot-media.ts — push PHOTO_SPOT_MEDIA onto the live photo spots without reseeding.
// Updates existing spots by name and creates Mayfield Falls if it's missing. Run: npx tsx scripts/sync-photo-spot-media.ts
import { PrismaClient, City } from '@prisma/client'
import { PHOTO_SPOT_MEDIA } from '../prisma/photo-spot-media'

const prisma = new PrismaClient()

const NEW_SPOTS = [
  {
    name: 'Mayfield Falls',
    description: 'Twenty-one little cascades and swimming holes you wade up with a river guide, in the Westmoreland hills.',
    lat: 18.3617,
    lng: -78.1017,
    bestTime: 'Morning',
    city: City.NEGRIL
  }
]

async function main() {
  for (const [name, media] of Object.entries(PHOTO_SPOT_MEDIA)) {
    const { count } = await prisma.photoSpot.updateMany({ where: { name }, data: media })
    if (count > 0) { console.log(`updated ${name}`); continue }
    const spot = NEW_SPOTS.find(s => s.name === name)
    if (!spot) { console.log(`no spot named ${name}, skipped`); continue }
    await prisma.photoSpot.create({ data: { ...spot, ...media } })
    console.log(`created ${name}`)
  }
}

main().finally(() => prisma.$disconnect())
