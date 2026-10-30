// scripts/seed-extras.ts — add the mock data for the newer features (events,
// vendor hours, stay prices, gems, Jordan's bookings and inbox...) to a
// database that already has the core seed, without wiping anything.
// Refuses to run if events already exist, so it can't add duplicates.
// Dry run by default; pass --apply to write.
// Run: npx tsx scripts/seed-extras.ts [--apply]
import { PrismaClient } from '@prisma/client'
import { seedExtras } from '../prisma/seed-extras'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const [events, vendors, jordan] = await Promise.all([
    prisma.event.count(),
    prisma.vendor.count(),
    prisma.user.findUnique({ where: { email: 'jordan@eta.app' }, select: { id: true } })
  ])
  console.log(`events: ${events}, vendors: ${vendors}, demo user: ${jordan ? 'yes' : 'no'}`)
  if (events > 0) throw new Error('Events already exist — the extras have been added before. Not running again.')
  if (vendors === 0 || !jordan) throw new Error('The core seed (vendors, demo users) is missing — run the full seed instead.')
  if (!apply) {
    console.log('Dry run: nothing written. Pass --apply to add the extras.')
    return
  }
  await seedExtras(prisma)
  console.log(`Done. Events now: ${await prisma.event.count()}`)
}

main()
  .catch(e => { console.error(e.message ?? e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
