// components/HiddenGems.tsx — Hidden Gems in the app's Discover map:
// load what's revealed near you (/api/gems), open a gem and confirm it in
// person, or submit a new one with photos. Fog-of-war and points are all
// enforced server-side (lib/hidden-gems.ts).
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '@/lib/icons'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { GEM_CATEGORIES, GEM_CATEGORY_LABELS, type GemCategoryKey } from '@/lib/hidden-gems'
import { useLang } from '@/lib/i18n-client'
import { hapticRewardRedeemed } from '@/lib/haptics'

export interface GemDetail {
  id: string
  name: string
  category: GemCategoryKey
  description: string
  lat: number
  lng: number
  photos: string[]
  status: 'PENDING' | 'VERIFIED' | 'REJECTED'
  confirmationCount: number
  threshold: number
  isMine: boolean
  confirmedByMe: boolean
  distanceM: number | null
}

type Pos = { lat: number; lng: number; accuracy?: number } | null

export function useHiddenGems(pos: Pos, enabled: boolean) {
  const [gems, setGems] = useState<GemDetail[]>([])
  const [fog, setFog] = useState<Array<{ lat: number; lng: number; count: number }>>([])
  const [failed, setFailed] = useState(false)
  // Re-query only when you've moved ~100 m, not on every GPS tick.
  const key = pos ? `${pos.lat.toFixed(3)},${pos.lng.toFixed(3)}` : 'none'

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const q = pos ? `?lat=${pos.lat}&lng=${pos.lng}` : ''
      const res = await fetch(`/api/gems${q}`, { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setGems(data.revealed ?? [])
      setFog(data.fog ?? [])
    } catch {
      setFailed(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { if (enabled) load() }, [enabled, load])
  return { gems, fog, failed, reload: load }
}

const sheetInput: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', marginBottom: '12px' }

export function GemDetailSheet({ gem, pos, onClose, onChanged }: { gem: GemDetail | null; pos: Pos; onClose: () => void; onChanged: () => void }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { setMsg(null) }, [gem?.id])

  const confirm = async () => {
    if (!gem) return
    if (!getCurrentUser()) { setMsg({ ok: false, text: t('m.gems.login') }); return }
    if (!pos) { setMsg({ ok: false, text: t('m.gems.needLocation') }); return }
    setBusy(true)
    try {
      const res = await fetch(`/api/gems/${gem.id}/confirm`, { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(pos) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
      const u = getCurrentUser()
      if (u) setCurrentUser({ ...u, points: u.points + (data.pointsAwarded ?? 0) })
      hapticRewardRedeemed()
      setMsg({ ok: true, text: data.verifiedNow ? t('m.gems.verifiedNow', { points: data.pointsAwarded }) : t('m.gems.confirmed', { points: data.pointsAwarded }) })
      onChanged()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Sumth nah wuk' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={`bottom-sheet-overlay ${gem ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${gem ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={gem?.name ?? t('m.gems.title')}>
        <div className="sheet-grabber" />
        {gem && (
          <div style={{ padding: '0 20px 24px' }}>
            {gem.photos[0] && <img src={gem.photos[0]} alt="" style={{ width: '100%', height: '170px', objectFit: 'cover', borderRadius: 'var(--radius-lg)', marginBottom: '12px' }} />}
            <p className="section-eyebrow">{t('m.gems.title')} · {GEM_CATEGORY_LABELS[gem.category]}</p>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', margin: '2px 0 6px' }}>{gem.name}</h3>
            <p style={{ fontSize: '15px', color: 'var(--label-secondary)', lineHeight: 1.45, marginBottom: '10px' }}>{gem.description}</p>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '16px' }}>
              {gem.status === 'VERIFIED' ? t('m.gems.verified') : t('m.gems.pending', { n: gem.confirmationCount, total: gem.threshold })}
              {gem.distanceM !== null ? ` · ${gem.distanceM} m` : ''}
            </p>
            {gem.isMine ? (
              <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.gems.yours')}</p>
            ) : gem.confirmedByMe || msg?.ok ? (
              <p style={{ fontSize: '14px', color: 'var(--success)' }}>{msg?.text ?? t('m.gems.alreadyConfirmed')}</p>
            ) : (
              <button className="btn btn-primary" onClick={confirm} disabled={busy} style={{ width: '100%' }}>
                <Icon name="check" size={16} /> {busy ? '…' : t('m.gems.confirm')}
              </button>
            )}
            {msg && !msg.ok && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{msg.text}</p>}
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${gem.lat},${gem.lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-tertiary" style={{ width: '100%', marginTop: '8px', textDecoration: 'none' }}>{t('m.events.directions')}</a>
          </div>
        )}
      </div>
    </>
  )
}

export function AddGemSheet({ open, pos, onClose, onAdded }: { open: boolean; pos: Pos; onClose: () => void; onAdded: () => void }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<GemCategoryKey>('VIEWPOINT')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    if (!getCurrentUser()) { setError(t('m.gems.login')); return }
    if (!pos) { setError(t('m.gems.needLocation')); return }
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('name', name)
      form.append('category', category)
      form.append('description', description)
      form.append('lat', String(pos.lat))
      form.append('lng', String(pos.lng))
      photos.forEach(p => form.append('photos', p))
      const res = await fetch('/api/gems', { method: 'POST', headers: authHeaders(), body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
      hapticRewardRedeemed()
      setName(''); setDescription(''); setPhotos([])
      onAdded()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className={`bottom-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`bottom-sheet ${open ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.gems.add')}>
        <div className="sheet-grabber" />
        {open && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '4px' }}>{t('m.gems.add')}</h3>
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '14px' }}>{pos ? t('m.gems.addHint') : t('m.gems.needLocation')}</p>
            <input aria-label={t('m.gems.name')} placeholder={t('m.gems.name')} value={name} onChange={e => setName(e.target.value)} maxLength={80} style={sheetInput} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }} role="group" aria-label={t('m.gems.category')}>
              {GEM_CATEGORIES.map(c => (
                <button key={c} className={`chip ${category === c ? 'active' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)} style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px' }}>{GEM_CATEGORY_LABELS[c]}</button>
              ))}
            </div>
            <textarea aria-label={t('m.gems.description')} placeholder={t('m.gems.description')} value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={1000} style={{ ...sheetInput, resize: 'vertical' }} />
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} style={{ width: '100%', marginBottom: '12px' }}>
              <Icon name="camera" size={16} /> {photos.length ? t('m.gems.photosChosen', { n: photos.length }) : t('m.gems.addPhotos')}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => { setPhotos(Array.from(e.target.files ?? []).slice(0, 4)); e.target.value = '' }} />
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
            <button className="btn btn-primary" onClick={submit} disabled={busy || !pos || name.trim().length < 3 || description.trim().length < 10 || photos.length === 0} style={{ width: '100%' }}>
              {busy ? '…' : t('m.gems.submit')}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
