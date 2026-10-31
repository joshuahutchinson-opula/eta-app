// prisma/seed-extras.ts — mock data for the newer features (events, hours,
// booking details, availability, redemptions, notifications...). Runs at the
// end of seed.ts, after the core vendors/experiences/users exist, and finds
// them by name so it doesn't depend on seed.ts's local variables.
//
// Everything here is placeholder data for the prototype: hours, phone
// numbers, prices and promoters are plausible, not confirmed with vendors.

import { City, type PrismaClient } from '@prisma/client'
import { MOCK_VENDOR_NAMES } from './seed-guard'
import { seedLaunchData } from './seed-launch'

const HOUR = 3600000
const DAY = 24 * HOUR

/** Jamaica is UTC-5 year-round: `daysFromNow` days ahead at hh:mm local time. */
function jamaicaAt(daysFromNow: number, hh: number, mm = 0): Date {
  const now = new Date()
  const local = new Date(now.getTime() - 5 * HOUR)
  const d = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysFromNow, hh + 5, mm)
  return new Date(d)
}

export async function seedEvents(prisma: PrismaClient) {
  const rick = await prisma.vendor.findFirst({ where: { name: { contains: 'Ivan' } }, select: { id: true } })
  const margaritaville = await prisma.vendor.findFirst({ where: { name: 'Margaritaville Negril' }, select: { id: true } })
  const woodstock = await prisma.vendor.findFirst({ where: { name: 'Woodstock' }, select: { id: true } })

  await prisma.event.createMany({
    data: [
      {
        title: 'Seven Mile Sunset Sessions',
        promoterName: 'Westend Vibes Promotions',
        description: 'Reggae and lovers rock on the sand as the sun goes down. Selectors from Sav and Negril, rum punch specials until 8.\n\nBring a towel, leave the shoes.',
        imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
        venueName: 'Bourbon Beach, Seven Mile',
        lat: 18.2905, lng: -78.3510,
        startAt: jamaicaAt(0, 17, 30), endAt: jamaicaAt(0, 22, 0),
        isFree: true, city: City.NEGRIL
      },
      {
        title: 'Cliffside Dub Night',
        promoterName: 'Bass Culture JA',
        description: 'Roots and dub sound system on the West End cliffs. Cliff jumping closes at dark — the speakers don’t.',
        imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200',
        venueName: 'Ivan’s Bar, West End',
        lat: 18.2622, lng: -78.3693,
        startAt: jamaicaAt(1, 21, 0), endAt: jamaicaAt(2, 2, 0),
        price: 15, ticketUrl: 'https://example.com/tickets/cliffside-dub',
        city: City.NEGRIL, vendorId: rick?.id
      },
      {
        title: 'Foam Party at Margaritaville',
        promoterName: 'Margaritaville Negril',
        description: 'The water trampoline turns into a foam pit. DJ from 2pm, drink specials all afternoon.',
        imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200',
        venueName: 'Margaritaville Negril',
        lat: 18.2958, lng: -78.3692,
        startAt: jamaicaAt(2, 14, 0), endAt: jamaicaAt(2, 19, 0),
        price: 20, city: City.NEGRIL, vendorId: margaritaville?.id
      },
      {
        title: 'Negril Craft & Food Market',
        promoterName: 'Negril Chamber of Commerce',
        description: 'Local makers, jerk stands, fresh juice and live mento band. Family friendly.',
        imageUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200',
        venueName: 'Rutland Point Craft Market',
        lat: 18.3086, lng: -78.3400,
        startAt: jamaicaAt(3, 10, 0), endAt: jamaicaAt(3, 16, 0),
        isFree: true, city: City.NEGRIL
      },
      {
        title: 'Woodstock Live: Roots Band Showcase',
        promoterName: 'Woodstock Bar',
        description: 'Three live roots reggae bands, one stage, one long night.',
        imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200',
        venueName: 'Woodstock, Seven Mile Beach',
        lat: 18.2840, lng: -78.3470,
        startAt: jamaicaAt(5, 20, 0),
        price: 10, city: City.NEGRIL, vendorId: woodstock?.id
      },
      {
        title: 'Hip Strip Friday',
        promoterName: 'MoBay Nights',
        description: 'Bar crawl along Gloucester Avenue with a dancehall finale. Wristband gets you a drink at each stop.',
        imageUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200',
        venueName: 'Gloucester Avenue (Hip Strip)',
        lat: 18.4866, lng: -77.9234,
        startAt: jamaicaAt(1, 20, 0), endAt: jamaicaAt(2, 3, 0),
        price: 35, ticketUrl: 'https://example.com/tickets/hip-strip-friday',
        city: City.MONTEGO_BAY
      },
      {
        title: 'Sunday Beach Fete',
        promoterName: 'Island Pulse Events',
        description: 'All-day beach party with soca and dancehall, food vendors and a sunset set.',
        imageUrl: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200',
        venueName: 'Dead End Beach',
        lat: 18.4983, lng: -77.9266,
        startAt: jamaicaAt(4, 12, 0), endAt: jamaicaAt(4, 20, 0),
        price: 25, city: City.MONTEGO_BAY
      },
      {
        title: 'Harbour Street Art Walk',
        promoterName: 'MoBay Creative Collective',
        description: 'Guided walk through downtown murals and pop-up galleries, ending at Sam Sharpe Square.',
        imageUrl: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200',
        venueName: 'Sam Sharpe Square',
        lat: 18.4710, lng: -77.9200,
        startAt: jamaicaAt(6, 16, 0), endAt: jamaicaAt(6, 18, 30),
        city: City.MONTEGO_BAY
      }
    ]
  })
}

// Booking details for every curated experience: what's included, where to
// meet, the cancellation policy, start times and group size.
const EXPERIENCE_DETAILS: Record<string, { included: string[]; meetingPoint: string; lat: number; lng: number; cancellation: string; startTimes: string[]; maxParty: number }> = {
  'Full Moon Float': { included: ['Dinner at Kamara’s', 'Two drinks at Alfred’s', 'Hobie Cat sail at sunrise', 'Life jackets'], meetingPoint: 'Kamara’s, Norman Manley Blvd', lat: 18.2931, lng: -78.3550, cancellation: 'Free cancellation up to 24 hours before. Sails are weather-dependent — a rained-out sail is refunded in full.', startTimes: ['18:00', '19:00'], maxParty: 8 },
  'Rum & Bass': { included: ['Rum tasting flight at Push Cart', 'Cliff bar entry', 'Sound system night at Coral Reef'], meetingPoint: 'Push Cart, West End Road', lat: 18.2633, lng: -78.3683, cancellation: 'Free cancellation up to 12 hours before.', startTimes: ['19:30', '20:30'], maxParty: 10 },
  'Cliff Morning': { included: ['Sunrise yoga class', 'Breakfast at Rockhouse', 'Guided cliff swim'], meetingPoint: 'Ocean View Spa, West End', lat: 18.2611, lng: -78.3720, cancellation: 'Free cancellation up to 24 hours before.', startTimes: ['06:30', '07:30'], maxParty: 6 },
  'Jerk Tour': { included: ['Tastings at five jerk centres', 'Taxi between stops', 'Bottle of water'], meetingPoint: 'Border Jerk, Negril', lat: 18.2795, lng: -78.3390, cancellation: 'Free cancellation up to 6 hours before.', startTimes: ['11:00', '13:00', '16:00'], maxParty: 12 },
  'Reef Snorkel': { included: ['Snorkel gear', 'Boat to the reef', 'Guide', 'Fresh fruit'], meetingPoint: 'Seven Mile Beach Snorkel Tours hut', lat: 18.3020, lng: -78.3645, cancellation: 'Free cancellation up to 24 hours before. Rough seas: full refund or rebook.', startTimes: ['09:00', '11:00', '14:00'], maxParty: 10 },
  'Sunset Dinner': { included: ['Three-course dinner', 'Glass of wine', 'Clifftop table for sunset'], meetingPoint: 'Rockhouse Restaurant, West End', lat: 18.2669, lng: -78.3655, cancellation: '50% refund up to 24 hours before; no refund after.', startTimes: ['17:30', '18:00'], maxParty: 6 },
  'Beach Day Pass': { included: ['Beach entry', 'Lounger and umbrella', 'One drink'], meetingPoint: 'Doctor’s Cave Beach entrance, Gloucester Ave', lat: 18.4855, lng: -77.9310, cancellation: 'Free cancellation any time before the day.', startTimes: [], maxParty: 10 },
  'Catamaran Sunset': { included: ['Catamaran cruise', 'Open bar', 'Snorkel stop', 'Hotel pickup in MoBay'], meetingPoint: 'MoBay Watersports dock, Freeport', lat: 18.4636, lng: -77.9400, cancellation: 'Free cancellation up to 48 hours before.', startTimes: ['15:30'], maxParty: 20 },
  'Coffee Farm Trip': { included: ['Farm tour', 'Coffee tasting', 'Lunch', 'Round-trip transport'], meetingPoint: 'Blue Mahoe, Negril Cliffs', lat: 18.2620, lng: -78.3510, cancellation: 'Free cancellation up to 48 hours before.', startTimes: ['08:00'], maxParty: 8 }
}

// Nightly prices and capacity for the seeded stays (USD; placeholders).
// Tryall Villa Estate and Secrets St. James are left unpriced on purpose, to
// show the "nightly price not listed" state.
const STAY_DETAILS: Record<string, { nightlyPrice: number; maxGuests: number }> = {
  'The Cliff Hotel': { nightlyPrice: 320, maxGuests: 4 },
  'Sandals Negril': { nightlyPrice: 690, maxGuests: 2 },
  'Villa Sur Mer': { nightlyPrice: 520, maxGuests: 10 },
  'Half Moon Rock Resort': { nightlyPrice: 410, maxGuests: 4 }
}

function utcMidnight(days: number): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days))
}

export async function seedBookingData(prisma: PrismaClient) {
  for (const [name, d] of Object.entries(EXPERIENCE_DETAILS)) {
    await prisma.experience.updateMany({
      where: { name },
      data: { included: d.included, meetingPoint: d.meetingPoint, meetingLat: d.lat, meetingLng: d.lng, cancellationPolicy: d.cancellation, startTimes: d.startTimes, maxPartySize: d.maxParty }
    })
  }

  for (const [name, d] of Object.entries(STAY_DETAILS)) {
    await prisma.accommodation.updateMany({ where: { name }, data: d })
  }
  // A few blocked nights so the availability check has something to find.
  const cliff = await prisma.accommodation.findFirst({ where: { name: 'The Cliff Hotel' } })
  const villa = await prisma.accommodation.findFirst({ where: { name: 'Villa Sur Mer' }, select: { id: true } })
  if (cliff) {
    await prisma.accommodationBlockedDate.createMany({ data: [8, 9, 20, 21, 22].map(n => ({ accommodationId: cliff.id, date: utcMidnight(n), reason: 'Owner block' })) })
  }
  if (villa) {
    await prisma.accommodationBlockedDate.createMany({ data: [3, 4, 5].map(n => ({ accommodationId: villa.id, date: utcMidnight(n), reason: 'Sold out' })) })
  }

  // Reviews of experiences themselves (tied to the route's host vendor).
  const users = await prisma.user.findMany({ select: { id: true, email: true } })
  const by = (email: string) => users.find(u => u.email === email)?.id
  const expReviews: Array<[string, string, number, string]> = [
    ['Jerk Tour', 'marcus@eta.app', 5, 'Five jerk spots, zero regrets. Border Jerk was the winner.'],
    ['Jerk Tour', 'sarah@eta.app', 4, 'Pace was a lot, but the taxi between stops made it easy.'],
    ['Reef Snorkel', 'tasha@eta.app', 5, 'Saw a ray and a turtle. The guide knew every fish by name.'],
    ['Catamaran Sunset', 'devon@eta.app', 5, 'Open bar + sunset + snorkel stop. Book it.'],
    ['Sunset Dinner', 'sarah@eta.app', 5, 'Best table I’ve ever had. The sun drops right in front of you.']
  ]
  for (const [expName, email, rating, comment] of expReviews) {
    const exp = await prisma.experience.findFirst({ where: { name: expName }, include: { stops: { orderBy: { order: 'asc' }, select: { vendorId: true } } } })
    const host = exp?.stops.find(s => s.vendorId)?.vendorId
    const userId = by(email)
    if (exp && host && userId) await prisma.review.create({ data: { experienceId: exp.id, vendorId: host, userId, rating, comment } })
  }

  // Jordan (the demo account) gets a realistic trip timeline: two upcoming
  // paid experiences and a stay, each with its receipt.
  const jordan = by('jordan@eta.app')
  const reef = await prisma.experience.findFirst({ where: { name: 'Reef Snorkel' } })
  const sunset = await prisma.experience.findFirst({ where: { name: 'Sunset Dinner' } })
  if (!jordan || !reef || !sunset || !cliff) return
  const fee = (n: number) => Math.round(n * 0.05 * 100) / 100
  const paid = async (data: { experienceId?: string; accommodationId?: string; date: Date; endDate?: Date; time?: string; partySize: number; unitPrice: number; qty: number; description: string }) => {
    const subtotal = data.unitPrice * data.qty
    const total = subtotal + fee(subtotal)
    const booking = await prisma.booking.create({
      data: {
        userId: jordan, experienceId: data.experienceId, accommodationId: data.accommodationId, date: data.date, endDate: data.endDate,
        time: data.time, partySize: data.partySize, unitPrice: data.unitPrice, fees: fee(subtotal), totalPrice: total,
        pointsEarned: Math.floor(subtotal), status: 'CONFIRMED'
      }
    })
    await prisma.transaction.create({
      data: { userId: jordan, bookingId: booking.id, amount: total, fees: fee(subtotal), description: data.description, rail: 'ETA Wallet', type: 'PAYMENT', status: 'COMPLETED' }
    })
  }
  await paid({ experienceId: reef.id, date: jamaicaAt(1, 9), time: '09:00', partySize: 2, unitPrice: reef.price, qty: 2, description: reef.name })
  await paid({ experienceId: sunset.id, date: jamaicaAt(2, 17, 30), time: '17:30', partySize: 2, unitPrice: sunset.price, qty: 2, description: sunset.name })
  await paid({ accommodationId: cliff.id, date: jamaicaAt(12, 15), endDate: jamaicaAt(15, 11), partySize: 2, unitPrice: 320, qty: 3, description: 'The Cliff Hotel · 3 nights' })
}

// What vendors are pushing today (Market → Dish of the Day).
const DISHES: Record<string, { name: string; price: number; imageUrl?: string; videoUrl?: string; prepMinutes: number }> = {
  'Margaritaville Negril': { name: 'Beach Burgers', price: 16, prepMinutes: 20, videoUrl: 'https://res.cloudinary.com/wspvflyn/video/upload/vc_h264,q_auto/v1789881244/vendors/margaritaville-negril/zoahmywsmu9w96g7rvcw.mp4' },
  'Push Cart': { name: 'Jerk Pork & Festival', price: 12, prepMinutes: 15 },
  'MoBay Jerk House': { name: 'Half Jerk Chicken Plate', price: 14, prepMinutes: 15 }
}

export async function seedDiscovery(prisma: PrismaClient) {
  for (const [name, dish] of Object.entries(DISHES)) {
    await prisma.vendor.updateMany({ where: { name }, data: { dishOfDay: dish } })
  }

  // Hidden gems for the Discover map: two verified (fogged until you're
  // close) and one still collecting confirmations.
  const users = await prisma.user.findMany({ where: { email: { in: ['marcus@eta.app', 'sarah@eta.app', 'tasha@eta.app'] } }, select: { id: true, email: true } })
  const id = (email: string) => users.find(u => u.email === email)?.id
  const marcus = id('marcus@eta.app')
  const sarah = id('sarah@eta.app')
  const tasha = id('tasha@eta.app')
  if (!marcus || !sarah || !tasha) return
  await prisma.hiddenGem.create({
    data: {
      name: 'Blue Hole mineral spring', category: 'HOT_SPRING', description: 'Cool spring-fed pool down a short ladder, about 25 minutes inland from Negril. Locals swim here on Sundays.',
      lat: 18.3322, lng: -78.2405, photos: ['https://images.unsplash.com/photo-1519111830404-c95d1a4d7332?w=1200'],
      status: 'VERIFIED', confirmationCount: 3, submitterRewarded: true, verifiedAt: new Date(), submittedByUserId: marcus
    }
  })
  await prisma.hiddenGem.create({
    data: {
      name: 'Lighthouse rock ledge', category: 'VIEWPOINT', description: 'Flat rock past the Negril lighthouse where you get the whole west coast at sunset without the Rick’s crowd.',
      lat: 18.2470, lng: -78.3655, photos: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200'],
      status: 'VERIFIED', confirmationCount: 4, submitterRewarded: true, verifiedAt: new Date(), submittedByUserId: sarah
    }
  })
  await prisma.hiddenGem.create({
    data: {
      name: 'Mayfield river pools', category: 'WATERFALL', description: 'Small falls and swimming holes off the Mayfield road. Bring water shoes.',
      lat: 18.3250, lng: -78.1650, photos: ['https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=1200'],
      status: 'PENDING', confirmationCount: 1, submittedByUserId: tasha
    }
  })
}

// Weekly hours (Jamaica time). Vendors not listed here keep hours = null and
// their page falls back to the live open/closed flag with no hours card.
const EVERY_DAY = (open: string, close: string) => ({ sun: [[open, close]], mon: [[open, close]], tue: [[open, close]], wed: [[open, close]], thu: [[open, close]], fri: [[open, close]], sat: [[open, close]] })
const VENDOR_ESSENTIALS: Record<string, { hours?: object; phone?: string; whatsapp?: string; acceptsReservations?: boolean }> = {
  'Push Cart': { hours: EVERY_DAY('12:00', '23:00'), phone: '+1 876 555 0101', whatsapp: '18765550101', acceptsReservations: true },
  'Rockhouse Restaurant': { hours: EVERY_DAY('07:30', '22:00'), phone: '+1 876 555 0102', whatsapp: '18765550102', acceptsReservations: true },
  '3 Dives Restaurant & Cliff Bar': { hours: EVERY_DAY('11:00', '23:30'), phone: '+1 876 555 0103' },
  'Margaritaville Negril': { hours: { ...EVERY_DAY('10:00', '23:00'), fri: [['10:00', '02:00']], sat: [['10:00', '02:00']] }, phone: '+1 876 555 0104', acceptsReservations: true },
  'Ocean View Spa': { hours: { mon: [['09:00', '18:00']], tue: [['09:00', '18:00']], wed: [['09:00', '18:00']], thu: [['09:00', '18:00']], fri: [['09:00', '18:00']], sat: [['10:00', '16:00']] }, whatsapp: '18765550105', acceptsReservations: true },
  'Border Jerk': { hours: EVERY_DAY('10:00', '21:00'), phone: '+1 876 555 0106' },
  'MoBay Jerk House': { hours: EVERY_DAY('11:00', '22:00'), phone: '+1 876 555 0107', whatsapp: '18765550107' },
  "Doctor's Cave Beach Bar": { hours: EVERY_DAY('08:30', '18:00') },
  'Coral Reef': { hours: { thu: [['18:00', '01:00']], fri: [['18:00', '03:00']], sat: [['18:00', '03:00']], sun: [['16:00', '23:00']] }, whatsapp: '18765550108' },
  'Seven Mile Beach Snorkel Tours': { hours: EVERY_DAY('08:00', '16:00'), phone: '+1 876 555 0109', whatsapp: '18765550109', acceptsReservations: true }
}

export async function seedVendorEssentials(prisma: PrismaClient) {
  for (const [name, data] of Object.entries(VENDOR_ESSENTIALS)) {
    await prisma.vendor.updateMany({ where: { name }, data })
  }

  // Vetted transport (Safety → Vetted transport). Hidden from the marketplace
  // lists; shown only on the Safety screen.
  const transport = [
    { name: 'Negril Licensed Taxi Stand', neighborhood: 'Negril Square', city: City.NEGRIL, lat: 18.2685, lng: -78.3478, description: 'Red-plate (PPV) licensed taxis from the square. Agree the fare before you get in.', phone: '+1 876 555 0201', whatsapp: '18765550201' },
    { name: 'West End Route Taxis', neighborhood: 'West End Road', city: City.NEGRIL, lat: 18.2640, lng: -78.3640, description: 'Licensed route taxis up and down West End Road, 7am–11pm.', phone: '+1 876 555 0202' },
    { name: 'MBJ Airport Transfers', neighborhood: 'Sangster International Airport', city: City.MONTEGO_BAY, lat: 18.5037, lng: -77.9134, description: 'Licensed airport transfers to Montego Bay and Negril hotels. Meets you at arrivals.', phone: '+1 876 555 0203', whatsapp: '18765550203' },
    { name: 'Hip Strip Licensed Taxis', neighborhood: 'Gloucester Avenue', city: City.MONTEGO_BAY, lat: 18.4866, lng: -77.9234, description: 'JTB-licensed taxis along the Hip Strip, day and night.', whatsapp: '18765550204' }
  ]
  for (const v of transport) {
    await prisma.vendor.create({
      data: { ...v, category: 'TRANSPORT', priceRange: '$$', images: [], videos: [], open: true, isTransport: true, visibleOnMap: false }
    })
  }

  // Jordan has one live reward voucher, so Recent Redemptions isn't empty.
  const jordan = await prisma.user.findUnique({ where: { email: 'jordan@eta.app' }, select: { id: true } })
  if (jordan) {
    await prisma.redemption.create({
      data: { userId: jordan.id, rewardId: 'rum-punch', rewardName: 'Free Round of Rum Punch', pointCost: 350, code: 'ETA-7Q2K9P', expiresAt: new Date(Date.now() + 10 * DAY) }
    })
    const push = await prisma.vendor.findFirst({ where: { name: 'Push Cart' }, select: { id: true } })
    if (push) {
      await prisma.reservationRequest.create({ data: { userId: jordan.id, vendorId: push.id, date: jamaicaAt(3, 19, 30), time: '19:30', partySize: 4, note: 'Birthday dinner' } })
    }
  }
}

// The demo account's profile details and a few past alerts for the inbox.
// The subscription is a placeholder (no real device), with alerts switched
// off so the sweep never tries to push to it.
export async function seedProfileAndInbox(prisma: PrismaClient) {
  const jordan = await prisma.user.update({
    where: { email: 'jordan@eta.app' },
    data: { bio: 'Chasing sunsets and jerk pork. Third trip to Negril.', homeCountry: 'Toronto, Canada' },
    select: { id: true }
  }).catch(() => null)
  if (!jordan) return
  const sub = await prisma.alertSubscription.create({
    data: { endpoint: 'https://push.invalid/seed/jordan', p256dh: 'seed', auth: 'seed', userId: jordan.id, liveAlerts: false, dealAlerts: false }
  })
  const push = await prisma.vendor.findFirst({ where: { name: 'Push Cart' }, select: { id: true } })
  const coral = await prisma.vendor.findFirst({ where: { name: 'Coral Reef' }, select: { id: true } })
  const now = Date.now()
  await prisma.notificationLog.createMany({
    data: [
      { subscriptionId: sub.id, key: 'seed-deal-1', title: 'Flash deal at Push Cart', body: '20% off jerk chicken · 400 m away · ends in 6h', url: push ? `/vendor/${push.id}` : null, createdAt: new Date(now - 40 * 60000) },
      { subscriptionId: sub.id, key: 'seed-live-1', title: 'Coral Reef is live now', body: '23 people there right now · Seven Mile Beach', url: coral ? `/vendor/${coral.id}` : null, createdAt: new Date(now - 5 * HOUR) },
      { subscriptionId: sub.id, key: 'seed-live-2', title: 'Push Cart is live now', body: 'Happening now in West End', url: push ? `/vendor/${push.id}` : null, createdAt: new Date(now - 2 * DAY), readAt: new Date(now - 2 * DAY + HOUR) }
    ]
  })
}

export async function seedExtras(prisma: PrismaClient) {
  await seedEvents(prisma)
  // Every seeded event is a placeholder; so are the vendors in MOCK_VENDOR_NAMES.
  await prisma.event.updateMany({ data: { isMock: true } })
  await seedBookingData(prisma)
  await seedDiscovery(prisma)
  await seedVendorEssentials(prisma)
  await seedProfileAndInbox(prisma)
  await prisma.vendor.updateMany({ where: { name: { in: MOCK_VENDOR_NAMES } }, data: { isMock: true } })
  await seedLaunchData(prisma)
}
