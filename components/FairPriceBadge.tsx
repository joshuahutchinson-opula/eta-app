// components/FairPriceBadge.tsx — "Fair price, same as locals": the vendor
// has confirmed tourists pay what locals pay (Vendor.fairPrice).
'use client'

import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

export default function FairPriceBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { t } = useLang()
  const md = size === 'md'
  return (
    <span
      title={t('m.fair.note')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: md ? '4px 10px' : '2px 8px', borderRadius: '999px', background: 'rgba(52,199,89,0.14)', color: 'var(--success)', fontSize: md ? '12px' : '11px', fontWeight: 700, whiteSpace: 'nowrap' }}
    >
      <Icon name="check" size={md ? 12 : 10} />
      {md ? t('m.fair.badgeLong') : t('m.fair.badge')}
    </span>
  )
}
