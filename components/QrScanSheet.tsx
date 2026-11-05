// components/QrScanSheet.tsx — "Scan to check in": the camera reads the
// vendor's ETA QR card (BarcodeDetector where the browser has it, jsQR
// otherwise), or the traveler types the code printed under it. The visit
// is logged server-side (lib/visit-client.ts → /api/visits), which checks
// they're really there.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { LocationError, submitVisit, type VisitResult } from '@/lib/visit-client'
import { triggerHaptic } from '@/lib/haptics'

type State =
  | { kind: 'camera' }
  | { kind: 'manual' }
  | { kind: 'checking' }
  | { kind: 'done'; result: VisitResult }
  | { kind: 'error'; message: string }

interface Detector { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }

export default function QrScanSheet({ open, onClose, vendorName, onVisited }: {
  open: boolean
  onClose: () => void
  /** Shown in the title when opened from a vendor page. */
  vendorName?: string
  onVisited?: (result: VisitResult) => void
}) {
  const { t } = useLang()
  const errorText = useErrorText()
  const [state, setState] = useState<State>({ kind: 'camera' })
  const [code, setCode] = useState('')
  const [cameraFailed, setCameraFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(tr => tr.stop())
    streamRef.current = null
  }, [])

  const submit = useCallback(async (value: string) => {
    if (busyRef.current) return
    busyRef.current = true
    stopCamera()
    triggerHaptic('medium')
    setState({ kind: 'checking' })
    try {
      const result = await submitVisit(value)
      setState({ kind: 'done', result })
      onVisited?.(result)
    } catch (e) {
      setState({ kind: 'error', message: e instanceof LocationError ? t('m.scan.needLocation') : errorText(e) })
    } finally {
      busyRef.current = false
    }
  }, [errorText, onVisited, stopCamera, t])

  // Camera + decode loop while the sheet is on the camera step.
  useEffect(() => {
    if (!open || state.kind !== 'camera' || !getCurrentUser()) return
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
          if (found && !cancelled) { submit(found); return }
        } catch {}
      }
      timer = setTimeout(tick, 250)
    }

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        tick()
      })
      .catch(() => { if (!cancelled) { setCameraFailed(true); setState({ kind: 'manual' }) } })
    if (!navigator.mediaDevices) { setCameraFailed(true); setState({ kind: 'manual' }) }

    return () => { cancelled = true; if (timer) clearTimeout(timer); stopCamera() }
  }, [open, state.kind, stopCamera, submit])

  useEffect(() => {
    if (open) { setState({ kind: 'camera' }); setCode(''); setCameraFailed(false) }
    else stopCamera()
  }, [open, stopCamera])

  const close = () => { stopCamera(); onClose() }
  const signedIn = typeof window !== 'undefined' && Boolean(getCurrentUser())

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={close} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.scan.title')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>
              {vendorName ? t('m.scan.titleAt', { name: vendorName }) : t('m.scan.title')}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{t('m.scan.sub')}</p>

            {!signedIn ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '15px', color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.checkin.login')}</p>
                <Link href="/login" className="btn btn-primary" style={{ textDecoration: 'none', width: '100%' }}>{t('m.profile.login')}</Link>
              </div>
            ) : state.kind === 'camera' ? (
              <>
                <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', background: '#000', aspectRatio: '1 / 1', marginBottom: '12px' }}>
                  <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div aria-hidden style={{ position: 'absolute', inset: '18%', border: '3px solid rgba(255,255,255,0.9)', borderRadius: '18px', boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
                </div>
                <button className="btn btn-tertiary" onClick={() => { stopCamera(); setState({ kind: 'manual' }) }} style={{ width: '100%' }}>
                  {t('m.scan.typeCode')}
                </button>
              </>
            ) : state.kind === 'manual' ? (
              <form onSubmit={e => { e.preventDefault(); if (code.trim()) submit(code) }}>
                {cameraFailed && <p role="status" style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '8px' }}>{t('m.scan.noCamera')}</p>}
                <input
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCDE-FGHJK"
                  aria-label={t('m.scan.codeLabel')}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="num-font"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '20px', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '12px' }}
                />
                <button type="submit" className="btn btn-primary" disabled={!code.trim()} style={{ width: '100%', marginBottom: '8px' }}>{t('m.checkin.button')}</button>
                {!cameraFailed && <button type="button" className="btn btn-tertiary" onClick={() => setState({ kind: 'camera' })} style={{ width: '100%' }}><Icon name="camera" size={16} /> {t('m.scan.useCamera')}</button>}
              </form>
            ) : state.kind === 'checking' ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <Icon name="mapPin" size={28} style={{ color: 'var(--rum-text)' }} />
                <p>{t('m.scan.checking')}</p>
              </div>
            ) : state.kind === 'done' ? (
              <div style={{ textAlign: 'center' }}>
                <div className="check-pop-in" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}><Icon name="check" size={26} /></div>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)' }}>{state.result.vendor.name}</p>
                <p className="num-font" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--success)', margin: '4px 0 12px' }}>
                  {state.result.firstDiscovery ? t('m.checkin.firstTime', { points: state.result.pointsAwarded }) : t('m.checkin.done', { points: state.result.pointsAwarded })}
                </p>
                {state.result.unlockedRewards.length > 0 && (
                  <Link href="/rewards" className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', textDecoration: 'none', textAlign: 'left', marginBottom: '12px' }}>
                    <Icon name="gift" size={20} style={{ color: 'var(--rum-text)' }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.scan.unlocked')}</span>
                      <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{state.result.unlockedRewards.map(r => r.name).join(', ')}</span>
                    </span>
                    <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
                  </Link>
                )}
                <button className="btn btn-primary" onClick={close} style={{ width: '100%' }}>{t('m.profile.done')}</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p role="alert" style={{ fontSize: '15px', color: 'var(--error)', marginBottom: '14px' }}>{state.message}</p>
                <button className="btn btn-primary" onClick={() => setState({ kind: 'camera' })} style={{ width: '100%', marginBottom: '8px' }}>{t('m.scan.again')}</button>
                <button className="btn btn-tertiary" onClick={close} style={{ width: '100%' }}>{t('m.book.cancel')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
