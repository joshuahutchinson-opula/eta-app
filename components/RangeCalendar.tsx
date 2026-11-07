// components/RangeCalendar.tsx — picking dates, the same way everywhere
// (planning or editing a trip, onboarding, extending a trip, the arrival's
// leave date, a town inside a multi-town trip):
//   DateRangeField   a summary row ("Nov 14 – 21 · 7 nights") that opens…
//   RangeSheet       …a bottom sheet with the calendar, "<n> nights", Clear
//                    and Done
//   RangeCalendar    month grids scrolling vertically; tap the arrival day,
//                    then the leaving day; the range in rum red with
//                    rounded ends; days before `min` (today by default) or
//                    after `max` are disabled. `fixedStart` only picks the
//                    leaving day (the start is already set).
// Dates are Jamaica days, "YYYY-MM-DD".
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { jamaicaDayKey } from '@/lib/trip-dates'

const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
export const nightsBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000))

function useLocale() {
  const { lang } = useLang()
  return lang === 'en' ? 'en-US' : lang
}

/** "Nov 14 – 21" (or "Nov 28 – Dec 3"). */
export function useRangeLabel() {
  const locale = useLocale()
  return (start: string, end: string | null) => {
    const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...o })
    if (!end || end === start) return f(start, { month: 'short', day: 'numeric' })
    const sameMonth = start.slice(0, 7) === end.slice(0, 7)
    return `${f(start, { month: 'short', day: 'numeric' })} – ${sameMonth ? f(end, { day: 'numeric' }) : f(end, { month: 'short', day: 'numeric' })}`
  }
}

interface CalendarProps {
  start: string | null
  end: string | null
  onChange: (start: string | null, end: string | null) => void
  min?: string
  max?: string
  fixedStart?: boolean
  months?: number
}

export function RangeCalendar({ start, end, onChange, min, max, fixedStart = false, months = 13 }: CalendarProps) {
  const { t } = useLang()
  const locale = useLocale()
  const floor = min ?? jamaicaDayKey()
  const first = (start ?? floor).slice(0, 7)
  const scroller = useRef<HTMLDivElement>(null)

  const monthList = useMemo(() => {
    const [y, m] = (min ?? jamaicaDayKey()).split('-').map(Number)
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 + i, 1))
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
    }).filter(({ y, m: mm }) => !max || ymd(y, mm, 1) <= max)
  }, [min, max, months])

  // Open on the month of the current start.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-month="${first}"]`)
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - 44
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' })), [locale])

  const tap = (day: string) => {
    triggerHaptic('selection')
    if (fixedStart) { if (start && day >= start) onChange(start, day); return }
    if (!start || end) { onChange(day, null); return }
    if (day < start) onChange(day, null)
    else onChange(start, day)
  }

  return (
    <div className="rc">
      <div className="rc-weekdays" aria-hidden>{weekdays.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div ref={scroller} className="rc-scroll">
        {monthList.map(({ y, m }) => {
          const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
          const lead = new Date(Date.UTC(y, m, 1)).getUTCDay()
          const title = new Date(Date.UTC(y, m, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
          return (
            <section key={`${y}-${m}`} data-month={ymd(y, m, 1).slice(0, 7)} className="rc-month" aria-label={title}>
              <h4 className="rc-month-title">{title}</h4>
              <div className="rc-grid" role="grid">
                {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: days }, (_, i) => {
                  const day = ymd(y, m, i + 1)
                  const disabled = day < floor || Boolean(max && day > max) || (fixedStart && Boolean(start) && day < start!)
                  const isStart = day === start
                  const isEnd = day === end
                  const inRange = Boolean(start && end && day > start && day < end)
                  const cls = ['rc-day', isStart && 'start', isEnd && 'end', inRange && 'in', start && end && start !== end && isStart && 'has-end', start && end && start !== end && isEnd && 'has-start', day === jamaicaDayKey() && 'today'].filter(Boolean).join(' ')
                  return (
                    <button key={day} type="button" className={cls} disabled={disabled} onClick={() => tap(day)} aria-pressed={isStart || isEnd || inRange} aria-label={new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}>
                      <span className="num-font">{i + 1}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
        {!monthList.length && <p className="rc-empty">{t('m.cal.noDays')}</p>}
      </div>
    </div>
  )
}

interface SheetProps extends Omit<CalendarProps, 'onChange'> {
  open: boolean
  title: string
  onClose: () => void
  onDone: (start: string, end: string) => void
}

/** The calendar in a bottom sheet with "<n> nights", Clear and Done. */
export function RangeSheet({ open, title, start, end, onClose, onDone, min, max, fixedStart }: SheetProps) {
  const { t } = useLang()
  const [draft, setDraft] = useState<{ start: string | null; end: string | null }>({ start, end })
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => { if (open) setDraft({ start, end }) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted) return null
  const n = draft.start && draft.end ? nightsBetween(draft.start, draft.end) : null
  const hint = !draft.start ? t('m.cal.pickStart') : !draft.end ? t('m.cal.pickEnd') : n === 1 ? t('m.cal.night') : t('m.cal.nights', { n: n ?? 0 })
  return createPortal(
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} style={{ zIndex: 700 }} />
      <div className={`bottom-sheet rc-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={title} style={{ zIndex: 701 }}>
        <div className="sheet-grabber" />
        {open && (
          <>
            <div className="rc-head">
              <h3>{title}</h3>
              <p className="num-font" aria-live="polite">{hint}</p>
            </div>
            <RangeCalendar start={draft.start} end={draft.end} min={min} max={max} fixedStart={fixedStart} onChange={(s, e) => setDraft({ start: s, end: e })} />
            <div className="rc-foot">
              <button type="button" className="rc-clear" onClick={() => setDraft(fixedStart ? { start, end: null } : { start: null, end: null })}>{t('m.cal.clear')}</button>
              <button type="button" className="btn btn-primary press" disabled={!draft.start || !draft.end} onClick={() => { triggerHaptic('medium'); onDone(draft.start!, draft.end!) }}>{t('m.cal.done')}</button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  )
}

/** A tappable summary of the dates that opens the calendar sheet. */
export function DateRangeField({ start, end, onChange, title, min, max, fixedStart, tone = 'default', label }: {
  start: string | null
  end: string | null
  onChange: (start: string, end: string) => void
  title: string
  min?: string
  max?: string
  fixedStart?: boolean
  tone?: 'default' | 'dark'
  label?: string
}) {
  const { t } = useLang()
  const range = useRangeLabel()
  const [open, setOpen] = useState(false)
  const n = start && end ? nightsBetween(start, end) : null
  return (
    <>
      <button type="button" className={`rc-field ${tone}`} onClick={() => { triggerHaptic('light'); setOpen(true) }} aria-haspopup="dialog">
        <Icon name="calendar" size={18} />
        <span className="rc-field-text">
          {label && <span className="rc-field-label">{label}</span>}
          <span className="rc-field-value num-font">{start ? range(start, end) : t('m.cal.addDates')}</span>
        </span>
        {n !== null && <span className="rc-field-nights num-font">{n === 1 ? t('m.cal.night') : t('m.cal.nights', { n })}</span>}
      </button>
      <RangeSheet open={open} title={title} start={start} end={end} min={min} max={max} fixedStart={fixedStart} onClose={() => setOpen(false)} onDone={(s, e) => { setOpen(false); onChange(s, e) }} />
    </>
  )
}
