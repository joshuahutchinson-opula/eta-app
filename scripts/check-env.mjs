// scripts/check-env.mjs — runs before `next start` (npm start). Refuses to
// boot without the settings ETA can't run safely without.
const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(k => !process.env[k])
if (missing.length) {
  console.error(`\nETA can't start: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set.`)
  if (missing.includes('JWT_SECRET')) console.error('JWT_SECRET signs every login session. Set it to a long random string, e.g. `openssl rand -base64 48`.')
  console.error('')
  process.exit(1)
}
const warn = ['NEXT_PUBLIC_SITE_URL', 'CRON_SECRET', 'EMAIL_API_KEY', 'EMAIL_FROM'].filter(k => !process.env[k])
if (warn.length) console.warn(`ETA: not set (features fall back or stay off): ${warn.join(', ')}`)
