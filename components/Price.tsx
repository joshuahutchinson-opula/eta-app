// components/Price.tsx — a USD amount in the traveler's chosen currency
// (Profile → Settings), and only that currency.
'use client'

import { useCurrency } from '@/lib/currency'

interface Props {
  usd: number
  className?: string
  style?: React.CSSProperties
  /** Kept for existing callers; the price is always a single currency now. */
  compact?: boolean
  suffix?: string
}

export default function Price({ usd, className = 'num-font', style, suffix }: Props) {
  const { format } = useCurrency()
  return (
    <span className={className} style={style}>
      {format(usd)}
      {suffix && <span style={{ fontSize: '0.75em', fontWeight: 400, opacity: 0.75 }}>{suffix}</span>}
    </span>
  )
}
