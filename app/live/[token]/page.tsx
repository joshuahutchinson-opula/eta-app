// app/live/[token]/page.tsx — what an emergency contact sees when they open
// an "I feel unsafe" link: the person's latest position on a map, refreshed
// every 15 seconds, until they stop sharing or the link expires.
'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { directionsUrl } from '@/lib/calendar'

const TripMap = dynamic(() => import('@/components/TripMap'), { ssr: false })

interface Live { name: string; active: boolean; lat: number | null; lng: number | null; accuracy: number | null; updatedAt: string }

export default function LiveLocationPage() {
  const { token } = useParams() as { token: string }
  const { t, lang } = useLang()
  const [live, setLive] = useState<Live | null>(null)
  const [missing, setMissing] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/safety/share/${token}`, { cache: 'no-store' }).catch(() => null)
    if (!res) return
    if (res.status === 404) { setMissing(true); return }
    if (res.ok) setLive(await res.json())
  }, [token])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  const time = live ? new Date(live.updatedAt).toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit' }) : ''
  const hasPos = live?.active && live.lat !== null && live.lng !== null

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '2px', color: 'var(--rum)' }}>ETA</p>
        {missing ? (
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginTop: '12px' }}>{t('m.live.notFound')}</p>
        ) : live && (
          <>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)', marginTop: '8px' }}>{t('m.live.title', { name: live.name })}</h1>
            {live.active ? (
              <p role="status" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--live)', fontWeight: 600, marginTop: '4px' }}><span className="live-dot" /> {t('m.live.updated', { time })}</p>
            ) : (
              <p role="status" style={{ fontSize: '15px', color: 'var(--label-secondary)', marginTop: '8px' }}>{t('m.live.ended', { name: live.name })}</p>
            )}
          </>
        )}
      </div>
      {hasPos && (
        <>
          <div style={{ position: 'relative', flex: 1, minHeight: '320px' }}>
            <TripMap stops={[{ name: live!.name, lat: live!.lat, lng: live!.lng }]} currentIndex={0} user={null} fallbackCenter={[live!.lat!, live!.lng!]} />
          </div>
          <div style={{ padding: '16px' }}>
            <a href={directionsUrl({ lat: live!.lat, lng: live!.lng })!} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%', textDecoration: 'none' }}><Icon name="navigate" size={16} /> {t('m.live.openMaps')}</a>
          </div>
        </>
      )}
      <p style={{ padding: '0 16px 24px', fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.live.emergency')}</p>
    </main>
  )
}
