// components/home/QuickPreview.tsx — long-press any Featured or event card
// on Home for a quick look without leaving Home: photos, hours (or the
// event's time), how far it is, Go (directions) and Save. useLongPress()
// is the gesture: hold ~450ms without moving; the tap that follows a
// long-press is swallowed so the card doesn't open as well.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import { SaveHeart, useOpenLine } from '@/components/home/bits'
import { directionsUrl } from '@/lib/calendar'
import { formatDistance, distanceFrom } from '@/lib/geo'
import { DAYS, formatTime, parseHours, openNow } from '@/lib/hours'
import { useLang } from '@/lib/i18n-client'
import { useEventFormat } from '@/lib/events'
import { triggerHaptic } from '@/lib/haptics'
import type { LatLng } from '@/lib/routing'

export type PreviewTarget =
  | { kind: 'vendor'; id: string; name: string; images: string[]; lat: number; lng: number; subtitle?: string | null }
  | { kind: 'event'; id: string; name: string; images: string[]; lat: number | null; lng: number | null; startAt: string; endAt?: string | null; venue: string; bookable?: boolean }

export function useLongPress(onLong: () => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  return {
    onTouchStart: (e: React.TouchEvent) => {
      fired.current = false
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      clear()
      timer.current = setTimeout(() => { fired.current = true; triggerHaptic('medium'); onLong() }, ms)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = start.current
      if (s && Math.hypot(e.touches[0].clientX - s.x, e.touches[0].clientY - s.y) > 8) clear()
    },
    onTouchEnd: () => clear(),
    onTouchCancel: () => clear(),
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (!fired.current) { fired.current = true; onLong() } },
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.preventDefault(); e.stopPropagation(); fired.current = false } }
  }
}

interface VendorDetail { hours: unknown; rating?: number; reviewCount?: number; images?: string[]; neighborhood?: string }

export default function QuickPreview({ target, location, onClose }: { target: PreviewTarget | null; location: LatLng | null; onClose: () => void }) {
  const { t, lang } = useLang()
  const { range } = useEventFormat()
  const openLine = useOpenLine()
  const [detail, setDetail] = useState<VendorDetail | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setDetail(null)
    if (target?.kind !== 'vendor') return
    let cancelled = false
    fetch(`/api/vendors/${target.id}`).then(r => (r.ok ? r.json() : null)).then(d => { if (!cancelled && d) setDetail(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [target])

  const close = useCallback(() => onClose(), [onClose])
  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, close])

  if (!mounted) return null
  const open = Boolean(target)
  const images = target ? Array.from(new Set([...(target.images ?? []), ...(detail?.images ?? [])])).slice(0, 6) : []
  const km = target ? distanceFrom(location, target) : null
  const go = target ? directionsUrl({ lat: target.lat, lng: target.lng, name: target.name }) : null
  const hours = detail ? parseHours(detail.hours) : null
  const locale = lang === 'en' ? 'en-US' : lang
  const dayNames = DAYS.map((_, i) => new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }))
  const href = target ? (target.kind === 'vendor' ? `/vendor/${target.id}` : `/events/${target.id}`) : '/'

  return createPortal(
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={close} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={target?.name ?? ''} style={{ maxHeight: '86vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        {target && (
          <div style={{ padding: '0 0 22px' }}>
            <div className="qp-photos">
              {images.length ? images.map(src => <span key={src} className="qp-photo"><Img src={src} alt="" width={640} height={480} sizes="80vw" /></span>)
                : <span className="qp-photo qp-empty" aria-hidden><Icon name={target.kind === 'event' ? 'party' : 'image'} size={32} /></span>}
            </div>
            <div style={{ padding: '14px 20px 0' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)' }}>{target.name}</h3>
              <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'center' }}>
                {target.kind === 'event'
                  ? <><span className="num-font"><Icon name="clock" size={12} /> {range(target.startAt, target.endAt ?? null)}</span><span><Icon name="mapPin" size={12} /> {target.venue}</span></>
                  : <>
                      {target.subtitle && <span>{target.subtitle}</span>}
                      {detail?.rating && <span className="num-font"><Icon name="star" size={12} style={{ color: 'var(--gold)' }} /> {detail.rating} ({detail.reviewCount ?? 0})</span>}
                    </>}
                {km !== null && <span className="num-font"><Icon name="navigate" size={12} /> {t('m.qp.away', { d: formatDistance(km) ?? '' })}</span>}
              </p>
              {target.kind === 'vendor' && (
                <div className="qp-hours">
                  <p className="qp-hours-now">{openLine(detail ? openNow(detail.hours) : null) ?? (detail ? t('m.qp.noHours') : '…')}</p>
                  {hours && (
                    <dl className="qp-week num-font">
                      {DAYS.map((d, i) => (
                        <div key={d}><dt>{dayNames[i]}</dt><dd>{(hours[d] ?? []).length ? (hours[d] ?? []).map(([a, b]) => `${formatTime(a)}–${formatTime(b)}`).join(', ') : t('common.closed')}</dd></div>
                      ))}
                    </dl>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', alignItems: 'center' }}>
                {go && <a href={go} target="_blank" rel="noopener noreferrer" className="btn btn-primary press" style={{ flex: 1, textDecoration: 'none' }} onClick={() => triggerHaptic('light')}><Icon name="navigate" size={16} /> {t('m.qp.go')}</a>}
                <Link href={href} className="btn btn-secondary press" style={{ flex: 1, textDecoration: 'none' }} onClick={close}>{target.kind === 'event' && target.bookable ? t('m.events.getTickets') : t('m.qp.open')}</Link>
                <SaveHeart kind={target.kind === 'vendor' ? 'vendors' : 'events'} id={target.id} className="save-btn qp-save" />
              </div>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
