// components/web/CollectPointsBanner.tsx — on a vendor's web page reached by
// scanning their QR with the phone camera without ETA (/v/<token> →
// ?collect=1): "Get ETA to collect your points". The visit is held on the
// server (lib/pending-visits.ts) and credited if they sign up within 24
// hours; the claim token waits on the device (eta_pending_visit).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

export default function CollectPointsBanner({ vendorName }: { vendorName: string }) {
  const { t } = useLang()
  const [show, setShow] = useState(false)
  const [onSite, setOnSite] = useState(true)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setShow(q.get('collect') === '1')
    setOnSite(q.get('onsite') !== '0')
  }, [])
  if (!show) return null
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', margin: '20px 0 0', borderRadius: 18, background: 'linear-gradient(135deg, #B82010, #8B1A0A)', color: 'white', boxShadow: '0 10px 30px rgba(184,32,16,0.3)' }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="star" size={22} style={{ color: '#FFB800' }} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 800 }}>{t('m.vq.title')}</span>
        <span style={{ display: 'block', fontSize: 14, opacity: 0.9 }}>{onSite ? t('m.vq.sub', { vendor: vendorName }) : t('m.vq.subFar', { vendor: vendorName })}</span>
      </span>
      <Link href="/register?next=/" style={{ flexShrink: 0, padding: '10px 16px', borderRadius: 999, background: 'white', color: '#B82010', fontWeight: 800, textDecoration: 'none', fontSize: 15 }}>{t('m.vq.cta')}</Link>
    </div>
  )
}
