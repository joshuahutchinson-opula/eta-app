// components/home/LivingHero.tsx — Home's living postcard: the selected
// town's coast right now, drawn on a canvas from the real sun and moon
// (lib/sky.ts). Sky colour follows the sun's altitude; the sun or moon sits
// on its real arc; clouds drift; the sea line shimmers; stars come out at
// night. One canvas, no video: ~60fps, capped at 2× pixels, and it stops
// drawing whenever it's off screen or the app is in the background. Reduce
// motion draws one still frame (refreshed each minute). Changing the region
// crossfades to the new town's sky; `washKey` sends a wave across (pull to
// refresh) and re-reads the sky.
'use client'

import { useEffect, useRef } from 'react'
import { skyScene, rgb, darken, mixRgb, type SkyScene } from '@/lib/sky'
import { useReducedMotion } from '@/lib/motion'

interface Props {
  lat: number
  lng: number
  /** Changes when the region changes (crossfade). */
  sceneKey: string
  /** Bump to wash a wave across and re-render the sky. */
  washKey: number
  children?: React.ReactNode
}

const HORIZON = 0.7
const CROSSFADE_MS = 1200

interface Star { x: number; y: number; r: number; p: number; s: number }
interface Cloud { x: number; y: number; w: number; speed: number; puffs: Array<[number, number, number]> }

function seeded(seed: number) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function makeStars(): Star[] {
  const r = seeded(7)
  return Array.from({ length: 110 }, () => ({ x: r(), y: r() * HORIZON * 0.95, r: 0.4 + r() * 1.1, p: r() * Math.PI * 2, s: 0.6 + r() * 1.8 }))
}

function makeClouds(): Cloud[] {
  const r = seeded(42)
  return Array.from({ length: 6 }, (_, i) => ({
    x: r(),
    y: 0.12 + r() * 0.38,
    w: 0.22 + r() * 0.2,
    // Fraction of the width per second: a slow drift, the far ones slower.
    speed: 0.0025 + r() * 0.004 + i * 0.0004,
    puffs: Array.from({ length: 5 }, (_, j) => [j / 4 - 0.5 + (r() - 0.5) * 0.1, (r() - 0.5) * 0.25, 0.32 + r() * 0.3] as [number, number, number])
  }))
}

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, scene: SkyScene, t: number, stars: Star[], clouds: Cloud[]) {
  const p = scene.palette
  const hy = h * HORIZON

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, hy)
  sky.addColorStop(0, rgb(p.top))
  sky.addColorStop(0.6, rgb(p.mid))
  sky.addColorStop(1, rgb(p.horizon))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, hy + 1)

  // Stars
  if (p.stars > 0.02) {
    for (const s of stars) {
      const a = p.stars * (0.55 + 0.45 * Math.sin(t * s.s + s.p))
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const bodyY = (alt: number) => hy - (Math.max(-10, alt) / 70) * hy * 1.05
  const sunUp = scene.sun.alt > -8
  const sx = (0.08 + scene.sun.x * 0.84) * w
  const sy = bodyY(scene.sun.alt)

  // Sun glow and disc (low sun = bigger, warmer glow)
  if (sunUp) {
    const low = Math.max(0, 1 - Math.max(0, scene.sun.alt) / 25)
    const glowR = h * (0.35 + low * 0.45)
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR)
    g.addColorStop(0, rgb(p.glow, 0.75))
    g.addColorStop(0.25, rgb(p.glow, 0.28 + low * 0.2))
    g.addColorStop(1, rgb(p.glow, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, hy)
    if (scene.sun.alt > -1.5) {
      const r = 13 + low * 7
      ctx.fillStyle = rgb(mixRgb([255, 252, 236], p.glow, low * 0.6))
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Moon (with its phase), when it's up and the sky's not bright
  const mx = (0.08 + scene.moon.x * 0.84) * w
  const my = bodyY(scene.moon.alt)
  if (scene.moon.alt > 0 && scene.sun.alt < 6 && scene.moon.fraction > 0.04) {
    const r = 11
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, r * 6)
    halo.addColorStop(0, `rgba(240,236,220,${(0.25 * scene.moon.fraction).toFixed(3)})`)
    halo.addColorStop(1, 'rgba(240,236,220,0)')
    ctx.fillStyle = halo
    ctx.fillRect(mx - r * 6, my - r * 6, r * 12, r * 12)
    ctx.save()
    ctx.beginPath()
    ctx.arc(mx, my, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = '#F2EEDF'
    ctx.fillRect(mx - r, my - r, r * 2, r * 2)
    // The shadow: a circle slid across by how much is lit.
    const off = r * 2 * scene.moon.fraction * (scene.moon.waxing ? -1 : 1)
    ctx.fillStyle = rgb(mixRgb(p.top, p.mid, 0.4), 0.94)
    ctx.beginPath()
    ctx.arc(mx + off, my, r * 1.02, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Clouds
  for (const c of clouds) {
    const cx = (((c.x + t * c.speed) % 1.4) - 0.2) * w
    const cy = c.y * hy
    const cw = c.w * w
    ctx.fillStyle = rgb(p.cloud, p.cloudAlpha * 0.55)
    for (const [dx, dy, rr] of c.puffs) {
      ctx.beginPath()
      ctx.ellipse(cx + dx * cw, cy + dy * cw * 0.3, rr * cw * 0.45, rr * cw * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Far headland on the left, a low cliff line on the right
  const land = rgb(darken(mixRgb(p.horizon, p.top, 0.55), 0.55))
  ctx.fillStyle = land
  ctx.beginPath()
  ctx.moveTo(0, hy)
  ctx.bezierCurveTo(w * 0.08, hy - h * 0.07, w * 0.2, hy - h * 0.05, w * 0.34, hy)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(w * 0.78, hy)
  ctx.bezierCurveTo(w * 0.86, hy - h * 0.035, w * 0.95, hy - h * 0.045, w, hy - h * 0.05)
  ctx.lineTo(w, hy)
  ctx.closePath()
  ctx.fill()

  // Sea
  const sea = ctx.createLinearGradient(0, hy, 0, h)
  sea.addColorStop(0, rgb(p.seaTop))
  sea.addColorStop(1, rgb(p.seaBottom))
  ctx.fillStyle = sea
  ctx.fillRect(0, hy, w, h - hy)

  // Shimmer on the sea line: short glints, brighter in the sun's/moon's path
  const lightX = sunUp ? sx : scene.moon.alt > 0 ? mx : -9999
  const lightC: [number, number, number] = sunUp ? [255, 236, 200] : [230, 230, 240]
  for (let row = 0; row < 14; row++) {
    const y = hy + 2 + row * row * 0.9 + row * 2.2
    if (y > h) break
    const count = 7 + row
    for (let k = 0; k < count; k++) {
      const base = (k + 0.5) / count
      const x = (base + Math.sin(t * 0.35 + row * 1.7 + k) * 0.012) * w
      const near = lightX > -9000 ? Math.max(0, 1 - Math.abs(x - lightX) / (w * (0.08 + row * 0.012))) : 0
      const a = (0.05 + near * 0.55) * (0.5 + 0.5 * Math.sin(t * (1.2 + (k % 3) * 0.4) + row + k * 2.1))
      if (a < 0.02) continue
      ctx.fillStyle = rgb(lightC, a)
      ctx.fillRect(x - (6 + row), y, 12 + row * 2, 1 + row * 0.12)
    }
  }
}

export default function LivingHero({ lat, lng, sceneKey, washKey, children }: Props) {
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SkyScene>(skyScene(lat, lng))
  const prevRef = useRef<{ scene: SkyScene; since: number } | null>(null)
  const coordsRef = useRef({ lat, lng })
  const redrawRef = useRef<() => void>(() => {})

  // New town: crossfade from the old sky. New wash: re-read the sky.
  useEffect(() => {
    const changed = coordsRef.current.lat !== lat || coordsRef.current.lng !== lng
    coordsRef.current = { lat, lng }
    if (changed && !reduce) prevRef.current = { scene: sceneRef.current, since: performance.now() }
    sceneRef.current = skyScene(lat, lng)
    redrawRef.current()
  }, [lat, lng, sceneKey, washKey, reduce])

  useEffect(() => {
    if (!washKey || reduce) return
    const el = waveRef.current
    if (!el) return
    el.classList.remove('hero-wash-run')
    void el.offsetWidth
    el.classList.add('hero-wash-run')
  }, [washKey, reduce])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const stars = makeStars()
    const clouds = makeClouds()
    const off = document.createElement('canvas')
    const offCtx = off.getContext('2d')
    let w = 0
    let h = 0
    let dpr = 1
    let raf = 0
    let visible = true
    const start = performance.now()

    const size = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      off.width = canvas.width
      off.height = canvas.height
    }

    const frame = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const prev = prevRef.current
      if (prev && offCtx) {
        const k = Math.min(1, (now - prev.since) / CROSSFADE_MS)
        drawScene(ctx, w, h, prev.scene, t, stars, clouds)
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawScene(offCtx, w, h, sceneRef.current, t, stars, clouds)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = k * k * (3 - 2 * k)
        ctx.drawImage(off, 0, 0)
        ctx.globalAlpha = 1
        if (k >= 1) prevRef.current = null
      } else {
        drawScene(ctx, w, h, sceneRef.current, t, stars, clouds)
      }
    }

    const loop = (now: number) => {
      frame(now)
      raf = visible && document.visibilityState === 'visible' ? requestAnimationFrame(loop) : 0
    }
    const play = () => {
      if (reduce) { frame(performance.now()); return }
      if (!raf && visible && document.visibilityState === 'visible') raf = requestAnimationFrame(loop)
    }
    redrawRef.current = () => (reduce ? frame(performance.now()) : play())

    size()
    play()
    const ro = new ResizeObserver(() => { size(); if (reduce || !raf) frame(performance.now()) })
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play() })
    io.observe(canvas)
    const onVis = () => { if (document.visibilityState === 'visible') { sceneRef.current = skyScene(coordsRef.current.lat, coordsRef.current.lng); play() } }
    document.addEventListener('visibilitychange', onVis)
    // The sun keeps moving: re-read the sky every minute.
    const tick = setInterval(() => { sceneRef.current = skyScene(coordsRef.current.lat, coordsRef.current.lng); if (reduce) frame(performance.now()) }, 60000)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(tick)
      redrawRef.current = () => {}
    }
  }, [reduce])

  return (
    <div className="living-hero">
      <canvas ref={canvasRef} className="living-hero-canvas" aria-hidden />
      <div ref={waveRef} className="hero-wash" aria-hidden>
        <svg viewBox="0 0 400 600" preserveAspectRatio="none"><path d="M0 0 H300 C360 80 280 150 340 230 C400 310 300 380 350 460 C390 530 330 570 360 600 H0 Z" fill="rgba(255,255,255,0.55)" /><path d="M0 0 H270 C330 80 250 150 310 230 C370 310 270 380 320 460 C360 530 300 570 330 600 H0 Z" fill="rgba(210,240,255,0.5)" /></svg>
      </div>
      <div className="living-hero-scrim" aria-hidden />
      {children}
    </div>
  )
}
