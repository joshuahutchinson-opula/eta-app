// components/AddToCalendar.tsx — one "Add To Calendar" button. Tapping it
// slides up a sheet to pick the phone's calendar: Apple Calendar or Other
// (the .ics file, which iPhones and most calendars open), Google Calendar,
// or Outlook (their add-event pages). The sheet sits on <body> so a moving
// page can't trap it.
'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { downloadIcs, googleCalendarUrl, outlookCalendarUrl, type CalendarItem } from '@/lib/calendar'
import { triggerHaptic } from '@/lib/haptics'

export default function AddToCalendar({ item, uid, compact, block }: { item: CalendarItem; uid: string; compact?: boolean; block?: boolean }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [added, setAdded] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!added) return
    const id = setTimeout(() => setAdded(false), 2400)
    return () => clearTimeout(id)
  }, [added])

  const size = compact ? { minHeight: '36px', padding: '6px 12px', fontSize: '14px' } : undefined
  const done = () => { triggerHaptic('medium'); setOpen(false); setAdded(true) }
  const ics = () => { downloadIcs(item, uid, item.title); done() }

  const sheet = (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={t('m.cal.addTo')}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px', color: 'var(--label-primary)' }}>
          <p className="section-eyebrow">{t('m.cal.addTo')}</p>
          <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 10px' }}>{t('m.cal.pick')}</h3>
          <div className="list-in" key={open ? 'open' : 'shut'}>
            <button className="cal-row" onClick={ics}><span className="cal-ic"><Icon name="calendar" size={18} /></span>{t('m.cal.apple')}</button>
            <a className="cal-row" href={googleCalendarUrl(item)} target="_blank" rel="noopener noreferrer" onClick={done}><span className="cal-ic"><Icon name="calendar" size={18} /></span>{t('m.cal.googleCal')}</a>
            <a className="cal-row" href={outlookCalendarUrl(item)} target="_blank" rel="noopener noreferrer" onClick={done}><span className="cal-ic"><Icon name="calendar" size={18} /></span>{t('m.cal.outlook')}</a>
            <button className="cal-row" onClick={ics}><span className="cal-ic"><Icon name="download" size={18} /></span>{t('m.cal.other')}</button>
          </div>
          <button className="btn btn-tertiary" style={{ width: '100%', marginTop: '10px' }} onClick={() => setOpen(false)}>{t('m.book.cancel')}</button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <button className={block ? 'btn btn-secondary' : 'chip'} style={block ? { width: '100%' } : size} onClick={() => { triggerHaptic('light'); setOpen(true) }} aria-haspopup="dialog" aria-expanded={open}>
        <Icon name={added ? 'check' : 'calendar'} size={block ? 16 : 14} /> {added ? t('m.cal.added') : t('m.cal.addTo')}
      </button>
      {mounted && createPortal(sheet, document.body)}
    </>
  )
}
