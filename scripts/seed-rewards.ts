// scripts/seed-rewards.ts — demo data for Rewards, all flagged isMock so
// `npm run mock:remove` clears it:
//   Jordan (jordan@eta.app) at Insider: 3,420 lifetime points, 2,180 to spend,
//     with a full points history, two vouchers and a Give Back donation
//   mock rewards across every filter (vendor perks, Insider/Yaadie-only,
//     event early access and VIP entry, ETA ride/experience perks, a locals'
//     perk) and a bigger Insider welcome-back gift
//   quiet-hour boosts at Negril vendors, rainy-day boosts per town, the crew bonus
//   badges for Jordan, and opted-in leaderboard people with this month's points
//   community donations to Negril's Hurricane Melissa cause
// Re-running replaces the previous batch.
//   npm run seed:rewards
import { PrismaClient, type City } from '@prisma/client'
import { assertSeedAllowed } from '../prisma/seed-guard'
import { ROTATING_QR_COST } from '../lib/earn-config'

const prisma = new PrismaClient()
const DAY = 86400000
const ago = (days: number, hour = 14) => { const d = new Date(Date.now() - days * DAY); d.setUTCHours(hour + 5, (days * 17) % 60, 0, 0); return d.getTime() > Date.now() ? new Date(Date.now() - 3600000) : d }
const code = (s: string) => `ETA-${s}`

const MOCK_PEOPLE: Array<{ name: string; month: number; lifetime: number; donated: number }> = [
  { name: 'Aaliyah Brown', month: 2420, lifetime: 7150, donated: 18000 },
  { name: 'Marco Rossi', month: 1860, lifetime: 4300, donated: 9500 },
  { name: 'Sophie Müller', month: 1490, lifetime: 2980, donated: 14500 },
  { name: 'Tyrone Campbell', month: 980, lifetime: 6400, donated: 22000 },
  { name: 'Emma Clarke', month: 760, lifetime: 1720, donated: 6000 },
  { name: 'Lucas Martin', month: 515, lifetime: 940, donated: 3500 },
  { name: 'Kezia Williams', month: 410, lifetime: 2210, donated: 12000 },
  { name: 'Daniel Ortiz', month: 265, lifetime: 610, donated: 2500 },
  { name: 'Priya Shah', month: 120, lifetime: 380, donated: 1000 }
]

async function vendorId(name: string): Promise<string | null> {
  return (await prisma.vendor.findFirst({ where: { name }, select: { id: true } }))?.id ?? null
}

async function main() {
  assertSeedAllowed('seed:rewards')
  const jordan = await prisma.user.findUnique({ where: { email: 'jordan@eta.app' }, select: { id: true } })
  if (!jordan) throw new Error('Jordan (jordan@eta.app) is missing — run the main seed first.')

  // ---------- Clear the previous batch ----------
  const oldRewards = (await prisma.reward.findMany({ where: { isMock: true, id: { startsWith: 'rw-' } }, select: { id: true } })).map(r => r.id)
  await prisma.redemption.deleteMany({ where: { rewardId: { in: oldRewards } } })
  await prisma.reward.deleteMany({ where: { id: { in: oldRewards } } })
  await prisma.boost.deleteMany({ where: { isMock: true } })
  await prisma.pointsLedger.deleteMany({ where: { isMock: true } })
  await prisma.donation.deleteMany({ where: { isMock: true } })
  await prisma.userBadge.deleteMany({ where: { isMock: true } })
  // Only this script's leaderboard people (seed-market-moments has its own locals).
  await prisma.user.deleteMany({ where: { isMock: true, email: { startsWith: 'mock-board-' } } })

  // ---------- Vendors we hang perks and boosts on ----------
  const v = {
    pushcart: await vendorId('Pushcart Restaurant & Rum Bar'),
    borderJerk: await vendorId('Border Jerk'),
    rockhouse: await vendorId('Rockhouse Restaurant'),
    threeDives: await vendorId('3 Dives Restaurant & Cliff Bar'),
    xtabi: await vendorId('Xtabi'),
    bestWest: await vendorId('Best in the West Jerk Centre'),
    spa: await vendorId('Ocean View Spa'),
    ivans: await vendorId("Ivan's Bar & Restaurant"),
    mobay: (await prisma.vendor.findFirst({ where: { city: 'MONTEGO_BAY' }, orderBy: { name: 'asc' }, select: { id: true } }))?.id ?? null
  }
  const ev = async (title: string) => prisma.event.findFirst({ where: { title, isMock: true }, select: { id: true, startAt: true } })
  const fullMoon = await ev('Full Moon Beach Party')
  const dancehall = await ev('Dancehall Friday')
  if (fullMoon) await prisma.event.update({ where: { id: fullMoon.id }, data: { earlyAccessUntil: new Date(Math.min(fullMoon.startAt.getTime() - DAY, Date.now() + 2 * DAY)) } })

  // ---------- Rewards ----------
  type R = { id: string; name: string; description: string; cost: number; icon: string; category: string; city: City | null; vendors: Array<string | null>; minTier?: string; audience?: string; eventId?: string | null; dailyCap?: number; monthlyBudget?: number; validDays?: number; kind?: string }
  const rewards: R[] = [
    { id: 'rw-pushcart-rum', name: 'Free rum punch at Pushcart', description: 'One house rum punch on the deck at sunset.', cost: 300, icon: 'glass', category: 'vendor', city: 'NEGRIL', vendors: [v.pushcart], dailyCap: 15, monthlyBudget: 200 },
    { id: 'rw-border-jerk', name: 'Free quarter chicken at Border Jerk', description: 'A quarter jerk chicken with festival, off the pan.', cost: 450, icon: 'food', category: 'vendor', city: 'NEGRIL', vendors: [v.borderJerk], dailyCap: 10, monthlyBudget: 150 },
    { id: 'rw-spa-upgrade', name: 'Free 15-minute massage upgrade', description: 'Add 15 minutes to any massage at Ocean View Spa.', cost: 500, icon: 'spa', category: 'vendor', city: 'NEGRIL', vendors: [v.spa], dailyCap: 6, monthlyBudget: 80 },
    { id: 'rw-explorer-cliff', name: 'Cliff-jump photo pack at 3 Dives', description: 'Their photographer shoots your jump — five edited shots.', cost: 600, icon: 'camera', category: 'insider', city: 'NEGRIL', vendors: [v.threeDives], minTier: 'EXPLORER', dailyCap: 8, monthlyBudget: 120 },
    { id: 'rw-insider-sunset', name: 'Sunset table at Rockhouse', description: 'A held cliff-edge table for sunset, no booking needed.', cost: 900, icon: 'sun', category: 'insider', city: 'NEGRIL', vendors: [v.rockhouse], minTier: 'INSIDER', dailyCap: 4, monthlyBudget: 60 },
    { id: 'rw-yaadie-xtabi', name: 'Yaadie cliff dinner for two at Xtabi', description: 'Three courses for two in the cave-top dining room. Top B.O.N perk.', cost: 2500, icon: 'crown', category: 'insider', city: 'NEGRIL', vendors: [v.xtabi], minTier: 'YAADIE', dailyCap: 2, monthlyBudget: 20, validDays: 60 },
    { id: 'rw-event-fullmoon', name: 'Early access: Full Moon Beach Party', description: 'Buy tickets before they open to everyone, plus a welcome drink.', cost: 400, icon: 'ticket', category: 'events', city: 'NEGRIL', vendors: [], minTier: 'INSIDER', eventId: fullMoon?.id ?? null, dailyCap: 20, monthlyBudget: 150 },
    { id: 'rw-event-vip-dancehall', name: 'VIP entry: Dancehall Friday', description: 'Skip the line, VIP deck and a bottle service credit.', cost: 1500, icon: 'party', category: 'events', city: 'NEGRIL', vendors: [], minTier: 'YAADIE', eventId: dancehall?.id ?? null, dailyCap: 5, monthlyBudget: 40 },
    { id: 'rw-eta-ride', name: 'J$1,000 off your next ride', description: 'Off any ETA airport transfer or licensed taxi booking.', cost: 400, icon: 'car', category: 'eta', city: null, vendors: [], dailyCap: 50, monthlyBudget: 600 },
    { id: 'rw-eta-experience', name: '15% off any experience', description: 'Your next ETA experience booking, any town.', cost: 700, icon: 'sparkle', category: 'eta', city: null, vendors: [], dailyCap: 40, monthlyBudget: 500 },
    { id: 'rw-local-festival', name: 'Locals’ Friday: free festival', description: 'A free festival with any jerk plate, Fridays. For locals.', cost: 150, icon: 'food', category: 'vendor', city: 'NEGRIL', vendors: [v.bestWest], audience: 'local', dailyCap: 25, monthlyBudget: 300 },
    { id: 'rw-mobay-perk', name: 'Free welcome drink in MoBay', description: 'A cold welcome drink on your first visit.', cost: 250, icon: 'glass', category: 'vendor', city: 'MONTEGO_BAY', vendors: [v.mobay], dailyCap: 15, monthlyBudget: 200 },
    { id: 'rw-wb-insider-negril', name: 'Insider welcome back: sunset sail for two', description: 'Welcome back — a sunset sail for two, on us.', cost: 0, icon: 'wave', category: 'eta', city: 'NEGRIL', vendors: [], kind: 'welcome_back_insider', validDays: 14 }
  ]
  for (let i = 0; i < rewards.length; i++) {
    const r = rewards[i]
    await prisma.reward.create({
      data: {
        id: r.id, name: r.name, description: r.description, cost: r.cost, icon: r.icon, category: r.category, city: r.city,
        minTier: r.minTier ?? null, audience: r.audience ?? 'all', eventId: r.eventId ?? null, kind: r.kind ?? 'catalog',
        dailyCap: r.dailyCap ?? 20, monthlyBudget: r.monthlyBudget ?? 300, validDays: r.validDays ?? 30,
        rotatingQr: r.cost >= ROTATING_QR_COST, sortOrder: 100 + i, isMock: true,
        vendors: { create: r.vendors.filter((x: string | null): x is string => Boolean(x)).map((vendorId: string) => ({ vendorId })) }
      }
    })
  }

  // ---------- Boosts ----------
  const quiet = [
    { vendor: v.pushcart, start: 14 * 60, end: 17 * 60, x: 2 },
    { vendor: v.xtabi, start: 15 * 60, end: 17 * 60 + 30, x: 2 },
    { vendor: v.borderJerk, start: 11 * 60, end: 13 * 60, x: 1.5 },
    { vendor: v.ivans, start: 16 * 60, end: 18 * 60, x: 2 },
    { vendor: v.mobay, start: 14 * 60, end: 16 * 60, x: 2 }
  ]
  for (const q of quiet) {
    if (!q.vendor) continue
    const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    await prisma.boost.create({ data: { kind: 'quiet_hour', title: `${q.x}× points ${hh(q.start)}–${hh(q.end)}`, multiplier: q.x, startMin: q.start, endMin: q.end, vendorId: q.vendor, isMock: true } })
  }
  for (const city of ['NEGRIL', 'MONTEGO_BAY', 'OCHO_RIOS', 'PORT_ANTONIO', 'KINGSTON'] as City[]) {
    await prisma.boost.create({ data: { kind: 'rainy_day', title: '2× at indoor spots on rainy days', multiplier: 2, city, isMock: true } })
  }
  await prisma.boost.create({ data: { kind: 'crew', title: 'Crew bonus', multiplier: 1, bonus: 25, city: null, isMock: true } })

  // ---------- Jordan: Insider, 3,420 lifetime, 2,180 to spend ----------
  const negril = (await prisma.vendor.findMany({ where: { city: 'NEGRIL', isMock: false }, select: { id: true }, orderBy: { name: 'asc' }, take: 20 })).map(x => x.id)
  const earns: Array<[string, number, number]> = [
    // [reason, points, days ago] — 3,420 in all, about 1,100 of it this month
    ['qr_first_visit', 60, 1], ['qr_first_visit', 60, 1], ['boost_quiet_hour', 60, 1], ['qr_repeat_visit', 15, 2], ['payment', 240, 2],
    ['qr_first_visit', 60, 3], ['review', 20, 3], ['secret_spot', 100, 4], ['streak3', 50, 4], ['qr_first_visit', 60, 5],
    ['story_tag', 30, 5], ['crew_bonus', 25, 6], ['qr_repeat_visit', 15, 6], ['boost_rainy_day', 60, 6], ['qr_repeat_visit', 15, 6],
    ['booking', 195, 6], ['review', 20, 6],
    ['qr_first_visit', 60, 9], ['payment', 160, 9], ['qr_first_visit', 60, 10], ['qr_repeat_visit', 15, 10], ['secret_spot', 100, 11],
    ['quest_complete', 250, 11], ['qr_first_visit', 60, 12], ['payment', 110, 12], ['review', 20, 12], ['qr_repeat_visit', 15, 13],
    ['streak3', 50, 13], ['qr_first_visit', 60, 14], ['booking', 280, 15], ['referral', 150, 15], ['qr_first_visit', 60, 16],
    ['boost_quiet_hour', 60, 16], ['qr_repeat_visit', 15, 17], ['payment', 300, 18], ['secret_spot', 100, 18], ['qr_first_visit', 60, 19],
    ['review', 20, 19], ['story_tag', 30, 20], ['crew_bonus', 25, 20], ['qr_repeat_visit', 15, 21], ['qr_first_visit', 60, 21],
    ['qr_repeat_visit', 15, 22], ['qr_repeat_visit', 15, 22], ['review', 20, 23], ['qr_repeat_visit', 15, 24],
    ['qr_first_visit', 60, 24], ['qr_repeat_visit', 15, 25], ['qr_first_visit', 60, 25]
  ]
  const earned = earns.reduce((n, e) => n + e[1], 0)
  if (earned !== 3420) throw new Error(`Jordan's mock earns add up to ${earned}, not 3,420`)
  await prisma.pointsLedger.createMany({
    data: earns.map(([reason, points, days], i) => ({
      userId: jordan.id, points, kind: 'earn', reason, sourceType: 'mock', sourceId: `mock-${i}`, city: 'NEGRIL' as City,
      vendorId: ['qr_first_visit', 'qr_repeat_visit', 'payment', 'review', 'boost_quiet_hour', 'story_tag'].includes(reason) ? negril[i % negril.length] ?? null : null,
      isMock: true, createdAt: ago(days, 10 + (i % 9))
    }))
  })
  // Spent 1,240: two vouchers and a donation.
  const now = Date.now()
  const rum = await prisma.redemption.create({ data: { userId: jordan.id, rewardId: 'rw-pushcart-rum', rewardName: 'Free rum punch at Pushcart', pointCost: 300, code: code('JRDN0RUM'), expiresAt: new Date(now + 12 * DAY), createdAt: ago(2, 18) } })
  const ride = await prisma.redemption.create({ data: { userId: jordan.id, rewardId: 'rw-eta-ride', rewardName: 'J$1,000 off your next ride', pointCost: 400, code: code('JRDNRIDE'), status: 'USED', usedAt: ago(8, 11), expiresAt: new Date(now + 20 * DAY), createdAt: ago(10, 9) } })
  const cause = await prisma.cause.findFirst({ where: { city: 'NEGRIL', active: true } })
  const gift = cause ? await prisma.donation.create({ data: { causeId: cause.id, userId: jordan.id, points: 540, isMock: true, createdAt: ago(7, 20) } }) : null
  await prisma.pointsLedger.createMany({
    data: [
      { userId: jordan.id, points: -300, kind: 'spend', reason: 'redeem', sourceType: 'redemption', sourceId: rum.id, city: 'NEGRIL', isMock: true, createdAt: rum.createdAt },
      { userId: jordan.id, points: -400, kind: 'spend', reason: 'redeem', sourceType: 'redemption', sourceId: ride.id, city: 'NEGRIL', isMock: true, createdAt: ride.createdAt },
      ...(gift ? [{ userId: jordan.id, points: -540, kind: 'donate', reason: 'donate', sourceType: 'donation', sourceId: gift.id, city: 'NEGRIL' as City, isMock: true, createdAt: gift.createdAt }] : [])
    ]
  })
  await prisma.user.update({ where: { id: jordan.id }, data: { lifetimePoints: 3420, points: 2180, tierSeen: 'INSIDER', leaderboardOptIn: true } })
  await prisma.userBadge.createMany({ data: [{ userId: jordan.id, key: 'sunsetChaser', isMock: true, earnedAt: ago(9, 18) }, { userId: jordan.id, key: 'secretSpots', isMock: true, earnedAt: ago(4, 15) }, { userId: jordan.id, key: 'giveBack', isMock: true, earnedAt: ago(7, 20) }], skipDuplicates: true })

  // ---------- Leaderboard people (opted in) + community donations ----------
  for (let i = 0; i < MOCK_PEOPLE.length; i++) {
    const p = MOCK_PEOPLE[i]
    const u = await prisma.user.create({
      data: { email: `mock-board-${i + 1}@eta.test`, name: p.name, isMock: true, leaderboardOptIn: true, city: 'NEGRIL', lifetimePoints: p.lifetime, points: Math.max(0, p.lifetime - p.month - p.donated / 10), tierSeen: 'VISITOR', emailVerifiedAt: new Date() }
    })
    const parts = [0.45, 0.35, 0.2]
    await prisma.pointsLedger.createMany({
      data: parts.map((f, k) => ({ userId: u.id, points: Math.round(p.month * f), kind: 'earn', reason: k === 1 ? 'payment' : 'qr_first_visit', sourceType: 'mock', sourceId: `mock-${k}`, city: 'NEGRIL' as City, isMock: true, createdAt: ago(k + 1 + (i % 3), 12 + k) }))
    })
    if (cause) await prisma.donation.create({ data: { causeId: cause.id, userId: u.id, points: p.donated, isMock: true, createdAt: ago(3 + i, 19) } })
  }
  if (cause) {
    const raised = await prisma.donation.aggregate({ where: { causeId: cause.id }, _sum: { points: true } })
    await prisma.cause.update({ where: { id: cause.id }, data: { raisedPoints: raised._sum.points ?? 0 } })
  }

  console.log(`Rewards demo: ${rewards.length} rewards, ${quiet.filter(q => q.vendor).length + 6} boosts, Jordan at Insider (3,420 lifetime / 2,180 to spend), ${MOCK_PEOPLE.length} leaderboard people.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
