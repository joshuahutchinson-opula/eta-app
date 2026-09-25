// scripts/migrate-experience-stops.ts — give the live curated experiences their
// multi-stop routes (prisma/experience-routes.ts) without reseeding.
// Safe to re-run: each experience's stops are replaced, not appended.
// Run: npx tsx scripts/migrate-experience-stops.ts
import { PrismaClient } from '@prisma/client'
import { EXPERIENCE_ROUTES, writeExperienceRoute } from '../prisma/experience-routes'

const prisma = new PrismaClient()

async function main() {
  const experiences = await prisma.experience.findMany({ select: { id: true, name: true } })
  for (const exp of experiences) {
    if (!EXPERIENCE_ROUTES[exp.name]) {
      console.log(`skipped ${exp.name} (no route defined)`)
      continue
    }
    const legs = await writeExperienceRoute(prisma, exp.id, exp.name)
    const timed = legs.filter(Boolean).map(l => `${l!.mode.toLowerCase()} ${l!.minutes}m (${l!.source})`)
    console.log(`${exp.name}: ${EXPERIENCE_ROUTES[exp.name].length} stops · ${timed.join(', ') || 'no legs'}`)
  }
}

main().finally(() => prisma.$disconnect())
