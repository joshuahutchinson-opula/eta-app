// scripts/seed-mock-events.ts — demo events so Home's Parties & Happenings
// is never empty: 7 per main town (Negril, Montego Bay, Ocho Rios, Port
// Antonio, Kingston) spread over this week and next, mixed free and paid,
// day and night, each with a photo. All flagged isMock, so
// `npm run mock:remove` clears them. Re-running replaces the previous batch
// (dates are relative to today; afterwards lib/mock-events.ts rollMockEvents()
// moves finished ones forward, so the section stays full).
//   npm run seed:events
import { PrismaClient } from '@prisma/client'
import { assertSeedAllowed } from '../prisma/seed-guard'
import { MOCK_EVENTS, MOCK_COORDS, MOCK_EVENT_TITLES, type MockTown, type MockEventTpl } from '../lib/mock-events'

const prisma = new PrismaClient()

/** Today (Jamaica) + day offset, at local "HH:MM". */
function at(day: number, hhmm: string): Date {
  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)
  const [y, m, d] = today.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d + day, h + 5, mi))
}

async function main() {
  assertSeedAllowed('seed:events')
  const removed = await prisma.event.deleteMany({ where: { isMock: true, title: { in: MOCK_EVENT_TITLES } } })
  let made = 0
  for (const [city, list] of Object.entries(MOCK_EVENTS) as Array<[MockTown, MockEventTpl[]]>) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      const startAt = at(e.day, e.at)
      const c = MOCK_COORDS[city]
      await prisma.event.create({
        data: {
          title: e.title, promoterName: e.promoter, description: e.blurb, imageUrl: e.img, venueName: e.venue,
          lat: c.lat + (i - 3) * 0.004, lng: c.lng + (i % 3 - 1) * 0.004,
          startAt, endAt: new Date(startAt.getTime() + e.hours * 3600000),
          price: e.price, isFree: e.price === null, inAppTickets: Boolean(e.tickets && e.price !== null),
          ticketCapacity: e.tickets && e.price !== null ? 150 : null, city, isMock: true
        }
      })
      made++
    }
  }
  console.log(`Mock events: removed ${removed.count}, created ${made}.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
