// app/search/page.tsx — universal search: vendors (and what's on their
// menus), experiences, events, photo spots and stays in one place, grouped.
// Before typing: category shortcuts, recent searches (this device) and
// popular searches. Typos still find things (close matches, flagged).
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import BackButton from '@/components/BackButton'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import Img from '@/components/Img'
import { RegionPill } from '@/components/RegionSelector'
import { useRegion } from '@/components/RegionProvider'
import { useLang, usePatois } from '@/lib/i18n-client'
import { formatCity } from '@/lib/format'
import { useEventFormat } from '@/lib/events'
import { categoryStyle } from '@/lib/vendor-style'
import { triggerHaptic } from '@/lib/haptics'
import type { DictKey } from '@/lib/i18n'

interface Results {
  vendors: Array<{ id: string; name: string; category: string; neighborhood: string; city: string; images: string[]; isTransport: boolean; menuMatch: string | null }>
  experiences: Array<{ id: string; name: string; tagline: string; imageUrl: string; city: string }>
  events: Array<{ id: string; title: string; venueName: string; startAt: string; imageUrl: string | null; city: string }>
  photoSpots: Array<{ id: string; name: string; bestTime: string; officialPhoto: string; city: string }>
  stays: Array<{ id: string; name: string; priceRange: string; city: string; image: string | null }>
  fuzzy: boolean
}

const RECENT_KEY = 'eta_recent_searches'
const RECENT_MAX = 8

const SHORTCUTS: Array<{ key: DictKey; icon: string; href: string }> = [
  { key: 'm.search.cat.food', icon: 'food', href: '/vendors?category=FOOD' },
  { key: 'm.search.cat.drinks', icon: 'drink', href: '/vendors?category=DRINKS' },
  { key: 'm.search.cat.beach', icon: 'wave', href: '/vendors?category=BEACH' },
  { key: 'm.search.cat.nightlife', icon: 'party', href: '/events?when=tonight' },
  { key: 'm.search.cat.wellness', icon: 'spa', href: '/vendors?category=WELLNESS' },
  { key: 'm.search.cat.events', icon: 'calendar', href: '/events' },
  { key: 'm.search.cat.photo', icon: 'camera', href: '/explore' }
]

function readRecent(): string[] {
  try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string') : [] } catch { return [] }
}

function Row({ href, image, title, sub, icon }: { href: string; image?: string | null; title: string; sub: string; icon: string }) {
  return (
    <Link href={href} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textDecoration: 'none', marginBottom: '8px' }}>
      {image ? <span style={{ width: '48px', height: '48px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}><Img src={image} alt="" width={96} height={96} sizes="48px" /></span> : (
        <span style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-secondary)', flexShrink: 0 }}><Icon name={icon} size={20} /></span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
      </span>
      <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
    </Link>
  )
}

export default function SearchPage() {
  const { t } = useLang()
  const patois = usePatois()
  const { when } = useEventFormat()
  const { city } = useRegion()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [recent, setRecent] = useState<string[]>([])
  const [popular, setPopular] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    setRecent(readRecent())
    const initial = new URLSearchParams(window.location.search).get('q')
    if (initial) setQ(initial)
  }, [])

  useEffect(() => {
    fetch(`/api/search/popular?city=${city}`).then(r => (r.ok ? r.json() : [])).then(d => setPopular(Array.isArray(d) ? d : [])).catch(() => {})
  }, [city])

  const remember = (query: string) => {
    const next = [query, ...readRecent().filter(r => r.toLowerCase() !== query.toLowerCase())].slice(0, RECENT_MAX)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
    setRecent(next)
  }

  const run = async (query: string) => {
    setState('loading')
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&city=${city}`)
      if (!res.ok) throw new Error()
      const data: Results = await res.json()
      setResults(data)
      setState('done')
      const found = data.vendors.length + data.experiences.length + data.events.length + data.photoSpots.length + data.stays.length
      if (found > 0 && query.length >= 3) remember(query)
    } catch {
      setState('error')
    }
  }

  // Debounced as you type.
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) { setResults(null); setState('idle'); return }
    const timer = setTimeout(() => run(query), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city])

  const total = results ? results.vendors.length + results.experiences.length + results.events.length + results.photoSpots.length + results.stays.length : 0
  const group = (title: string, count: number, children: React.ReactNode) => count === 0 ? null : (
    <section style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '8px 0' }}>{title} · <span className="num-font">{count}</span></p>
      {children}
    </section>
  )
  const queryChip = (text: string, icon: string) => (
    <button key={`${icon}-${text}`} className="chip" onClick={() => { triggerHaptic('selection'); setQ(text) }} style={{ minHeight: '36px' }}>
      <Icon name={icon} size={12} /> {text}
    </button>
  )

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: 0, background: 'var(--system-bg)', zIndex: 5 }}>
        <BackButton />
        <label className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', flex: 1, minHeight: '44px', cursor: 'text' }}>
          <Icon name="search" size={16} style={{ color: 'var(--label-secondary)' }} />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={t('m.search.placeholder')}
            aria-label={t('m.search.open')}
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '17px', outline: 'none', fontFamily: 'inherit' }}
          />
        </label>
        <RegionPill />
      </div>

      <div style={{ padding: '0 16px' }}>
        {state === 'idle' && (
          <>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '4px 0 8px' }}>{t('m.search.browse')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px', marginBottom: '20px' }}>
              {SHORTCUTS.map(s => (
                <Link key={s.key} href={s.href} onClick={() => triggerHaptic('light')} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '14px 8px', textDecoration: 'none' }}>
                  <Icon name={s.icon} size={22} style={{ color: 'var(--rum-text)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-primary)', textAlign: 'center' }}>{t(s.key)}</span>
                </Link>
              ))}
            </div>
            {recent.length > 0 && (
              <section style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)' }}>{t('m.search.recent')}</p>
                  <button className="btn btn-tertiary" style={{ minHeight: '36px', padding: '0 4px', fontSize: '13px' }} onClick={() => { try { localStorage.removeItem(RECENT_KEY) } catch {}; setRecent([]) }}>{t('m.search.clearRecent')}</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{recent.map(r => queryChip(r, 'clock'))}</div>
              </section>
            )}
            {popular.length > 0 && (
              <section style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.search.popular')}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{popular.map(p => queryChip(p, 'flame'))}</div>
              </section>
            )}
            <p style={{ fontSize: '13px', color: 'var(--label-tertiary)', textAlign: 'center', marginTop: '8px' }}>{t('m.search.hint')}</p>
          </>
        )}
        {state === 'loading' && !results && <p role="status" style={{ fontSize: '14px', color: 'var(--label-secondary)', textAlign: 'center', marginTop: '24px' }}>{patois.loadingMarketplace}…</p>}
        {state === 'error' && <ErrorState onRetry={() => run(q.trim())} />}
        {state !== 'error' && results && total === 0 && (
          <div className="empty-state"><Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} /><p style={{ fontSize: '17px', fontWeight: 600 }}>{patois.emptySearch}</p></div>
        )}
        {state !== 'error' && results && (
          <>
            {results.fuzzy && total > 0 && <p role="status" style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 8px' }}>{t('m.search.didYouMean', { q: q.trim() })}</p>}
            {group(t('m.search.vendors'), results.vendors.length, results.vendors.map(v => (
              <Row key={v.id} href={`/vendor/${v.id}`} image={v.images[0]} icon="marketplace" title={v.name} sub={v.menuMatch ? t('m.search.menuMatch', { item: v.menuMatch }) : `${categoryStyle(v.category).label} · ${v.neighborhood}, ${formatCity(v.city)}`} />
            )))}
            {group(t('m.search.experiences'), results.experiences.length, results.experiences.map(e => (
              <Row key={e.id} href={`/experiences/${e.id}`} image={e.imageUrl} icon="compass" title={e.name} sub={`${e.tagline} · ${formatCity(e.city)}`} />
            )))}
            {group(t('m.search.events'), results.events.length, results.events.map(e => (
              <Row key={e.id} href={`/events/${e.id}`} image={e.imageUrl} icon="party" title={e.title} sub={`${when(e.startAt)} · ${e.venueName}`} />
            )))}
            {group(t('m.search.stays'), results.stays.length, results.stays.map(s => (
              <Row key={s.id} href={`/accommodations/${s.id}`} image={s.image} icon="home" title={s.name} sub={`${s.priceRange} · ${formatCity(s.city)}`} />
            )))}
            {group(t('m.search.photoSpots'), results.photoSpots.length, results.photoSpots.map(s => (
              <Row key={s.id} href={`/photospot/${s.id}`} image={s.officialPhoto} icon="camera" title={s.name} sub={`${t('spots.bestTime')}: ${s.bestTime} · ${formatCity(s.city)}`} />
            )))}
          </>
        )}
      </div>
      <Dock />
    </main>
  )
}
