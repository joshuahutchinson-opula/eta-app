// lib/mock-events-roll.ts — keeps the demo Parties & Happenings
// (lib/mock-events.ts) current: any seeded mock event that has finished moves
// forward in whole two-week steps, so the section is never empty in the demo
// without re-running `npm run seed:events`. Called before event queries.
import { prisma } from '@/lib/prisma'
import { MOCK_EVENT_TITLES } from '@/lib/mock-events'

const CYCLE_DAYS = 14
const THROTTLE_MS = 10 * 60 * 1000
let lastRoll = 0

/** Moves finished mock events forward by whole two-week cycles (at most every 10 minutes per server). */
export async function rollMockEvents(): Promise<void> {
  if (Date.now() - lastRoll < THROTTLE_MS) return
  lastRoll = Date.now()
  try {
    await prisma.$executeRaw`
      UPDATE "Event" e SET
        "startAt" = e."startAt" + s.shift,
        "endAt"   = e."endAt" + s.shift
      FROM (
        SELECT id, make_interval(days => ${CYCLE_DAYS}::int * CEIL(EXTRACT(EPOCH FROM (NOW() - COALESCE("endAt", "startAt"))) / (${CYCLE_DAYS}::int * 86400))::int) AS shift
        FROM "Event"
        WHERE "isMock" = true AND COALESCE("endAt", "startAt") < NOW() AND title = ANY(${MOCK_EVENT_TITLES})
      ) s
      WHERE e.id = s.id`
  } catch (e) {
    lastRoll = 0
    console.error('rollMockEvents failed', e)
  }
}
