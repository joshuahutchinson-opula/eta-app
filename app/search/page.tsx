// app/search/page.tsx — universal search: vendors, experiences, events and
// photo spots in one place, grouped.
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import ErrorState from '@/components/ErrorState'
import { useRegion } from '@/components/RegionProvider'
import { useLang, usePatois } from '@/lib/i18n-client'
import { formatCity } from '@/lib/format'
import { eventWhen } from '@/lib/events'
import { categoryStyle } from '@/lib/vendor-style'

interface Results {
  vendors: Array<{ id: string; name: string; category: string; neighborhood: string; city: string; images: string[]; isTransport: boolean }>
  experiences: Array<{ id: string; name: string; tagline: string; imageUrl: string; city: string }>
  events: Array<{ id: string; title: string; venueName: string; startAt: string; imageUrl: string | null; city: string }>
  photoSpots: Array<{ id: string; name: string; bestTime: string; officialPhoto: string; city: string }>
}

function Row({ href, image, title, sub, icon }: { href: string; image?: string | null; title: string; sub: string; icon: string }) {
  return (
    <Link href={href} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', textDecoration: 'none', marginBottom: '8px' }}>
      {image ? <img src={image} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} /> : (
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
  const router = useRouter()
  const { t } = useLang()
  const patois = usePatois()
  const { city } = useRegion()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const run = async (query: string) => {
    setState('loading')
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&city=${city}`)
      if (!res.ok) throw new Error()
      setResults(await res.json())
      setState('done')
    } catch {
      setState('error')
    }
  }

  // Debounced as you type.
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) { setResults(null); setState('idle'); return }
    const timer = setTimeout(() => run(query), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, city])

  const total = results ? results.vendors.length + results.experiences.length + results.events.length + results.photoSpots.length : 0
  const group = (title: string, count: number, children: React.ReactNode) => count === 0 ? null : (
    <section style={{ marginBottom: '16px' }}>
      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--label-secondary)', margin: '8px 0' }}>{title} · <span className="num-font">{count}</span></p>
      {children}
    </section>
  )

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: 0, background: 'var(--system-bg)', zIndex: 5 }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label-primary)', flexShrink: 0 }}>
          <Icon name="back" size={16} />
        </button>
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
      </div>

      <div style={{ padding: '0 16px' }}>
        {state === 'idle' && <p style={{ fontSize: '14px', color: 'var(--label-secondary)', textAlign: 'center', marginTop: '24px' }}>{t('m.search.hint')}</p>}
        {state === 'loading' && !results && <p role="status" style={{ fontSize: '14px', color: 'var(--label-secondary)', textAlign: 'center', marginTop: '24px' }}>{patois.loadingMarketplace}…</p>}
        {state === 'error' && <ErrorState onRetry={() => run(q.trim())} />}
        {state !== 'error' && results && total === 0 && (
          <div className="empty-state"><Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} /><p style={{ fontSize: '17px', fontWeight: 600 }}>{patois.emptySearch}</p></div>
        )}
        {state !== 'error' && results && (
          <>
            {group(t('m.search.vendors'), results.vendors.length, results.vendors.map(v => (
              <Row key={v.id} href={`/vendor/${v.id}`} image={v.images[0]} icon="marketplace" title={v.name} sub={`${categoryStyle(v.category).label} · ${v.neighborhood}, ${formatCity(v.city)}`} />
            )))}
            {group(t('m.search.experiences'), results.experiences.length, results.experiences.map(e => (
              <Row key={e.id} href={`/experiences/${e.id}`} image={e.imageUrl} icon="compass" title={e.name} sub={`${e.tagline} · ${formatCity(e.city)}`} />
            )))}
            {group(t('m.search.events'), results.events.length, results.events.map(e => (
              <Row key={e.id} href={`/events/${e.id}`} image={e.imageUrl} icon="party" title={e.title} sub={`${eventWhen(e.startAt)} · ${e.venueName}`} />
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
