// lib/rewards.ts — the reward catalog now lives in the Reward table (tied to
// participating vendors and a region). REWARD_SEED is what prisma/seed and
// scripts/seed-launch-data.ts load into it; the server reads the table.
import type { City } from '@prisma/client'

export interface RewardItem {
  id: string
  name: string
  cost: number
  description: string
  icon: string
  minTier?: string | null
  /** Days the voucher stays valid after redeeming. */
  validDays: number
  /** Null = everywhere in Jamaica. */
  city?: string | null
  vendors?: Array<{ id: string; name: string }>
}

/** Seed catalog. `vendors` are matched by name; `city` null = island-wide. */
export const REWARD_SEED: Array<Omit<RewardItem, 'vendors' | 'city'> & { city: City | null; vendorNames: string[] }> = [
  { id: 'credit-10', name: '$10 Marketplace Credit', cost: 500, description: 'Knock $10 off any order at a participating vendor.', icon: 'gift', validDays: 30, city: null, vendorNames: ['Push Cart', 'MoBay Jerk House', 'Border Jerk'] },
  { id: 'booking-10off', name: '10% Off Next Booking', cost: 300, description: 'A discount on your next experience booking.', icon: 'sparkle', validDays: 30, city: null, vendorNames: [] },
  { id: 'rum-punch', name: 'Free Round of Rum Punch', cost: 350, description: 'On the house at a participating beach bar.', icon: 'glass', validDays: 14, city: 'NEGRIL', vendorNames: ['3 Dives Restaurant & Cliff Bar', 'Margaritaville Negril'] },
  { id: 'airport-transfer', name: 'Free Airport Transfer', cost: 800, description: 'One-way transfer between MBJ and your stay.', icon: 'route', validDays: 60, city: 'MONTEGO_BAY', vendorNames: ['MBJ Airport Transfers'] },
  { id: 'priority-table', name: 'Priority Restaurant Table', cost: 600, description: 'Skip the wait at a top-rated Negril spot.', icon: 'star', validDays: 30, city: 'NEGRIL', vendorNames: ['Rockhouse Restaurant', 'Push Cart'] },
  { id: 'sunset-cruise', name: 'Free Sunset Cruise Upgrade', cost: 1200, description: 'Upgrade to the sunset sail on your next catamaran trip.', icon: 'wave', validDays: 60, city: 'NEGRIL', vendorNames: ['Seven Mile Beach Snorkel Tours'] },
  { id: 'spa-pass', name: 'Half-Day Spa Pass', cost: 1500, description: 'A half day of spa access at a partner spa.', icon: 'spa', validDays: 60, city: 'NEGRIL', vendorNames: ['Ocean View Spa'] },
  { id: 'vip-cabana', name: 'VIP Cabana for a Day', cost: 2000, description: 'A full day in a private beachfront cabana.', icon: 'crown', validDays: 60, city: 'MONTEGO_BAY', vendorNames: ["Doctor's Cave Beach Bar"] },
  { id: 'legend-concierge', name: 'Personal Concierge Day', cost: 2500, description: 'A dedicated local concierge plans and runs your whole day. Legend tier exclusive.', icon: 'star', minTier: 'LOCAL_LEGEND', validDays: 90, city: null, vendorNames: [] }
]
