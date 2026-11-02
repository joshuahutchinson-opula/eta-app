// app/privacy/page.tsx — DRAFT, pending legal review (components/LegalDocument.tsx).
import type { Metadata } from 'next'
import LegalDocument from '@/components/LegalDocument'
import { PRIVACY_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Privacy Policy · ETA' }

export default function Page() {
  return <LegalDocument doc="privacy" version={PRIVACY_VERSION} />
}
