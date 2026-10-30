// components/Price.tsx — a USD amount in the traveler's chosen currency,
// with the other currency in smaller text beside it.
'use client'

import { useCurrency } from '@/lib/currency'

interface Props {
  usd: number
  className?: string
  style?: React.CSSProperties
  /** Hide the secondary currency (tight spots like map popups). */
  compact?: boolean
  suffix?: string
}

export default function Price({ usd, className = 'num-font', style, compact, suffix }: Props) {
  const { format, formatOther } = useCurrency()
  return (
    <span className={className} style={style}>
      {format(usd)}
      {suffix && <span style={{ fontSize: '0.75em', fontWeight: 400, opacity: 0.75 }}>{suffix}</span>}
      {!compact && (
        <span style={{ fontSize: '0.7em', fontWeight: 500, opacity: 0.65, marginLeft: '4px' }}>{formatOther(usd)}</span>
      )}
    </span>
  )
}
