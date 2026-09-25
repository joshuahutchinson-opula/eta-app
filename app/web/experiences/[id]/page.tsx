// app/web/experiences/[id]/page.tsx — A6 read-only experience detail
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MediaGallery from '@/components/web/MediaGallery'
import ExperienceCard from '@/components/web/ExperienceCard'
import Icon from '@/lib/icons'
import { getExperience, getExperiences, formatCity } from '@/lib/web-data'
import { accessibilityLabel } from '@/lib/accessibility'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const e = await getExperience(params.id)
  if (!e) return { title: 'Experience not found' }
  return { title: `${e.name} — ${formatCity(e.city)}`, description: e.tagline, openGraph: { images: [e.imageUrl] } }
}

export default async function ExperienceDetailPage({ params }: { params: { id: string } }) {
  const lang = getServerLang()
  const [experience, all] = await Promise.all([getExperience(params.id), getExperiences()])
  if (!experience) notFound()

  // Reviews from every vendor on the route.
  const ratings = experience.ratings
  const rating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null
  const moodIds = experience.moods.map(m => m.id)
  const more = all
    .filter(e => e.id !== experience.id)
    .sort((a, b) =>
      Number(b.moods.some(m => moodIds.includes(m.id))) - Number(a.moods.some(m => moodIds.includes(m.id))) ||
      Number(b.city === experience.city) - Number(a.city === experience.city))
    .slice(0, 3)

  return (
    <div className="w-container">
      <nav aria-label="Breadcrumb" style={{ paddingTop: 24, fontSize: 14 }} className="w-faint">
        <Link href="/web/experiences" className="w-muted">{t(lang, 'nav.experiences')}</Link>{' / '}<span>{experience.name}</span>
      </nav>
      <div className="w-detail">
        <div>
          <MediaGallery name={experience.name} videos={experience.videoUrl ? [experience.videoUrl] : []} images={[experience.imageUrl, ...(experience.vendor?.images ?? []).slice(0, 5)]} />
          <h1 className="w-detail-title">{experience.name}</h1>
          <div className="w-detail-meta">
            <span>{experience.tagline}</span>
            {rating !== null ? (
              <span className="w-rating" style={{ color: 'var(--w-ink)' }}>
                <span className="star" aria-hidden>★</span>{rating}
                <span className="w-faint" style={{ fontWeight: 500 }}>· {ratings.length} {t(lang, ratings.length === 1 ? 'common.review' : 'common.reviews')}</span>
              </span>
            ) : null}
          </div>

          <h2 className="w-h2">{t(lang, 'vendor.about')}</h2>
          <div className="w-prose">
            <p>
              {experience.tagline}. {t(lang, 'exp.startsAt')} {experience.startLocation}, {formatCity(experience.city)} — {experience.travelTime} min by {experience.travelMode.toLowerCase()}
              {experience.vendor ? `, hosted by ${experience.vendor.name}` : ''}.
            </p>
          </div>

          {experience.stops.length > 0 ? (
            <>
              <h2 className="w-h2">{t(lang, 'exp.route')}</h2>
              <ol className="w-route">
                {experience.stops.map(st => (
                  <li key={st.order}>
                    <div className="w-route-stop">
                      {st.image ? <img src={st.image} alt="" loading="lazy" /> : <span className="w-route-img" />}
                      <div>
                        {st.type === 'vendor'
                          ? <Link href={`/web/vendor/${st.id}`} className="w-route-name">{st.name}</Link>
                          : <Link href={`/web/photo-spots/${st.id}`} className="w-route-name">{st.name}</Link>}
                        <p className="w-faint">{st.type === 'photospot' ? t(lang, 'exp.photoStop') : null}{st.plannedDuration} min</p>
                      </div>
                    </div>
                    {st.transportModeToNext ? (
                      <p className="w-route-leg">{t(lang, `exp.mode.${st.transportModeToNext}` as 'exp.mode.WALKING')} · {st.transportDurationToNext} min</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {experience.moods.length > 0 ? (
            <>
              <h2 className="w-h2">{t(lang, 'exp.moods')}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, maxWidth: 640 }}>
                {experience.moods.map(m => (
                  <div key={m.id} className="w-panel" style={{ padding: 16 }}>
                    <p style={{ fontWeight: 700 }}>{m.name}</p>
                    <p className="w-muted" style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{m.description}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {experience.accessibility.length > 0 ? (
            <>
              <h2 className="w-h2">{t(lang, 'vendor.accessibility')}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {experience.accessibility.map(k => <span key={k} className="w-pill">♿ {accessibilityLabel(k)}</span>)}
              </div>
            </>
          ) : null}
        </div>

        <aside className="w-aside">
          <div className="w-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span className="w-display" style={{ fontSize: 40 }}>${Math.round(experience.price)}</span>
              <span className="w-muted"> {t(lang, 'exp.perPerson')}</span>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 16px', fontSize: 15 }}>
              <dt className="w-faint">{t(lang, 'exp.startsAt')}</dt><dd>{experience.startLocation}</dd>
              <dt className="w-faint">{t(lang, 'exp.travel')}</dt><dd>{experience.travelTime} min · {experience.travelMode}</dd>
              {experience.vendor ? (
                <>
                  <dt className="w-faint">{t(lang, 'exp.hostedBy')}</dt>
                  <dd><Link href={`/web/vendor/${experience.vendor.id}`} className="w-link-arrow" style={{ fontWeight: 600 }}>{experience.vendor.name}</Link></dd>
                </>
              ) : null}
            </dl>
            <div>
              <Link href="/experiences" className="w-btn w-btn-primary w-btn-block">
                <Icon name="compass" size={18} /> {t(lang, 'exp.planInApp')}
              </Link>
              <p className="w-faint" style={{ fontSize: 13, marginTop: 10, textAlign: 'center' }}>{t(lang, 'exp.planInAppHelp')}</p>
            </div>
          </div>
        </aside>
      </div>

      {more.length > 0 ? (
        <section className="w-section">
          <h2 className="w-section-title" style={{ marginBottom: 20 }}>{t(lang, 'vendor.youMightLike')}</h2>
          <div className="w-grid-3">{more.map(e => <ExperienceCard key={e.id} experience={e} lang={lang} />)}</div>
        </section>
      ) : null}
    </div>
  )
}
