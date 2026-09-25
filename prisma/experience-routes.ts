// prisma/experience-routes.ts — the curated experiences as multi-stop routes of
// real seeded vendors and photo spots (matched by name). Used by seed.ts and by
// scripts/migrate-experience-stops.ts, so a reseed and the live data agree.
// Travel time between stops is looked up with OSRM at write time (estimate if
// it's unreachable); the mode is fixed per leg here.

import type { PrismaClient } from '@prisma/client'
import { legBetween, type TransportMode } from '../lib/routing'

interface RouteStop {
  vendor?: string
  spot?: string
  /** Minutes at the stop. */
  minutes: number
  /** How you get to the NEXT stop (omit on the last one). */
  next?: TransportMode
}

export const EXPERIENCE_ROUTES: Record<string, RouteStop[]> = {
  // Dinner, dubs, boat at sunrise.
  'Full Moon Float': [
    { vendor: "Kamara's", minutes: 90, next: 'WALKING' },
    { vendor: "Alfred's Ocean Palace", minutes: 150, next: 'WALKING' },
    { vendor: 'Seven Mile Beach Hobie Cat Sailing', minutes: 90 }
  ],
  // Tastings, sound system, jerk.
  'Rum & Bass': [
    { vendor: 'Push Cart', minutes: 60, next: 'WALKING' },
    { vendor: 'LTU Pub (LTU Cliff Bar)', minutes: 60, next: 'TAXI' },
    { vendor: 'Coral Reef', minutes: 150 }
  ],
  // Yoga, breakfast, dip.
  'Cliff Morning': [
    { vendor: 'Ocean View Spa', minutes: 60, next: 'TAXI' },
    { vendor: 'Rockhouse Restaurant', minutes: 60, next: 'TAXI' },
    { spot: 'West End cliffs', minutes: 45 }
  ],
  // Five stops. One mission.
  'Jerk Tour': [
    { vendor: 'Border Jerk', minutes: 30, next: 'TAXI' },
    { vendor: 'Kool Vybes Bar & Jerk Center', minutes: 30, next: 'WALKING' },
    { vendor: 'Push Cart', minutes: 30, next: 'TAXI' },
    { vendor: 'Best in the West Jerk Centre', minutes: 30, next: 'TAXI' },
    { vendor: "Devon's Jerk Pan", minutes: 30 }
  ],
  // Coral, fish, blue.
  'Reef Snorkel': [
    { vendor: 'Seven Mile Beach Snorkel Tours', minutes: 120, next: 'BOAT' },
    { spot: 'Booby Cay Island', minutes: 60, next: 'BOAT' },
    { vendor: "Niah's Patties", minutes: 30 }
  ],
  // Lobster, champagne, view.
  'Sunset Dinner': [
    { spot: 'Negril Lighthouse grounds', minutes: 30, next: 'WALKING' },
    { spot: "Rick's Café sunset", minutes: 45, next: 'TAXI' },
    { vendor: "Ivan's Bar & Restaurant", minutes: 120 }
  ],
  // Loungers, drinks, lunch.
  'Beach Day Pass': [
    { spot: "Doctor's Cave Sand", minutes: 20, next: 'WALKING' },
    { vendor: "Doctor's Cave Beach Bar", minutes: 240, next: 'TAXI' },
    { vendor: 'MoBay Jerk House', minutes: 60 }
  ],
  // Sail, rum, reggae.
  'Catamaran Sunset': [
    { vendor: 'MoBay Jerk House', minutes: 45, next: 'TAXI' },
    { vendor: 'MoBay Watersports', minutes: 180 }
  ],
  // Beans, hills, brew.
  'Coffee Farm Trip': [
    { vendor: 'Blue Mahoe', minutes: 150, next: 'TAXI' },
    { spot: 'Blue Hole Mineral Spring', minutes: 60, next: 'TAXI' },
    { vendor: 'Royal Palm Reserve', minutes: 60 }
  ]
}

/** Replaces an experience's stops with its curated route. Throws if a named stop is missing. */
export async function writeExperienceRoute(prisma: PrismaClient, experienceId: string, name: string) {
  const route = EXPERIENCE_ROUTES[name]
  if (!route) throw new Error(`No route defined for experience "${name}"`)

  const places = await Promise.all(route.map(async stop => {
    if (stop.vendor) {
      const v = await prisma.vendor.findFirst({ where: { name: stop.vendor }, select: { id: true, lat: true, lng: true } })
      if (!v) throw new Error(`"${name}": no vendor named "${stop.vendor}"`)
      return { vendorId: v.id, photoSpotId: null, lat: v.lat, lng: v.lng }
    }
    const p = await prisma.photoSpot.findFirst({ where: { name: stop.spot }, select: { id: true, lat: true, lng: true } })
    if (!p) throw new Error(`"${name}": no photo spot named "${stop.spot}"`)
    return { vendorId: null, photoSpotId: p.id, lat: p.lat, lng: p.lng }
  }))

  const legs = await Promise.all(route.map((stop, i) =>
    stop.next && places[i + 1] ? legBetween(places[i], places[i + 1], { mode: stop.next }) : Promise.resolve(null)
  ))

  await prisma.$transaction([
    prisma.experienceStop.deleteMany({ where: { experienceId } }),
    prisma.experienceStop.createMany({
      data: route.map((stop, i) => ({
        experienceId,
        order: i,
        stopType: places[i].vendorId ? 'VENDOR' : 'PHOTO_SPOT',
        vendorId: places[i].vendorId,
        photoSpotId: places[i].photoSpotId,
        plannedDuration: stop.minutes,
        transportModeToNext: legs[i]?.mode ?? null,
        transportDurationToNext: legs[i]?.minutes ?? null
      }))
    })
  ])
  return legs
}
