// app/web/best/page.tsx
import type { Metadata } from 'next'
import EditorialIndex from '@/components/web/EditorialIndex'
import { BEST_OF } from '@/lib/editorial'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Best of Negril',
  description: 'The best jerk chicken, sunset spots, cheap eats, beach bars and watersports in Negril — live lists from ETA.'
}

export default function BestIndexPage() {
  const lang = getServerLang()
  return (
    <EditorialIndex
      pages={BEST_OF}
      lang={lang}
      eyebrow={t(lang, 'footer.bestOf')}
      title={t(lang, 'footer.bestOf')}
      dek="Lists that update themselves — every entry is a live query against ETA’s vendor database, ranked by real traveler ratings and who’s busy right now."
    />
  )
}
