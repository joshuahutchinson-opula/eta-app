// components/QrScanner.tsx — the one scanner (Scan & Pay): the camera reads a
// vendor's ETA QR card (BarcodeDetector where the browser has it, jsQR
// otherwise), or the traveler types the code printed under it. Hands the
// raw value to onCode; the caller decides what happens next.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

interface Detector { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }

export default function QrScanner({ onCode, active = true }: { onCode: (code: string) => void; active?: boolean }) {
  const { t } = useLang()
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [cameraFailed, setCameraFailed] = useState(false)
  const [code, setCode] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const firedRef = useRef(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    streamRef.current = null
  }, [])

  const fire = useCallback((value: string) => {
    if (firedRef.current) return
    firedRef.current = true
    stop()
    triggerHaptic('medium')
    onCode(value)
  }, [onCode, stop])

  useEffect(() => { if (active) firedRef.current = false }, [active])

  useEffect(() => {
    if (!active || mode !== 'camera') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
    const detector: Detector | null = Native ? new Native({ formats: ['qr_code'] }) : null
    let jsQR: ((d: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null

    const tick = async () => {
      if (cancelled) return
      const video = videoRef.current
      if (video && video.readyState >= 2 && video.videoWidth) {
        try {
          let found: string | null = null
          if (detector) {
            found = (await detector.detect(video))[0]?.rawValue ?? null
          } else if (ctx) {
            if (!jsQR) jsQR = (await import('jsqr')).default
            const w = Math.min(640, video.videoWidth)
            const h = Math.round((video.videoHeight / video.videoWidth) * w)
            canvas.width = w
            canvas.height = h
            ctx.drawImage(video, 0, 0, w, h)
            found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null
          }
          if (found && !cancelled) { fire(found); return }
        } catch {}
      }
      timer = setTimeout(tick, 250)
    }

    if (!navigator.mediaDevices?.getUserMedia) { setCameraFailed(true); setMode('manual'); return }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        tick()
      })
      .catch(() => { if (!cancelled) { setCameraFailed(true); setMode('manual') } })
    return () => { cancelled = true; if (timer) clearTimeout(timer); stop() }
  }, [active, mode, fire, stop])

  return mode === 'camera' ? (
    <>
      <div style={{ position: 'relative', borderRadius: '20px', overflow: 'hidden', background: '#000', aspectRatio: '1 / 1', marginBottom: '10px' }}>
        <video ref={videoRef} muted playsInline aria-label={t('m.scan.title')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div aria-hidden style={{ position: 'absolute', inset: '16%', border: '3px solid rgba(255,255,255,0.9)', borderRadius: '20px', boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
        <p style={{ position: 'absolute', left: 0, right: 0, bottom: '14px', textAlign: 'center', color: 'white', fontSize: '14px', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{t('m.scan.aim')}</p>
      </div>
      <button className="btn btn-tertiary" onClick={() => { stop(); setMode('manual') }} style={{ width: '100%' }}>{t('m.scan.typeCode')}</button>
    </>
  ) : (
    <form onSubmit={e => { e.preventDefault(); if (code.trim()) fire(code) }}>
      {cameraFailed && <p role="status" style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.scan.noCamera')}</p>}
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="ABCDE-FGHJK"
        aria-label={t('m.scan.codeLabel')}
        autoCapitalize="characters"
        autoComplete="off"
        className="num-font"
        style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '20px', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '10px' }}
      />
      <button type="submit" className="btn btn-primary" disabled={!code.trim()} style={{ width: '100%', marginBottom: '8px' }}>{t('m.partner.continue')}</button>
      {!cameraFailed && <button type="button" className="btn btn-tertiary" onClick={() => setMode('camera')} style={{ width: '100%' }}><Icon name="camera" size={16} /> {t('m.scan.useCamera')}</button>}
    </form>
  )
}
