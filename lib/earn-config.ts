// lib/earn-config.ts — every points value in one place, so they can be
// tuned without hunting through routes. Server and client both read it
// (the Tiers & How To Earn screen shows EARN_TABLE straight from here).
//
// Rules that go with these values:
//   - Points are never cash: no withdrawal, no transfer between users.
//   - Cash payments earn nothing (only in-app payments do).
//   - Every earn is a PointsLedger row with a reason (below) and its source.
//   - Boosts (lib/boosts.ts) stack on the base values: each multiplier adds
//     base × (multiplier − 1); crew bonus is a flat amount on top.

export const EARN = {
  /** First QR visit to a vendor. */
  qrFirstVisit: 60,
  /** Repeat QR visit, once a Jamaica day per vendor. */
  qrRepeatVisit: 15,
  /** In-app payment, per whole $1. */
  payPerDollar: 2,
  /** Experience / event booking, per whole $1. */
  bookingPerDollar: 1,
  /** A review after a verified (QR) visit. */
  verifiedReview: 20,
  /** An Instagram story tagging @ETA that the vendor approves. */
  storyTag: 30,
  /** Finding a secret spot. */
  secretSpot: 100,
  /** Finishing a quest. */
  questComplete: 250,
  /** Each quest checkpoint along the way. */
  questCheckpoint: 15,
  /** Checking in three Jamaica days in a row. */
  streak3: 50,
  /** A friend you referred makes their first visit (you get this). */
  referralFirstVisit: 150,
  /** Crew bonus: everyone in the group, when the whole group checks in together. */
  crewBonus: 25,
  /** Photo spot GPS check-in, once a day per spot, and the first-time bonus. */
  photoSpotCheckIn: 10,
  photoSpotFirst: 30,
  /** Submitting a secret spot that other travellers verify. */
  gemVerified: 150
} as const

/** Ledger reason codes. */
export type EarnReason =
  | 'qr_first_visit' | 'qr_repeat_visit' | 'payment' | 'booking' | 'ticket'
  | 'review' | 'story_tag' | 'secret_spot' | 'gem_verified' | 'quest_complete' | 'quest_checkpoint'
  | 'streak3' | 'referral' | 'crew_bonus' | 'photo_spot' | 'challenge'
  | 'boost_quiet_hour' | 'boost_rainy_day' | 'birthday'
export type SpendReason = 'redeem' | 'donate'

/** The earning table on Tiers & How To Earn: i18n key suffix and the points text. */
export const EARN_TABLE: Array<{ key: string; points: number; per?: 'dollar' | 'day' }> = [
  { key: 'firstVisit', points: EARN.qrFirstVisit },
  { key: 'repeatVisit', points: EARN.qrRepeatVisit, per: 'day' },
  { key: 'payment', points: EARN.payPerDollar, per: 'dollar' },
  { key: 'booking', points: EARN.bookingPerDollar, per: 'dollar' },
  { key: 'review', points: EARN.verifiedReview },
  { key: 'storyTag', points: EARN.storyTag },
  { key: 'secretSpot', points: EARN.secretSpot },
  { key: 'quest', points: EARN.questComplete },
  { key: 'streak', points: EARN.streak3 },
  { key: 'referral', points: EARN.referralFirstVisit }
]

/** Give Back quick picks. */
export const DONATE_PICKS = [100, 250, 500] as const

/** Rainy-day boosts switch on at or above this chance of rain in the next 3 hours. */
export const RAIN_BOOST_CHANCE = 60
/** A whole group checking in at the same vendor within this window earns the crew bonus. */
export const CREW_WINDOW_MS = 30 * 60 * 1000

/** Fraud protection: an admin alert when someone earns faster than this. */
export const FRAUD = {
  windowMs: 60 * 60 * 1000,
  maxPoints: 1500,
  maxEarns: 12
} as const

/** Rewards at or above this cost get rotating voucher QR codes. */
export const ROTATING_QR_COST = 1500
