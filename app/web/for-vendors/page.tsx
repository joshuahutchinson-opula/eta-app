// app/web/for-vendors/page.tsx — vendor recruitment landing page.
// Visual language comes from the "ETA — For Vendors" artboard in the ETA
// design canvas (#14120E ink / #FBF8F4 paper / #FF4B2B accent, Fraunces
// display over Inter). Its job is conversion: show a business owner what
// ETA does for them, prove it with real vendors, reviews and numbers, and
// remove every reason not to apply.
//
// Everything that looks like proof is live data — vendor photos, counts
// and traveler reviews are read from the database on each request. No
// invented statistics or testimonials.
import type { Metadata } from 'next'
import Link from 'next/link'
import WaitlistForm from '@/components/web/WaitlistForm'
import { prisma } from '@/lib/prisma'
import { applyVendorPriority } from '@/lib/vendor-priority'
import { areaForNeighborhood, areaLabel } from '@/lib/areas'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For local businesses — grow with ETA',
  description: 'ETA plans the day around your business, gets travelers to your door, and stays in your corner. Free to join — street-side stalls and established restaurants alike.'
}

const PROBLEMS = [
  {
    problem: 'Travelers plan from the same ten names.',
    detail: 'Guidebooks and resort desks send everyone to the places everyone already knows. Great cookshops, cliff bars and boat captains a few minutes away never come up.',
    answer: 'ETA plans around a mood, not a top-ten list. Someone who picks “Street Food Crawl” or “Sunset Chaser” is shown the spots that fit — including yours.'
  },
  {
    problem: 'Getting there is the hard part.',
    detail: 'No car, no idea how far it is, not sure about the route or the fare. A lot of visits die right there, before anyone reaches your door.',
    answer: 'Transport is part of the trip travelers book with ETA. They’re brought to you and taken onward — no haggling, no guessing.'
  },
  {
    problem: 'Quiet hours cost you money.',
    detail: 'Every business has slow afternoons and empty tables — and no easy way to tell the people nearby that right now is a good time to come.',
    answer: 'Drop a flash deal and it goes to travelers close by and to everyone who saved you. Go live, and the app shows how many people are there right now.'
  }
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

const JOURNEY = [
  { step: 'They pick a feeling', body: 'A traveler opens ETA and answers four questions: their mood, how much time they have, who’s coming, and how they want to get around.' },
  { step: 'ETA builds the day', body: 'The app bundles stops into one itinerary, priced up front. Your business is one of those stops — chosen because it fits what they asked for.' },
  { step: 'The crew decides together', body: 'They share the plan with their group, everyone votes on the stops, and the cost is split before anyone books.' },
  { step: 'We bring them to you', body: 'Transport is handled, so they arrive on time and ready — not lost, not late, not arguing about a fare.' },
  { step: 'They pay, tip and come back', body: 'Travelers can pay and tip in the app where you switch it on, earn points for visiting, and leave a review that brings the next traveler.' }
]

const TOOLS = [
  { title: 'Live status', body: 'Go live and the app shows you’re open and how many people are there right now — the best signal a busy spot can send.', icon: <><circle cx="12" cy="12" r="3" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></> },
  { title: 'Flash deals', body: 'Post a time-limited offer; travelers nearby and everyone who saved you get a push notification.', icon: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /> },
  { title: 'Stories', body: 'Short photo updates — tonight’s band, the catch of the day — shown to travelers browsing the app.', icon: <><rect x="4" y="3" width="16" height="18" rx="3" /><circle cx="12" cy="11" r="3" /></> },
  { title: 'Menu & dish of the day', body: 'Your menu on your listing, and a spotlight for the one thing people should order today.', icon: <><path d="M5 3v18M9 3v6a4 4 0 0 1-4 4" /><path d="M16 3c-2 2-2 6 0 8v10" /></> },
  { title: 'Tips jar & pay-it-forward', body: 'Let travelers tip your staff or pay a meal forward for the next person, right from your listing.', icon: <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z" /> },
  { title: 'Reviews that travel', body: 'Every review is tied to a real visit through the app, so your rating reflects real guests.', icon: <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6Z" /> },
  { title: 'Group bookings', body: 'Crews plan together and split the cost before they book — which means bigger tables, decided in advance.', icon: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 1.8 6 5" /></> },
  { title: 'Accessibility details', body: 'Confirm what you offer — step-free entry, seating, accessible restrooms — and travelers who need it can find you.', icon: <><circle cx="12" cy="4.5" r="2" /><path d="M7 8.5h10M12 8.5v5l-4 7M12 13.5l4 7" /></> }
]

const WE_CHECK = [
  'You’re a real, operating business at a real location travelers can reach.',
  'Your hours and prices are what a traveler will actually find when they arrive.',
  'Your photos and video show your place as it is today.',
  'You’re happy with exactly how you’ll be shown — nothing goes live without your sign-off.'
]

const WE_DONT = [
  'How big you are',
  'Whether you have a website',
  'How many Instagram followers you have',
  'Whether you’re a sit-down restaurant or a cart by the roadside'
]

const AFTER_APPLY = [
  { title: 'Apply', body: 'Leave your business email below. It takes about five minutes to tell us about yourself.' },
  { title: 'We reach out', body: 'A real person from ETA gets in touch — not an automated funnel.' },
  { title: 'We meet and vet', body: 'We get to know your business, check the basics, and talk through what travelers will see.' },
  { title: 'You sign off', body: 'We put your listing together with you. Photos, video, prices, hours — you approve every piece before it’s public.' },
  { title: 'You’re live — and we stay in touch', body: 'Travelers start finding you. When your hours, menu or plans change, tell us and we update it.' }
]

const COMMITMENTS = [
  { title: 'Free to join', body: 'Getting vetted and listed costs nothing — ever.' },
  { title: 'Someone to call', body: 'You deal with people who know your business, not a support ticket queue.' },
  { title: 'Your content, your call', body: 'Your photos, your video, your consent. Nothing goes live without your sign-off, and you can ask for changes any time.' },
  { title: 'We send people your way', body: 'Beyond the app, vendors appear in ETA’s destination guides and “best of” pages on the web — written to bring travelers to the places worth finding.' }
]

const FAQ = [
  { q: 'Does it cost anything to be listed?', a: 'No. Getting vetted and listed on ETA is free.' },
  { q: 'I don’t have a website or much of an online presence. Can I still join?', a: 'Yes. Plenty of the best vendors on ETA don’t have a website. We build your listing with you — photos, video and details included.' },
  { q: 'I run a small stall or cart without fixed hours. Is ETA for me?', a: 'Very much so. Small and informal operators get the same vetting and the same consideration as established businesses, and live status lets you show travelers exactly when you’re open.' },
  { q: 'Who decides what goes on my listing?', a: 'You do. We’ll help put it together, but nothing is published without your approval, and you can ask us to change it whenever something changes.' },
  { q: 'How do travelers get to me?', a: 'Transport is part of the trip travelers plan and book with ETA, so getting to and from your location is handled for them.' },
  { q: 'Where does ETA operate?', a: 'ETA is launching first in Negril, with Montego Bay alongside it. If you’re in the area, we’d like to hear from you.' },
  { q: 'How long does applying take?', a: 'About five minutes to tell us about your business. After that, a real person from ETA reaches out to take it from there.' }
]

const TIER_LABEL: Record<string, string> = { $: 'Street-side & budget', $$: 'Casual', $$$: 'Upscale', $$$$: 'Destination dining' }

const ACCENT = '#FF4B2B'

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

function SectionIntro({ eyebrow, title, dek, light }: { eyebrow: string; title: string; dek?: string; light?: boolean }) {
  return (
    <div className="fv-intro">
      <div className="fv-eyebrow" style={light ? { color: '#C23A21' } : undefined}>{eyebrow}</div>
      <h2 className="fv-h2">{title}</h2>
      {dek ? <p className="fv-dek">{dek}</p> : null}
    </div>
  )
}

export default async function ForVendorsPage() {
  // One vendor query and one review query feed every proof point on the page.
  const [vendors, reviews] = await Promise.all([
    prisma.vendor.findMany({
      where: { visibleInMarketplace: true, isTransport: false },
      select: { id: true, name: true, category: true, neighborhood: true, city: true, priceRange: true, images: true, isPremium: true }
    }),
    prisma.review.findMany({
      where: { comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { vendor: { select: { name: true } }, user: { select: { name: true } } }
    })
  ])

  const total = vendors.length
  const budget = vendors.filter(v => v.priceRange === '$').length
  const independent = vendors.filter(v => !v.isPremium).length

  // Showcase: real vendors across every price tier, street-side first.
  const withImages = applyVendorPriority(vendors.filter(v => v.images[0]), v => v.name)
  const tiers = ['$', '$', '$$', '$$', '$$$', '$$$$']
  const showcase = tiers
    .map((tier, i) => withImages.filter(v => v.priceRange === tier)[tiers.slice(0, i).filter(t => t === tier).length])
    .filter((v): v is (typeof vendors)[number] => Boolean(v))
  const collage = showcase.slice(0, 4)

  return (
    <div className="fv">
      {/* Hero */}
      <section className="fv-hero">
        <div aria-hidden className="fv-hero-dots" />
        <div aria-hidden className="fv-hero-glow" />
        <div className="fv-hero-inner">
          <div className="fv-hero-copy">
            <div className="fv-chip">For local business owners</div>
            <h1 className="fv-h1">Travelers are already looking for you.</h1>
            <p className="fv-lede">
              ETA doesn’t just list your business — it plans the day around it, gets travelers to your door, and stays in your corner. Street-side stalls and established restaurants alike, free to join.
            </p>
            <div className="fv-ctas">
              <a href="#apply" className="w-btn" style={{ background: ACCENT, color: '#fff' }}>Apply to list — it’s free</a>
              <a href="#how-it-works" className="w-btn fv-btn-ghost">See what happens next</a>
            </div>
            <p className="fv-trust">
              <strong>{total}</strong> local businesses already on ETA · <strong>{budget}</strong> of them street-side and budget spots
            </p>
          </div>
          {collage.length === 4 ? (
            <div className="fv-collage" aria-label="Some of the vendors already on ETA">
              {collage.map((v, i) => (
                <figure key={v.id} className={`fv-collage-item fv-collage-${i}`}>
                  <img src={v.images[0]} alt={v.name} />
                  <figcaption>{v.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* The problem */}
      <section className="fv-section">
        <SectionIntro eyebrow="Why it’s hard today" title="Being great isn’t the same as being found." dek="Most of what stands between a traveler and a great local business has nothing to do with the business itself. That’s the part ETA fixes." />
        <div className="fv-problems">
          {PROBLEMS.map(p => (
            <article key={p.problem} className="fv-problem w-reveal">
              <h3>{p.problem}</h3>
              <p className="fv-problem-detail">{p.detail}</p>
              <p className="fv-problem-answer"><span>With ETA</span>{p.answer}</p>
            </article>
          ))}
        </div>
      </section>

      {/* More than a listing */}
      <section className="fv-section">
        <SectionIntro eyebrow="More than a listing" title="We handle everything around your business, so you can focus on running it." />
        <div className="fv-grid-2">
          {PILLARS.map(p => (
            <article key={p.n} className="w-pillar w-reveal fv-pillar">
              <span aria-hidden className="fv-pillar-n">{p.n}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* The traveler journey */}
      <section className="fv-section fv-paper">
        <SectionIntro light eyebrow="How travelers find you" title="From “what should we do today?” to walking through your door." />
        <ol className="fv-journey">
          {JOURNEY.map((j, i) => (
            <li key={j.step} className="w-reveal">
              <span className="fv-journey-n">{i + 1}</span>
              <h3>{j.step}</h3>
              <p>{j.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Tools */}
      <section className="fv-section">
        <SectionIntro eyebrow="Everything you get" title="Real tools for filling tables — not just a page with your name on it." dek="All of this is in the ETA app today, and it’s all included." />
        <div className="w-grid-4">
          {TOOLS.map(tool => (
            <div key={tool.title} className="fv-tool">
              <Icon>{tool.icon}</Icon>
              <h3>{tool.title}</h3>
              <p>{tool.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proof: vendors + numbers */}
      <section className="fv-section">
        <SectionIntro eyebrow="Already on ETA" title="From the roadside to the cliffside." dek="Real businesses listed on ETA right now — every price point, side by side." />
        <div className="w-grid-3">
          {showcase.map(v => (
            <Link key={v.id} href={`/web/vendor/${v.id}`} className="fv-vendor">
              <img src={v.images[0]} alt="" loading="lazy" />
              <div className="fv-vendor-body">
                <span className="fv-tier">{TIER_LABEL[v.priceRange] ?? v.priceRange}</span>
                <h3>{v.name}</h3>
                <p>{areaLabel(areaForNeighborhood(v.neighborhood, v.city))}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="fv-stats w-reveal">
          {[
            { v: total, l: 'local businesses already on ETA' },
            { v: budget, l: 'of them street-side stalls, cookshops and budget spots' },
            { v: independent, l: 'independent operators with no paid premium placement' }
          ].map(stat => (
            <div key={stat.l} className="fv-stat">
              <div className="fv-stat-v">{stat.v}</div>
              <div className="fv-stat-l">{stat.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Real reviews */}
      {reviews.length > 0 ? (
        <section className="fv-section">
          <SectionIntro eyebrow="What travelers say" title="Reviews from real ETA visits." dek="Left by travelers in the app about vendors listed on ETA." />
          <div className="w-grid-3">
            {reviews.map(r => (
              <figure key={r.id} className="fv-quote">
                <div className="fv-stars" aria-label={`${r.rating} out of 5`}>{'★'.repeat(Math.max(0, Math.min(5, r.rating)))}</div>
                <blockquote>“{r.comment}”</blockquote>
                <figcaption>{r.user.name.split(' ')[0]} · about <strong>{r.vendor.name}</strong></figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Vetting in practice */}
      <section id="vetting" className="fv-section fv-paper">
        <SectionIntro light eyebrow="Vetting, in practice" title="We vet every vendor by hand. Here’s what that actually means." />
        <div className="fv-vetting">
          <div className="fv-vet-card w-reveal">
            <h3>What we check</h3>
            <ul>{WE_CHECK.map(item => <li key={item}><span aria-hidden>✓</span>{item}</li>)}</ul>
          </div>
          <div className="fv-vet-card fv-vet-dont w-reveal">
            <h3>What we don’t care about</h3>
            <ul>{WE_DONT.map(item => <li key={item}><span aria-hidden>—</span>{item}</li>)}</ul>
            <p>The only thing that counts is whether a traveler will be glad they came.</p>
          </div>
        </div>
      </section>

      {/* After you apply */}
      <section id="how-it-works" className="fv-section fv-paper fv-paper-join">
        <SectionIntro light eyebrow="After you apply" title="What happens next, step by step." />
        <ol className="fv-timeline">
          {AFTER_APPLY.map((s, i) => (
            <li key={s.title} className="w-reveal">
              <span className="fv-timeline-n">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Commitments */}
      <section className="fv-section">
        <SectionIntro eyebrow="Our commitments to you" title="What partnership with ETA looks like." />
        <div className="w-grid-4">
          {COMMITMENTS.map(c => (
            <div key={c.title} className="fv-commit">
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="fv-section">
        <SectionIntro eyebrow="Questions" title="Things business owners ask us." />
        <div className="fv-faq">
          {FAQ.map(f => (
            <details key={f.q} className="w-reveal">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Apply */}
      <section className="fv-section fv-apply-wrap">
        <div id="apply" className="fv-apply">
          <div aria-hidden className="fv-apply-circle-a" />
          <div aria-hidden className="fv-apply-circle-b" />
          <div className="fv-apply-inner">
            <h2 className="fv-h2" style={{ color: '#fff' }}>Ready to be found?</h2>
            <p className="fv-apply-sub">Free to join. About five minutes. No website needed.</p>
            <WaitlistForm
              type="vendor"
              source="for-vendors"
              label="Business email"
              placeholder="your business email"
              button="Apply Now"
              success="Application received — a real person from ETA will be in touch."
              variant="dark"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
