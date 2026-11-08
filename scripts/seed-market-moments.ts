// scripts/seed-market-moments.ts — demo data so every new Market section and
// the Experiences moments are filled in Negril and the other main towns
// (Montego Bay, Ocho Rios, Kingston, Port Antonio). All flagged isMock, so
// `npm run mock:remove` clears it. Per town:
//   Market     jerk spots (with heat), a rum bar and a beach bar (happy
//              hours), late-night spots (open past 10pm), crafts makers and
//              a craft market, a supermarket, a pharmacy and a phone top-up
//              shop, cook shops with dishes of the day, two B.O.N members
//              with perks, vendor perks + quiet-hour boosts through the day
//              (Deals Right Now), locals who check in and say why (Local
//              Favourites), and stays where the town has none
//   Moments    experiences tagged for every time of day (vendor tags: best
//              time, indoor/outdoor, start times, spots), indoor ones for
//              rain, a paid Featured one, an ETA hand-pick, and promo
//              videos/photos on the demo events
// Re-running replaces the previous batch (ids start mkv-, mox-, mka-,
// mk-perk-; locals are mock-local-*@eta.test).
//   npm run seed:market
import { PrismaClient, type City, type VendorCategory } from '@prisma/client'
import { assertSeedAllowed } from '../prisma/seed-guard'

const prisma = new PrismaClient()
const DAY = 86400000

type Town = 'NEGRIL' | 'MONTEGO_BAY' | 'OCHO_RIOS' | 'KINGSTON' | 'PORT_ANTONIO'
const TOWNS: Record<Town, { name: string; lat: number; lng: number; areas: [string, string, string]; locals: [string, string, string] }> = {
  NEGRIL: { name: 'Negril', lat: 18.2683, lng: -78.3478, areas: ['West End', 'Seven Mile', 'Sheffield'], locals: ['Andre Campbell', 'Keisha Brown', 'Devon Reid'] },
  MONTEGO_BAY: { name: 'Montego Bay', lat: 18.4762, lng: -77.8939, areas: ['Hip Strip', 'Downtown', 'Reading'], locals: ['Marlon Grant', 'Tanisha Clarke', 'Ricardo Hall'] },
  OCHO_RIOS: { name: 'Ocho Rios', lat: 18.4074, lng: -77.1031, areas: ['Main Street', 'Turtle Beach', 'Fisherman’s Point'], locals: ['Shanice Miller', 'Omar Wright', 'Paulette James'] },
  KINGSTON: { name: 'Kingston', lat: 18.0179, lng: -76.8099, areas: ['New Kingston', 'Half Way Tree', 'Downtown'], locals: ['Kemar Thompson', 'Nadine Walker', 'Jermaine Lewis'] },
  PORT_ANTONIO: { name: 'Port Antonio', lat: 18.176, lng: -76.45, areas: ['West Harbour', 'Boston Bay', 'Titchfield'], locals: ['Sheldon Gordon', 'Latoya Morgan', 'Dwayne Scott'] }
}

const IMG = {
  jerk: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
  plate: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=1200',
  restaurant: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=1200',
  bar: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
  music: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200',
  coffee: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=1200',
  water: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200',
  reef: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=1200',
  boat: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=1200',
  family: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200',
  spa: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200',
  hotel1: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
  hotel2: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200',
  hotel3: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200',
  room1: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
  room2: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200'
}

const every = (ranges: Array<[string, string]>) => Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => [d, ranges]))

interface VendorTpl {
  key: string
  name: (town: string, areas: [string, string, string]) => string
  category: VendorCategory
  area: 0 | 1 | 2
  /** Offset from the town centre, degrees. */
  at: [number, number]
  price: string
  about: string
  tags?: string[]
  heat?: number
  happy?: [string, string]
  note?: string
  hours: Array<[string, string]>
  images: string[]
  indoor?: boolean
  local?: boolean
  premium?: boolean
  dish?: { name: string; price: number; note: string; image: string }
}

const VENDORS: VendorTpl[] = [
  { key: 'jerk1', name: t => `${t} Jerk Centre`, category: 'FOOD', area: 1, at: [0.004, 0.006], price: '$', about: 'Pimento-wood jerk chicken and pork, roast breadfruit and festival, done slow over the pit since the 80s.', tags: ['jerk'], heat: 3, note: 'Chicken · Pork · Festival', hours: [['11:00', '23:00']], images: [IMG.jerk, IMG.food], local: true, dish: { name: 'Jerk Chicken Quarter', price: 9, note: 'Off the pimento wood', image: IMG.jerk } },
  { key: 'jerk2', name: (_, a) => `${a[0]} Jerk Pit`, category: 'FOOD', area: 0, at: [-0.006, -0.008], price: '$', about: 'A roadside drum pan with a view. Jerk pork, festival and a pepper sauce that bites back.', tags: ['jerk'], heat: 2, note: 'Cliffside', hours: [['12:00', '02:00']], images: [IMG.food, IMG.jerk], local: true },
  { key: 'jerk3', name: () => 'Best Jerk Roadside', category: 'FOOD', area: 2, at: [0.009, -0.003], price: '$', about: 'Fire-hot jerk and pepper sauce made from scratch every morning.', tags: ['jerk'], heat: 4, note: 'Roadside', hours: [['10:00', '23:00']], images: [IMG.jerk], local: true },
  { key: 'rum', name: () => 'The Rum Shack', category: 'DRINKS', area: 0, at: [-0.004, -0.005], price: '$$', about: 'Forty-plus Jamaican rums, overproof flights and rum punch the old way.', tags: ['rum_bar'], note: '40+ Rums', happy: ['21:00', '23:00'], hours: [['16:00', '02:00']], images: [IMG.bar], indoor: true },
  { key: 'beachbar', name: (_, a) => `${a[1]} Beach Bar`, category: 'DRINKS', area: 1, at: [0.007, 0.009], price: '$$', about: 'Toes in the sand, cold Red Stripe and the best seat for sunset.', tags: ['beach_bar'], note: 'Sunset View', happy: ['16:00', '18:00'], hours: [['10:00', '00:00']], images: [IMG.beach, IMG.bar] },
  { key: 'patty', name: () => 'Late Night Patty Stop', category: 'FOOD', area: 0, at: [0.001, 0.002], price: '$', about: 'Hot beef, chicken and callaloo patties with coco bread, until the small hours.', note: 'Patties', hours: [['18:00', '03:00']], images: [IMG.food], indoor: true },
  { key: 'live', name: () => 'Bourbon Yard', category: 'DRINKS', area: 1, at: [0.005, 0.004], price: '$$', about: 'Live reggae most nights and a sound system on weekends.', note: 'Live music', hours: [['20:00', '02:00']], images: [IMG.music, IMG.bar], indoor: true },
  { key: 'carver', name: () => 'Errol’s Wood Carvings', category: 'OTHER', area: 2, at: [-0.002, 0.007], price: '$$', about: 'Mahogany and lignum vitae carvings, made by hand in the yard out back.', tags: ['crafts'], note: 'Carving since 1989', hours: [['09:00', '18:00']], images: [] },
  { key: 'craftmarket', name: t => `${t} Craft Market`, category: 'OTHER', area: 1, at: [0.003, -0.004], price: '$', about: 'Stalls of local makers: woven baskets, jewellery, art and souvenirs.', tags: ['crafts', 'souvenirs'], note: 'Local makers', hours: [['08:00', '18:00']], images: [] },
  { key: 'art', name: () => 'Hand-painted Art Studio', category: 'OTHER', area: 2, at: [-0.008, 0.003], price: '$$', about: 'Bright canvases and painted signs by a family of local artists.', tags: ['crafts'], note: 'Hand-painted art', hours: [['10:00', '17:00']], images: [], indoor: true },
  { key: 'grocery', name: () => 'Hi-Lo Supermarket', category: 'OTHER', area: 1, at: [0.008, -0.006], price: '$', about: 'Groceries, water, snacks, beach gear and phone top-up.', tags: ['grocery', 'phone_topup'], hours: [['08:00', '21:00']], images: [], indoor: true },
  { key: 'pharmacy', name: t => `${t} Pharmacy`, category: 'OTHER', area: 0, at: [-0.003, 0.002], price: '$', about: 'Sunscreen, after-sun, first aid and a pharmacist on duty.', tags: ['pharmacy'], note: 'Sunscreen, after-sun, first aid', hours: [['08:00', '20:00']], images: [], indoor: true },
  { key: 'topup', name: () => 'Digicel & Flow Top-Up', category: 'OTHER', area: 2, at: [0.002, 0.008], price: '$', about: 'Phone credit, SIM cards and data plans for visitors.', tags: ['phone_topup'], note: 'Digicel · Flow', hours: [['09:00', '19:00']], images: [], indoor: true },
  { key: 'cookshop', name: () => 'Miss Lily’s Cook Shop', category: 'FOOD', area: 2, at: [-0.005, 0.005], price: '$', about: 'Curry goat, oxtail and stew peas the way Sunday dinner should taste.', note: 'Cook shop', hours: [['07:00', '16:00']], images: [IMG.plate, IMG.food], local: true, indoor: true, dish: { name: 'Oxtail & Rice', price: 14, note: '12 left', image: IMG.plate } },
  { key: 'seafood', name: () => 'Ivan’s Seafood Spot', category: 'FOOD', area: 0, at: [-0.007, -0.002], price: '$$', about: 'Fish straight off the boat, escovitched or steamed, with bammy.', note: 'Fresh catch', hours: [['11:00', '22:30']], images: [IMG.restaurant, IMG.food], local: true, dish: { name: 'Escovitch Fish', price: 18, note: 'Today’s catch', image: IMG.food } },
  { key: 'cafe', name: () => 'Sips & Bites', category: 'FOOD', area: 1, at: [0.002, -0.002], price: '$', about: 'Breakfast all morning: ackee and saltfish, callaloo, Blue Mountain coffee.', note: 'Café', hours: [['07:00', '18:00']], images: [IMG.coffee, IMG.food], indoor: true, dish: { name: 'Ackee & Saltfish', price: 11, note: 'Till noon', image: IMG.restaurant } },
  { key: 'bon1', name: () => 'The Rock House Grill', category: 'FOOD', area: 0, at: [-0.009, -0.009], price: '$$$', about: 'Cliff-top dining over the sea, a B.O.N member.', note: 'Cliff-top dining', hours: [['12:00', '22:00']], images: [IMG.restaurant, IMG.plate], premium: true },
  { key: 'bon2', name: () => 'Kuyaba Lounge', category: 'DRINKS', area: 1, at: [0.006, 0.007], price: '$$$', about: 'Cocktails on the sand and a long dinner menu, a B.O.N member.', note: 'Cocktails on the sand', hours: [['11:00', '23:30']], images: [IMG.bar, IMG.beach], premium: true }
]

const QUOTES: Record<string, string[]> = {
  cookshop: ['Best curry goat in town. Mi go every Sunday after church.', 'Miss Lily cook like your granny. Get the oxtail before it done.'],
  seafood: ['Fresh fish straight off the boat. No tourist prices.', 'Ask for the escovitch with extra pickle. Trust me.'],
  jerk1: ['The real pimento smoke. Everybody else just a copy.', 'Mi bring every visitor here first. Never fail.'],
  patty: ['When everything else close, the patties still hot.']
}
const CHECKINS: Record<string, number> = { cookshop: 9, seafood: 7, jerk1: 6, patty: 4 }

const PERKS: Array<{ vendor: string; id: string; name: string; description: string; cost: number; icon: string }> = [
  { vendor: 'rum', id: 'rum-punch', name: 'Free Rum Punch', description: 'One house rum punch, on us.', cost: 300, icon: 'glass' },
  { vendor: 'cookshop', id: 'second-plate', name: 'Free Festival With Any Plate', description: 'A side of festival with any dinner plate.', cost: 150, icon: 'food' },
  { vendor: 'bon2', id: 'arrival-cocktail', name: 'Free Cocktail On Arrival', description: 'A welcome cocktail when you sit down.', cost: 400, icon: 'glass' },
  { vendor: 'bon1', id: 'dinner-15', name: '15% Off Dinner', description: '15% off your dinner bill.', cost: 500, icon: 'food' }
]

/** Quiet-hour boosts that cover most of the day between them. */
const BOOSTS: Array<{ vendor: string; start: string; end: string; x: number }> = [
  { vendor: 'cafe', start: '08:00', end: '11:00', x: 2 },
  { vendor: 'beachbar', start: '11:00', end: '14:00', x: 2 },
  { vendor: 'cookshop', start: '14:00', end: '17:00', x: 2 },
  { vendor: 'jerk2', start: '17:00', end: '20:00', x: 2 },
  { vendor: 'rum', start: '20:00', end: '23:59', x: 2 }
]

interface ExpTpl { key: string; name: string; tagline: string; price: number; image: string; mood?: string; best: string[]; indoor: boolean; times: string[]; cap: number; at: [number, number]; area: 0 | 1 | 2; featured?: boolean }
const EXPERIENCES: ExpTpl[] = [
  { key: 'reef', name: 'Snorkel The Reef Before The Crowds', tagline: 'Calm water till 11, turtles if you’re lucky.', price: 40, image: IMG.reef, mood: 'Water Life', best: ['morning'], indoor: false, times: ['08:30', '10:00'], cap: 10, at: [0.006, 0.01], area: 1 },
  { key: 'yoga', name: 'Sunrise Yoga On The Sand', tagline: 'A slow hour with the waves. Mats provided.', price: 20, image: IMG.spa, mood: 'R&R', best: ['morning'], indoor: false, times: ['06:30', '07:30'], cap: 15, at: [0.008, 0.008], area: 1 },
  { key: 'jerktour', name: 'Jerk Lunch Tour', tagline: 'Three pits, three heat levels, one verdict.', price: 35, image: IMG.jerk, mood: 'Street Food Crawl', best: ['afternoon'], indoor: false, times: ['11:00', '13:00'], cap: 12, at: [0.004, 0.006], area: 2 },
  { key: 'falls', name: 'River Falls Swim', tagline: 'Cool river pools under the waterfall.', price: 55, image: IMG.water, mood: 'Water Life', best: ['afternoon'], indoor: false, times: ['12:00', '14:00'], cap: 10, at: [0.02, 0.025], area: 2 },
  { key: 'cliff', name: 'Cliff Jumping At Golden Hour', tagline: 'The jump everybody talks about, as the sun goes down.', price: 45, image: IMG.beach, mood: 'Golden Hour', best: ['golden'], indoor: false, times: ['16:30', '17:10'], cap: 8, at: [-0.009, -0.01], area: 0 },
  { key: 'catamaran', name: 'Sunset Catamaran', tagline: 'Rum punch, reggae and the sun dropping into the sea.', price: 70, image: IMG.boat, mood: 'Golden Hour', best: ['golden'], indoor: false, times: ['16:00', '17:00'], cap: 20, at: [0.007, 0.012], area: 1, featured: true },
  { key: 'lagoon', name: 'Glowing Lagoon Night Swim', tagline: 'The water lights up around you.', price: 50, image: IMG.water, mood: 'Just The Two Of Us', best: ['night'], indoor: false, times: ['18:30', '20:00', '22:00'], cap: 12, at: [0.015, 0.02], area: 1 },
  { key: 'rumtasting', name: 'Rum Tasting', tagline: 'Six rums, a master blender and a lot of stories.', price: 25, image: IMG.bar, mood: 'Rum & Bass', best: ['night', 'afternoon'], indoor: true, times: ['16:00', '19:00', '21:00', '22:30'], cap: 12, at: [-0.004, -0.005], area: 0 },
  { key: 'latejerk', name: 'Late Jerk Run', tagline: 'Three late-night pits and a cold Red Stripe at each.', price: 12, image: IMG.jerk, mood: 'Street Food Crawl', best: ['night'], indoor: false, times: ['21:30', '23:00'], cap: 10, at: [0.001, 0.002], area: 0 },
  { key: 'cooking', name: 'Jamaican Cooking Class', tagline: 'Cook ackee, jerk and festival in a covered kitchen.', price: 60, image: IMG.plate, mood: 'Family Day', best: ['afternoon'], indoor: true, times: ['11:00', '15:00'], cap: 8, at: [-0.005, 0.005], area: 2 },
  { key: 'spa', name: 'Spa Hour', tagline: 'Coconut-oil massage while the rain does its thing.', price: 70, image: IMG.spa, mood: 'R&R', best: ['afternoon', 'morning'], indoor: true, times: ['10:00', '13:00', '15:30'], cap: 6, at: [0.003, 0.003], area: 1 },
  { key: 'artvisit', name: 'Art Studio Visit', tagline: 'Paint with a local artist and take it home.', price: 0, image: IMG.family, mood: 'Family Day', best: ['afternoon'], indoor: true, times: ['14:00', '17:00'], cap: 10, at: [-0.008, 0.003], area: 2 }
]

const STAYS: Array<{ key: string; name: (t: string) => string; type: 'VILLA' | 'A_LA_CARTE' | 'ALL_INCLUSIVE'; price: number; stars: number; amenities: string[]; images: string[] }> = [
  { key: 'villas', name: t => `${t} Cliff Villas`, type: 'VILLA', price: 140, stars: 4.6, amenities: ['Cliffside', 'Pool'], images: [IMG.hotel1, IMG.room1, IMG.hotel2] },
  { key: 'beach', name: t => `${t} Beach Cottages`, type: 'A_LA_CARTE', price: 95, stars: 4.3, amenities: ['Beachfront', 'Breakfast'], images: [IMG.hotel3, IMG.room2, IMG.hotel2] }
]

async function clear() {
  const vendors = (await prisma.vendor.findMany({ where: { id: { startsWith: 'mkv-' } }, select: { id: true } })).map(v => v.id)
  const exps = (await prisma.experience.findMany({ where: { id: { startsWith: 'mox-' } }, select: { id: true } })).map(e => e.id)
  const locals = (await prisma.user.findMany({ where: { email: { startsWith: 'mock-local-' } }, select: { id: true } })).map(u => u.id)
  const perks = (await prisma.reward.findMany({ where: { id: { startsWith: 'mk-perk-' } }, select: { id: true } })).map(r => r.id)
  await prisma.momentPick.deleteMany({ where: { isMock: true } })
  await prisma.redemption.deleteMany({ where: { rewardId: { in: perks } } })
  await prisma.reward.deleteMany({ where: { id: { in: perks } } })
  await prisma.review.deleteMany({ where: { OR: [{ vendorId: { in: vendors } }, { userId: { in: locals } }] } })
  await prisma.checkIn.deleteMany({ where: { OR: [{ vendorId: { in: vendors } }, { userId: { in: locals } }] } })
  await prisma.boost.deleteMany({ where: { vendorId: { in: vendors } } })
  await prisma.experienceStop.deleteMany({ where: { OR: [{ vendorId: { in: vendors } }, { experienceId: { in: exps } }] } })
  // The demo reservations go; anyone else's keep their record, unlinked.
  await prisma.booking.deleteMany({ where: { userId: { in: locals } } })
  await prisma.booking.updateMany({ where: { experienceId: { in: exps } }, data: { experienceId: null } })
  await prisma.booking.updateMany({ where: { vendorId: { in: vendors } }, data: { vendorId: null } })
  await prisma.tripStop.deleteMany({ where: { OR: [{ experienceId: { in: exps } }, { vendorId: { in: vendors } }] } })
  await prisma.saved.deleteMany({ where: { refId: { in: [...vendors, ...exps] } } })
  await prisma.experience.deleteMany({ where: { id: { in: exps } } })
  await prisma.vendor.deleteMany({ where: { id: { in: vendors } } })
  await prisma.accommodation.deleteMany({ where: { id: { startsWith: 'mka-' } } })
  await prisma.user.deleteMany({ where: { id: { in: locals } } })
}

async function main() {
  assertSeedAllowed('seed:market')
  await clear()

  const moods = await prisma.mood.findMany({ select: { id: true, name: true, videoUrl: true } })
  const mood = (name?: string) => moods.find(m => m.name === name)
  const now = Date.now()
  let vendorCount = 0
  let expCount = 0

  for (const [city, town] of Object.entries(TOWNS) as Array<[Town, (typeof TOWNS)[Town]]>) {
    const c = city.toLowerCase().replace(/_/g, '-')
    const vid = (key: string) => `mkv-${c}-${key}`

    // ---------- Vendors ----------
    for (const v of VENDORS) {
      await prisma.vendor.create({
        data: {
          id: vid(v.key), name: v.name(town.name, town.areas), category: v.category, neighborhood: town.areas[v.area], city: city as City,
          lat: town.lat + v.at[0], lng: town.lng + v.at[1], priceRange: v.price, description: v.about, images: v.images, videos: [],
          open: true, isPremium: Boolean(v.premium), indoor: Boolean(v.indoor), localSpot: Boolean(v.local), hours: every(v.hours),
          marketTags: v.tags ?? [], heatLevel: v.heat ?? null, happyHourStart: v.happy?.[0] ?? null, happyHourEnd: v.happy?.[1] ?? null, marketNote: v.note ?? null,
          dishOfDay: v.dish ? { name: v.dish.name, price: v.dish.price, imageUrl: v.dish.image, note: v.dish.note } : undefined,
          locationStatus: 'UNCONFIRMED', isMock: true
        }
      })
      vendorCount++
    }

    // ---------- Locals: check-ins and their own words ----------
    const locals = []
    for (let i = 0; i < town.locals.length; i++) {
      const name = town.locals[i]
      locals.push(await prisma.user.create({ data: { email: `mock-local-${c}-${i + 1}@eta.test`, name, isMock: true, travelerType: 'LOCAL', city: city as City, emailVerifiedAt: new Date() } }))
    }
    for (const [key, n] of Object.entries(CHECKINS)) {
      for (let k = 0; k < n; k++) {
        const u = locals[k % locals.length]
        await prisma.checkIn.create({ data: { userId: u.id, vendorId: vid(key), method: 'qr', createdAt: new Date(now - (k * 5 + 2) * DAY) } })
      }
      for (let k = 0; k < (QUOTES[key] ?? []).length; k++) {
        const quote = QUOTES[key][k]
        await prisma.review.create({ data: { userId: locals[k % locals.length].id, vendorId: vid(key), rating: 5, comment: quote, createdAt: new Date(now - (k + 1) * 3 * DAY) } })
      }
    }
    // A few visitor reviews so the ranking has something to go on.
    for (const key of ['jerk1', 'jerk2', 'beachbar', 'rum']) {
      await prisma.review.create({ data: { userId: locals[2].id, vendorId: vid(key), rating: key === 'jerk1' ? 5 : 4, comment: null } })
    }

    // ---------- Deals: vendor perks + quiet hours ----------
    for (const p of PERKS) {
      await prisma.reward.create({
        data: {
          id: `mk-perk-${c}-${p.id}`, name: p.name, description: p.description, cost: p.cost, icon: p.icon, validDays: 7, city: city as City,
          category: 'vendor', kind: 'catalog', dailyCap: 20, monthlyBudget: 300, createdByVendorId: vid(p.vendor), isMock: true,
          vendors: { create: [{ vendorId: vid(p.vendor) }] }
        }
      })
    }
    const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
    for (const b of BOOSTS) {
      await prisma.boost.create({ data: { kind: 'quiet_hour', title: `${b.x}× points ${b.start}–${b.end}`, multiplier: b.x, startMin: toMin(b.start), endMin: toMin(b.end) + (b.end === '23:59' ? 1 : 0), vendorId: vid(b.vendor), isMock: true } })
    }

    // ---------- Stays, where the town has none ----------
    if (!(await prisma.accommodation.count({ where: { city: city as City, NOT: { id: { startsWith: 'mka-' } } } }))) {
      for (const s of STAYS) {
        await prisma.accommodation.create({
          data: {
            id: `mka-${c}-${s.key}`, name: s.name(town.name), type: s.type, googleStars: s.stars, description: `${s.name(town.name)} — ${s.amenities.join(', ').toLowerCase()}.`,
            amenities: s.amenities, priceRange: '$$', lat: town.lat + 0.006, lng: town.lng - 0.004, city: city as City, vetted: true,
            media: s.images.map(url => ({ type: 'photo', url })), roomViews: [], nightlyPrice: s.price, isMock: true
          }
        })
      }
    }

    // ---------- Experiences for every time of day ----------
    for (const e of EXPERIENCES) {
      const m = mood(e.mood)
      await prisma.experience.create({
        data: {
          id: `mox-${c}-${e.key}`, name: e.name, tagline: e.tagline, price: e.price, imageUrl: e.image,
          // Short loops from the mood collections (already in use), for the Video badge and Up Next tiles.
          videoUrl: ['reef', 'cliff', 'lagoon', 'rumtasting'].includes(e.key) ? m?.videoUrl ?? null : null,
          city: city as City, startLocation: town.areas[e.area], travelTime: 10, travelMode: 'TAXI',
          meetingPoint: `${town.areas[e.area]}, ${town.name}`, meetingLat: town.lat + e.at[0], meetingLng: town.lng + e.at[1],
          startTimes: e.times, capacityPerSlot: e.cap, maxPartySize: Math.min(10, e.cap), bestTimes: e.best, outdoor: !e.indoor,
          featuredUntil: e.featured ? new Date(now + 30 * DAY) : null, included: [], isMock: true,
          ...(m ? { moods: { connect: [{ id: m.id }] } } : {})
        }
      })
      expCount++
    }
    // Spots get taken: a few reservations today (from the locals) so "booked today" and spots left move.
    const today = new Date(now - 5 * 3600000).toISOString().slice(0, 10)
    const booked = ['cliff', 'reef', 'cooking', 'catamaran']
    for (let k = 0; k < booked.length; k++) {
      const key = booked[k]
      const tpl = EXPERIENCES.find(x => x.key === key)!
      const time = tpl.times[tpl.times.length - 1]
      await prisma.booking.create({
        data: { userId: locals[k % locals.length].id, experienceId: `mox-${c}-${key}`, date: new Date(`${today}T${time}:00-05:00`), time, partySize: 2 + (k % 3), unitPrice: tpl.price, totalPrice: tpl.price * (2 + (k % 3)), status: 'PENDING' }
      })
    }

    // ---------- An ETA hand-pick for golden hour ----------
    await prisma.momentPick.create({ data: { city: city as City, experienceId: `mox-${c}-cliff`, daypart: 'golden', note: null, sortOrder: 0, isMock: true } })

    // ---------- Promo media on the demo events: videos first, then photos ----------
    const events = await prisma.event.findMany({ where: { city: city as City, isMock: true }, select: { id: true, imageUrl: true } })
    const loops = moods.map(x => x.videoUrl).filter((u): u is string => Boolean(u))
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]
      await prisma.event.update({
        where: { id: ev.id },
        data: {
          videos: loops.length && i % 2 === 0 ? [loops[i % loops.length]] : [],
          photos: [IMG.music, IMG.beach, IMG.bar, IMG.food].filter(u => u !== ev.imageUrl).slice(0, 2 + (i % 2))
        }
      })
    }
    console.log(`${town.name}: ${VENDORS.length} vendors, ${EXPERIENCES.length} experiences, ${events.length} events with promo media`)
  }

  console.log(`\nDone: ${vendorCount} mock vendors and ${expCount} mock experiences across ${Object.keys(TOWNS).length} towns.`)
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())

