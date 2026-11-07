// components/rewards/Badges.tsx — collectable badges on the Rewards hub:
// a ring of progress per badge, a "one more to unlock" nudge for any badge
// one step away, and for earned badges a shareable card image (drawn on a
// canvas here: rum-red card, gold medal, badge name, date, ETA) that goes
// to the share sheet as a PNG, or downloads where sharing files isn't
// supported.
'use client'

import { useEffect, useState } from 'react'
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

  return (
    <>
      {nudge && (
        <div className="rw-nudge" role="status">
          <Icon name="sparkle" size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <span>{t('m.rw.oneMore', { badge: name(nudge.key) })}</span>
        </div>
      )}
      <div className="rw-badges">
        {badges.map(b => (
          <button key={b.key} className={`rw-badge press ${b.earned ? 'earned' : ''}`} onClick={() => { triggerHaptic('light'); setOpen(b) }} aria-label={`${name(b.key)} · ${t('m.rw.badgeProgress', { n: b.progress, target: b.target })}`}>
            <span className="rw-badge-ring" style={{ '--p': Math.round((b.progress / b.target) * 100) } as React.CSSProperties}>
              <span><Icon name={b.earned ? b.icon : 'lock'} size={20} /></span>
            </span>
            <span className="rw-badge-name">{name(b.key)}</span>
            <span className="rw-badge-prog num-font">{b.earned ? <Icon name="check" size={12} style={{ color: 'var(--success)' }} /> : t('m.rw.badgeProgress', { n: b.progress, target: b.target })}</span>
          </button>
        ))}
      </div>

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
