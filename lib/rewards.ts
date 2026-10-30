// lib/rewards.ts — the reward catalog. Shared by the Rewards screen and the
// redeem endpoint, so the server decides what a reward costs.

export interface RewardItem {
  id: string
  name: string
  cost: number
  description: string
  icon: string
  minTier?: string
  /** Days the voucher stays valid after redeeming. */
  validDays: number
}

export const REWARD_CATALOG: RewardItem[] = [
  { id: 'credit-10', name: '$10 Marketplace Credit', cost: 500, description: 'Knock $10 off any vendor order in the marketplace.', icon: 'gift', validDays: 30 },
  { id: 'booking-10off', name: '10% Off Next Booking', cost: 300, description: 'A discount on your next experience booking.', icon: 'sparkle', validDays: 30 },
  { id: 'rum-punch', name: 'Free Round of Rum Punch', cost: 350, description: 'On the house at a participating beach bar.', icon: 'glass', validDays: 14 },
  { id: 'airport-transfer', name: 'Free Airport Transfer', cost: 800, description: 'One-way transfer between MBJ and your stay.', icon: 'route', validDays: 60 },
  { id: 'priority-table', name: 'Priority Restaurant Table', cost: 600, description: 'Skip the wait at a top-rated Negril spot.', icon: 'star', validDays: 30 },
  { id: 'sunset-cruise', name: 'Free Sunset Cruise Upgrade', cost: 1200, description: 'Upgrade to the sunset sail on your next catamaran trip.', icon: 'wave', validDays: 60 },
  { id: 'spa-pass', name: 'Half-Day Spa Pass', cost: 1500, description: 'A half day of spa access at a partner resort.', icon: 'spa', validDays: 60 },
  { id: 'vip-cabana', name: 'VIP Cabana for a Day', cost: 2000, description: 'A full day in a private beachfront cabana.', icon: 'crown', validDays: 60 },
  { id: 'legend-concierge', name: 'Personal Concierge Day', cost: 2500, description: 'A dedicated local concierge plans and runs your whole day. Legend tier exclusive.', icon: 'star', minTier: 'LOCAL_LEGEND', validDays: 90 }
]

export function findReward(id: string): RewardItem | undefined {
  return REWARD_CATALOG.find(r => r.id === id)
}
