// scripts/remove-mock-data.ts — delete every piece of placeholder content in
// one go: vendors, events, experiences, stays, rewards and challenges
// flagged isMock (plus vendors named in MOCK_VENDOR_NAMES, for databases
// seeded before the flag existed), and the rows that point at them.
// Real users' bookings and payments are kept; their link to a removed
// vendor or experience is cleared.
// Dry run by default; pass --apply to delete.
// Run: npx tsx scripts/remove-mock-data.ts [--apply]
import { PrismaClient } from '@prisma/client'
import { MOCK_VENDOR_NAMES } from '../prisma/seed-guard'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')

async function main() {
  const [vendors, events, experiences, stays, rewards, challenges] = await Promise.all([
    prisma.vendor.findMany({ where: { OR: [{ isMock: true }, { name: { in: MOCK_VENDOR_NAMES } }] }, select: { id: true, name: true } }),
    prisma.event.findMany({ where: { isMock: true }, select: { id: true, title: true } }),
    prisma.experience.findMany({ where: { isMock: true }, select: { id: true, name: true } }),
    prisma.accommodation.findMany({ where: { isMock: true }, select: { id: true, name: true } }),
    prisma.reward.findMany({ where: { isMock: true }, select: { id: true, name: true } }),
    prisma.challenge.findMany({ where: { isMock: true }, select: { id: true, title: true } })
  ])
  const show = (label: string, names: string[]) => console.log(`${label} (${names.length}): ${names.join(', ') || '—'}`)
  show('Vendors', vendors.map(v => v.name))
  show('Events', events.map(e => e.title))
  show('Experiences', experiences.map(e => e.name))
  show('Stays', stays.map(s => s.name))
  show('Rewards', rewards.map(r => r.name))
  show('Challenges', challenges.map(c => c.title))
  const total = vendors.length + events.length + experiences.length + stays.length + rewards.length + challenges.length
  if (!total) { console.log('\nNo mock data left.'); return }
  if (!apply) { console.log(`\nDry run — ${total} items. Re-run with --apply to delete.`); return }

  const v = vendors.map(x => x.id)
  const ev = events.map(x => x.id)
  const ex = experiences.map(x => x.id)
  const st = stays.map(x => x.id)
  await prisma.$transaction(async tx => {
    // Vendors
    await tx.experienceStop.deleteMany({ where: { vendorId: { in: v } } })
    await tx.tripStop.deleteMany({ where: { vendorId: { in: v } } })
    await tx.review.deleteMany({ where: { vendorId: { in: v } } })
    await tx.checkIn.deleteMany({ where: { vendorId: { in: v } } })
    await tx.discovery.deleteMany({ where: { vendorId: { in: v } } })
    await tx.story.deleteMany({ where: { vendorId: { in: v } } })
    await tx.flashDealClaim.deleteMany({ where: { deal: { vendorId: { in: v } } } })
    await tx.flashDeal.deleteMany({ where: { vendorId: { in: v } } })
    await tx.transaction.updateMany({ where: { vendorId: { in: v } }, data: { vendorId: null } })
    await tx.booking.updateMany({ where: { vendorId: { in: v } }, data: { vendorId: null } })
    await tx.redemption.updateMany({ where: { vendorId: { in: v } }, data: { vendorId: null } })
    await tx.saved.deleteMany({ where: { kind: 'VENDOR', refId: { in: v } } })
    await tx.savedListItem.deleteMany({ where: { kind: 'VENDOR', refId: { in: v } } })
    await tx.vendor.deleteMany({ where: { id: { in: v } } })
    // Events (tickets are kept as records, with their event removed only when none exist)
    const ticketed = new Set((await tx.ticket.findMany({ where: { eventId: { in: ev } }, select: { eventId: true } })).map(t => t.eventId))
    const removableEvents = ev.filter(id => !ticketed.has(id))
    await tx.saved.deleteMany({ where: { kind: 'EVENT', refId: { in: removableEvents } } })
    await tx.savedListItem.deleteMany({ where: { kind: 'EVENT', refId: { in: removableEvents } } })
    await tx.event.deleteMany({ where: { id: { in: removableEvents } } })
    if (ticketed.size) console.log(`Kept ${ticketed.size} event(s) that have tickets sold.`)
    // Experiences
    await tx.tripStop.deleteMany({ where: { experienceId: { in: ex } } })
    await tx.trip.updateMany({ where: { experienceId: { in: ex } }, data: { experienceId: null } })
    await tx.booking.updateMany({ where: { experienceId: { in: ex } }, data: { experienceId: null } })
    await tx.review.updateMany({ where: { experienceId: { in: ex } }, data: { experienceId: null } })
    await tx.bundle.deleteMany({ where: { experienceId: { in: ex } } })
    await tx.saved.deleteMany({ where: { kind: 'EXPERIENCE', refId: { in: ex } } })
    await tx.savedListItem.deleteMany({ where: { kind: 'EXPERIENCE', refId: { in: ex } } })
    await tx.experience.deleteMany({ where: { id: { in: ex } } })
    // Stays
    await tx.booking.updateMany({ where: { accommodationId: { in: st } }, data: { accommodationId: null } })
    await tx.bundle.deleteMany({ where: { accommodationId: { in: st } } })
    await tx.accommodation.deleteMany({ where: { id: { in: st } } })
    // Rewards and challenges (vouchers already issued keep their copy of the name)
    await tx.reward.deleteMany({ where: { id: { in: rewards.map(r => r.id) } } })
    await tx.challenge.deleteMany({ where: { id: { in: challenges.map(c => c.id) } } })
  }, { timeout: 60000 })
  console.log(`\nRemoved ${total} mock items.`)
}

main()
  .catch(e => { console.error(e.message ?? e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
