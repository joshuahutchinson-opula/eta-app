// app/policies/cancellation/page.tsx — DRAFT, pending legal review (components/LegalDocument.tsx).
import type { Metadata } from 'next'
import LegalDocument from '@/components/LegalDocument'
import { TERMS_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Cancellation & refund policy · ETA' }

export default function Page() {
  return <LegalDocument doc="cancel" version={TERMS_VERSION} />
}
