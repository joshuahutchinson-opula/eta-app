// scripts/delete-mock-photo-spots.ts — remove every photo spot that isn't one of
// the nine real spots in prisma/photo-spots.ts, with the rows that point at them
// (user moments, discoveries, trip stops, experience stops).
// Dry run by default; pass --apply to delete.
// Run: npx tsx scripts/delete-mock-photo-spots.ts [--apply]
import { PrismaClient } from '@prisma/client'
import { PHOTO_SPOTS } from '../prisma/photo-spots'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const real = PHOTO_SPOTS.map(s => s.name)
  const mock = await prisma.photoSpot.findMany({
    where: { name: { notIn: real } },
    select: {
      id: true, name: true,
      _count: { select: { userPhotos: true, discoveries: true, tripStops: true, experienceStops: true } }
    }
  })
  for (const s of mock) {
    const c = s._count
    console.log(`${s.name}: ${c.userPhotos} moments, ${c.discoveries} discoveries, ${c.tripStops} trip stops, ${c.experienceStops} experience stops`)
  }
  if (!mock.length) { console.log('No mock photo spots left.'); return }
  if (!apply) { console.log(`\nDry run — ${mock.length} spots. Re-run with --apply to delete.`); return }

  const ids = mock.map(s => s.id)
  const [moments, discoveries, tripStops, expStops, spots] = await prisma.$transaction([
    prisma.userMoment.deleteMany({ where: { photoSpotId: { in: ids } } }),
    prisma.discovery.deleteMany({ where: { photoSpotId: { in: ids } } }),
    prisma.tripStop.deleteMany({ where: { photoSpotId: { in: ids } } }),
    prisma.experienceStop.deleteMany({ where: { photoSpotId: { in: ids } } }),
    prisma.photoSpot.deleteMany({ where: { id: { in: ids } } })
  ])
  console.log(`\nDeleted ${spots.count} spots, ${moments.count} moments, ${discoveries.count} discoveries, ${tripStops.count} trip stops, ${expStops.count} experience stops.`)
}

main().finally(() => prisma.$disconnect())
