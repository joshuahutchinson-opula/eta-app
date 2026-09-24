// app/web/best/[slug]/page.tsx — B6 auto-generated "best of" SEO page
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EditorialTemplate from '@/components/web/EditorialTemplate'
import { BEST_OF, getBestOf } from '@/lib/editorial'
import { getServerLang } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getBestOf(params.slug)
  if (!page) return { title: 'Not found' }
  return {
    title: page.title,
    description: page.seoDescription,
    alternates: { canonical: `/web/best/${page.slug}` },
    openGraph: { title: page.title, description: page.seoDescription, type: 'article' }
  }
}

export default function BestOfPage({ params }: { params: { slug: string } }) {
  const page = getBestOf(params.slug)
  if (!page) notFound()
  return <EditorialTemplate page={page} lang={getServerLang()} related={BEST_OF.filter(b => b.slug !== page.slug)} />
}
