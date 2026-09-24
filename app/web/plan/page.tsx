// app/web/plan/page.tsx — B7 no-login day planner
import type { Metadata } from 'next'
import PlannerClient from '@/components/web/PlannerClient'
import { queryVendors } from '@/lib/vendor-query'
import { getServerLang } from '@/lib/i18n-server'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Plan a day in Negril',
  description: 'Build a day in Negril from real local vendors and photo spots — no account needed — and share it with a link.'
}

export default async function PlanPage({ searchParams }: { searchParams: { edit?: string } }) {
  const lang = getServerLang()
  const trending = await queryVendors({}, { sort: 'trending', take: 10 })
  return (
    <div className="w-container">
      <header className="w-page-head">
        <p className="w-eyebrow">No account needed</p>
        <h1 className="w-page-title">{searchParams.edit ? 'Edit your plan' : t(lang, 'plan.title')}</h1>
        <p className="w-page-dek">{t(lang, 'plan.dek')}</p>
      </header>
      <PlannerClient suggestions={trending.items} editSlug={searchParams.edit} />
    </div>
  )
}
