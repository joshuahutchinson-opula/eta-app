// components/ContextTip.tsx — one small, timely suggestion on Home from
// /api/context (weather + time of day, lib/context-engine.ts): rain → a
// covered spot, sunset soon → a sunset spot. Hidden if it can't load.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useRegion } from '@/components/RegionProvider'

interface ContextResponse {
  weather: { tempC: number; label: string } | null
  suggestion: { title: string; desc: string; icon: string; action: 'vendor' | 'map' | 'experiences'; reason?: string; vendor: { id: string; name: string; image: string | null } | null }
}

export default function ContextTip() {
  const { city, ready } = useRegion()
  const [ctx, setCtx] = useState<ContextResponse | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setCtx(null)
    fetch(`/api/context?city=${city}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.suggestion) setCtx(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [city, ready])

  if (!ctx) return null
  const { suggestion: s, weather } = ctx
  const href = s.action === 'vendor' && s.vendor ? `/vendor/${s.vendor.id}` : s.action === 'map' ? '/experiences?mode=discover' : '/experiences'

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <Link href={href} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', textDecoration: 'none' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--rum-tint)', color: 'var(--rum-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={s.icon} size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>
            {s.title}
            {weather && <span className="num-font" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--label-secondary)' }}>{weather.tempC}° · {weather.label}</span>}
          </span>
          <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', lineHeight: 1.35 }}>{s.desc}</span>
        </span>
        <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
      </Link>
    </div>
  )
}
