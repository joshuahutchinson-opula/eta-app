// app/web/get-the-app/page.tsx — A9 Get the App.
// Launch status: pre-launch. The app is not in the App Store or Google
// Play (no store listing exists anywhere in the project and the ETA
// landing design says "launching first in Negril"), so this is a real
// waitlist backed by WaitlistEntry — not store badges pointing nowhere.
// Screenshots in /public/web/screens are captures of the live mobile app.
import type { Metadata } from 'next'
import Link from 'next/link'
import WaitlistForm from '@/components/web/WaitlistForm'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Get the ETA app',
  description: 'ETA is launching first in Negril, Jamaica. Join the waitlist for the app that plans your trip around a feeling.'
}

const SCREENS = [
  { src: '/web/screens/home.png', caption: 'Home — featured vendors, who’s live and your vibe' },
  { src: '/web/screens/experiences.png', caption: 'Experiences — four questions, one bundled day' },
  { src: '/web/screens/marketplace.png', caption: 'Market — flash deals, dish of the day, every vendor' },
  { src: '/web/screens/vendor.png', caption: 'Vendor — live status, menu, reviews, directions' }
]

const COMPARE: Array<{ feature: string; web: boolean; app: boolean }> = [
  { feature: 'Browse every vendor, experience and photo spot', web: true, app: true },
  { feature: 'Destination guides and best-of lists', web: true, app: true },
  { feature: 'Plan a day and share a link', web: true, app: true },
  { feature: 'Mood survey that builds a bundled itinerary', web: false, app: true },
  { feature: 'Book experiences and split the cost with your crew', web: false, app: true },
  { feature: 'Live map with who’s there right now', web: false, app: true },
  { feature: 'Pay vendors and earn points toward reward tiers', web: false, app: true },
  { feature: 'Alerts when a saved vendor goes live or drops a deal', web: false, app: true },
  { feature: 'Offline access to your booked trip', web: false, app: true }
]

export default function GetTheAppPage() {
  const lang = getServerLang()
  return (
    <div className="w-container">
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 56, alignItems: 'center', padding: '56px 0 0' }}>
        <div>
          <p className="w-eyebrow">Coming soon to iOS & Android</p>
          <h1 className="w-page-title" style={{ fontSize: 56 }}>{t(lang, 'app.title')}</h1>
          <p className="w-page-dek" style={{ marginBottom: 28 }}>{t(lang, 'app.dek')}</p>
          <WaitlistForm type="traveler" source="get-the-app" label={t(lang, 'app.email')} placeholder={t(lang, 'app.email')} button={t(lang, 'app.join')} success={t(lang, 'app.joined')} />
          <p className="w-faint" style={{ fontSize: 13, marginTop: 14 }}>
            In Negril now? The app already runs in your phone’s browser — <Link href="/" className="w-link-arrow" style={{ fontSize: 13 }}>open it here</Link>.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
          {SCREENS.slice(0, 2).map((s, i) => (
            <img key={s.src} src={s.src} alt={s.caption} style={{ width: 240, borderRadius: 32, boxShadow: 'var(--w-shadow-lift)', border: '6px solid var(--w-ink)', transform: i === 1 ? 'translateY(40px)' : undefined }} />
          ))}
        </div>
      </section>

      <section className="w-section" style={{ paddingTop: 96 }}>
        <h2 className="w-section-title" style={{ marginBottom: 24 }}>Inside the app</h2>
        <div className="w-grid-4">
          {SCREENS.map(s => (
            <figure key={s.src} style={{ margin: 0 }}>
              <img src={s.src} alt={s.caption} loading="lazy" style={{ width: '100%', borderRadius: 24, border: '1px solid var(--w-line)', boxShadow: 'var(--w-shadow)' }} />
              <figcaption className="w-muted" style={{ fontSize: 14, marginTop: 12, lineHeight: 1.5 }}>{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="w-section">
        <h2 className="w-section-title" style={{ marginBottom: 20 }}>{t(lang, 'app.compareTitle')}</h2>
        <table style={{ width: '100%', maxWidth: 860, borderCollapse: 'collapse', fontSize: 16 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th scope="col" style={{ padding: '12px 0', borderBottom: '1px solid var(--w-line)' }}> </th>
              <th scope="col" style={{ padding: '12px 16px', borderBottom: '1px solid var(--w-line)', width: 120 }}>Web</th>
              <th scope="col" style={{ padding: '12px 16px', borderBottom: '1px solid var(--w-line)', width: 120 }}>App</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map(row => (
              <tr key={row.feature}>
                <th scope="row" style={{ padding: '14px 0', borderBottom: '1px solid var(--w-line)', fontWeight: 500, textAlign: 'left' }}>{row.feature}</th>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--w-line)', color: row.web ? 'var(--w-open)' : 'var(--w-ink-3)', fontWeight: 700 }}>{row.web ? '✓' : '—'}<span className="w-sr">{row.web ? 'Yes' : 'No'}</span></td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--w-line)', color: 'var(--w-open)', fontWeight: 700 }}>✓<span className="w-sr">Yes</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
