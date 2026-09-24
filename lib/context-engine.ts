import type { WeatherNow } from '@/lib/weather'

interface BounceSuggestion {
  title: string
  desc: string
  icon: string
  action: 'vendor' | 'map' | 'experiences'
  vendorId?: string
  /** Why this suggestion won — surfaced in the UI so weather-driven picks are explainable. */
  reason?: 'weather' | 'time' | 'activity' | 'default'
}

export interface SuggestionVendor {
  id: string
  name: string
  category: string
  open: boolean
  live: boolean
  whoThere: number
  isPremium: boolean
}

interface BounceExtras {
  /** Live conditions from lib/weather.ts. Overrides `tempC` when present. */
  weather?: WeatherNow | null
  /** Real, currently-listed vendors to point suggestions at. */
  vendors?: SuggestionVendor[]
}

// Which categories keep you out of the rain. Restaurants and spas are
// roofed; beaches and watersports are not. Bars are left neutral — many in
// Negril are open-air — so they're only picked for rain as a last resort.
const COVERED = ['FOOD', 'WELLNESS']
const OUTDOOR = ['BEACH', 'ACTIVITY']

function best(vendors: SuggestionVendor[], categories: string[]): SuggestionVendor | undefined {
  return vendors
    .filter(v => v.open && categories.includes(v.category))
    .sort((a, b) => Number(b.live) - Number(a.live) || b.whoThere - a.whoThere || Number(b.isPremium) - Number(a.isPremium))[0]
}

function crowd(v: SuggestionVendor): string {
  return v.live && v.whoThere > 0 ? `${v.whoThere} here now.` : 'Open now.'
}

export function getBounceSuggestion(
  currentVendorCategory: string | null,
  userLocation: { lat: number; lng: number } | null,
  hour: number = new Date().getHours(),
  tempC: number = 28,
  justBoughtFood: boolean = false,
  atVendorForHours: number = 0,
  extras: BounceExtras = {}
): BounceSuggestion {
  const weather = extras.weather ?? null
  const vendors = extras.vendors ?? []
  const temp = weather?.tempC ?? tempC
  const wet = weather?.isRaining ?? false

  // Weather first: rain changes everything on an island built around the outdoors.
  if (weather?.condition === 'storm') {
    const spot = best(vendors, COVERED)
    return spot
      ? { title: 'Storm passing through', desc: `Sit it out at ${spot.name} — roof overhead. ${crowd(spot)}`, icon: 'moon', action: 'vendor', vendorId: spot.id, reason: 'weather' }
      : { title: 'Storm passing through', desc: 'Stay off the water and cliffs until it clears.', icon: 'moon', action: 'experiences', reason: 'weather' }
  }

  if (wet) {
    const covered = best(vendors, currentVendorCategory && COVERED.includes(currentVendorCategory) ? COVERED.filter(c => c !== currentVendorCategory).concat(currentVendorCategory) : COVERED)
    const fallback = covered ?? best(vendors, ['DRINKS'])
    return fallback
      ? { title: 'Rain a fall', desc: `Duck into ${fallback.name} — covered and open. ${crowd(fallback)}`, icon: 'food', action: 'vendor', vendorId: fallback.id, reason: 'weather' }
      : { title: 'Rain a fall', desc: 'Good time for a long lunch indoors.', icon: 'food', action: 'experiences', reason: 'weather' }
  }

  if (weather?.rainSoon && hour >= 8 && hour <= 18 && (!currentVendorCategory || OUTDOOR.includes(currentVendorCategory))) {
    const outdoor = best(vendors, OUTDOOR)
    return {
      title: 'Rain coming soon',
      desc: outdoor ? `Hit ${outdoor.name} now, then head somewhere covered.` : 'Do the beach now — showers expected within the next couple of hours.',
      icon: 'wave',
      action: outdoor ? 'vendor' : 'map',
      vendorId: outdoor?.id,
      reason: 'weather'
    }
  }

  // Sunset viewpoint — timed off today's real sunset when we have it, and
  // skipped when the sky is too overcast to see it.
  const sunsetIn = weather?.sunsetAt ? Math.round((new Date(weather.sunsetAt).getTime() - Date.now()) / 60000) : null
  const skyOk = weather?.condition !== 'fog' && weather?.condition !== 'cloudy'
  if (skyOk && (sunsetIn !== null ? sunsetIn > 0 && sunsetIn <= 120 : hour >= 17 && hour <= 19)) {
    return {
      title: sunsetIn !== null ? `Sunset in ${sunsetIn} min` : 'Sunset soon',
      desc: 'Head west — the cliffs and Seven Mile Beach both face it.',
      icon: 'sun',
      action: 'map',
      reason: sunsetIn !== null ? 'weather' : 'time'
    }
  }

  // Just bought food → Spot with view nearby
  if (justBoughtFood) {
    return {
      title: 'Food with a view?',
      desc: '5 min away. Bring your plate.',
      icon: 'food',
      action: 'map',
      reason: 'activity'
    }
  }

  // Hour >= 20 → Night run, pointed at a bar that's actually live tonight
  if (hour >= 20) {
    const bar = best(vendors, ['DRINKS'])
    return bar
      ? { title: 'Night run loading', desc: `${bar.name} is ${bar.live ? 'live' : 'open'}. ${bar.live && bar.whoThere ? `${bar.whoThere} there now.` : ''}`.trim(), icon: 'moon', action: 'vendor', vendorId: bar.id, reason: 'time' }
      : { title: 'Night run loading', desc: 'See who\'s live on the map.', icon: 'moon', action: 'map', reason: 'time' }
  }

  // At vendor 2+ hours → Live music alert
  if (atVendorForHours >= 2) {
    return {
      title: 'Live music alert',
      desc: 'Something else is happening nearby.',
      icon: 'audio',
      action: 'map',
      reason: 'activity'
    }
  }

  // Scorching midday → shade and a cold coconut beats a cliff hike
  if (temp >= 31 && hour >= 11 && hour <= 15) {
    return {
      title: `${temp}° out there`,
      desc: 'Cold coconut and some shade before the next stop.',
      icon: 'drink',
      action: 'map',
      reason: 'weather'
    }
  }

  // Hour 10-16 → Cliffside morning
  if (hour >= 10 && hour <= 16) {
    return {
      title: 'Cliffside morning',
      desc: 'Yoga, breakfast, dip. 10 min away.',
      icon: 'activity',
      action: 'experiences',
      reason: 'time'
    }
  }

  // Walking 2+ hours AND temp >= 25 → Coconut vendor
  if (temp >= 25) {
    return {
      title: 'Coconut time',
      desc: 'Cold coconut nearby. 3 min walk.',
      icon: 'drink',
      action: 'map',
      reason: 'weather'
    }
  }

  // Default
  return {
    title: 'Explore the area',
    desc: 'Some spots only appear when close.',
    icon: 'compass',
    action: 'map',
    reason: 'default'
  }
}
