// app/web/for-vendors/page.tsx — A8 vendor recruitment page.
// Ported from the "ETA — For Vendors" artboard in the ETA design canvas:
// same dark hero, why-join cards, 3-step onboarding and apply band, same
// copy, colors (#14120E / #FBF8F4 / #FF4B2B) and Fraunces + Inter type.
// The artboard's own floating pill nav and footer are replaced by the
// shared web nav/footer; the apply form now actually submits.
import type { Metadata } from 'next'
import WaitlistForm from '@/components/web/WaitlistForm'

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
    body: 'Getting vetted and listed costs nothing — ever. No pay-to-rank, no hidden tiers.',
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

const serif = 'var(--w-display)'

export default function ForVendorsPage() {
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
          <p style={{ margin: 0, maxWidth: 540, fontSize: 18, lineHeight: 1.6, color: 'rgba(251,248,244,0.7)' }}>
            ETA puts your business in front of people actively planning what to do, right now — with zero listing fees and full control over what gets shown.
          </p>
          <a href="#apply" className="w-btn" style={{ background: ACCENT, color: '#fff', alignSelf: 'flex-start' }}>Apply to List</a>
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
