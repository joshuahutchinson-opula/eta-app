// components/experiences/ExperienceDetailView.tsx — one experience (curated or
// a generated route): hero, the route on a map with its stops, the host, and
// tap rows that open sheets for reviews, what's included, and meeting point &
// cancellation. Price and Book stay pinned at the bottom.
'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useMorphIn } from '@/lib/morph'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import Price from '@/components/Price'
import BackButton from '@/components/BackButton'
import ReportButton from '@/components/ReportButton'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { directionsUrl } from '@/lib/calendar'
import { parseTier, TIER_SUMMARY_KEY } from '@/lib/cancellation'
import { shortDuration } from '@/lib/plan'

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })
const EtaMap = dynamic(() => import('@/components/map/EtaMap'), { ssr: false })

export interface DetailStop {
  id: string
  type: 'vendor' | 'photospot' | 'experience'
  name: string
  lat: number | null
  lng: number | null
  minutes: number | null
}

export interface DetailReview {
  id: string
  rating: number
  comment: string | null
  user: { name: string; avatarUrl: string | null }
}

export interface DetailData {
  name: string
  image: string
  video: string | null
  gallery: string[]
  rating: number | null
  reviewCount: number
  minutes: number | null
  stops: DetailStop[]
  host: { id: string; name: string; image: string | null; video: string | null; isPremium: boolean } | null
  reviews: DetailReview[]
  /** "See all reviews" page, when there are more than shown. */
  reviewsHref: string | null
  included: string[]
  whatToBring: string[]
  languages: string[]
  groupSize: number | null
  accessibility: string[]
  accessibilityNotes: string | null
  meeting: { text: string | null; lat: number | null; lng: number | null } | null
  cancellation: { tier: string; note: string | null } | null
  price: number
  /** Generated routes: the price is an estimate. */
  estimate: boolean
}

type SheetKey = 'reviews' | 'included' | 'meeting' | 'photos' | null

export default function ExperienceDetailView({ data, fallbackCenter, onBack, backFallback, saved, onToggleSave, onShare, shareCopied, onBook, onPlanWithCrew, planning, actionError }: {
  data: DetailData
  fallbackCenter: [number, number]
  onBack?: () => void
  backFallback?: string
  saved: boolean | null
  onToggleSave: (() => void) | null
  onShare: () => void
  shareCopied: boolean
  onBook: () => void
  onPlanWithCrew: () => void
  planning: boolean
  actionError: string | null
}) {
  // The tapped card's image grows into the hero (lib/morph.ts).
  const heroRef = useRef<HTMLDivElement>(null)
  useMorphIn(heroRef, true)
  const { t } = useLang()
  const labels = useLabels()
  const [sheet, setSheet] = useState<SheetKey>(null)
  const [hostVideo, setHostVideo] = useState(false)
  const [photo, setPhoto] = useState(0)

  const placed = data.stops.filter(s => s.lat !== null && s.lng !== null)
  const meta = [
    data.rating ? `★ ${data.rating}` : null,
    shortDuration(data.minutes),
    data.stops.length > 1 ? t('m.exp.stops', { n: data.stops.length }) : null
  ].filter(Boolean).join(' · ')
  const photos = [data.image, ...data.gallery].filter(Boolean)
  const hasIncluded = data.included.length + data.whatToBring.length + data.languages.length + data.accessibility.length > 0 || Boolean(data.groupSize || data.accessibilityNotes)
  const hasMeeting = Boolean(data.meeting || data.cancellation)

  const heroIcon = (icon: string, label: string, onClick: () => void, pressed?: boolean, text?: string | null) => (
    <button onClick={onClick} aria-label={label} aria-pressed={pressed} style={{ height: '40px', minWidth: '40px', padding: text ? '0 12px' : 0, borderRadius: '999px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: pressed ? 'var(--rum)' : 'white', fontSize: '13px', fontWeight: 600 }}>
      <Icon name={icon} size={16} className={pressed ? 'filled' : ''} />{text}
    </button>
  )

  const row = (icon: string, title: ReactNode, onClick: () => void, last = false) => (
    <button onClick={() => { triggerHaptic('light'); onClick() }} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 16px', background: 'none', border: 'none', borderBottom: last ? 'none' : '0.5px solid var(--separator)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: '52px' }}>
      <Icon name={icon} size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{title}</span>
      <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
    </button>
  )

  const rows: Array<{ icon: string; title: ReactNode; open: () => void }> = []
  if (data.reviewCount > 0) rows.push({ icon: 'star', title: <>{t('vendor.reviews')} <span className="num-font" style={{ color: 'var(--label-secondary)', fontWeight: 500 }}>{data.rating ? `★ ${data.rating} ` : ''}({data.reviewCount})</span></>, open: () => setSheet('reviews') })
  if (hasIncluded) rows.push({ icon: 'check', title: t('m.exp.included'), open: () => setSheet('included') })
  if (hasMeeting) rows.push({ icon: 'mapPin', title: t('m.xd.meetingCancel'), open: () => setSheet('meeting') })
  rows.push({ icon: 'users', title: planning ? '…' : t('m.detail.planWithCrew'), open: onPlanWithCrew })

  const list = (items: string[], icon: string, color: string) => (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: i < items.length - 1 ? '0.5px solid var(--separator)' : 'none', fontSize: '15px', color: 'var(--label-primary)' }}>
          <Icon name={icon} size={16} style={{ color, flexShrink: 0, marginTop: '2px' }} />{item}
        </li>
      ))}
    </ul>
  )
  const sheetTitle = (text: string) => <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{text}</h2>
  const subTitle = (text: string) => <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '16px 0 4px' }}>{text}</h3>
  const meetAt = data.meeting?.lat != null && data.meeting.lng != null ? { lat: data.meeting.lat, lng: data.meeting.lng } : null

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Hero */}
      <div ref={heroRef} style={{ position: 'relative', height: '340px', overflow: 'hidden', background: '#0F0E0C' }}>
        {data.video ? <SmartVideo src={data.video} poster={data.image} alt="" /> : data.image ? <Img src={data.image} alt="" width={1080} height={680} priority /> : null}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 30%, rgba(0,0,0,0.75) 100%)' }} />
        <BackButton floating onClick={onBack} fallback={backFallback} />
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)', right: '16px', zIndex: 10, display: 'flex', gap: '8px' }}>
          {photos.length > 1 && heroIcon('image', t('m.exp.gallery'), () => { setPhoto(0); setSheet('photos') }, undefined, String(photos.length))}
          {onToggleSave && heroIcon('heart', saved ? t('m.saved.unsave') : t('m.saved.save'), () => { triggerHaptic('light'); onToggleSave() }, Boolean(saved))}
          {heroIcon('share', t('m.events.share'), onShare, undefined, shareCopied ? t('m.events.linkCopied') : null)}
        </div>
        <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '18px', color: 'white' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{data.name}</h1>
          {meta && <p className="num-font" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>{meta}</p>}
        </div>
      </div>

      {/* The route */}
      {data.stops.length > 0 && (
        <section style={{ padding: '20px 16px 0' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.xd.theRoute')}</span></div></div>
          {placed.length > 0 && (
            <div style={{ position: 'relative', height: '200px', borderRadius: '16px', overflow: 'hidden', marginBottom: '10px' }}>
              <RouteMap stops={data.stops} fallbackCenter={fallbackCenter} interactive label={t('m.exp.stops', { n: data.stops.length })} />
            </div>
          )}
          <ol className="card" style={{ listStyle: 'none', margin: 0, padding: '0 16px', cursor: 'default' }}>
            {data.stops.map((s, i) => {
              const href = s.type === 'vendor' ? `/vendor/${s.id}` : s.type === 'photospot' ? `/photospot/${s.id}` : null
              const body = (
                <>
                  <span className="num-font" aria-hidden="true" style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--rum)', color: 'white', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                  {s.minutes ? <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)', flexShrink: 0 }}>{t('m.exp.minutes', { n: s.minutes })}</span> : null}
                </>
              )
              const style = { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < data.stops.length - 1 ? '0.5px solid var(--separator)' : 'none', textDecoration: 'none', minHeight: '44px' }
              return <li key={`${s.id}-${i}`}>{href ? <Link href={href} style={style} aria-label={`${i + 1}. ${s.name}`}>{body}</Link> : <div style={style}>{body}</div>}</li>
            })}
          </ol>
        </section>
      )}

      {/* Your host */}
      {data.host && (
        <section style={{ padding: '24px 16px 0' }}>
          <div className="section-header"><div className="section-heading"><span className="section-title">{t('m.exp.host')}</span></div></div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', cursor: 'default' }}>
            <button
              onClick={() => { if (data.host?.video) { triggerHaptic('light'); setHostVideo(true) } }}
              disabled={!data.host.video}
              aria-label={data.host.video ? t('m.xd.watchIntro') : data.host.name}
              style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', overflow: 'visible', border: 'none', padding: 0, background: 'var(--system-bg-secondary)', cursor: data.host.video ? 'pointer' : 'default', flexShrink: 0 }}
            >
              <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>{data.host.image && <Img src={data.host.image} alt="" width={112} height={112} sizes="56px" />}</span>
              {data.host.video && (
                <span aria-hidden="true" style={{ position: 'absolute', right: '-2px', bottom: '-2px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--rum)', color: 'white', border: '2px solid var(--system-bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={10} />
                </span>
              )}
            </button>
            <Link href={`/vendor/${data.host.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.host.name}</span>
                {data.host.isPremium && <span className="chip" style={{ minHeight: '22px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}><Icon name="crown" size={10} /> {t('common.premium')}</span>}
              </span>
              {data.host.video && <span style={{ display: 'block', fontSize: '13px', color: 'var(--rum-text)', fontWeight: 600 }}>{t('m.xd.watchIntro')}</span>}
            </Link>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
          </div>
        </section>
      )}

      {/* Everything else, one tap away */}
      <section style={{ padding: '24px 16px 0' }}>
        <div className="card" style={{ padding: 0, cursor: 'default', overflow: 'hidden' }}>
          {rows.map((r, i) => <div key={i}>{row(r.icon, r.title, r.open, i === rows.length - 1)}</div>)}
        </div>
      </section>

      {/* Price + Book */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', boxShadow: 'var(--shadow-sheet)' }}>
        {actionError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{actionError}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ marginRight: 'auto' }}>
            <Price usd={data.price} style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }} />
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{data.estimate ? t('m.xd.estPerPerson') : t('exp.perPerson')}</p>
          </div>
          <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); onBook() }} style={{ minWidth: '140px' }}>{t('m.detail.book')}</button>
        </div>
      </div>

      {/* Sheets */}
      <div className={`bottom-sheet-overlay ${sheet && sheet !== 'photos' ? 'open' : ''}`} onClick={() => setSheet(null)} />
      <div className={`bottom-sheet ${sheet && sheet !== 'photos' ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!sheet || sheet === 'photos'}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
          {sheet === 'reviews' && (
            <>
              {sheetTitle(t('vendor.reviews'))}
              {data.reviews.map(r => (
                <div key={r.id} style={{ padding: '12px 0', borderBottom: '0.5px solid var(--separator)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: 'var(--system-bg-secondary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {r.user.avatarUrl ? <Img src={r.user.avatarUrl} alt="" width={64} height={64} sizes="32px" /> : <Icon name="user" size={16} style={{ color: 'var(--label-tertiary)' }} />}
                    </span>
                    <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{r.user.name}</span>
                    <span aria-label={t('m.review.stars', { n: r.rating })} style={{ color: 'var(--gold)', fontSize: '13px' }}>{'★'.repeat(r.rating)}<span style={{ color: 'var(--label-tertiary)' }}>{'★'.repeat(5 - r.rating)}</span></span>
                  </div>
                  {r.comment && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.4 }}>{r.comment}</p>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}><ReportButton targetType="REVIEW" targetId={r.id} /></div>
                </div>
              ))}
              {data.reviewsHref && <Link href={data.reviewsHref} className="btn btn-secondary" style={{ width: '100%', marginTop: '12px', textDecoration: 'none' }}>{t('m.exp.allReviews', { n: data.reviewCount })}</Link>}
            </>
          )}
          {sheet === 'included' && (
            <>
              {sheetTitle(t('m.exp.included'))}
              {data.included.length > 0 && list(data.included, 'check', 'var(--success)')}
              {data.whatToBring.length > 0 && <>{subTitle(t('m.exp.whatToBring'))}{list(data.whatToBring, 'bookmark', 'var(--rum-text)')}</>}
              {(data.languages.length > 0 || data.groupSize) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                  {data.languages.length > 0 && <span className="chip" style={{ cursor: 'default' }}><Icon name="globe" size={14} /> {t('m.exp.languages', { list: data.languages.join(', ') })}</span>}
                  {data.groupSize && <span className="chip" style={{ cursor: 'default' }}><Icon name="users" size={14} /> {t('m.exp.groupSize', { n: data.groupSize })}</span>}
                </div>
              )}
              {(data.accessibility.length > 0 || data.accessibilityNotes) && (
                <>
                  {subTitle(t('m.exp.accessibility'))}
                  {data.accessibility.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {data.accessibility.map(k => <span key={k} className="chip" style={{ cursor: 'default', minHeight: '28px', fontSize: '13px' }}><Icon name="check" size={12} /> {labels.access(k)}</span>)}
                    </div>
                  )}
                  {data.accessibilityNotes && <p style={{ fontSize: '14px', color: 'var(--label-primary)', lineHeight: 1.45 }}>{data.accessibilityNotes}</p>}
                </>
              )}
            </>
          )}
          {sheet === 'meeting' && (
            <>
              {sheetTitle(t('m.xd.meetingCancel'))}
              {data.meeting && (
                <>
                  {subTitle(t('m.exp.meetingPoint'))}
                  <div className="card" style={{ overflow: 'hidden', cursor: 'default', marginTop: '6px' }}>
                    {meetAt && (
                      <div style={{ position: 'relative', height: '180px' }}>
                        <EtaMap center={meetAt} zoom={15} markers={[{ id: 'meet', ...meetAt, size: 22, label: t('m.exp.meetingPoint'), labelAlways: true }]} label={t('m.exp.meetingPoint')} />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
                      <Icon name="mapPin" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '15px', color: data.meeting.text ? 'var(--label-primary)' : 'var(--label-secondary)' }}>{data.meeting.text ?? t('m.common.notListed')}</span>
                      {data.meeting.lat != null && data.meeting.lng != null && (
                        <a href={directionsUrl({ lat: data.meeting.lat, lng: data.meeting.lng })!} target="_blank" rel="noopener noreferrer" className="section-link" style={{ minHeight: '36px' }}>{t('m.events.directions')}</a>
                      )}
                    </div>
                  </div>
                </>
              )}
              {data.cancellation && (
                <>
                  {subTitle(t('m.exp.cancellation'))}
                  <p style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.45, color: 'var(--label-primary)' }}>{t(TIER_SUMMARY_KEY[parseTier(data.cancellation.tier)])}</p>
                  {data.cancellation.note && <p style={{ fontSize: '14px', lineHeight: 1.45, color: 'var(--label-secondary)', marginTop: '4px' }}>{t('m.cancel.vendorNote', { note: data.cancellation.note })}</p>}
                  <Link href="/policies/cancellation" className="section-link" style={{ display: 'inline-flex', minHeight: '36px', marginTop: '4px' }}>{t('m.cancel.fullPolicy')}</Link>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Photos */}
      {sheet === 'photos' && (
        <div role="dialog" aria-modal="true" aria-label={t('m.exp.gallery')} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Img src={photos[photo]} alt={t('m.exp.photoN', { n: photo + 1 })} width={1600} height={1200} style={{ objectFit: 'contain', width: '100%', height: 'auto', maxHeight: '86vh' }} />
          <button aria-label={t('m.common.close')} onClick={() => setSheet(null)} className="back-button" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '16px' }}><Icon name="close" size={16} /></button>
          {photos.length > 1 && (
            <div style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
              <button className="back-button" aria-label={t('m.res.prev')} onClick={() => setPhoto(p => (p - 1 + photos.length) % photos.length)}><Icon name="back" size={16} /></button>
              <span className="num-font" style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>{t('m.res.nOfM', { n: photo + 1, total: photos.length })}</span>
              <button className="back-button" aria-label={t('m.res.next')} onClick={() => setPhoto(p => (p + 1) % photos.length)}><Icon name="chevronRight" size={16} /></button>
            </div>
          )}
        </div>
      )}

      {/* Host intro */}
      {hostVideo && data.host?.video && (
        <div role="dialog" aria-modal="true" aria-label={t('m.xd.watchIntro')} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video src={data.host.video} controls autoPlay playsInline style={{ width: '100%', maxHeight: '86vh' }} />
          <button aria-label={t('m.common.close')} onClick={() => setHostVideo(false)} className="back-button" style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '16px' }}><Icon name="close" size={16} /></button>
        </div>
      )}
    </main>
  )
}
