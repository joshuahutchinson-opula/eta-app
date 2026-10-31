// prisma/seed-guard.ts — seed scripts write placeholder data (and the full
// seed wipes the database first), so they refuse to run in production unless
// ALLOW_SEED=true is set for that one run.
//
// Note: NODE_ENV is "production" on Railway, not on your laptop. A script run
// locally against a production DATABASE_URL is not stopped by this guard.

export function assertSeedAllowed(script: string) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    console.error(`\n${script} refuses to run with NODE_ENV=production.\nSet ALLOW_SEED=true for this run if you really mean to seed this database.\n`)
    process.exit(1)
  }
}

// Seeded placeholder content, flagged isMock (the launch migration also flags
// these by name in databases seeded before the flag existed).
// scripts/remove-mock-data.ts deletes all of it in one go.
export const MOCK_VENDOR_NAMES = [
  'Push Cart', 'Blue Mahoe', 'Coral Reef',
  'MoBay Jerk House', "Doctor's Cave Beach Bar", 'MoBay Watersports',
  'Negril Licensed Taxi Stand', 'West End Route Taxis', 'MBJ Airport Transfers', 'Hip Strip Licensed Taxis'
]
