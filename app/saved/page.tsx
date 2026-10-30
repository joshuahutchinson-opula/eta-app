// app/saved/page.tsx — everything you've saved: vendors (the Market heart)
// and experiences (the results long-press or the experience page heart).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import VendorCard, { type VendorCardVendor } from '@/components/VendorCard'
import ExperienceCard, { type ExperienceCardData } from '@/components/ExperienceCard'
import ErrorState from '@/components/ErrorState'
import { readSaved, toggleSaved } from '@/lib/saved'
import { syncAlerts } from '@/lib/alerts-client'
import { useLang, usePatois } from '@/lib/i18n-client'
import { hapticSaved } from '@/lib/haptics'

export default function SavedPage() {
  const router = useRouter()
  const { t } = useLang()
  const patois = usePatois()
  const [tab, setTab] = useState<'vendors' | 'experiences'>('vendors')
  const [vendors, setVendors] = useState<VendorCardVendor[] | null>(null)
  const [experiences, setExperiences] = useState<ExperienceCardData[] | null>(null)
  const [savedVendorIds, setSavedVendorIds] = useState<string[]>([])
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const vIds = readSaved('vendors')
    const eIds = readSaved('experiences')
    setSavedVendorIds(vIds)
    try {
      const [vRes, eRes] = await Promise.all([fetch('/api/vendors'), fetch('/api/experiences')])
      if (!vRes.ok || !eRes.ok) throw new Error()
      const [v, e] = await Promise.all([vRes.json(), eRes.json()])
      setVendors((Array.isArray(v) ? v : []).filter((x: VendorCardVendor) => vIds.includes(x.id)))
      // Generated routes aren't stored server-side, so only curated experiences can come back.
      setExperiences((Array.isArray(e) ? e : []).filter((x: ExperienceCardData) => eIds.includes(x.id)))
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const unsaveVendor = (id: string) => {
    hapticSaved()
    toggleSaved('vendors', id)
    setSavedVendorIds(readSaved('vendors'))
    setVendors(prev => prev?.filter(v => v.id !== id) ?? null)
    syncAlerts()
  }

  const list = tab === 'vendors' ? vendors : experiences

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label-primary)' }}>
          <Icon name="back" size={16} />
        </button>
        <h1 className="section-title">{t('m.saved.title')}</h1>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <div className="segmented-control" role="tablist">
          {(['vendors', 'experiences'] as const).map(k => (
            <button key={k} role="tab" aria-selected={tab === k} className={`segmented-control-option ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
              {t(k === 'vendors' ? 'm.saved.vendors' : 'm.saved.experiences')}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {failed ? <ErrorState onRetry={load} /> : list === null ? (
          [0, 1].map(i => <div key={i} className="skeleton-card" style={{ height: '120px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : list.length === 0 ? (
          <div className="empty-state">
            <Icon name="heart" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{patois.emptySaved}</p>
            <p>{t(tab === 'vendors' ? 'm.saved.emptyVendors' : 'm.saved.emptyExperiences')}</p>
            <Link href={tab === 'vendors' ? '/marketplace' : '/experiences/browse'} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              {t(tab === 'vendors' ? 'm.tab.market' : 'm.exp.browseAll')}
            </Link>
          </div>
        ) : tab === 'vendors' ? (
          (vendors ?? []).map(v => <VendorCard key={v.id} vendor={v} saved={savedVendorIds.includes(v.id)} onToggleSave={() => unsaveVendor(v.id)} />)
        ) : (
          (experiences ?? []).map(e => <ExperienceCard key={e.id} exp={e} width="100%" imageHeight="160px" />)
        )}
      </div>
      <Dock />
    </main>
  )
}
