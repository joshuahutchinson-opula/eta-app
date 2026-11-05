// components/PartnerBadge.tsx — the red "★ ETA Partner" badge on partner
// hotels and villas (stay search, stay listings, stay pages).
'use client'

import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

export default function PartnerBadge() {
  const { t } = useLang()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: 'var(--rum)', color: 'white', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <Icon name="star" size={10} /> {t('m.partner.badge')}
    </span>
  )
}
