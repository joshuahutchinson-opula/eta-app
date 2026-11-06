// components/home/TicketScreen.tsx — a ticket or booking full screen, Apple
// Wallet style: the QR big on white, the title and time, and the screen as
// bright as it goes while it's open (the native brightness plugin when the
// app has one; otherwise a white screen kept awake), so it scans first time.
'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import QRCode from '@/components/QRCode'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

interface Props {
  open: boolean
  title: string
  when: string
  place: string | null
  qr: string
  onClose: () => void
}

type Brightness = { getBrightness: () => Promise<{ brightness: number }>; setBrightness: (o: { brightness: number }) => Promise<void> }

export default function TicketScreen({ open, title, when, place, qr, onClose }: Props) {
  const { t } = useLang()
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    triggerHaptic('medium')
    let restore: number | null = null
    let lock: { release: () => Promise<void> } | null = null
    const plugin = (window as unknown as { Capacitor?: { Plugins?: { ScreenBrightness?: Brightness } } }).Capacitor?.Plugins?.ScreenBrightness
    if (plugin) plugin.getBrightness().then(b => { restore = b.brightness; return plugin.setBrightness({ brightness: 1 }) }).catch(() => {})
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then(l => { lock = l }).catch(() => {})
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (plugin && restore !== null) plugin.setBrightness({ brightness: restore }).catch(() => {})
      lock?.release().catch(() => {})
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="ticket-screen" role="dialog" aria-modal="true" aria-label={t('m.yd.ticket')}>
      <button className="ticket-close" onClick={onClose} aria-label={t('m.today.close')}><Icon name="close" size={22} /></button>
      <div className="ticket-pass">
        <p className="ticket-eyebrow">ETA · {t('m.yd.ticket')}</p>
        <h2 className="ticket-title">{title}</h2>
        <p className="ticket-when num-font">{when}</p>
        {place && <p className="ticket-place"><Icon name="mapPin" size={13} /> {place}</p>}
        <div className="ticket-qr"><QRCode value={qr} size={260} label={t('m.bookings.ticketQr')} /></div>
        <p className="ticket-code num-font">{qr.length > 14 ? `${qr.slice(0, 6)}…${qr.slice(-6)}` : qr}</p>
        <p className="ticket-hint">{t('m.yd.brightHint')}</p>
      </div>
    </div>,
    document.body
  )
}
