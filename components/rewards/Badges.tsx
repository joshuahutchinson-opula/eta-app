// components/rewards/Badges.tsx — collectable badges on the Rewards hub
// (docs/mockups/RewardsHub.dc.html): "Collected n of N", four badges (earned
// ones as medals, the rest as progress rings), a "one more to unlock" row
// for any badge one step away, and for earned badges a shareable card image (drawn on a
// canvas here: rum-red card, gold medal, badge name, date, ETA) that goes
// to the share sheet as a PNG, or downloads where sharing files isn't
// supported.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import type { DictKey } from '@/lib/i18n'

export interface BadgeView { key: string; icon: string; target: number; progress: number; earned: boolean; earnedAt: string | null }

const EMOJI: Record<string, string> = { sunsetChaser: '🌅', jerkTrail: '🔥', cliffHopper: '🌊', secretSpots: '✨', townHopper: '🗺️', giveBack: '❤️' }

async function drawCard(name: string, line: string, date: string): Promise<Blob | null> {
  const c = document.createElement('canvas')
  c.width = 1080
  c.height = 1350
  const g = c.getContext('2d')
  if (!g) return null
  const bg = g.createLinearGradient(0, 0, 1080, 1350)
  bg.addColorStop(0, '#B82010'); bg.addColorStop(0.6, '#7A1508'); bg.addColorStop(1, '#2A0703')
  g.fillStyle = bg
  g.fillRect(0, 0, 1080, 1350)
  const glow = g.createRadialGradient(540, 520, 40, 540, 520, 520)
  glow.addColorStop(0, 'rgba(255,184,0,0.45)'); glow.addColorStop(1, 'rgba(255,184,0,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, 1080, 1350)
  // Medal
  const medal = g.createLinearGradient(380, 360, 700, 680)
  medal.addColorStop(0, '#FFB800'); medal.addColorStop(0.55, '#FFE08A'); medal.addColorStop(1, '#E39B00')
  g.beginPath(); g.arc(540, 520, 180, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fill()
  g.beginPath(); g.arc(540, 520, 156, 0, Math.PI * 2); g.fillStyle = medal; g.fill()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '150px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
  g.fillText(EMOJI[name] ?? '⭐', 540, 530)
  return new Promise(resolve => {
    g.fillStyle = '#FFFFFF'
    g.font = '800 84px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
    g.fillText(line.split('\n')[0], 540, 860)
    g.fillStyle = 'rgba(255,255,255,0.85)'
    g.font = '500 40px -apple-system, "Segoe UI", Roboto, sans-serif'
    g.fillText(line.split('\n')[1] ?? '', 540, 950)
    g.fillStyle = '#FFE08A'
    g.font = '700 36px -apple-system, "Segoe UI", Roboto, sans-serif'
    g.fillText(date, 540, 1020)
    g.fillStyle = '#FFFFFF'
    g.font = '900 64px -apple-system, "Segoe UI", Roboto, sans-serif'
    g.fillText('ETA', 540, 1220)
    c.toBlob(b => resolve(b), 'image/png')
  })
}

export default function Badges({ badges }: { badges: BadgeView[] }) {
  const { t, lang } = useLang()
  const [open, setOpen] = useState<BadgeView | null>(null)
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null)
  const name = (k: string) => t(`m.rw.badge.${k}` as DictKey)
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { month: 'long', day: 'numeric', year: 'numeric' })
  const nudge = badges.find(b => !b.earned && b.target - b.progress === 1)

  useEffect(() => {
    setImg(null)
    if (!open?.earned || !open.earnedAt) return
    let url = ''
    drawCard(open.key, `${name(open.key)}\n${t('m.rw.badgeCardLine')}`, date(open.earnedAt)).then(blob => {
      if (!blob) return
      url = URL.createObjectURL(blob)
      setImg({ url, blob })
    })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    if (!open || !img) return
    triggerHaptic('light')
    const file = new File([img.blob], `eta-${open.key}.png`, { type: 'image/png' })
    const text = t('m.rw.badgeShareText', { badge: name(open.key) })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text }).catch(() => {})
      return
    }
    const a = document.createElement('a')
    a.href = img.url
    a.download = file.name
    a.click()
  }

  // Earned first, then the closest to done; four on the hub.
  const shown = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned) || (b.progress / b.target) - (a.progress / a.target)).slice(0, 4)
  const earned = badges.filter(b => b.earned).length
  const ring = (b: BadgeView) => {
    const c = 2 * Math.PI * 28
    const done = Math.round((b.progress / b.target) * c)
    return (
      <span className="rh-ring">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r="28" fill="var(--system-bg-elevated)" stroke="var(--separator)" strokeWidth="5" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="#B82010" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${done} ${Math.ceil(c)}`} transform="rotate(-90 32 32)" />
        </svg>
        <span className="num">{b.progress}/{b.target}</span>
      </span>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p className="rh-eb">{t('m.rw.collected', { n: earned, total: badges.length })}</p>
          <h2 className="rh-st">{t('m.rw.badges')}</h2>
        </div>
        <Link href="/rewards/passport" style={{ fontSize: '15px', fontWeight: 600, minHeight: '44px', display: 'flex', alignItems: 'center', color: 'var(--rum-text)', textDecoration: 'none' }}>{t('m.common.seeAll')}</Link>
      </div>
      <div className="rh-badges list-in">
        {shown.map((b, i) => (
          <button key={b.key} className="rh-badge press" onClick={() => { triggerHaptic('light'); setOpen(b) }} aria-label={`${name(b.key)} · ${t('m.rw.badgeProgress', { n: b.progress, target: b.target })}`}>
            {b.earned ? (
              <span className="rh-medal" style={{ background: i % 2 ? 'radial-gradient(circle at 35% 30%, #F24230, #B82010)' : 'radial-gradient(circle at 35% 30%, #FFD54A, #E0A100)', color: i % 2 ? '#FFFFFF' : '#7A1408' }}><Icon name={b.icon} size={28} /></span>
            ) : ring(b)}
            <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: 600 }}>{name(b.key)}</p>
          </button>
        ))}
      </div>
      {nudge && (
        <button className="rh-card rh-link press" style={{ marginTop: '12px', width: '100%', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => { triggerHaptic('light'); setOpen(nudge) }}>
          <span style={{ flex: 1, fontSize: '14px' }}>{t('m.rw.oneMoreTo', { badge: '\u0000' }).split('\u0000').flatMap((part, k, arr) => k < arr.length - 1 ? [part, <b key={k}>{name(nudge.key)}</b>] : [part])}</span>
          <Icon name="chevronRight" size={14} style={{ color: 'var(--rum-text)' }} />
        </button>
      )}

      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(null)} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={open ? name(open.key) : t('m.rw.badges')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
            {open.earned ? (
              <>
                <p className="section-eyebrow">{t('m.rw.shareBadge')}</p>
                <div style={{ margin: '10px auto 14px', width: 'min(100%, 260px)', aspectRatio: '4 / 5', borderRadius: '18px', overflow: 'hidden', background: '#7A1508' }}>
                  {img && <img src={img.url} alt={name(open.key)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </div>
                <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{open.earnedAt && t('m.rw.badgeEarned', { date: date(open.earnedAt) })}</p>
                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }} disabled={!img} onClick={share}><Icon name="share" size={16} /> {t('m.rw.share')}</button>
              </>
            ) : (
              <>
                <span className="rw-badge-ring" style={{ '--p': Math.round((open.progress / open.target) * 100), width: '86px', height: '86px', margin: '8px auto 12px' } as React.CSSProperties}>
                  <span style={{ width: '66px', height: '66px' }}><Icon name="lock" size={26} /></span>
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--label-primary)' }}>{name(open.key)}</h3>
                <p style={{ fontSize: '15px', color: 'var(--label-secondary)', margin: '6px 0 4px' }}>{t(`m.rw.badgeHow.${open.key}` as DictKey)}</p>
                <p className="num-font" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--rum-text)', marginBottom: '16px' }}>{t('m.rw.badgeProgress', { n: open.progress, target: open.target })}</p>
              </>
            )}
            <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setOpen(null)}>{t('m.profile.done')}</button>
          </div>
        )}
      </div>
    </>
  )
}
