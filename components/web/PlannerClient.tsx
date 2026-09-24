// components/web/PlannerClient.tsx
// No-login day planner (B7). Builds an ordered list of real vendors and
// photo spots, then saves it server-side as a Trip (source "web") and hands
// back a shareable read-only link. The edit key stays in this browser, so
// the same person can come back and change the plan.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { CATEGORY_LABELS, type VendorCardData } from '@/lib/vendor-types'
import { areaLabel } from '@/lib/areas'
import { getTripKey, rememberTrip, type TripView } from '@/lib/trip-client'

interface PlanStop {
  key: string
  stopId?: string
  kind: 'vendor' | 'photospot'
  refId: string
  name: string
  subtitle: string
  image: string | null
  time: string
  note: string
}

interface PhotoSpot { id: string; name: string; bestTime: string; officialPhoto: string; city: string }

let counter = 0
const k = () => `s${++counter}`

async function api<T>(path: string, method: string, body: unknown, key?: string): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-trip-key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export default function PlannerClient({ suggestions, editSlug }: { suggestions: VendorCardData[]; editSlug?: string }) {
  const router = useRouter()
  const [name, setName] = useState('My day in Negril')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [stops, setStops] = useState<PlanStop[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VendorCardData[]>([])
  const [spots, setSpots] = useState<PhotoSpot[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const original = useRef<TripView | null>(null)
  const editKey = editSlug ? getTripKey(editSlug) : undefined

  useEffect(() => {
    fetch('/api/photospots').then(r => r.json()).then(d => setSpots(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Editing an existing plan: load it into the builder.
  useEffect(() => {
    if (!editSlug) return
    fetch(`/api/trips/${editSlug}`).then(r => r.json()).then((trip: TripView) => {
      if (!trip?.slug) return
      original.current = trip
      setName(trip.name)
      setDate(trip.date ? trip.date.slice(0, 10) : '')
      setNotes(trip.notes ?? '')
      setStops(trip.stops.filter(s => s.kind !== 'experience').map(s => ({
        key: k(), stopId: s.id, kind: s.kind as 'vendor' | 'photospot', refId: s.refId, name: s.name, subtitle: s.subtitle, image: s.image, time: s.time ?? '', note: s.note ?? ''
      })))
    }).catch(() => {})
  }, [editSlug])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    const timer = setTimeout(() => {
      fetch(`/api/web/vendors?q=${encodeURIComponent(q)}&take=8&facets=0`).then(r => r.json()).then(d => setResults(d.items ?? [])).catch(() => {})
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const matchingSpots = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? spots.filter(s => s.name.toLowerCase().includes(q)).slice(0, 4) : []
  }, [query, spots])

  const has = (kind: PlanStop['kind'], id: string) => stops.some(s => s.kind === kind && s.refId === id)

  const addVendor = (v: VendorCardData) => {
    if (has('vendor', v.id)) return
    setStops(prev => [...prev, { key: k(), kind: 'vendor', refId: v.id, name: v.name, subtitle: `${CATEGORY_LABELS[v.category] ?? v.category} · ${areaLabel(v.area)}`, image: v.image, time: '', note: '' }])
  }

  const addSpot = (s: PhotoSpot) => {
    if (has('photospot', s.id)) return
    setStops(prev => [...prev, { key: k(), kind: 'photospot', refId: s.id, name: s.name, subtitle: `Photo spot · best at ${s.bestTime}`, image: s.officialPhoto, time: '', note: '' }])
  }

  const move = (i: number, dir: -1 | 1) => {
    setStops(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const update = (i: number, patch: Partial<PlanStop>) => setStops(prev => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  const stopBody = (s: PlanStop) => ({
    ...(s.kind === 'vendor' ? { vendorId: s.refId } : { photoSpotId: s.refId }),
    time: s.time || undefined,
    note: s.note || undefined
  })

  const save = async () => {
    if (stops.length === 0) { setError('Add at least one stop.'); return }
    setSaving(true)
    setError(null)
    try {
      if (editSlug && editKey && original.current) {
        await api(`/api/trips/${editSlug}`, 'PATCH', { name, date: date ? new Date(`${date}T12:00:00`).toISOString() : null, notes }, editKey)
        const keep = new Set(stops.map(s => s.stopId).filter(Boolean))
        for (const old of original.current.stops) {
          if (!keep.has(old.id) && old.kind !== 'experience') await api(`/api/trips/${editSlug}/stops?stopId=${old.id}`, 'DELETE', undefined, editKey)
        }
        const ids: string[] = []
        for (const s of stops) {
          if (s.stopId) {
            await api(`/api/trips/${editSlug}/stops`, 'PATCH', { stopId: s.stopId, time: s.time, note: s.note }, editKey)
            ids.push(s.stopId)
          } else {
            const trip = await api<TripView>(`/api/trips/${editSlug}/stops`, 'POST', stopBody(s), editKey)
            const added = trip.stops.find(x => x.refId === s.refId && x.kind === s.kind)
            if (added) ids.push(added.id)
          }
        }
        await api(`/api/trips/${editSlug}/stops`, 'PATCH', { order: ids }, editKey)
        router.push(`/web/plan/${editSlug}`)
        return
      }
      const data = await api<{ trip: TripView; editKey: string }>('/api/trips', 'POST', {
        source: 'web',
        name,
        date: date ? new Date(`${date}T12:00:00`).toISOString() : undefined,
        notes,
        stops: stops.map(stopBody)
      })
      rememberTrip({ slug: data.trip.slug, editKey: data.editKey, name: data.trip.name })
      router.push(`/web/plan/${data.trip.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setSaving(false)
    }
  }

  const pickList = query.trim() ? results : suggestions

  return (
    <div className="w-planner">
      <section>
        <div className="w-panel" style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span className="w-faint" style={{ fontSize: 13, fontWeight: 700 }}>Plan name</span>
            <input className="w-input" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="w-faint" style={{ fontSize: 13, fontWeight: 700 }}>Date (optional)</span>
              <input className="w-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="w-faint" style={{ fontSize: 13, fontWeight: 700 }}>Notes for your crew (optional)</span>
              <input className="w-input" value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} placeholder="Meet at the roundabout at 9…" />
            </label>
          </div>
        </div>

        <h2 className="w-section-title" style={{ fontSize: 24, marginBottom: 12 }}>Your day · {stops.length} {stops.length === 1 ? 'stop' : 'stops'}</h2>
        {stops.length === 0 ? (
          <div className="w-empty" style={{ padding: 40 }}>
            <h3 style={{ fontSize: 20 }}>Add your first stop</h3>
            <p className="w-muted">Search on the right, or pick from what’s trending.</p>
          </div>
        ) : (
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {stops.map((s, i) => (
              <li key={s.key} className="w-stop">
                <span className="w-stop-num">{i + 1}</span>
                {s.image ? <img src={s.image} alt="" /> : <span />}
                <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
                  <div>
                    <p style={{ fontWeight: 700 }}>{s.name}</p>
                    <p className="w-muted" style={{ fontSize: 13 }}>{s.subtitle}</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
                    <label><span className="w-sr">Time for {s.name}</span>
                      <input className="w-input" style={{ height: 36, fontSize: 14, width: '100%' }} type="time" value={s.time} onChange={e => update(i, { time: e.target.value })} />
                    </label>
                    <label><span className="w-sr">Note for {s.name}</span>
                      <input className="w-input" style={{ height: 36, fontSize: 14, width: '100%' }} placeholder="Note (optional)" value={s.note} maxLength={280} onChange={e => update(i, { note: e.target.value })} />
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="w-icon-btn" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="w-icon-btn" aria-label={`Move ${s.name} down`} disabled={i === stops.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="w-icon-btn" aria-label={`Remove ${s.name}`} onClick={() => setStops(prev => prev.filter((_, j) => j !== i))}><Icon name="close" size={12} /></button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {editSlug && !editKey ? (
          <p className="w-form-msg w-muted">This plan was made in another browser, so saving will create your own copy with a new link.</p>
        ) : null}
        {error ? <p role="alert" className="w-form-msg" style={{ color: 'var(--w-accent-strong)' }}>{error}</p> : null}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, alignItems: 'center' }}>
          <button type="button" className="w-btn w-btn-primary" onClick={save} disabled={saving || stops.length === 0}>
            {saving ? 'Saving…' : editSlug ? 'Save changes' : 'Create shareable link'}
          </button>
          <span className="w-faint" style={{ fontSize: 13 }}>No account needed. Anyone with the link can view it; only this browser can edit it.</span>
        </div>
      </section>

      <aside className="w-aside">
        <div className="w-panel" style={{ display: 'grid', gap: 14 }}>
          <label className="w-search" style={{ boxShadow: 'none', height: 46 }}>
            <Icon name="search" size={16} style={{ color: 'var(--w-ink-3)' }} />
            <span className="w-sr">Search vendors and photo spots</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jerk, snorkel, sunset…" />
          </label>
          <p className="w-faint" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {query.trim() ? 'Results' : 'Trending now'}
          </p>
          <div style={{ display: 'grid', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            {pickList.map(v => (
              <div key={v.id} className="w-mini-card">
                {v.image ? <img src={v.image} alt="" /> : <span />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{v.name}</p>
                  <p className="w-muted" style={{ fontSize: 12 }}>{CATEGORY_LABELS[v.category]} · {areaLabel(v.area)}</p>
                </div>
                <button type="button" className="w-icon-btn" aria-label={`Add ${v.name}`} disabled={has('vendor', v.id)} onClick={() => addVendor(v)}>
                  {has('vendor', v.id) ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}
                </button>
              </div>
            ))}
            {matchingSpots.map(s => (
              <div key={s.id} className="w-mini-card">
                <img src={s.officialPhoto} alt="" />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</p>
                  <p className="w-muted" style={{ fontSize: 12 }}>Photo spot · best at {s.bestTime}</p>
                </div>
                <button type="button" className="w-icon-btn" aria-label={`Add ${s.name}`} disabled={has('photospot', s.id)} onClick={() => addSpot(s)}>
                  {has('photospot', s.id) ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}
                </button>
              </div>
            ))}
            {query.trim() && pickList.length === 0 && matchingSpots.length === 0 ? <p className="w-muted" style={{ fontSize: 14 }}>No matches.</p> : null}
          </div>
        </div>
      </aside>
    </div>
  )
}
