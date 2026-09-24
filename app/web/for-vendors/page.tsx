// app/web/for-vendors/page.tsx — A8 vendor recruitment page.
// Ported from the "ETA — For Vendors" artboard in the ETA design canvas:
// same dark hero, why-join cards, 3-step onboarding and apply band, same
// copy, colors (#14120E / #FBF8F4 / #FF4B2B) and Fraunces + Inter type.
// The artboard's own floating pill nav and footer are replaced by the
// shared web nav/footer; the apply form now actually submits. A "More than
// a listing" section and a live proof strip were added on top of the
// original design to say what ETA actually does for vendors.
import type { Metadata } from 'next'
import WaitlistForm from '@/components/web/WaitlistForm'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For local businesses — list your business on ETA',
  description: 'Put your business in front of travelers actively planning what to do in Negril — zero listing fees, full control over your content.'
}

const ACCENT = '#FF4B2B'
const INK = '#14120E'
const PAPER = '#FBF8F4'

const WHY = [
  {
    title: 'Zero listing fees',
    body: 'Getting vetted and listed costs nothing — ever.',
    icon: <><circle cx="12" cy="12" r="10" /><path d="M8 12 L11 15 L16 9" /></>
  },
  {
    title: 'Featured placement',
    body: 'Standout experiences and premium vendors get surfaced first — earned, not bought.',
    icon: <path d="M12 2 L15 9 L22 10 L17 15 L18 22 L12 18.5 L6 22 L7 15 L2 10 L9 9 Z" />
  },
  {
    title: 'You control your content',
    body: 'Your photos, your video, your consent — nothing goes live without your sign-off.',
    icon: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12 L11 15 L16 9" /></>
  }
]

const STEPS = [
  { n: 1, title: 'Apply', body: 'Tell us about your business — takes about five minutes.' },
  { n: 2, title: 'Get vetted', body: 'We verify every vendor by hand — real businesses, real reviews.' },
  { n: 3, title: 'Go live', body: 'Your listing goes live once you’ve reviewed and approved everything on it.' }
]

// What ETA does beyond listing a business — the core of the pitch.
const PILLARS = [
  {
    n: '01',
    title: 'We run the whole day, not just your listing.',
    body: 'Travelers tell ETA their mood, their time and their crew, and we build the day around it — the route, the timing, the booking, the split payment. Your business becomes a stop in a planned trip, so people arrive ready to spend, not still deciding.'
  },
  {
    n: '02',
    title: 'We get them to your door.',
    body: 'Getting there and back is part of what travelers book with ETA. You don’t arrange pickups and they don’t haggle with a driver — transport is handled, so the hard-to-reach spots get visited too.'
  },
  {
    n: '03',
    title: 'A partner, not a directory.',
    body: 'We know the people behind every listing. We vet in person, we keep in touch when your hours, menu or busy nights change, and we work with you on what gets shown. You have someone to call, not a form to fill in.'
  },
  {
    n: '04',
    title: 'The roadside jerk pan gets the same spotlight as the cliffside restaurant.',
    body: 'A cart by the roundabout and a resort kitchen go through the same vetting and are shown on the same terms. Some of the best food and the best stories in Negril come from small, informal operators — ETA is built to put them in front of travelers, not bury them.'
  }
]

const serif = 'var(--w-display)'

export default async function ForVendorsPage() {
  // Live numbers for the proof strip — straight from the vendor table.
  const listed = { visibleInMarketplace: true, isTransport: false }
  const [total, budget, independent] = await Promise.all([
    prisma.vendor.count({ where: listed }),
    prisma.vendor.count({ where: { ...listed, priceRange: '$' } }),
    prisma.vendor.count({ where: { ...listed, isPremium: false } })
  ])

  return (
    <div style={{ background: INK, color: PAPER, marginBottom: -96 }}>
      {/* Hero */}
      <section style={{ position: 'relative', minHeight: 620, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.45, backgroundImage: 'radial-gradient(rgba(255,75,43,0.3) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }} />
        <div aria-hidden style={{ position: 'absolute', top: -200, left: -160, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,75,43,0.25) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', width: '100%', maxWidth: 760, margin: '0 auto', padding: '0 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, color: 'rgba(251,248,244,0.75)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', width: 'fit-content' }}>
            For local business owners
          </div>
          <h1 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 64, lineHeight: 1.05, letterSpacing: '-0.01em', maxWidth: 640 }}>
            Travelers are already looking for you.
          </h1>
          <p style={{ margin: 0, maxWidth: 560, fontSize: 18, lineHeight: 1.6, color: 'rgba(251,248,244,0.7)' }}>
            ETA doesn’t just list your business — it plans the day around it, gets travelers to your door, and stays in your corner. Zero listing fees, full control over what gets shown.
          </p>
          <a href="#apply" className="w-btn" style={{ background: ACCENT, color: '#fff', alignSelf: 'flex-start' }}>Apply to List</a>
        </div>
      </section>

      {/* More than a listing */}
      <section style={{ padding: '96px 32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56 }}>
        <div style={{ textAlign: 'center', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT }}>More than a listing</div>
          <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 40, lineHeight: 1.1 }}>We handle everything around your business, so you can focus on running it.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 28, width: '100%', maxWidth: 1240 }} className="w-pillars">
          {PILLARS.map(p => (
            <article key={p.n} className="w-pillar w-reveal" style={{ position: 'relative', background: 'linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '40px 40px 44px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
              <span aria-hidden style={{ fontFamily: serif, fontSize: 64, fontWeight: 700, lineHeight: 1, color: 'rgba(255,75,43,0.9)' }}>{p.n}</span>
              <h3 style={{ margin: 0, fontFamily: serif, fontSize: 26, fontWeight: 600, lineHeight: 1.2, color: PAPER }}>{p.title}</h3>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: 'rgba(251,248,244,0.68)' }}>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Proof strip — live counts */}
      <section style={{ padding: '32px 32px 0' }}>
        <div className="w-reveal" style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: '1px solid rgba(255,255,255,0.12)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          {[
            { v: total, l: 'local businesses already on ETA' },
            { v: budget, l: 'of them street-side stalls, cookshops and budget spots' },
            { v: independent, l: 'independent operators with no paid premium placement' }
          ].map((stat, i) => (
            <div key={stat.l} style={{ padding: '36px 28px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
              <div style={{ fontFamily: serif, fontSize: 56, fontWeight: 600, lineHeight: 1, color: PAPER }}>{stat.v}</div>
              <div style={{ fontSize: 15, marginTop: 10, color: 'rgba(251,248,244,0.6)', lineHeight: 1.5 }}>{stat.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Why vendors join */}
      <section style={{ padding: '88px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48 }}>
        <div style={{ textAlign: 'center', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: ACCENT }}>Why vendors join</div>
          <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 34 }}>Built to help small operators, not squeeze them.</h2>
        </div>
        <div className="w-grid-3" style={{ gap: 28, width: '100%', maxWidth: 1240 }}>
          {WHY.map(w => (
            <div key={w.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" aria-hidden>{w.icon}</svg>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{w.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(251,248,244,0.6)' }}>{w.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ background: PAPER, color: INK, padding: '88px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 52 }}>
        <div style={{ textAlign: 'center', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C23A21' }}>How it works</div>
          <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 34 }}>From application to live listing.</h2>
        </div>
        <ol style={{ display: 'flex', width: '100%', maxWidth: 1100, alignItems: 'flex-start', listStyle: 'none', padding: 0, margin: 0 }}>
          {STEPS.map((s, i) => (
            <li key={s.n} style={{ display: 'contents' }}>
              {i > 0 ? <div aria-hidden style={{ width: '100%', maxWidth: 90, height: 2, background: 'rgba(20,18,14,0.15)', marginTop: 27 }} /> : null}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: ACCENT, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: serif, fontWeight: 700, fontSize: 22 }}>{s.n}</div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'rgba(20,18,14,0.6)', maxWidth: 220 }}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Apply */}
      <section style={{ padding: '100px 32px' }}>
        <div id="apply" style={{ position: 'relative', maxWidth: 1312, margin: '0 auto', minHeight: 300, background: ACCENT, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '56px 0', scrollMarginTop: 96 }}>
          <div aria-hidden style={{ position: 'absolute', top: -120, right: -80, width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: -140, left: -60, width: 380, height: 380, borderRadius: '50%', background: 'rgba(20,18,14,0.1)' }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, textAlign: 'center', maxWidth: 560, padding: '0 40px', width: '100%', color: '#fff' }}>
            <h2 style={{ margin: 0, fontFamily: serif, fontWeight: 600, fontSize: 32, color: '#fff' }}>Ready to be found?</h2>
            <WaitlistForm
              type="vendor"
              source="for-vendors"
              label="Business email"
              placeholder="your business email"
              button="Apply Now"
              success="Application received — we’ll be in touch to start vetting."
              variant="dark"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
