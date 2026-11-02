// lib/events.ts — shared shape and formatting for promoter events.
'use client'

import { useCallback } from 'react'
import { useLang } from '@/lib/i18n-client'

export interface EventItem {
  id: string
  title: string
  promoterName: string
  description: string
  imageUrl: string | null
  videoUrl: string | null
  venueName: string
  lat: number | null
  lng: number | null
  startAt: string
  endAt: string | null
  price: number | null
  isFree: boolean
  ticketUrl: string | null
  inAppTickets?: boolean
  ticketCapacity?: number | null
  ticketsLeft?: number | null
  interestedCount?: number
  interested?: boolean
  city: string
  vendorId?: string | null
  vendor?: { id: string; name: string; images: string[] } | null
}

const TZ = 'America/Jamaica'

export interface WhenLabels { now: string; today: string; tomorrow: string }

/** "Tonight · 9:00 PM", "Sat · 2:00 PM" — in Jamaica time. */
export function eventWhen(startAt: string, locale = 'en-US', labels: WhenLabels = { now: 'Now', today: 'Today', tomorrow: 'Tomorrow' }): string {
  const start = new Date(startAt)
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
  const today = dayKey(new Date())
  const tomorrow = dayKey(new Date(Date.now() + 86400000))
  const time = start.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  const day = dayKey(start) === today ? (start.getTime() < Date.now() ? labels.now : labels.today)
    : dayKey(start) === tomorrow ? labels.tomorrow
    : start.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
  return `${day} · ${time}`
}

export function eventRange(startAt: string, endAt: string | null, locale = 'en-US'): string {
  const start = new Date(startAt)
  const full = start.toLocaleString(locale, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
  if (!endAt) return full
  const end = new Date(endAt)
  return `${full} – ${end.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })}`
}

/** eventWhen / eventRange in the traveler's language. */
export function useEventFormat() {
  const { t, lang } = useLang()
  const locale = lang === 'en' ? 'en-US' : lang
  const when = useCallback((startAt: string) => eventWhen(startAt, locale, { now: t('m.events.now'), today: t('m.events.today'), tomorrow: t('m.events.tomorrowShort') }), [locale, t])
  const range = useCallback((startAt: string, endAt: string | null) => eventRange(startAt, endAt, locale), [locale])
  return { when, range, locale }
}
