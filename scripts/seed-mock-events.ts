// scripts/seed-mock-events.ts — demo events so Home's Parties & Happenings
// is never empty: 7 per main town (Negril, Montego Bay, Ocho Rios, Port
// Antonio, Kingston) spread over this week and next, mixed free and paid,
// day and night, each with a photo. All flagged isMock, so
// `npm run mock:remove` clears them. Re-running replaces the previous batch
// (dates are relative to today, so run it again to keep the demo fresh).
//   npm run seed:events
import { PrismaClient } from '@prisma/client'
import { assertSeedAllowed } from '../prisma/seed-guard'

const prisma = new PrismaClient()

type Town = 'NEGRIL' | 'MONTEGO_BAY' | 'OCHO_RIOS' | 'PORT_ANTONIO' | 'KINGSTON'

const IMG = {
  concert: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1200',
  bar: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
  beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
  water: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200',
  family: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1200',
  wellness: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200',
  grill: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=1200'
}

/** One event template: day offset from today, local start "HH:MM", hours long, price (null = free). */
interface Tpl { title: string; venue: string; promoter: string; blurb: string; day: number; at: string; hours: number; price: number | null; img: string; tickets?: boolean }

const EVENTS: Record<Town, Tpl[]> = {
  NEGRIL: [
    { title: 'Sunset Reggae on the Cliffs', venue: 'West End Cliffs', promoter: 'Cliffside Sounds', blurb: 'Live roots reggae as the sun drops into the sea. Bring a towel and an appetite.', day: 0, at: '17:30', hours: 4, price: 15, img: IMG.concert, tickets: true },
    { title: 'Seven Mile Beach Cleanup & Brunch', venue: 'Seven Mile Beach', promoter: 'Negril Green Team', blurb: 'An hour of beach cleanup, then fresh juice and ackee for everyone who helped.', day: 1, at: '08:30', hours: 3, price: null, img: IMG.beach },
    { title: 'Jerk Night Cook-Off', venue: 'Norman Manley Blvd Yard', promoter: 'Pan Chicken Collective', blurb: 'Five pitmasters, one crown. Taste every plate and vote for the best jerk.', day: 2, at: '19:00', hours: 4, price: 10, img: IMG.grill, tickets: true },
    { title: 'Full Moon Beach Party', venue: 'Bloody Bay', promoter: 'Moonlight Collective', blurb: 'Bonfires, sound system and dancing until the moon sets.', day: 4, at: '21:00', hours: 6, price: 20, img: IMG.bar, tickets: true },
    { title: 'Sunrise Yoga on the Sand', venue: 'Long Bay', promoter: 'Irie Flow Yoga', blurb: 'A gentle hour of yoga with the waves. Mats provided.', day: 6, at: '06:30', hours: 1, price: null, img: IMG.wellness },
    { title: 'Snorkel & Rum Punch Cruise', venue: 'Negril Marina', promoter: 'Blue Water Tours', blurb: 'Reef snorkel stops, then rum punch on the deck for the sail home.', day: 8, at: '13:00', hours: 3, price: 45, img: IMG.water, tickets: true },
    { title: 'Dancehall Friday', venue: 'One Love Lounge', promoter: 'Selecta Kush', blurb: 'The biggest dancehall night on the West End. Dress to sweat.', day: 11, at: '22:00', hours: 5, price: 12, img: IMG.concert, tickets: true }
  ],
  MONTEGO_BAY: [
    { title: 'Hip Strip Street Food Night', venue: 'Gloucester Avenue', promoter: 'MoBay Eats', blurb: 'Patties, festival, fish tea and more from a dozen street stalls.', day: 0, at: '18:00', hours: 4, price: null, img: IMG.food },
    { title: 'Doctor’s Cave Family Beach Day', venue: 'Doctor’s Cave Beach', promoter: 'Bay Family Fun', blurb: 'Sandcastle contest, face painting and a kids’ swim race.', day: 2, at: '10:00', hours: 5, price: 8, img: IMG.family, tickets: true },
    { title: 'Rooftop Rum Tasting', venue: 'Pier 1 Rooftop', promoter: 'Rum Society JA', blurb: 'Six Jamaican rums, guided by a master blender, with small bites.', day: 3, at: '19:30', hours: 2, price: 35, img: IMG.bar, tickets: true },
    { title: 'Catamaran Sunset Sail', venue: 'Montego Bay Yacht Club', promoter: 'Island Wind Charters', blurb: 'Two hours on the water with an open bar and a reggae soundtrack.', day: 5, at: '16:30', hours: 2, price: 60, img: IMG.water, tickets: true },
    { title: 'Sumfest Warm-Up Party', venue: 'Catherine Hall', promoter: 'Sound Clash Promotions', blurb: 'Local selectors warm up the crowd ahead of festival season.', day: 7, at: '21:00', hours: 6, price: 25, img: IMG.concert, tickets: true },
    { title: 'Sunday Gospel Breakfast', venue: 'Sam Sharpe Square', promoter: 'Community Choirs', blurb: 'Choirs, coffee and a full Jamaican breakfast in the square.', day: 9, at: '09:00', hours: 3, price: null, img: IMG.food },
    { title: 'Beach Volleyball Open', venue: 'Walter Fletcher Beach', promoter: 'MoBay Sports Club', blurb: 'Pick-up teams welcome. Music, coconuts and a trophy for the winners.', day: 12, at: '14:00', hours: 4, price: null, img: IMG.beach }
  ],
  OCHO_RIOS: [
    { title: 'Dunn’s River Morning Climb', venue: 'Dunn’s River Falls', promoter: 'Ochi Adventures', blurb: 'Climb the falls with a guide before the crowds arrive.', day: 1, at: '08:00', hours: 3, price: 30, img: IMG.water, tickets: true },
    { title: 'Ochi Night Market', venue: 'Turtle River Park', promoter: 'St. Ann Makers', blurb: 'Craft, street food and live drumming under the lights.', day: 1, at: '18:00', hours: 4, price: null, img: IMG.food },
    { title: 'Reggae Under the Stars', venue: 'Island Village', promoter: 'Garden Parish Sounds', blurb: 'An open-air reggae concert with local headliners.', day: 3, at: '20:00', hours: 4, price: 18, img: IMG.concert, tickets: true },
    { title: 'Bamboo Beach Day Party', venue: 'Bamboo Blu', promoter: 'Sun & Sound', blurb: 'DJs on the sand from noon till sunset.', day: 5, at: '12:00', hours: 6, price: 15, img: IMG.beach, tickets: true },
    { title: 'Mystic Mountain Family Day', venue: 'Mystic Mountain', promoter: 'Ochi Family Club', blurb: 'Bobsled, chairlift and a picnic lunch for the whole family.', day: 7, at: '10:00', hours: 5, price: 40, img: IMG.family, tickets: true },
    { title: 'Seafood & Soca Night', venue: 'Margaritaville Ocho Rios', promoter: 'Soca Wave', blurb: 'Grilled lobster, soca and a crowd that dances on the tables.', day: 10, at: '21:00', hours: 5, price: 20, img: IMG.bar, tickets: true },
    { title: 'Free Sunset Drumming Circle', venue: 'Fisherman’s Beach', promoter: 'Ochi Drummers', blurb: 'Bring a drum or borrow one. All rhythms welcome.', day: 13, at: '17:00', hours: 2, price: null, img: IMG.concert }
  ],
  PORT_ANTONIO: [
    { title: 'Blue Lagoon Swim & Picnic', venue: 'Blue Lagoon', promoter: 'Portland Outdoors', blurb: 'A slow morning swim in the lagoon, then a picnic on the rocks.', day: 0, at: '09:30', hours: 3, price: null, img: IMG.water },
    { title: 'Rafting the Rio Grande', venue: 'Berridale Raft Landing', promoter: 'Rio Grande Raftsmen', blurb: 'Glide down the river on a bamboo raft with a local captain.', day: 2, at: '10:00', hours: 3, price: 65, img: IMG.water, tickets: true },
    { title: 'Boston Bay Jerk Festival', venue: 'Boston Bay', promoter: 'Portland Jerk Masters', blurb: 'The birthplace of jerk throws its weekly party.', day: 3, at: '12:00', hours: 6, price: 10, img: IMG.grill, tickets: true },
    { title: 'Frenchman’s Cove Sunset Session', venue: 'Frenchman’s Cove', promoter: 'Cove Sounds', blurb: 'Acoustic sets on the beach as the sun goes down.', day: 5, at: '17:00', hours: 3, price: 12, img: IMG.beach, tickets: true },
    { title: 'Portland Night Run', venue: 'Errol Flynn Marina', promoter: 'Run Portland', blurb: 'A 5k fun run along the waterfront, then cold coconuts.', day: 8, at: '18:30', hours: 2, price: null, img: IMG.wellness },
    { title: 'Marina Dance Night', venue: 'Errol Flynn Marina', promoter: 'Portland Vibes', blurb: 'Dancehall and reggae by the boats until late.', day: 9, at: '21:00', hours: 5, price: 15, img: IMG.concert, tickets: true },
    { title: 'Reach Falls Guided Hike', venue: 'Reach Falls', promoter: 'Portland Outdoors', blurb: 'A guided walk to the falls with a swim at the top.', day: 12, at: '09:00', hours: 4, price: 25, img: IMG.water, tickets: true }
  ],
  KINGSTON: [
    { title: 'Sound System Sunday', venue: 'Emancipation Park', promoter: 'Kingston Sound Society', blurb: 'Classic sound systems face off in the park.', day: 0, at: '16:00', hours: 6, price: null, img: IMG.concert },
    { title: 'Bob Marley Museum Late Night', venue: 'Bob Marley Museum', promoter: 'Tuff Gong Heritage', blurb: 'After-hours tour with live acoustic sets in the yard.', day: 2, at: '18:30', hours: 3, price: 30, img: IMG.concert, tickets: true },
    { title: 'Blue Mountain Coffee Morning', venue: 'Craighton Estate', promoter: 'Blue Mountain Growers', blurb: 'Tour a coffee farm and taste the beans fresh off the slopes.', day: 3, at: '08:00', hours: 4, price: 40, img: IMG.food, tickets: true },
    { title: 'New Kingston Food Truck Fest', venue: 'Knutsford Boulevard', promoter: 'Kingston Eats', blurb: 'Twenty trucks, from ital stews to curry goat.', day: 4, at: '17:00', hours: 5, price: null, img: IMG.food },
    { title: 'Port Royal Fish Fry', venue: 'Gloria’s Port Royal', promoter: 'Port Royal Fishermen', blurb: 'Fried fish, bammy and festival right off the boats.', day: 6, at: '13:00', hours: 5, price: 15, img: IMG.grill, tickets: true },
    { title: 'Dub Club Rooftop', venue: 'Skyline Drive', promoter: 'Dub Club', blurb: 'Roots and dub on a rooftop above the city lights.', day: 9, at: '21:00', hours: 5, price: 10, img: IMG.bar, tickets: true },
    { title: 'Hope Gardens Family Picnic', venue: 'Hope Botanical Gardens', promoter: 'Kingston Family Days', blurb: 'Games, storytelling and a picnic under the trees.', day: 11, at: '11:00', hours: 4, price: null, img: IMG.family }
  ]
}

const COORDS: Record<Town, { lat: number; lng: number }> = {
  NEGRIL: { lat: 18.2683, lng: -78.3478 },
  MONTEGO_BAY: { lat: 18.4762, lng: -77.8939 },
  OCHO_RIOS: { lat: 18.4074, lng: -77.1031 },
  PORT_ANTONIO: { lat: 18.1760, lng: -76.4500 },
  KINGSTON: { lat: 18.0179, lng: -76.8099 }
}

/** Today (Jamaica) + day offset, at local "HH:MM". */
function at(day: number, hhmm: string): Date {
  const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10)
  const [y, m, d] = today.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d + day, h + 5, mi))
}

async function main() {
  assertSeedAllowed('seed:events')
  const titles = Object.values(EVENTS).flat().map(e => e.title)
  const removed = await prisma.event.deleteMany({ where: { isMock: true, title: { in: titles } } })
  let made = 0
  for (const [city, list] of Object.entries(EVENTS) as Array<[Town, Tpl[]]>) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i]
      const startAt = at(e.day, e.at)
      const c = COORDS[city]
      await prisma.event.create({
        data: {
          title: e.title, promoterName: e.promoter, description: e.blurb, imageUrl: e.img, venueName: e.venue,
          lat: c.lat + (i - 3) * 0.004, lng: c.lng + (i % 3 - 1) * 0.004,
          startAt, endAt: new Date(startAt.getTime() + e.hours * 3600000),
          price: e.price, isFree: e.price === null, inAppTickets: Boolean(e.tickets && e.price !== null),
          ticketCapacity: e.tickets && e.price !== null ? 150 : null, city, isMock: true
        }
      })
      made++
    }
  }
  console.log(`Mock events: removed ${removed.count}, created ${made}.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
