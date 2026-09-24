// app/web/guides/[slug]/page.tsx — A7 destination guide (parameter-driven)
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EditorialTemplate from '@/components/web/EditorialTemplate'
import { GUIDES, getGuide } from '@/lib/editorial'
import { getServerLang } from '@/lib/i18n-server'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug)
  if (!guide) return { title: 'Guide not found' }
  return { title: `${guide.title} guide`, description: guide.seoDescription }
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug)
  if (!guide) notFound()
  return <EditorialTemplate page={guide} lang={getServerLang()} related={GUIDES.filter(g => g.slug !== guide.slug)} />
}
