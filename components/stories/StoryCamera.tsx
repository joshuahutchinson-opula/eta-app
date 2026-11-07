// components/stories/StoryCamera.tsx — adding a story opens straight into
// a full-screen camera (getUserMedia), Instagram-style:
//   tap the shutter   take a photo
//   hold it          record video with sound, up to 15 s (the ring fills)
//   flip             front / back camera
//   flash            the torch on the back camera; a white screen flash on
//                    the front one
//   gallery          pick an existing photo or video instead (secondary)
// Without camera access it says so and keeps the gallery button.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'

export interface Captured { file: File; kind: 'image' | 'video'; url: string }

const MAX_MS = 15000
const HOLD_MS = 280

function recorderType(): string {
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return types.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) ?? ''
}

export default function StoryCamera({ onClose, onCaptured }: { onClose: () => void; onCaptured: (c: Captured) => void }) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [flash, setFlash] = useState(false)
  const [torchOk, setTorchOk] = useState(false)
  const [state, setState] = useState<'starting' | 'ready' | 'denied' | 'unsupported'>('starting')
  const [recording, setRecording] = useState(false)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [screenFlash, setScreenFlash] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const stopStream = () => { streamRef.current?.getTracks().forEach(tr => tr.stop()); streamRef.current = null }

  // (Re)start the camera for the chosen side, with sound for video.
  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) { setState('unsupported'); return }
    setState('starting')
    const video = { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }
    navigator.mediaDevices.getUserMedia({ video, audio: true })
      .catch(() => navigator.mediaDevices.getUserMedia({ video, audio: false }))
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return }
        stopStream()
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean }
        setTorchOk(Boolean(caps.torch))
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('denied') })
    return () => { cancelled = true }
  }, [facing])

  useEffect(() => () => { stopStream(); if (holdTimer.current) clearTimeout(holdTimer.current); if (stopTimer.current) clearTimeout(stopTimer.current) }, [])

  // The ring fills while recording.
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [recording])

  const torch = async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !torchOk) return
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).catch(() => {})
  }

  const withFlash = async (fn: () => void | Promise<void>) => {
    if (!flash) return fn()
    if (facing === 'user' || !torchOk) {
      setScreenFlash(true)
      await new Promise(r => setTimeout(r, 160))
      await fn()
      setTimeout(() => setScreenFlash(false), 120)
      return
    }
    await torch(true)
    await new Promise(r => setTimeout(r, 250))
    await fn()
    if (!recRef.current) torch(false)
  }

  const takePhoto = () => withFlash(() => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')!
    if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
    ctx.drawImage(v, 0, 0)
    triggerHaptic('medium')
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `story-${Date.now()}.jpg`, { type: 'image/jpeg' })
      stopStream()
      onCaptured({ file, kind: 'image', url: URL.createObjectURL(file) })
    }, 'image/jpeg', 0.9)
  })

  const startRecording = () => withFlash(() => {
    const stream = streamRef.current
    if (!stream || typeof MediaRecorder === 'undefined') return
    const type = recorderType()
    const rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined)
    chunks.current = []
    rec.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      torch(false)
      const base = (rec.mimeType || type || 'video/webm').split(';')[0]
      const file = new File(chunks.current, `story-${Date.now()}.${base.includes('mp4') ? 'mp4' : 'webm'}`, { type: base })
      recRef.current = null
      setRecording(false)
      if (!file.size) return
      stopStream()
      onCaptured({ file, kind: 'video', url: URL.createObjectURL(file) })
    }
    rec.start(250)
    recRef.current = rec
    setRecording(true)
    setStartedAt(Date.now())
    setNow(Date.now())
    triggerHaptic('heavy')
    stopTimer.current = setTimeout(() => stopRecording(), MAX_MS)
  })

  const stopRecording = useCallback(() => {
    if (stopTimer.current) { clearTimeout(stopTimer.current); stopTimer.current = null }
    if (recRef.current && recRef.current.state !== 'inactive') { triggerHaptic('medium'); recRef.current.stop() }
  }, [])

  const down = () => {
    if (state !== 'ready') return
    holdTimer.current = setTimeout(() => { holdTimer.current = null; startRecording() }, HOLD_MS)
  }
  const up = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; takePhoto(); return }
    stopRecording()
  }

  const pickFile = (f: File | undefined) => {
    if (!f) return
    stopStream()
    onCaptured({ file: f, kind: f.type.startsWith('video/') ? 'video' : 'image', url: URL.createObjectURL(f) })
  }

  const progress = recording ? Math.min(1, (now - startedAt) / MAX_MS) : 0
  const R = 38
  const C = 2 * Math.PI * R

  if (!mounted) return null
  return createPortal(
    <div className="cam" role="dialog" aria-modal="true" aria-label={t('m.cam.title')}>
      <video ref={videoRef} className={`cam-video ${facing === 'user' ? 'mirror' : ''}`} muted playsInline autoPlay />
      {screenFlash && <div className="cam-screen-flash" aria-hidden />}

      {(state === 'denied' || state === 'unsupported') && (
        <div className="cam-blocked">
          <Icon name="camera" size={36} />
          <p>{state === 'denied' ? t('m.cam.denied') : t('m.cam.unsupported')}</p>
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}><Icon name="image" size={16} /> {t('m.cam.gallery')}</button>
        </div>
      )}

      <div className="cam-top">
        <button type="button" className="cam-btn" onClick={() => { stopStream(); onClose() }} aria-label={t('m.cam.close')}><Icon name="close" size={22} /></button>
        <button type="button" className={`cam-btn ${flash ? 'on' : ''}`} aria-pressed={flash} onClick={() => { triggerHaptic('selection'); setFlash(f => !f) }} aria-label={flash ? t('m.cam.flashOff') : t('m.cam.flashOn')}>
          <Icon name="flame" size={20} />
        </button>
      </div>

      {recording && <p className="cam-rec num-font" role="status"><span className="live-blink" aria-hidden /> {Math.ceil((MAX_MS - (now - startedAt)) / 1000)}s</p>}

      <div className="cam-bottom">
        <button type="button" className="cam-btn small" onClick={() => fileRef.current?.click()} aria-label={t('m.cam.gallery')}><Icon name="image" size={22} /></button>
        <button
          type="button"
          className={`cam-shutter ${recording ? 'rec' : ''}`}
          aria-label={t('m.cam.shutter')}
          disabled={state !== 'ready'}
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={() => { if (recording) stopRecording() }}
          onContextMenu={e => e.preventDefault()}
        >
          <svg viewBox="0 0 88 88" aria-hidden>
            <circle cx="44" cy="44" r={R} className="cam-ring-bg" />
            {recording && <circle cx="44" cy="44" r={R} className="cam-ring" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - progress), transition: reduce ? 'none' : 'stroke-dashoffset 0.1s linear' }} />}
          </svg>
          <span className="cam-dot" />
        </button>
        <button type="button" className="cam-btn small" onClick={() => { triggerHaptic('selection'); setFacing(f => (f === 'user' ? 'environment' : 'user')) }} aria-label={t('m.cam.flip')} disabled={recording}><Icon name="shuffle" size={22} /></button>
      </div>
      <p className="cam-hint">{t('m.cam.hint')}</p>
      <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; pickFile(f) }} />
    </div>,
    document.body
  )
}
