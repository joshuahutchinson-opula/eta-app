// prisma/seed-launch.ts — mock data for the launch-readiness features:
// rewards in the database, experience details and slot capacity, menus,
// safety contacts, monthly challenges, in-app event tickets and sample
// check-ins for "Popular times". Safe to run more than once (upserts, and
// each block skips what's already there). Runs at the end of the full seed
// and from scripts/seed-launch-data.ts.
//
// Everything here is PLACEHOLDER: menus, prices, capacities and challenge
// rules are plausible, not confirmed with vendors.
//
// ⚠ VERIFY BEFORE LAUNCH: every phone number in SAFETY_CONTACTS was entered
// from public listings without being re-checked. Call each one and set
// verified: true in the database once confirmed.

import { City, type PrismaClient } from '@prisma/client'
import { REWARD_SEED } from '../lib/rewards'

const DAY = 86400000

// ---------- Experience details ----------

const EXPERIENCE_EXTRAS: Record<string, {
  tier: 'flexible' | 'standard' | 'strict'
  note: string | null
  capacity: number
  gallery: string[]
  bring: string[]
  access: string | null
  languages: string[]
}> = {
  'Full Moon Float': { tier: 'flexible', note: 'Sails are weather-dependent — a rained-out sail is refunded in full.', capacity: 8, gallery: ['https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=1200', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200'], bring: ['Swimwear', 'A light jacket for the night sail', 'Cash for tips'], access: 'Boarding the Hobie Cat is from the beach, in knee-deep water.', languages: ['English', 'Patois'] },
  'Rum & Bass': { tier: 'flexible', note: null, capacity: 10, gallery: ['https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200'], bring: ['ID (18+)', 'Comfortable shoes'], access: 'Cliff bar has steps down to the deck; the sound-system venue is step-free.', languages: ['English', 'Patois'] },
  'Cliff Morning': { tier: 'flexible', note: null, capacity: 6, gallery: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200'], bring: ['Swimwear', 'Towel', 'Water bottle'], access: 'The cliff swim is optional; the ladder into the water is steep.', languages: ['English', 'Spanish'] },
  'Jerk Tour': { tier: 'flexible', note: null, capacity: 12, gallery: ['https://images.unsplash.com/photo-1544025162-d76694265947?w=1200', 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=1200'], bring: ['An appetite', 'Cash for extra plates'], access: 'All five stops are street-level; the taxi has a high step.', languages: ['English', 'Patois'] },
  'Reef Snorkel': { tier: 'flexible', note: 'Rough seas: full refund or rebook.', capacity: 10, gallery: ['https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200', 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=1200'], bring: ['Swimwear', 'Reef-safe sunscreen', 'Towel'], access: 'Boarding is from a short jetty; you must be able to swim.', languages: ['English', 'German'] },
  'Sunset Dinner': { tier: 'standard', note: null, capacity: 6, gallery: ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200'], bring: ['Smart-casual clothes'], access: 'The clifftop tables are reached by a few steps; ask for a step-free table.', languages: ['English'] },
  'Beach Day Pass': { tier: 'flexible', note: null, capacity: 40, gallery: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200'], bring: ['Swimwear', 'Sunscreen', 'Hat'], access: 'Boardwalk to the sand; beach wheelchairs on request.', languages: ['English'] },
  'Catamaran Sunset': { tier: 'standard', note: null, capacity: 20, gallery: ['https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=1200'], bring: ['Swimwear', 'Towel', 'Motion-sickness tablets if you need them'], access: 'Boarding from the dock by a short ramp; the snorkel stop is by ladder.', languages: ['English', 'Spanish', 'French'] },
  'Coffee Farm Trip': { tier: 'standard', note: null, capacity: 8, gallery: ['https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1200'], bring: ['Walking shoes', 'A light layer for the hills'], access: 'The farm walk is on uneven, sloped paths.', languages: ['English'] }
}

// ---------- Menus ----------

type Dish = { name: string; price: number | null; tags: string[]; section: string; description?: string; image?: string }

const MENUS: Record<string, Dish[]> = {
  'Pushcart Restaurant & Rum Bar': [
    { name: 'Jerk Chicken Quarter', price: 12, tags: ['GLUTEN_FREE'], section: 'Jerk', description: 'Pimento-smoked, with festival and slaw.', image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600' },
    { name: 'Jerk Pork', price: 14, tags: ['GLUTEN_FREE'], section: 'Jerk' },
    { name: 'Escovitch Fish', price: 18, tags: ['SEAFOOD', 'GLUTEN_FREE'], section: 'Mains', description: 'Whole snapper, pickled peppers and onions.' },
    { name: 'Ital Stew', price: 11, tags: ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE'], section: 'Mains', description: 'Pumpkin, callaloo and coconut.' },
    { name: 'Rum Punch', price: 7, tags: ['VEGAN', 'VEGETARIAN'], section: 'Drinks' }
  ],
  'Push Cart': [
    { name: 'Jerk Pork & Festival', price: 12, tags: [], section: 'Jerk' },
    { name: 'Jerk Shrimp Skewer', price: 13, tags: ['SEAFOOD', 'GLUTEN_FREE'], section: 'Jerk' },
    { name: 'Roast Breadfruit', price: 5, tags: ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE'], section: 'Sides' }
  ],
  'Border Jerk': [
    { name: 'Half Jerk Chicken', price: 11, tags: ['GLUTEN_FREE'], section: 'Jerk', image: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=600' },
    { name: 'Jerk Sausage', price: 8, tags: [], section: 'Jerk' },
    { name: 'Rice & Peas', price: 4, tags: ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE'], section: 'Sides' },
    { name: 'Halal Curry Goat', price: 13, tags: ['HALAL', 'GLUTEN_FREE'], section: 'Mains' }
  ],
  'Just Natural Veggie & Seafood': [
    { name: 'Callaloo & Ackee Bowl', price: 10, tags: ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE'], section: 'Bowls' },
    { name: 'Steamed Fish with Okra', price: 16, tags: ['SEAFOOD', 'GLUTEN_FREE'], section: 'Seafood' },
    { name: 'Fresh Coconut Water', price: 3, tags: ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE'], section: 'Drinks' }
  ],
  "Niah's Patties": [
    { name: 'Beef Patty', price: 3, tags: [], section: 'Patties' },
    { name: 'Callaloo Patty', price: 3, tags: ['VEGETARIAN'], section: 'Patties' },
    { name: 'Lobster Patty', price: 6, tags: ['SEAFOOD'], section: 'Patties' }
  ],
  '3 Dives Restaurant & Cliff Bar': [
    { name: 'Jerk Lobster', price: null, tags: ['SEAFOOD', 'GLUTEN_FREE'], section: 'Seafood', description: 'Market price — ask at the grill.' },
    { name: 'Jerk Chicken Plate', price: 13, tags: ['GLUTEN_FREE'], section: 'Jerk' },
    { name: 'Veggie Rundown', price: 10, tags: ['VEGAN', 'VEGETARIAN', 'GLUTEN_FREE'], section: 'Mains' }
  ],
  'MoBay Jerk House': [
    { name: 'Half Jerk Chicken Plate', price: 14, tags: ['GLUTEN_FREE'], section: 'Jerk' },
    { name: 'Festival (3)', price: 3, tags: ['VEGETARIAN'], section: 'Sides' }
  ]
}

// ---------- Safety ----------
// ⚠ VERIFY BEFORE LAUNCH — none of these numbers have been confirmed by phone.

const SAFETY_CONTACTS: Array<{ kind: 'HOSPITAL' | 'CLINIC' | 'TOURIST_POLICE' | 'EMBASSY'; name: string; phone: string; address: string; city?: City; lat?: number; lng?: number; country?: string; notes?: string }> = [
  { kind: 'HOSPITAL', name: 'Cornwall Regional Hospital', phone: '+1 876 952 5100', address: 'Mount Salem, Montego Bay', city: City.MONTEGO_BAY, lat: 18.4699, lng: -77.9140, notes: 'Public hospital, 24-hour emergency' },
  { kind: 'HOSPITAL', name: 'Savanna-la-Mar Public General Hospital', phone: '+1 876 955 2133', address: 'Barracks Road, Savanna-la-Mar', city: City.SAVANNA_LA_MAR, lat: 18.2213, lng: -78.1327, notes: 'Nearest public hospital to Negril' },
  { kind: 'CLINIC', name: 'Negril Health Centre', phone: '+1 876 957 4926', address: 'Whitehall Road, Negril', city: City.NEGRIL, lat: 18.2700, lng: -78.3420 },
  { kind: 'HOSPITAL', name: 'St. Ann’s Bay Regional Hospital', phone: '+1 876 972 2272', address: 'Seville Road, St. Ann’s Bay', city: City.ST_ANNS_BAY, lat: 18.4320, lng: -77.2040, notes: 'Nearest public hospital to Ocho Rios' },
  { kind: 'HOSPITAL', name: 'University Hospital of the West Indies', phone: '+1 876 927 1620', address: 'Mona, Kingston 7', city: City.KINGSTON, lat: 18.0055, lng: -76.7447 },
  { kind: 'HOSPITAL', name: 'Kingston Public Hospital', phone: '+1 876 922 0210', address: 'North Street, Kingston', city: City.KINGSTON, lat: 17.9775, lng: -76.7932 },
  { kind: 'TOURIST_POLICE', name: 'Negril Police Station', phone: '+1 876 957 4268', address: 'Negril Square, Negril', city: City.NEGRIL, lat: 18.2687, lng: -78.3475 },
  { kind: 'TOURIST_POLICE', name: 'Montego Bay Police (Barnett Street)', phone: '+1 876 952 1557', address: 'Barnett Street, Montego Bay', city: City.MONTEGO_BAY, lat: 18.4702, lng: -77.9203 },
  { kind: 'TOURIST_POLICE', name: 'Ocho Rios Police Station', phone: '+1 876 974 2533', address: 'Main Street, Ocho Rios', city: City.OCHO_RIOS, lat: 18.4060, lng: -77.1040 },
  { kind: 'EMBASSY', name: 'Embassy of the United States', phone: '+1 876 702 6000', address: '142 Old Hope Road, Kingston 6', country: 'US', lat: 18.0239, lng: -76.7700 },
  { kind: 'EMBASSY', name: 'High Commission of Canada', phone: '+1 876 926 1500', address: '3 West King’s House Road, Kingston 10', country: 'CA', lat: 18.0225, lng: -76.7905 },
  { kind: 'EMBASSY', name: 'British High Commission', phone: '+1 876 936 0700', address: '28 Trafalgar Road, Kingston 10', country: 'GB', lat: 18.0083, lng: -76.7869 },
  { kind: 'EMBASSY', name: 'Embassy of Germany', phone: '+1 876 631 7935', address: '10 Waterloo Road, Kingston 10', country: 'DE', lat: 18.0161, lng: -76.7927 }
]

// ---------- Challenges ----------

function monthKey(offset: number): string {
  const local = new Date(Date.now() - 5 * 3600000)
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offset, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const CHALLENGES = [
  { key: 'beaches', title: 'Beach hopper', description: 'Visit 3 new beaches this month.', metric: 'NEW_BEACHES', target: 3, bonusPoints: 150 },
  { key: 'food', title: 'Taste the island', description: 'Try 5 new food spots this month.', metric: 'NEW_FOOD_SPOTS', target: 5, bonusPoints: 200 },
  { key: 'checkins', title: 'Out and about', description: 'Check in 10 times this month.', metric: 'CHECKINS', target: 10, bonusPoints: 150 },
  { key: 'gem', title: 'Gem hunter', description: 'Find a hidden gem this month.', metric: 'HIDDEN_GEMS', target: 1, bonusPoints: 100 }
]

// ---------- In-app tickets ----------

const TICKETED_EVENTS: Record<string, number> = {
  'Cliffside Dub Night': 120,
  'Foam Party at Margaritaville': 200,
  'Woodstock Live: Roots Band Showcase': 80,
  'Sunday Beach Fete': 300
}

// ---------- Popular times (sample check-ins) ----------

const BUSY_HOURS: Record<string, number[]> = {
  'Pushcart Restaurant & Rum Bar': [12, 13, 13, 18, 19, 19, 19, 20, 20, 21],
  '3 Dives Restaurant & Cliff Bar': [16, 17, 17, 18, 18, 18, 19, 19, 20],
  'Push Cart': [13, 14, 18, 19, 19, 20, 20, 21]
}

export async function seedLaunchData(prisma: PrismaClient) {
  // The seeded demo accounts can book and post straight away.
  await prisma.user.updateMany({ where: { email: { endsWith: '@eta.app' }, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } })

  // Rewards, tied to vendors and a region.
  for (let i = 0; i < REWARD_SEED.length; i++) {
    const r = REWARD_SEED[i]
    const vendors = await prisma.vendor.findMany({ where: { name: { in: r.vendorNames } }, select: { id: true } })
    const data = { name: r.name, description: r.description, cost: r.cost, icon: r.icon, minTier: r.minTier ?? null, validDays: r.validDays, city: r.city, sortOrder: i, isMock: true }
    await prisma.reward.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data })
    for (const v of vendors) {
      await prisma.rewardVendor.upsert({ where: { rewardId_vendorId: { rewardId: r.id, vendorId: v.id } }, create: { rewardId: r.id, vendorId: v.id }, update: {} })
    }
  }

  // Experience details, slot capacity and cancellation tiers.
  for (const [name, x] of Object.entries(EXPERIENCE_EXTRAS)) {
    await prisma.experience.updateMany({
      where: { name },
      data: { cancellationTier: x.tier, cancellationPolicy: x.note, capacityPerSlot: x.capacity, gallery: x.gallery, whatToBring: x.bring, accessibilityNotes: x.access, guideLanguages: x.languages }
    })
  }
  await prisma.accommodation.updateMany({ where: { name: { in: ['Villa Sur Mer', 'Tryall Villa Estate'] } }, data: { cancellationTier: 'strict' } })

  // Menus (only for vendors that don't have one yet).
  for (const [vendorName, dishes] of Object.entries(MENUS)) {
    const vendor = await prisma.vendor.findFirst({ where: { name: vendorName }, select: { id: true, _count: { select: { menuItems: true } } } })
    if (!vendor || vendor._count.menuItems > 0) continue
    await prisma.menuItem.createMany({
      data: dishes.map((d, i) => ({ vendorId: vendor.id, name: d.name, price: d.price, dietaryTags: d.tags, section: d.section, description: d.description ?? null, imageUrl: d.image ?? null, sortOrder: i }))
    })
  }

  // Safety contacts (VERIFY BEFORE LAUNCH — see the note at the top).
  if ((await prisma.safetyContact.count()) === 0) {
    await prisma.safetyContact.createMany({ data: SAFETY_CONTACTS.map((c, i) => ({ ...c, verified: false, sortOrder: i })) })
  }

  // This month's and the next two months' challenges.
  for (const offset of [0, 1, 2]) {
    const month = monthKey(offset)
    for (const c of CHALLENGES) {
      const slug = `${month}-${c.key}`
      const { key: _key, ...rest } = c
      await prisma.challenge.upsert({ where: { slug }, create: { slug, month, ...rest }, update: {} })
    }
  }

  // In-app tickets for the paid events.
  for (const [title, capacity] of Object.entries(TICKETED_EVENTS)) {
    await prisma.event.updateMany({ where: { title, price: { not: null } }, data: { inAppTickets: true, ticketCapacity: capacity } })
  }

  // Sample check-ins so "Popular times" has something to draw (vendors with
  // fewer than 12 check-ins only). Spread over the last 12 weeks, points 0.
  const users = await prisma.user.findMany({ where: { email: { endsWith: '@eta.app' }, role: 'EXPLORER' }, select: { id: true } })
  if (users.length) {
    for (const [vendorName, hours] of Object.entries(BUSY_HOURS)) {
      const vendor = await prisma.vendor.findFirst({ where: { name: vendorName }, select: { id: true, lat: true, lng: true, _count: { select: { checkIns: true } } } })
      if (!vendor || vendor._count.checkIns >= 12) continue
      const rows = []
      for (let week = 0; week < 12; week++) {
        for (let day = 0; day < 7; day++) {
          for (let i = 0; i < hours.length; i++) {
            const hour = hours[i]
            if ((week + day + i) % 3 !== 0) continue
            const local = new Date(Date.now() - 5 * 3600000 - (week * 7 + day + 1) * DAY)
            const at = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour + 5, (i * 7) % 60))
            rows.push({ vendorId: vendor.id, userId: users[(week + i) % users.length].id, createdAt: at, lat: vendor.lat, lng: vendor.lng, points: 0 })
          }
        }
      }
      await prisma.checkIn.createMany({ data: rows })
    }
  }
}
