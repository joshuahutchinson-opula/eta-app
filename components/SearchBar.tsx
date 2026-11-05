// components/SearchBar.tsx — the search field at the top of Home and Market.
// Uncontrolled (Home): typing and pressing search opens /search with the
// query. Controlled (Market): value/onChange filter the screen in place.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

interface Props {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export default function SearchBar({ value, onChange, placeholder, style }: Props) {
  const { t } = useLang()
  const router = useRouter()
  const [own, setOwn] = useState('')
  const controlled = onChange !== undefined
  const q = controlled ? value ?? '' : own

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (controlled) return
    triggerHaptic('light')
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search')
  }

  return (
    <form role="search" onSubmit={submit} className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', minHeight: '44px', minWidth: 0, cursor: 'text', ...style }}>
      <Icon name="search" size={16} style={{ color: 'var(--label-secondary)', flexShrink: 0 }} />
      <input
        type="search"
        enterKeyHint="search"
        value={q}
        onChange={e => (controlled ? onChange!(e.target.value) : setOwn(e.target.value))}
        placeholder={placeholder ?? t('m.search.placeholder')}
        aria-label={t('m.search.open')}
        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'var(--label-primary)', fontSize: '17px', outline: 'none', fontFamily: 'inherit' }}
      />
      {q && (
        <button type="button" onClick={() => (controlled ? onChange!('') : setOwn(''))} aria-label={t('m.search.clear')} style={{ background: 'none', border: 'none', color: 'var(--label-tertiary)', cursor: 'pointer', padding: 0, minWidth: '28px', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" size={14} />
        </button>
      )}
    </form>
  )
}
