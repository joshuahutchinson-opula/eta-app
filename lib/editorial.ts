// lib/editorial.ts
// Destination guides (/web/guides/[slug]) and "best of" pages
// (/web/best/[slug]) are the same thing: written copy interleaved with live
// rows pulled from the database. Each page is a definition here; every
// "vendors" / "photospots" / "experiences" section carries a real query
// definition that components/web/EditorialTemplate.tsx executes at request
// time. Adding a page means adding an entry, not building a page.

import type { VendorFilter, VendorSort } from '@/lib/vendor-types'
import type { AreaSlug } from '@/lib/areas'

export type EditorialSection =
  | { type: 'copy'; heading?: string; body: string[] }
  | { type: 'vendors'; heading: string; intro?: string; filter: VendorFilter; sort?: VendorSort; limit?: number }
  | { type: 'photospots'; heading: string; intro?: string; city?: 'NEGRIL' | 'MONTEGO_BAY'; bestTimes?: string[]; limit?: number }
  | { type: 'experiences'; heading: string; intro?: string; city?: 'NEGRIL' | 'MONTEGO_BAY'; limit?: number }

export interface EditorialPage {
  slug: string
  kind: 'guide' | 'best'
  title: string
  eyebrow: string
  dek: string
  seoDescription: string
  area?: AreaSlug
  /** Vendor (by exact name) whose thumbnail is the panel image for this guide. */
  coverVendor?: string
  sections: EditorialSection[]
}

export const GUIDES: EditorialPage[] = [
  {
    slug: 'seven-mile-beach',
    kind: 'guide',
    area: 'seven-mile-beach',
    coverVendor: "Doctor's Cave Beach Bar",
    eyebrow: 'Negril guide',
    title: 'Seven Mile Beach',
    dek: 'The long curve of white sand that made Negril famous — calm water by day, beach bars and bonfires by night.',
    seoDescription: 'A first-timer’s guide to Negril’s Seven Mile Beach: where to eat, drink and get on the water, with live listings from local vendors.',
    sections: [
      {
        type: 'copy',
        body: [
          'Seven Mile Beach runs north from Negril town along Norman Manley Boulevard, with the sea on one side and a strip of hotels, guesthouses, bars and cookshops on the other. The water here is shallow, clear and usually calm, which is why nearly every watersport in Negril launches from this stretch of sand.',
          'You can walk most of it barefoot. The beach is public, and it’s normal to wander from one bar’s loungers to the next, stop for a patty, and keep going. Vendors will offer you everything from boat rides to jewellery — a friendly “no thanks” is all it takes.'
        ]
      },
      { type: 'vendors', heading: 'Get on the water', intro: 'Snorkel trips, glass-bottom boats, parasailing and rentals, all launching from the sand.', filter: { areas: ['seven-mile-beach'], categories: ['ACTIVITY'] }, sort: 'recommended', limit: 6 },
      {
        type: 'copy',
        heading: 'Eating and drinking on the beach',
        body: [
          'Beach bars here run from rum shacks with a sound system to full restaurants with a dance floor. Most serve food all day, and many turn into party spots after dark — check who’s live on ETA before you pick one.',
          'Jerk is never far away. Some of Negril’s best-known jerk centres sit just off the beach road, where a quarter chicken with festival and a cold drink is still one of the best-value meals in town.'
        ]
      },
      { type: 'vendors', heading: 'Beach bars', filter: { areas: ['seven-mile-beach'], categories: ['DRINKS', 'BEACH'] }, sort: 'trending', limit: 6 },
      { type: 'vendors', heading: 'Where to eat', filter: { areas: ['seven-mile-beach'], categories: ['FOOD', 'WELLNESS'] }, sort: 'rating', limit: 6 },
      {
        type: 'copy',
        heading: 'When to go',
        body: [
          'Mornings are the calmest time for snorkelling and paddleboarding, before the afternoon breeze picks up. Late afternoon belongs to sunset — the whole beach faces west, so any spot on the sand works.'
        ]
      },
      { type: 'photospots', heading: 'Photo spots nearby', city: 'NEGRIL', bestTimes: ['Morning', 'Dawn'], limit: 4 }
    ]
  },
  {
    slug: 'west-end',
    kind: 'guide',
    area: 'west-end',
    coverVendor: 'Rockhouse Restaurant',
    eyebrow: 'Negril guide',
    title: 'West End & the Cliffs',
    dek: 'No sand, all drama — limestone cliffs, ladders into deep blue water, and the best sunsets on the island.',
    seoDescription: 'A guide to Negril’s West End cliffs: cliff bars, jumping spots, sunset viewpoints and where to eat, with live listings from local vendors.',
    sections: [
      {
        type: 'copy',
        body: [
          'South of the roundabout, Negril changes completely. West End Road winds along low limestone cliffs, and instead of a beach you get ladders and platforms straight down into clear, deep water. It’s the part of Negril people come back for.',
          'The cliffs are dotted with small hotels, restaurants and bars that let you swim off their rocks. Cliff jumping is a West End tradition — only jump where locals do, check the depth first, and never after drinking.'
        ]
      },
      { type: 'vendors', heading: 'Cliff bars', intro: 'Rum, music and a front-row seat for sunset.', filter: { areas: ['west-end'], categories: ['DRINKS'] }, sort: 'trending', limit: 6 },
      {
        type: 'copy',
        heading: 'Sunset is the main event',
        body: [
          'The cliffs face due west, so every evening the whole road turns toward the water. Get to your spot early — the popular bars fill up well before the sun goes down.'
        ]
      },
      { type: 'photospots', heading: 'Sunset viewpoints', city: 'NEGRIL', bestTimes: ['Sunset', 'Golden Hour'], limit: 6 },
      { type: 'vendors', heading: 'Where to eat on the cliffs', filter: { areas: ['west-end'], categories: ['FOOD'] }, sort: 'rating', limit: 6 },
      { type: 'vendors', heading: 'Diving and tours', filter: { areas: ['west-end'], categories: ['ACTIVITY', 'WELLNESS'] }, limit: 3 }
    ]
  },
  {
    slug: 'negril-town',
    kind: 'guide',
    area: 'negril-town',
    eyebrow: 'Negril guide',
    title: 'Negril Town',
    dek: 'Where the beach road meets the cliff road — cookshops, bakeries, the craft market and local prices.',
    seoDescription: 'A guide to Negril town: cookshops, patties, bakeries and the craft market, with live listings from local vendors.',
    sections: [
      {
        type: 'copy',
        body: [
          'Negril’s small town centre sits around the roundabout where Norman Manley Boulevard and West End Road meet, beside the Negril River. It’s where locals shop and eat, and it’s the easiest place in Negril to eat well for very little.',
          'Look for cookshops with a queue at lunchtime, bakeries selling hard dough bread and patties, and juice counters doing fresh cane and fruit blends. Portions are big and prices are local.'
        ]
      },
      { type: 'vendors', heading: 'Cookshops and quick bites', filter: { areas: ['negril-town'], categories: ['FOOD'] }, sort: 'rating', limit: 9 },
      {
        type: 'copy',
        heading: 'Beyond the food',
        body: [
          'The craft market by the roundabout is the place for carvings, jewellery and souvenirs made in Jamaica — take your time and expect to bargain a little.'
        ]
      },
      { type: 'vendors', heading: 'Markets, bars and more', filter: { areas: ['negril-town'], categories: ['OTHER', 'DRINKS', 'ACTIVITY'] }, limit: 6 }
    ]
  },
  {
    slug: 'inland-negril',
    kind: 'guide',
    area: 'inland-negril',
    coverVendor: 'The Lodge Restaurant',
    eyebrow: 'Negril guide',
    title: 'Inland Negril',
    dek: 'Wetlands, hills and farm-to-table dining a short drive from the coast.',
    seoDescription: 'A guide to inland Negril: the Royal Palm Reserve, hillside farm-to-table dining and golf, with live listings from local vendors.',
    sections: [
      {
        type: 'copy',
        body: [
          'Most visitors never leave the coast, but some of Negril’s most memorable afternoons are inland. Behind the beach lies the Great Morass, a protected wetland, and beyond it the Negril hills rise into farmland and forest.',
          'You’ll want a driver or a car for this side of Negril. Plan for half a day, and go in the morning when it’s cooler and the birds are out.'
        ]
      },
      { type: 'vendors', heading: 'Nature and activities', filter: { areas: ['inland-negril'], categories: ['ACTIVITY', 'WELLNESS'] }, limit: 6 },
      { type: 'vendors', heading: 'Dining in the hills', filter: { areas: ['inland-negril'], categories: ['FOOD', 'DRINKS'] }, sort: 'rating', limit: 6 },
      { type: 'photospots', heading: 'Photo spots inland', city: 'NEGRIL', bestTimes: ['Morning', 'Midday', 'Afternoon'], limit: 4 }
    ]
  },
  {
    slug: 'montego-bay',
    kind: 'guide',
    area: 'montego-bay',
    eyebrow: 'Montego Bay guide',
    title: 'Montego Bay',
    dek: 'The Hip Strip, Doctor’s Cave and the marina — where most trips to western Jamaica begin.',
    seoDescription: 'A guide to Montego Bay’s Hip Strip, Doctor’s Cave Beach and Freeport, with live listings from local vendors on ETA.',
    sections: [
      {
        type: 'copy',
        body: [
          'Most visitors to western Jamaica fly into Montego Bay, and it’s worth more than a drive-through. Gloucester Avenue — the “Hip Strip” — runs along the water with bars, restaurants and beach clubs, including the well-known Doctor’s Cave Beach.',
          'Negril is roughly an hour and a half down the coast, so MoBay makes an easy first or last day. ETA’s Montego Bay listings are still growing.'
        ]
      },
      { type: 'vendors', heading: 'On ETA in Montego Bay', filter: { areas: ['montego-bay'] }, limit: 9 },
      { type: 'experiences', heading: 'Montego Bay experiences', city: 'MONTEGO_BAY', limit: 3 },
      { type: 'photospots', heading: 'Photo spots', city: 'MONTEGO_BAY', limit: 4 }
    ]
  }
]

export const BEST_OF: EditorialPage[] = [
  {
    slug: 'jerk-chicken-negril',
    kind: 'best',
    eyebrow: 'Best of Negril',
    title: 'The best jerk chicken in Negril',
    dek: 'Pimento smoke, scotch bonnet heat and festival on the side — the jerk centres and cookshops worth the queue.',
    seoDescription: 'Where to eat the best jerk chicken in Negril, Jamaica — live list of jerk centres and cookshops with real traveler ratings.',
    sections: [
      {
        type: 'copy',
        body: [
          'Proper jerk is slow-cooked over pimento wood, rubbed with scotch bonnet, allspice and thyme, and chopped to order. In Negril you’ll find it everywhere from roadside drum pans to sit-down restaurants.',
          'This list is pulled live from ETA — every spot below is a real vendor whose menu or description mentions jerk, ranked by traveler ratings.'
        ]
      },
      { type: 'vendors', heading: 'Where to get jerk', filter: { city: 'NEGRIL', categories: ['FOOD', 'DRINKS'], keywords: ['jerk'] }, sort: 'rating' },
      {
        type: 'copy',
        heading: 'How to order',
        body: [
          'Order by the quarter, half or whole chicken, and add festival (a sweet fried dumpling), roast breadfruit or rice and peas. Ask for the sauce on the side if you’re not sure about the heat.'
        ]
      }
    ]
  },
  {
    slug: 'sunset-spots',
    kind: 'best',
    eyebrow: 'Best of Negril',
    title: 'The best sunset spots in Negril',
    dek: 'Negril faces west, which makes every evening a show. These are the spots to be when it happens.',
    seoDescription: 'The best places to watch the sunset in Negril, Jamaica — cliff bars and viewpoints from ETA’s live map.',
    sections: [
      {
        type: 'copy',
        body: [
          'Negril is one of the few places in Jamaica where the sun sets straight into the sea. The West End cliffs give you height and drama; Seven Mile Beach gives you sand between your toes. Both work — the difference is the vibe.'
        ]
      },
      { type: 'photospots', heading: 'Viewpoints', city: 'NEGRIL', bestTimes: ['Sunset', 'Golden Hour'] },
      { type: 'vendors', heading: 'Cliff bars for sunset', filter: { city: 'NEGRIL', areas: ['west-end'], categories: ['DRINKS', 'FOOD'], keywords: ['sunset', 'cliff'] }, sort: 'trending', limit: 6 },
      { type: 'vendors', heading: 'Beach bars for sunset', filter: { city: 'NEGRIL', areas: ['seven-mile-beach'], categories: ['DRINKS'] }, sort: 'trending', limit: 6 }
    ]
  },
  {
    slug: 'cheap-eats-negril',
    kind: 'best',
    eyebrow: 'Best of Negril',
    title: 'Cheap eats in Negril',
    dek: 'Patties, cookshops and juice counters where a full meal still costs next to nothing.',
    seoDescription: 'The best cheap eats in Negril, Jamaica — budget-friendly cookshops, patty shops and jerk centres from ETA’s live listings.',
    sections: [
      {
        type: 'copy',
        body: [
          'The best food in Negril is often the cheapest. Every vendor below is in ETA’s lowest price tier, pulled live and sorted by what travelers rated highest.'
        ]
      },
      { type: 'vendors', heading: 'Budget-friendly food', filter: { city: 'NEGRIL', categories: ['FOOD'], priceTiers: ['$'] }, sort: 'rating' }
    ]
  },
  {
    slug: 'watersports-seven-mile-beach',
    kind: 'best',
    eyebrow: 'Best of Negril',
    title: 'Watersports on Seven Mile Beach',
    dek: 'Snorkelling, parasailing, jet skis and glass-bottom boats — all launching from the sand.',
    seoDescription: 'The best watersports on Negril’s Seven Mile Beach — snorkel tours, parasailing, jet skis and more from ETA’s live listings.',
    sections: [
      {
        type: 'copy',
        body: [
          'Seven Mile Beach’s calm, shallow water makes it Negril’s watersports hub. Book in the morning for the flattest water, and agree on the price and time before you set off.'
        ]
      },
      { type: 'vendors', heading: 'Watersports operators', filter: { areas: ['seven-mile-beach'], categories: ['ACTIVITY'] }, sort: 'recommended' },
      { type: 'experiences', heading: 'Bundled water experiences', city: 'NEGRIL', limit: 3 }
    ]
  },
  {
    slug: 'beach-bars-negril',
    kind: 'best',
    eyebrow: 'Best of Negril',
    title: 'The best beach bars in Negril',
    dek: 'Rum punch, sound systems and your feet in the sand — sorted by who’s live right now.',
    seoDescription: 'The best beach bars on Negril’s Seven Mile Beach, sorted live by what’s busy right now on ETA.',
    sections: [
      { type: 'copy', body: ['Every bar below is on Seven Mile Beach and pulled live from ETA — the ones with people there right now are at the top.'] },
      { type: 'vendors', heading: 'Beach bars', filter: { areas: ['seven-mile-beach'], categories: ['DRINKS', 'BEACH'] }, sort: 'trending' }
    ]
  }
]

export function getGuide(slug: string): EditorialPage | undefined {
  return GUIDES.find(g => g.slug === slug)
}

export function getBestOf(slug: string): EditorialPage | undefined {
  return BEST_OF.find(b => b.slug === slug)
}
