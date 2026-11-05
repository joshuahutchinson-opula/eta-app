// components/HiddenGems.tsx — adding a secret spot (a hidden gem) from
// Explore mode: name, kind, a sentence or two and photos, pinned where you
// stand. It stays a secret on everyone else's map until they're close
// (lib/hidden-gems.ts); locals' in-person confirmations verify it.
'use client'

import { useRef, useState } from 'react'
import Icon from '@/lib/icons'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { GEM_CATEGORIES, type GemCategoryKey } from '@/lib/hidden-gems'
import { useLang, useErrorText } from '@/lib/i18n-client'
import { hapticRewardRedeemed } from '@/lib/haptics'
import type { DictKey } from '@/lib/i18n'

type Pos = { lat: number; lng: number; accuracy?: number } | null

const sheetInput: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', marginBottom: '12px' }

export function AddGemSheet({ open, pos, onClose, onAdded }: { open: boolean; pos: Pos; onClose: () => void; onAdded: () => void }) {
  const { t } = useLang()
  const errorText = useErrorText()
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
      setError(errorText(e))
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
                <button key={c} className={`chip ${category === c ? 'active' : ''}`} aria-pressed={category === c} onClick={() => setCategory(c)} style={{ minHeight: '36px', padding: '6px 12px', fontSize: '14px' }}>{t(`m.ex.cat.${c}` as DictKey)}</button>
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
