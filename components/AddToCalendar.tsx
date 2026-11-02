// components/AddToCalendar.tsx — the two calendar buttons: .ics download
// (Apple Calendar, Outlook, most phones) and Google Calendar.
'use client'

import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { downloadIcs, googleCalendarUrl, type CalendarItem } from '@/lib/calendar'
import { triggerHaptic } from '@/lib/haptics'

export default function AddToCalendar({ item, uid, compact }: { item: CalendarItem; uid: string; compact?: boolean }) {
  const { t } = useLang()
  const size = compact ? { minHeight: '36px', padding: '6px 12px', fontSize: '14px' } : undefined
  return (
    <>
      <button className="chip" style={size} onClick={() => { triggerHaptic('light'); downloadIcs(item, uid, item.title) }}>
        <Icon name="calendar" size={14} /> {t('m.cal.add')}
      </button>
      <a className="chip" href={googleCalendarUrl(item)} target="_blank" rel="noopener noreferrer" style={{ ...size, textDecoration: 'none' }}>
        <Icon name="calendar" size={14} /> {t('m.cal.google')}
      </a>
    </>
  )
}
