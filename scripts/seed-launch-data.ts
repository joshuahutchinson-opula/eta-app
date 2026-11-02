// scripts/seed-launch-data.ts — add this build's mock data (rewards in the
// database, menus, safety contacts, challenges, experience details, in-app
// tickets, sample check-ins) to a database that already has the core seed,
// without wiping anything. Safe to run again: it upserts and skips what's
// there. Dry run by default; pass --apply to write.
// Run: npx tsx scripts/seed-launch-data.ts [--apply]
// In production (NODE_ENV=production) it also needs ALLOW_SEED=true.
import { PrismaClient } from '@prisma/client'
import { seedLaunchData } from '../prisma/seed-launch'
import { assertSeedAllowed } from '../prisma/seed-guard'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  assertSeedAllowed('scripts/seed-launch-data.ts')
  const [vendors, rewards, contacts, challenges] = await Promise.all([prisma.vendor.count(), prisma.reward.count(), prisma.safetyContact.count(), prisma.challenge.count()])
  console.log(`vendors: ${vendors}, rewards: ${rewards}, safety contacts: ${contacts}, challenges: ${challenges}`)
  if (vendors === 0) throw new Error('The core seed (vendors) is missing — run the full seed instead.')
  if (!apply) {
    console.log('Dry run: nothing written. Pass --apply to add the launch data.')
    return
  }
  await seedLaunchData(prisma)
  console.log(`Done. Rewards: ${await prisma.reward.count()}, menu items: ${await prisma.menuItem.count()}, safety contacts: ${await prisma.safetyContact.count()}, challenges: ${await prisma.challenge.count()}`)
}

main()
  .catch(e => { console.error(e.message ?? e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
