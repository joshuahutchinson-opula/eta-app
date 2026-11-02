// app/saved/page.tsx — everything you've saved (vendors, experiences,
// events), stored on your account, plus named lists ("Date night",
// "Day 2"). Offline or logged out it shows this device's cached saves.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import BackButton from '@/components/BackButton'
import Icon from '@/lib/icons'
import VendorCard, { type VendorCardVendor } from '@/components/VendorCard'
import ExperienceCard, { type ExperienceCardData } from '@/components/ExperienceCard'
import EventCard from '@/components/EventCard'
import ErrorState from '@/components/ErrorState'
import { loadSaved, readSaved, toggleSaved, type SavedKind } from '@/lib/saved'
import { syncAlerts } from '@/lib/alerts-client'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang, usePatois } from '@/lib/i18n-client'
import { hapticSaved, triggerHaptic } from '@/lib/haptics'
import type { EventItem } from '@/lib/events'
import { cacheForOffline, readOffline, saveOffline } from '@/lib/offline'

type Tab = SavedKind | 'lists'
interface SavedList { id: string; name: string; items: Array<{ kind: SavedKind; refId: string }> }

const OFFLINE_KEY = 'saved'

export default function SavedPage() {
  const { t, lang } = useLang()
  const patois = usePatois()
  const errorText = useErrorText()
  const [tab, setTab] = useState<Tab>('vendors')
  const [vendors, setVendors] = useState<VendorCardVendor[] | null>(null)
  const [experiences, setExperiences] = useState<ExperienceCardData[] | null>(null)
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [savedVendorIds, setSavedVendorIds] = useState<string[]>([])
  const [lists, setLists] = useState<SavedList[] | null>(null)
  const [openList, setOpenList] = useState<SavedList | null>(null)
  const [newList, setNewList] = useState('')
  const [adding, setAdding] = useState<{ kind: SavedKind; refId: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [offlineAt, setOfflineAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const signedIn = typeof window !== 'undefined' && Boolean(getCurrentUser())

  const fetchByIds = async <T,>(path: string, ids: string[]): Promise<T[]> => {
    if (!ids.length) return []
    const res = await fetch(`${path}?ids=${ids.join(',')}`)
    if (!res.ok) throw new Error()
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  const load = useCallback(async () => {
    setFailed(false)
    const state = (await loadSaved()) ?? { vendors: readSaved('vendors'), experiences: readSaved('experiences'), events: readSaved('events') }
    setSavedVendorIds(state.vendors)
    try {
      const [v, e, ev] = await Promise.all([
        fetchByIds<VendorCardVendor>('/api/vendors', state.vendors),
        // Generated routes aren't stored server-side, so only curated experiences come back.
        fetchByIds<ExperienceCardData>('/api/experiences', state.experiences),
        fetchByIds<EventItem>('/api/events', state.events)
      ])
      setVendors(v)
      setExperiences(e)
      setEvents(ev)
      setOfflineAt(null)
      saveOffline(OFFLINE_KEY, { v, e, ev })
      cacheForOffline(['/saved', ...v.map(x => x.images[0]), ...e.map(x => x.imageUrl), ...ev.map(x => x.imageUrl)])
    } catch {
      const cached = readOffline<{ v: VendorCardVendor[]; e: ExperienceCardData[]; ev: EventItem[] }>(OFFLINE_KEY)
      if (cached) {
        setVendors(cached.data.v)
        setExperiences(cached.data.e)
        setEvents(cached.data.ev)
        setOfflineAt(cached.savedAt)
      } else setFailed(true)
    }
    if (getCurrentUser()) apiJson<SavedList[]>('/api/saved/lists').then(setLists).catch(() => setLists([]))
    else setLists([])
  }, [])

  useEffect(() => { load() }, [load])

  const unsave = (kind: SavedKind, id: string) => {
    hapticSaved()
    toggleSaved(kind, id)
    if (kind === 'vendors') { setSavedVendorIds(readSaved('vendors')); setVendors(p => p?.filter(v => v.id !== id) ?? null); syncAlerts() }
    if (kind === 'events') setEvents(p => p?.filter(v => v.id !== id) ?? null)
  }

  const createList = async () => {
    const name = newList.trim()
    if (!name) return
    setError(null)
    try {
      const list = await apiJson<SavedList>('/api/saved/lists', { method: 'POST', body: { name } })
      setLists(prev => [list, ...(prev ?? [])])
      setNewList('')
      if (adding) await addTo(list)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const addTo = async (list: SavedList) => {
    if (!adding) return
    try {
      const updated = await apiJson<SavedList>(`/api/saved/lists/${list.id}`, { method: 'PATCH', body: { add: adding } })
      triggerHaptic('light')
      setLists(prev => prev?.map(l => (l.id === updated.id ? updated : l)) ?? null)
      setAdding(null)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const removeFromList = async (list: SavedList, item: { kind: SavedKind; refId: string }) => {
    const updated = await apiJson<SavedList>(`/api/saved/lists/${list.id}`, { method: 'PATCH', body: { remove: item } }).catch(() => null)
    if (updated) { setLists(prev => prev?.map(l => (l.id === updated.id ? updated : l)) ?? null); setOpenList(updated) }
  }

  const deleteList = async (list: SavedList) => {
    await apiJson(`/api/saved/lists/${list.id}`, { method: 'DELETE' }).catch(() => null)
    setLists(prev => prev?.filter(l => l.id !== list.id) ?? null)
    setOpenList(null)
  }

  const addButton = (kind: SavedKind, refId: string) => signedIn ? (
    <button className="chip" onClick={() => { setError(null); setAdding({ kind, refId }) }} style={{ minHeight: '36px', alignSelf: 'flex-start' }}>
      <Icon name="list" size={12} /> {t('m.saved.addToList')}
    </button>
  ) : null

  const empty = (kind: SavedKind) => (
    <div className="empty-state">
      <Icon name="heart" size={32} style={{ color: 'var(--label-tertiary)' }} />
      <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{patois.emptySaved}</p>
      <p>{t(kind === 'vendors' ? 'm.saved.emptyVendors' : kind === 'experiences' ? 'm.saved.emptyExperiences' : 'm.saved.emptyEvents')}</p>
      <Link href={kind === 'vendors' ? '/marketplace' : kind === 'experiences' ? '/experiences/browse' : '/events'} className="btn btn-secondary" style={{ textDecoration: 'none' }}>
        {t(kind === 'vendors' ? 'm.tab.market' : kind === 'experiences' ? 'm.exp.browseAll' : 'm.events.allTitle')}
      </Link>
    </div>
  )

  const listItems = (l: SavedList) => {
    const v = (vendors ?? []).filter(x => l.items.some(i => i.kind === 'vendors' && i.refId === x.id))
    const e = (experiences ?? []).filter(x => l.items.some(i => i.kind === 'experiences' && i.refId === x.id))
    const ev = (events ?? []).filter(x => l.items.some(i => i.kind === 'events' && i.refId === x.id))
    return { v, e, ev }
  }

  const tabs: Tab[] = ['vendors', 'experiences', 'events', 'lists']
  const tabLabel = (k: Tab) => t(k === 'vendors' ? 'm.saved.vendors' : k === 'experiences' ? 'm.saved.experiences' : k === 'events' ? 'm.saved.events' : 'm.saved.lists')
  const loading = vendors === null || experiences === null || events === null

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton />
        <h1 className="section-title">{t('m.saved.title')}</h1>
      </div>
      {offlineAt && <p role="status" style={{ padding: '0 16px 8px', fontSize: '13px', color: 'var(--warning)' }}>{t('m.bookings.offline', { when: new Date(offlineAt).toLocaleString(lang === 'en' ? 'en-US' : lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</p>}
      <div style={{ padding: '0 16px 12px' }}>
        <div className="segmented-control" role="tablist">
          {tabs.map(k => (
            <button key={k} role="tab" aria-selected={tab === k} className={`segmented-control-option ${tab === k ? 'active' : ''}`} onClick={() => { setTab(k); setOpenList(null) }}>
              {tabLabel(k)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {failed ? <ErrorState onRetry={load} /> : loading ? (
          [0, 1].map(i => <div key={i} className="skeleton-card" style={{ height: '120px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : tab === 'vendors' ? (
          vendors!.length === 0 ? empty('vendors') : vendors!.map(v => (
            <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <VendorCard vendor={v} saved={savedVendorIds.includes(v.id)} onToggleSave={() => unsave('vendors', v.id)} />
              {addButton('vendors', v.id)}
            </div>
          ))
        ) : tab === 'experiences' ? (
          experiences!.length === 0 ? empty('experiences') : experiences!.map(e => (
            <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ExperienceCard exp={e} width="100%" imageHeight="160px" />
              {addButton('experiences', e.id)}
            </div>
          ))
        ) : tab === 'events' ? (
          events!.length === 0 ? empty('events') : events!.map(ev => (
            <div key={ev.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <EventCard ev={ev} width="100%" />
              <div style={{ display: 'flex', gap: '8px' }}>
                {addButton('events', ev.id)}
                <button className="chip" onClick={() => unsave('events', ev.id)} style={{ minHeight: '36px' }}><Icon name="heart" size={12} /> {t('m.saved.unsave')}</button>
              </div>
            </div>
          ))
        ) : !signedIn ? (
          <div className="empty-state">
            <Icon name="list" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.saved.listsLogin')}</p>
            <Link href="/login?next=/saved" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
          </div>
        ) : openList ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn-tertiary" onClick={() => setOpenList(null)} style={{ padding: 0, minHeight: '44px' }}><Icon name="chevronLeft" size={12} /> {t('m.saved.lists')}</button>
              <h2 style={{ flex: 1, fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)' }}>{openList.name}</h2>
              <button className="chip" onClick={() => deleteList(openList)} style={{ minHeight: '36px' }} aria-label={t('m.saved.deleteList')}><Icon name="trash" size={12} /> {t('m.saved.deleteList')}</button>
            </div>
            {openList.items.length === 0 ? <p style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.saved.listEmpty')}</p> : (() => {
              const { v, e, ev } = listItems(openList)
              return (
                <>
                  {v.map(x => <div key={x.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><VendorCard vendor={x} /><button className="chip" style={{ minHeight: '36px', alignSelf: 'flex-start' }} onClick={() => removeFromList(openList, { kind: 'vendors', refId: x.id })}><Icon name="close" size={12} /> {t('m.saved.removeFromList')}</button></div>)}
                  {e.map(x => <div key={x.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><ExperienceCard exp={x} width="100%" imageHeight="140px" /><button className="chip" style={{ minHeight: '36px', alignSelf: 'flex-start' }} onClick={() => removeFromList(openList, { kind: 'experiences', refId: x.id })}><Icon name="close" size={12} /> {t('m.saved.removeFromList')}</button></div>)}
                  {ev.map(x => <div key={x.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}><EventCard ev={x} width="100%" /><button className="chip" style={{ minHeight: '36px', alignSelf: 'flex-start' }} onClick={() => removeFromList(openList, { kind: 'events', refId: x.id })}><Icon name="close" size={12} /> {t('m.saved.removeFromList')}</button></div>)}
                </>
              )
            })()}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={newList} maxLength={40} onChange={e => setNewList(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createList() }} placeholder={t('m.saved.newListPlaceholder')} aria-label={t('m.saved.newList')} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid var(--separator)', background: 'var(--system-bg-elevated)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', minHeight: '44px' }} />
              <button className="btn btn-primary" onClick={createList} disabled={!newList.trim()} aria-label={t('m.saved.newList')}><Icon name="plus" size={16} /></button>
            </div>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)' }}>{error}</p>}
            {lists === null ? null : lists.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'var(--label-secondary)', textAlign: 'center', marginTop: '12px' }}>{t('m.saved.noLists')}</p>
            ) : lists.map(l => (
              <button key={l.id} className="card" onClick={() => setOpenList(l)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <Icon name="list" size={20} style={{ color: 'var(--rum-text)' }} />
                <span style={{ flex: 1, fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)' }}>{l.name}</span>
                <span className="num-font" style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{t('m.saved.itemCount', { n: l.items.length })}</span>
                <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
              </button>
            ))}
          </>
        )}
      </div>

      <div className={`bottom-sheet-overlay ${adding ? 'open' : ''}`} onClick={() => setAdding(null)} />
      <div className={`bottom-sheet ${adding ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.saved.addToList')}>
        <div className="sheet-grabber" />
        {adding && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.saved.addToList')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {(lists ?? []).map(l => {
                const inIt = l.items.some(i => i.kind === adding.kind && i.refId === adding.refId)
                return (
                  <button key={l.id} className="card" disabled={inIt} onClick={() => addTo(l)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: 'none', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', opacity: inIt ? 0.6 : 1 }}>
                    <Icon name={inIt ? 'check' : 'list'} size={16} style={{ color: 'var(--rum-text)' }} />
                    <span style={{ flex: 1, fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{l.name}</span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={newList} maxLength={40} onChange={e => setNewList(e.target.value)} placeholder={t('m.saved.newListPlaceholder')} aria-label={t('m.saved.newList')} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', minHeight: '44px' }} />
              <button className="btn btn-primary" onClick={createList} disabled={!newList.trim()}>{t('m.saved.create')}</button>
            </div>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{error}</p>}
          </div>
        )}
      </div>
      <Dock />
    </main>
  )
}
