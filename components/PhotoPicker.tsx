// components/PhotoPicker.tsx — choose a photo from the camera or library,
// with a preview. The caller uploads it (lib/api-client uploadPhoto).
'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'

export default function PhotoPicker({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const { t } = useLang()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div style={{ marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={file ? t('m.photo.change') : t('m.photo.choose')}
        style={{ width: '100%', height: preview ? '200px' : '120px', borderRadius: 'var(--radius-lg)', border: preview ? 'none' : '2px dashed var(--separator)', background: preview ? `center / cover no-repeat url(${preview})` : 'var(--system-bg)', color: 'var(--label-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px', fontWeight: 600, position: 'relative' }}
      >
        {preview ? (
          <span style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '12px' }}>{t('m.photo.change')}</span>
        ) : (
          <>
            <Icon name="camera" size={24} />
            {t('m.photo.choose')}
          </>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={e => { onChange(e.target.files?.[0] ?? null); e.target.value = '' }} />
    </div>
  )
}
