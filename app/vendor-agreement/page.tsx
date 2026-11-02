// app/vendor-agreement/page.tsx — DRAFT, pending legal review (components/LegalDocument.tsx).
import type { Metadata } from 'next'
import LegalDocument from '@/components/LegalDocument'
import { VENDOR_AGREEMENT_VERSION } from '@/lib/legal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Vendor Agreement · ETA' }

export default function Page() {
  return <LegalDocument doc="vendor" version={VENDOR_AGREEMENT_VERSION} intro="m.legal.vendorIntro" />
}
