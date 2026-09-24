// app/web/guides/page.tsx
import type { Metadata } from 'next'
import EditorialIndex from '@/components/web/EditorialIndex'
import { GUIDES } from '@/lib/editorial'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Destination guides — Negril & Montego Bay',
  description: 'Area-by-area guides to Negril and Montego Bay with live listings from local vendors on ETA.'
}

export default function GuidesIndexPage() {
  const lang = getServerLang()
  return <EditorialIndex pages={GUIDES} lang={lang} eyebrow="Negril · Montego Bay" title={t(lang, 'guides.title')} dek={t(lang, 'guides.dek')} />
}
