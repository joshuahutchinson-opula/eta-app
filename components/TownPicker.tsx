// components/TownPicker.tsx — choosing a town for a trip (Plan My Trip,
// onboarding, another town in a multi-town trip): a searchable list where
// each row has a small photo of the town (/api/towns), its name, its parish,
// and "Been here · 34% explored" when they've visited. Tap to select (a
// check mark), which closes the sheet.
//   TownField  the selected town as a row that opens the list
//   TownSheet  the list on its own (e.g. "Add another town")
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { parishFor, townFor, TOWNS, type CityCode } from '@/lib/regions'
import { allTrips } from '@/lib/stage-client'
import { jamaicaDayKey } from '@/lib/trip-dates'

interface TownRow { city: CityCode; name: string; parish: string; image: string | null }

let cache: TownRow[] | null = null
let inflight: Promise<TownRow[]> | null = null

function loadTowns(): Promise<TownRow[]> {
  if (cache) return Promise.resolve(cache)
  inflight = inflight ?? fetch('/api/towns').then(r => (r.ok ? r.json() : [])).then((d: TownRow[]) => { cache = Array.isArray(d) && d.length ? d : null; return cache ?? [] }).catch(() => [])
  return inflight
}

function useTowns(): TownRow[] {
  const fallback = useMemo(() => TOWNS.map(t => ({ city: t.city, name: t.name, parish: parishFor(t.city).name, image: null })), [])
  const [rows, setRows] = useState<TownRow[]>(cache ?? fallback)
  useEffect(() => { loadTowns().then(r => { if (r.length) setRows(r) }) }, [])
  return rows
}

/** Towns they've been to (past trips, and any town with check-ins) and how much of each they've explored. */
export function useTravelHistory(refresh: unknown = null): { visited: Set<string>; explored: Record<string, number> } {
  const [state, setState] = useState<{ visited: Set<string>; explored: Record<string, number> }>({ visited: new Set(), explored: {} })
  useEffect(() => {
    let explored: Record<string, number> = {}
    try { explored = JSON.parse(localStorage.getItem('eta_travel_trips') || '{}').explored ?? {} } catch {}
    const today = jamaicaDayKey()
    const past = allTrips().filter(x => x.status === 'ENDED' || x.end < today)
    setState({ visited: new Set<string>([...past.map(x => x.city), ...past.flatMap(x => x.legs.map(l => l.city)), ...Object.keys(explored)]), explored })
  }, [refresh])
  return state
}

/** The towns most visitors go to, first in the list. */
const POPULAR: CityCode[] = ['NEGRIL', 'MONTEGO_BAY', 'OCHO_RIOS', 'KINGSTON', 'PORT_ANTONIO', 'TREASURE_BEACH', 'RUNAWAY_BAY', 'FALMOUTH']

export function TownSheet({ open, title, value, visited, explored, exclude = [], onPick, onClose }: {
  open: boolean
  title: string
  value: CityCode | null
  visited: Set<string>
  explored: Record<string, number>
  exclude?: CityCode[]
  onPick: (city: CityCode) => void
  onClose: () => void
}) {
  const { t } = useLang()
  const towns = useTowns()
  const [q, setQ] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => { if (open) setQ('') }, [open])

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    const rank = (c: CityCode) => { const i = POPULAR.indexOf(c); return i === -1 ? 99 : i }
    return towns
      .filter(r => !exclude.includes(r.city))
      .filter(r => !term || r.name.toLowerCase().includes(term) || r.parish.toLowerCase().includes(term))
      .sort((a, b) => rank(a.city) - rank(b.city) || a.name.localeCompare(b.name))
  }, [towns, q, exclude])

  if (!mounted) return null
  return createPortal(
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} style={{ zIndex: 700 }} />
      <div className={`bottom-sheet tp-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={title} style={{ zIndex: 701 }}>
        <div className="sheet-grabber" />
        {open && (
          <>
            <div className="tp-head">
              <h3>{title}</h3>
              <label className="plan-search">
                <Icon name="search" size={16} style={{ color: 'var(--label-secondary)' }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('m.tp.search')} aria-label={t('m.tp.search')} />
              </label>
            </div>
            <ul className="tp-list" role="listbox" aria-label={title}>
              {list.map(r => {
                const on = r.city === value
                const been = visited.has(r.city)
                return (
                  <li key={r.city}>
                    <button type="button" role="option" aria-selected={on} className={`tp-row ${on ? 'on' : ''}`} onClick={() => { triggerHaptic('selection'); onPick(r.city) }}>
                      <span className="tp-photo">{r.image ? <Img src={r.image} alt="" width={120} height={120} sizes="48px" /> : <Icon name="mapPin" size={18} />}</span>
                      <span className="tp-text">
                        <span className="tp-name">{r.name}</span>
                        <span className="tp-sub">{r.parish}{been ? ` · ${t('m.plan.beenHere', { n: explored[r.city] ?? 0 })}` : ''}</span>
                      </span>
                      {on && <Icon name="check" size={18} style={{ color: 'var(--rum-text)' }} />}
                    </button>
                  </li>
                )
              })}
              {list.length === 0 && <li className="tp-empty">{t('m.tp.none')}</li>}
            </ul>
          </>
        )}
      </div>
    </>,
    document.body
  )
}

export function TownField({ value, onChange, title, visited, explored, tone = 'default' }: {
  value: CityCode
  onChange: (city: CityCode) => void
  title: string
  visited: Set<string>
  explored: Record<string, number>
  tone?: 'default' | 'dark'
}) {
  const { t } = useLang()
  const towns = useTowns()
  const [open, setOpen] = useState(false)
  const row = towns.find(r => r.city === value)
  const been = visited.has(value)
  return (
    <>
      <button type="button" className={`tp-field ${tone}`} onClick={() => { triggerHaptic('light'); setOpen(true) }} aria-haspopup="dialog">
        <span className="tp-photo">{row?.image ? <Img src={row.image} alt="" width={120} height={120} sizes="48px" /> : <Icon name="mapPin" size={18} />}</span>
        <span className="tp-text">
          <span className="tp-name">{townFor(value).name}</span>
          <span className="tp-sub">{parishFor(value).name}{been ? ` · ${t('m.plan.beenHere', { n: explored[value] ?? 0 })}` : ` · ${t('m.plan.newForYou')}`}</span>
        </span>
        <Icon name="chevronDown" size={14} style={{ opacity: 0.6 }} />
      </button>
      <TownSheet open={open} title={title} value={value} visited={visited} explored={explored} onClose={() => setOpen(false)} onPick={c => { setOpen(false); onChange(c) }} />
    </>
  )
}
