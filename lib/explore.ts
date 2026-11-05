// lib/explore.ts — Explore mode, the game (app/explore). Everything here is
// computed from the account, so progress follows you across phones:
//   progress     places found in the town (QR visits, photo-spot check-ins,
//                discoveries) out of everything there, and the fog cleared
//                around them
//   secret spots hidden gems & co. (lib/hidden-gems.ts). Until you're within
//                REVEAL_RADIUS_M the app only ever gets a rough zone (offset
//                from the spot by a secret, stable amount) and a distance
//                band for warmer/colder. Walking into range reveals it, pays
//                discovery points and records the Discovery.
//   quests       trails of checkpoints with a clue each; a checkpoint's
//                location is never sent before it's reached (GPS within its
//                radius, or scanning its vendor's QR card)
//   perks        explorer-only rewards (Reward.kind "explorer"): unlocked by
//                scanning that vendor's QR after reaching it through Explore
//                mode or a quest; never shown on Discover or vendor pages
//   badges       progress toward Beach hopper, Jerk hunter, Gem finder...
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { GEM_DISCOVERY_POINTS, REVEAL_RADIUS_M, distanceM, type GemCategoryKey } from '@/lib/hidden-gems'
import { streaks } from '@/lib/passport'
import { townFor, type CityCode } from '@/lib/regions'
import { jwtSecret } from '@/lib/auth-server'

export const EXPLORER_KIND = 'explorer'
/** How far from the town centre Explore mode covers. */
export const EXPLORE_RADIUS_KM = 20
/** The rough "secret spot somewhere here" circle. */
export const ZONE_RADIUS_M = 250
/** Distance bands for warmer/colder: 0 is in range (revealed). */
export const BANDS_M = [REVEAL_RADIUS_M, 200, 350, 600, 1200]
export const CHECKPOINT_POINTS = 15
/** An explorer perk needs the QR scan within this long of an Explore session near the vendor. */
const PERK_SESSION_MS = 3 * 3600000
const PERK_SESSION_M = 1500

const OFFSET = 5 * 3600000
const dayKey = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10)

export function band(distM: number): number {
  const i = BANDS_M.findIndex(b => distM <= b)
  return i === -1 ? BANDS_M.length : i
}

/**
 * The zone shown for a secret spot: a circle that contains the spot, centred
 * somewhere else inside it. The offset comes from a keyed hash, so it's the
 * same on every request and can't be averaged away.
 */
export function zoneFor(gem: { id: string; lat: number; lng: number }) {
  const h = crypto.createHmac('sha256', jwtSecret()).update(`zone:${gem.id}`).digest()
  const angle = (h.readUInt16BE(0) / 65535) * Math.PI * 2
  const dist = ZONE_RADIUS_M * (0.3 + (h.readUInt16BE(2) / 65535) * 0.4)
  const dLat = (dist * Math.cos(angle)) / 110540
  const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos((gem.lat * Math.PI) / 180))
  return { lat: gem.lat + dLat, lng: gem.lng + dLng, radiusM: ZONE_RADIUS_M }
}

function nearTown(city: CityCode) {
  const town = townFor(city)
  const d = EXPLORE_RADIUS_KM / 111
  return { town, box: { lat: { gte: town.lat - d, lte: town.lat + d }, lng: { gte: town.lng - d * 1.06, lte: town.lng + d * 1.06 } } }
}

function secretSpotsNear(city: CityCode) {
  const { box } = nearTown(city)
  return prisma.hiddenGem.findMany({ where: { status: { not: 'REJECTED' }, hidden: false, ...box } })
}

// ---------- Badges ----------

export interface ExploreBadge { key: string; progress: number; target: number; earned: boolean }

const JERK = /jerk/i

// ---------- State ----------

export interface SecretSpotView {
  id: string
  category: GemCategoryKey
  found: boolean
  /** Only once found (or your own). */
  name?: string
  description?: string
  photos?: string[]
  lat?: number
  lng?: number
  status?: 'PENDING' | 'VERIFIED' | 'REJECTED'
  /** Before it's found: the rough zone. */
  zone?: { lat: number; lng: number; radiusM: number }
}

export async function exploreState(userId: string, city: CityCode) {
  const { town, box } = nearTown(city)
  const [vendors, spots, gems, discoveries, checkIns, quests, perks] = await Promise.all([
    prisma.vendor.findMany({ where: { city, visibleOnMap: true, isTransport: false }, select: { id: true, name: true, description: true, category: true, lat: true, lng: true } }),
    prisma.photoSpot.findMany({ where: { city }, select: { id: true, lat: true, lng: true } }),
    secretSpotsNear(city),
    prisma.discovery.findMany({ where: { userId }, select: { vendorId: true, photoSpotId: true, hiddenGemId: true } }),
    prisma.checkIn.findMany({ where: { userId }, select: { createdAt: true, lat: true, lng: true, vendorId: true, photoSpotId: true } }),
    prisma.quest.findMany({
      where: { city, active: true },
      orderBy: { createdAt: 'asc' },
      include: {
        checkpoints: { orderBy: { order: 'asc' }, select: { id: true, order: true, name: true, clue: true, lat: true, lng: true } },
        progress: { where: { userId } },
        vendor: { select: { name: true } }
      }
    }),
    prisma.reward.findMany({
      where: { kind: EXPLORER_KIND, active: true, OR: [{ city }, { city: null }] },
      include: { vendors: { include: { vendor: { select: { id: true, name: true, city: true } } } } }
    })
  ])

  const foundVendors = new Set(discoveries.map(d => d.vendorId).filter(Boolean) as string[])
  checkIns.forEach(c => c.vendorId && foundVendors.add(c.vendorId))
  const foundSpots = new Set(discoveries.map(d => d.photoSpotId).filter(Boolean) as string[])
  checkIns.forEach(c => c.photoSpotId && foundSpots.add(c.photoSpotId))
  const foundGems = new Set(discoveries.map(d => d.hiddenGemId).filter(Boolean) as string[])

  const townVendors = vendors.filter(v => foundVendors.has(v.id))
  const townSpots = spots.filter(s => foundSpots.has(s.id))
  const townGems = gems.filter(g => foundGems.has(g.id))
  const total = vendors.length + spots.length + gems.length
  const found = townVendors.length + townSpots.length + townGems.length

  // The fog lifts around everything you've found and everywhere you checked in.
  const inBox = (p: { lat: number | null; lng: number | null }) => p.lat !== null && p.lng !== null && p.lat >= box.lat.gte && p.lat <= box.lat.lte && p.lng >= box.lng.gte && p.lng <= box.lng.lte
  const cleared = [
    ...townVendors, ...townSpots, ...townGems,
    ...checkIns.filter(inBox).map(c => ({ lat: c.lat!, lng: c.lng! }))
  ].map(p => ({ lat: Math.round(p.lat * 1e4) / 1e4, lng: Math.round(p.lng * 1e4) / 1e4 }))

  const secretSpots: SecretSpotView[] = gems.map(g => (foundGems.has(g.id) || g.submittedByUserId === userId
    ? { id: g.id, category: g.category, found: foundGems.has(g.id), name: g.name, description: g.description, photos: g.photos, lat: g.lat, lng: g.lng, status: g.status }
    : { id: g.id, category: g.category, found: false, zone: zoneFor(g) }))

  const questViews = quests.map(q => {
    const p = q.progress[0] ?? null
    const reached = p?.reached ?? 0
    const next = q.checkpoints[reached] ?? null
    return {
      id: q.id,
      slug: q.slug,
      title: q.title,
      description: q.description,
      badgeName: q.badgeName,
      rewardPoints: q.rewardPoints,
      sponsor: q.vendor?.name ?? null,
      total: q.checkpoints.length,
      reached,
      started: Boolean(p),
      completed: Boolean(p?.completedAt),
      // Reached checkpoints are yours to see; the next one is only a clue.
      reachedCheckpoints: q.checkpoints.slice(0, reached).map(c => ({ order: c.order, name: c.name, lat: c.lat, lng: c.lng })),
      nextClue: p && !p.completedAt && next ? { order: next.order, clue: next.clue } : null
    }
  })

  const completedQuests = await prisma.questProgress.count({ where: { userId, completedAt: { not: null } } })
  const allFoundVendors = await prisma.vendor.findMany({ where: { id: { in: Array.from(foundVendors) } }, select: { category: true, name: true, description: true } })
  const allFoundGems = await prisma.discovery.count({ where: { userId, hiddenGemId: { not: null } } })
  const badge = (key: string, progress: number, target: number): ExploreBadge => ({ key, progress: Math.min(progress, target), target, earned: progress >= target })
  const badges: ExploreBadge[] = [
    badge('beachHopper', allFoundVendors.filter(v => v.category === 'BEACH').length, 5),
    badge('jerkHunter', allFoundVendors.filter(v => JERK.test(v.name) || JERK.test(v.description)).length, 10),
    badge('gemFinder', allFoundGems, 3),
    badge('shutterbug', foundSpots.size, 5),
    badge('questMaster', completedQuests, 3)
  ]
  const questBadges = questViews.filter(q => q.completed).map(q => q.badgeName)

  const myPerks = await prisma.redemption.findMany({ where: { userId, rewardId: { in: perks.map(p => p.id) } }, select: { rewardId: true, code: true, status: true, expiresAt: true } })
  const perkViews = perks
    .filter(p => !p.vendors.length || p.vendors.some(v => v.vendor.city === city))
    .map(p => {
      const mine = myPerks.find(m => m.rewardId === p.id)
      return { id: p.id, name: p.name, description: p.description, icon: p.icon, vendors: p.vendors.map(v => v.vendor.name), unlocked: Boolean(mine), code: mine?.code ?? null, status: mine?.status ?? null, expiresAt: mine?.expiresAt ?? null }
    })

  const { current } = streaks(new Set(checkIns.map(c => dayKey(c.createdAt))))
  return {
    town: { city, name: town.name, lat: town.lat, lng: town.lng },
    stats: { found, total, pct: total ? Math.round((found / total) * 100) : 0, streak: current, secretFound: townGems.length, secretTotal: gems.length },
    cleared,
    secretSpots,
    quests: questViews,
    badges,
    questBadges,
    perks: perkViews
  }
}

// ---------- Moving around ----------

async function awardPoints(userId: string, points: number) {
  if (points > 0) await prisma.user.update({ where: { id: userId }, data: { points: { increment: points } } })
}

/** Records a checkpoint and moves the quest on; finishing pays out. */
export async function reachCheckpoint(progressId: string, checkpointId: string, method: 'gps' | 'qr') {
  const progress = await prisma.questProgress.findUnique({
    where: { id: progressId },
    include: { quest: { include: { checkpoints: { orderBy: { order: 'asc' }, select: { id: true, name: true } } } } }
  })
  if (!progress || progress.completedAt) return null
  const expected = progress.quest.checkpoints[progress.reached]
  if (!expected || expected.id !== checkpointId) return null
  const reached = progress.reached + 1
  const completed = reached >= progress.quest.checkpoints.length
  // Conditional on the count we read, so two pings can't both advance it.
  const moved = await prisma.questProgress.updateMany({ where: { id: progressId, reached: progress.reached, completedAt: null }, data: { reached, ...(completed ? { completedAt: new Date() } : {}) } })
  if (!moved.count) return null
  await prisma.questCheckpointHit.create({ data: { progressId, checkpointId, method } }).catch(() => {})
  let points = CHECKPOINT_POINTS
  let perk: { name: string; code: string } | null = null
  if (completed) {
    points += progress.quest.rewardPoints
    if (progress.quest.rewardId) perk = await issuePerk(progress.userId, progress.quest.rewardId)
  }
  await awardPoints(progress.userId, points)
  return { questId: progress.questId, title: progress.quest.title, checkpoint: expected.name, reached, total: progress.quest.checkpoints.length, completed, badgeName: completed ? progress.quest.badgeName : null, points, perk }
}

async function issuePerk(userId: string, rewardId: string): Promise<{ name: string; code: string } | null> {
  const reward = await prisma.reward.findFirst({ where: { id: rewardId, kind: EXPLORER_KIND, active: true } })
  if (!reward) return null
  const existing = await prisma.redemption.findFirst({ where: { userId, rewardId } })
  if (existing) return null
  const r = await prisma.redemption.create({
    data: { userId, rewardId, rewardName: reward.name, pointCost: 0, code: `ETA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, expiresAt: new Date(Date.now() + reward.validDays * 86400000) }
  })
  return { name: r.rewardName, code: r.code }
}

/**
 * A position fix from Explore mode: remembers the session (for explorer
 * perks), reveals secret spots in range, advances the active quest, and
 * returns the band of the nearest unfound spot for warmer/colder.
 */
export async function explorePing(userId: string, city: CityCode, pos: { lat: number; lng: number }) {
  await prisma.user.update({ where: { id: userId }, data: { exploreLastAt: new Date(), exploreLastLat: pos.lat, exploreLastLng: pos.lng } })
  const [gems, discovered, progress] = await Promise.all([
    secretSpotsNear(city),
    prisma.discovery.findMany({ where: { userId, hiddenGemId: { not: null } }, select: { hiddenGemId: true } }),
    prisma.questProgress.findMany({ where: { userId, completedAt: null }, include: { quest: { include: { checkpoints: { orderBy: { order: 'asc' } } } } } })
  ])
  const found = new Set(discovered.map(d => d.hiddenGemId))
  const revealed: Array<{ id: string; name: string; points: number }> = []
  let nearest: number | null = null
  for (const g of gems) {
    if (found.has(g.id) || g.submittedByUserId === userId) continue
    const d = distanceM(pos, g)
    if (d <= REVEAL_RADIUS_M) {
      try {
        await prisma.discovery.create({ data: { userId, hiddenGemId: g.id, type: 'SECRET_SPOT', points: GEM_DISCOVERY_POINTS } })
        await awardPoints(userId, GEM_DISCOVERY_POINTS)
        revealed.push({ id: g.id, name: g.name, points: GEM_DISCOVERY_POINTS })
      } catch {}
    } else if (nearest === null || d < nearest) nearest = d
  }

  const quests = []
  for (const p of progress) {
    const next = p.quest.checkpoints[p.reached]
    if (next && distanceM(pos, next) <= next.radiusM) {
      const hit = await reachCheckpoint(p.id, next.id, 'gps')
      if (hit) quests.push(hit)
    }
  }
  return { revealed, quests, band: nearest === null ? null : band(nearest) }
}

/**
 * After a QR visit: a quest checkpoint at that vendor counts, and explorer
 * perks there unlock when the visit came through Explore mode (a recent
 * Explore session near the vendor) or a quest.
 */
export async function onExploreScan(userId: string, vendor: { id: string; lat: number; lng: number }, via: string | null) {
  const progress = await prisma.questProgress.findMany({ where: { userId, completedAt: null }, include: { quest: { include: { checkpoints: { orderBy: { order: 'asc' } } } } } })
  const quests = []
  for (const p of progress) {
    const next = p.quest.checkpoints[p.reached]
    if (next?.vendorId === vendor.id) {
      const hit = await reachCheckpoint(p.id, next.id, 'qr')
      if (hit) quests.push(hit)
    }
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { exploreLastAt: true, exploreLastLat: true, exploreLastLng: true } })
  const viaExplore = via === 'explore' && user?.exploreLastAt && Date.now() - user.exploreLastAt.getTime() <= PERK_SESSION_MS
    && user.exploreLastLat !== null && user.exploreLastLng !== null && distanceM({ lat: user.exploreLastLat, lng: user.exploreLastLng }, vendor) <= PERK_SESSION_M
  const viaQuest = quests.length > 0 || (await prisma.questCheckpointHit.count({ where: { progress: { userId }, checkpoint: { vendorId: vendor.id } } })) > 0
  const perks: Array<{ name: string; code: string }> = []
  if (viaExplore || viaQuest) {
    const rewards = await prisma.reward.findMany({ where: { kind: EXPLORER_KIND, active: true, vendors: { some: { vendorId: vendor.id } } }, select: { id: true } })
    for (const r of rewards) {
      const p = await issuePerk(userId, r.id)
      if (p) perks.push(p)
    }
  }
  return { quests, perks }
}
