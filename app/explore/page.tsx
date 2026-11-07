// app/explore/page.tsx — Explore mode, the game. A dark map under fog of war
// that lifts around everything you've found (from your account, so it
// follows you across phones; lib/explore.ts). Secret spots show only as a
// rough dashed zone with a warmer/colder hint until you're close enough to
// reveal them; quests lead you checkpoint by checkpoint with a clue each;
// badges and explorer-only perks live here too. × goes back to Discover.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import EtaMap, { type MapCircle, type MapMarker, type MapPoint } from '@/components/map/EtaMap'
import { AddGemSheet } from '@/components/HiddenGems'
import { useRegion } from '@/components/RegionProvider'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { haversineKm } from '@/lib/routing'
import { hapticRewardRedeemed, triggerHaptic } from '@/lib/haptics'
import type { DictKey } from '@/lib/i18n'

interface SecretSpot { id: string; category: string; found: boolean; name?: string; description?: string; photos?: string[]; lat?: number; lng?: number; status?: string; zone?: { lat: number; lng: number; radiusM: number } }
interface QuestView { id: string; title: string; description: string; badgeName: string; rewardPoints: number; sponsor: string | null; total: number; reached: number; started: boolean; completed: boolean; reachedCheckpoints: Array<{ order: number; name: string; lat: number; lng: number }>; nextClue: { order: number; clue: string } | null }
interface Badge { key: string; progress: number; target: number; earned: boolean }
interface Perk { id: string; name: string; description: string; icon: string; vendors: string[]; unlocked: boolean; code: string | null; status: string | null }
interface ExploreState {
  town: { city: string; name: string; lat: number; lng: number }
  stats: { found: number; total: number; pct: number; streak: number; secretFound: number; secretTotal: number }
  cleared: MapPoint[]
  secretSpots: SecretSpot[]
  quests: QuestView[]
  badges: Badge[]
  questBadges: string[]
  perks: Perk[]
}
interface PingResult {
  revealed: Array<{ id: string; name: string; points: number }>
  quests: Array<{ title: string; checkpoint: string; reached: number; total: number; completed: boolean; badgeName: string | null; points: number; perk: { name: string; code: string } | null }>
  band: number | null
}

const FOG_SPAN = { lat: 0.18, lng: 0.22 }
const PANEL_INSET = 250
/** Ping the server at most this often, or after this much walking. */
const PING_MS = 15000
const PING_M = 40
const BADGE_ICON: Record<string, string> = { beachHopper: 'wave', jerkHunter: 'food', gemFinder: 'sparkle', shutterbug: 'camera', questMaster: 'route' }

export default function ExploreModePage() {
  const router = useRouter()
  const { t } = useLang()
  const errorText = useErrorText()
  const { city, ready } = useRegion()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [state, setState] = useState<ExploreState | null>(null)
  const [failed, setFailed] = useState(false)
  const [pos, setPos] = useState<(MapPoint & { accuracy: number }) | null>(null)
  const [hint, setHint] = useState<{ band: number; trend: 'warmer' | 'colder' | 'same' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [panel, setPanel] = useState<'quest' | 'badges' | 'perks'>('quest')
  const [questsOpen, setQuestsOpen] = useState(false)
  const [spot, setSpot] = useState<SecretSpot | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const lastPing = useRef<{ at: number; pos: MapPoint } | null>(null)
  const lastBand = useRef<number | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try { setState(await apiJson<ExploreState>(`/api/explore?city=${city}`)) } catch { setFailed(true) }
  }, [city])

  useEffect(() => { setSignedIn(Boolean(getCurrentUser())) }, [])
  useEffect(() => { if (ready && signedIn) load() }, [ready, signedIn, load])

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  // Position fixes go to the server, which decides what's revealed or reached.
  const onPosition = useCallback(async (p: MapPoint & { accuracy: number }) => {
    setPos(p)
    const last = lastPing.current
    if (last && Date.now() - last.at < PING_MS && haversineKm(last.pos, p) * 1000 < PING_M) return
    lastPing.current = { at: Date.now(), pos: p }
    try {
      const r = await apiJson<PingResult>('/api/explore/ping', { method: 'POST', body: { city, lat: p.lat, lng: p.lng, accuracy: p.accuracy } })
      if (r.band !== null) {
        const prev = lastBand.current
        setHint({ band: r.band, trend: prev === null || prev === r.band ? 'same' : r.band < prev ? 'warmer' : 'colder' })
        lastBand.current = r.band
      } else setHint(null)
      const gained = r.revealed.reduce((n, s) => n + s.points, 0) + r.quests.reduce((n, q) => n + q.points, 0)
      if (r.revealed.length || r.quests.length) {
        hapticRewardRedeemed()
        const q = r.quests[0]
        flash(r.revealed.length ? t('m.ex.revealed', { name: r.revealed[0].name, n: r.revealed[0].points }) : q.completed ? t('m.ex.questDone', { title: q.title, badge: q.badgeName ?? '' }) : t('m.ex.checkpointHit', { title: q.title, n: q.reached, total: q.total }))
        const u = getCurrentUser()
        if (u && gained) setCurrentUser({ ...u, points: u.points + gained, lifetimePoints: (u.lifetimePoints ?? u.points) + gained })
        lastBand.current = null
        load()
      }
    } catch {}
  }, [city, load, t])

  const startQuest = async (q: QuestView) => {
    setBusy(q.id)
    try {
      await apiJson(`/api/explore/quests/${q.id}/start`, { method: 'POST' })
      triggerHaptic('medium')
      setQuestsOpen(false)
      setPanel('quest')
      await load()
    } catch (e) {
      flash(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const confirmSpot = async (s: SecretSpot) => {
    if (!pos) { flash(t('m.scan.needLocation')); return }
    setBusy(s.id)
    try {
      const r = await apiJson<{ pointsAwarded: number; status: string }>(`/api/gems/${s.id}/confirm`, { method: 'POST', body: { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } })
      hapticRewardRedeemed()
      flash(r.status === 'VERIFIED' ? t('m.ex.confirmedVerified') : t('m.ex.confirmed'))
      setSpot(null)
      load()
    } catch (e) {
      flash(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const fog = useMemo(() => (state ? {
    bounds: { west: state.town.lng - FOG_SPAN.lng, east: state.town.lng + FOG_SPAN.lng, south: state.town.lat - FOG_SPAN.lat, north: state.town.lat + FOG_SPAN.lat },
    explored: [...state.cleared, ...(pos ? [pos] : [])],
    radiusM: 350
  } : null), [state, pos])

  const circles: MapCircle[] = useMemo(() => (state?.secretSpots ?? []).filter(s => !s.found && s.zone).map(s => ({ id: s.id, lat: s.zone!.lat, lng: s.zone!.lng, radiusM: s.zone!.radiusM, color: '#FFB800' })), [state])

  const markers: MapMarker[] = useMemo(() => {
    if (!state) return []
    const found = state.secretSpots.filter(s => s.lat !== undefined && s.lng !== undefined).map(s => ({
      id: `spot-${s.id}`, lat: s.lat!, lng: s.lng!, color: '#AF52DE', size: 22, label: s.name, dashed: s.status === 'PENDING', onClick: () => setSpot(s)
    }))
    const checkpoints = state.quests.filter(q => q.started).flatMap(q => q.reachedCheckpoints.map(c => ({ id: `cp-${q.id}-${c.order}`, lat: c.lat, lng: c.lng, color: '#00B8A9', size: 22, text: String(c.order + 1), label: c.name })))
    return [...found, ...checkpoints]
  }, [state])

  const activeQuest = state?.quests.find(q => q.started && !q.completed) ?? null
  const hintText = hint ? (hint.band <= 1 ? t('m.ex.hint.burning') : hint.band === 2 ? t('m.ex.hint.hot') : hint.band === 3 ? t('m.ex.hint.warm') : t('m.ex.hint.cold')) : null

  if (signedIn === false) {
    return (
      <main style={{ minHeight: '100dvh', background: '#0B0E17', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center' }}>
        <Icon name="compass" size={40} style={{ color: 'var(--gold)' }} />
        <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{t('m.ex.title')}</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: '320px' }}>{t('m.ex.loginBody')}</p>
        <Link href="/login?next=/explore" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('m.profile.login')}</Link>
        <Link href="/experiences?mode=discover" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{t('m.ex.backToDiscover')}</Link>
      </main>
    )
  }

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#0B0E17', overflow: 'hidden', color: 'white' }}>
      {state && (
        <EtaMap
          key={state.town.city}
          live
          detailed
          theme="dark"
          center={{ lat: state.town.lat, lng: state.town.lng }}
          zoom={15}
          fitTo={[{ lat: state.town.lat, lng: state.town.lng }]}
          markers={markers}
          circles={circles}
          fog={fog}
          onPosition={onPosition}
          bottomInset={PANEL_INSET}
          label={t('m.ex.title')}
        />
      )}

      {/* Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '18px', background: 'rgba(11,14,23,0.86)', backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
          <button onClick={() => router.push('/experiences?mode=discover')} aria-label={t('m.ex.backToDiscover')} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="close" size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state?.town.name ?? '…'}</span>
              <span className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{t('m.ex.pctExplored', { pct: state?.stats.pct ?? 0 })}</span>
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state?.stats.pct ?? 0} style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', margin: '6px 0' }}>
              <div style={{ width: `${state?.stats.pct ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--gold), #FF7F5C)', transition: 'width 0.6s ease' }} />
            </div>
            <div className="num-font" style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>
              <span><Icon name="flame" size={11} style={{ color: '#FF9F0A' }} /> {t('m.ex.streak', { n: state?.stats.streak ?? 0 })}</span>
              <span><Icon name="mapPin" size={11} /> {t('m.ex.found', { n: state?.stats.found ?? 0, total: state?.stats.total ?? 0 })}</span>
              <span><Icon name="sparkle" size={11} style={{ color: '#D1A3EC' }} /> {t('m.ex.secrets', { n: state?.stats.secretFound ?? 0, total: state?.stats.secretTotal ?? 0 })}</span>
            </div>
          </div>
        </div>
        {hintText && (
          <p role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(11,14,23,0.86)', fontSize: '13px', fontWeight: 700, color: hint!.band <= 2 ? '#FF9F0A' : '#9CC9FF' }}>
            <Icon name={hint!.band <= 2 ? 'flame' : 'compass'} size={13} /> {hintText}{hint!.trend !== 'same' && ` · ${hint!.trend === 'warmer' ? t('m.ex.warmer') : t('m.ex.colder')}`}
          </p>
        )}
        {circles.length > 0 && !hintText && (
          <p style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '8px 12px', borderRadius: '999px', background: 'rgba(11,14,23,0.86)', fontSize: '13px', fontWeight: 600, color: '#FFD66B' }}>
            <Icon name="sparkle" size={13} /> {t('m.ex.zoneHint')}
          </p>
        )}
      </div>

      {failed && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', zIndex: 5 }}>
          <p>{t('m.err.generic')}</p>
          <button className="btn btn-primary" onClick={load}>{t('m.error.retry')}</button>
        </div>
      )}

      {toast && <p role="status" style={{ position: 'absolute', left: '16px', right: '16px', top: 'calc(env(safe-area-inset-top, 0px) + 150px)', zIndex: 12, padding: '12px 14px', borderRadius: '14px', background: 'var(--gold)', color: '#0F0E0C', fontSize: '14px', fontWeight: 700, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{toast}</p>}

      {/* Bottom panel: quest · badges · perks */}
      {state && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)', background: 'linear-gradient(180deg, rgba(11,14,23,0) 0%, rgba(11,14,23,0.92) 18%)' }}>
          <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {(['quest', 'badges', 'perks'] as const).map(k => (
              <button key={k} role="tab" aria-selected={panel === k} onClick={() => { triggerHaptic('selection'); setPanel(k) }} style={{ flex: 1, minHeight: '36px', borderRadius: '999px', border: 'none', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: panel === k ? 'white' : 'rgba(255,255,255,0.12)', color: panel === k ? '#0B0E17' : 'white' }}>
                {t(`m.ex.tab.${k}` as 'm.ex.tab.quest')}
              </button>
            ))}
          </div>

          <div style={{ borderRadius: '18px', background: '#151A28', padding: '14px', minHeight: '128px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
            {panel === 'quest' && (activeQuest ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800 }}>{activeQuest.title}</span>
                  <span className="num-font" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{activeQuest.reached}/{activeQuest.total}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', margin: '8px 0 10px' }} aria-hidden>
                  {Array.from({ length: activeQuest.total }, (_, i) => <span key={i} style={{ flex: 1, height: '5px', borderRadius: '3px', background: i < activeQuest.reached ? '#00B8A9' : 'rgba(255,255,255,0.15)' }} />)}
                </div>
                {activeQuest.nextClue && (
                  <p style={{ fontSize: '14px', lineHeight: 1.4, color: 'rgba(255,255,255,0.9)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gold)', display: 'block', marginBottom: '2px' }}>{t('m.ex.clue', { n: activeQuest.nextClue.order + 1 })}</span>
                    {activeQuest.nextClue.clue}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <Link href="/pay?via=explore" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none', minHeight: '40px' }}><Icon name="qr" size={14} /> {t('m.ex.scan')}</Link>
                  <button className="btn btn-tertiary" onClick={() => setQuestsOpen(true)} style={{ flex: 1, minHeight: '40px', color: 'white' }}>{t('m.ex.allQuests')}</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '16px', fontWeight: 800 }}>{t('m.ex.noQuestTitle')}</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: '4px 0 12px' }}>{state.quests.some(q => !q.completed) ? t('m.ex.noQuestBody') : t('m.ex.noQuests')}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {state.quests.some(q => !q.completed) && <button className="btn btn-primary" onClick={() => setQuestsOpen(true)} style={{ flex: 1, minHeight: '40px' }}>{t('m.ex.pickQuest')}</button>}
                  <button className="btn btn-secondary" onClick={() => setAdding(true)} style={{ flex: 1, minHeight: '40px' }}><Icon name="plus" size={14} /> {t('m.ex.addSpot')}</button>
                </div>
              </>
            ))}

            {panel === 'badges' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                {state.badges.map(b => (
                  <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', opacity: b.earned ? 1 : 0.85 }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: b.earned ? 'var(--gold)' : 'rgba(255,255,255,0.1)', color: b.earned ? '#0F0E0C' : 'white' }}><Icon name={BADGE_ICON[b.key] ?? 'star'} size={15} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t(`m.ex.badge.${b.key}` as DictKey)}</span>
                      <span className="num-font" style={{ display: 'block', fontSize: '12px', color: b.earned ? 'var(--gold)' : 'rgba(255,255,255,0.7)' }}>{b.progress}/{b.target}</span>
                    </span>
                  </div>
                ))}
                {state.questBadges.map(name => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '12px', background: 'rgba(0,184,169,0.15)' }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00B8A9' }}><Icon name="route" size={15} /></span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{name}</span>
                  </div>
                ))}
              </div>
            )}

            {panel === 'perks' && (state.perks.length === 0 ? (
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)' }}>{t('m.ex.noPerks')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                {state.perks.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '12px', background: p.unlocked ? 'rgba(255,184,0,0.14)' : 'rgba(255,255,255,0.06)' }}>
                    <Icon name={p.unlocked ? 'gift' : 'lock'} size={18} style={{ color: p.unlocked ? 'var(--gold)' : 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '14px', fontWeight: 700 }}>{p.unlocked ? p.name : t('m.ex.perkLocked')}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{p.unlocked ? `${p.vendors.join(', ')} · ${p.code}` : t('m.ex.perkHow', { vendor: p.vendors[0] ?? state.town.name })}</span>
                    </span>
                    {p.unlocked && <Link href="/rewards/mine" style={{ color: 'var(--gold)', fontSize: '13px', fontWeight: 700 }}>{t('m.common.view')}</Link>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quests */}
      <div className={`bottom-sheet-overlay ${questsOpen ? 'open' : ''}`} onClick={() => setQuestsOpen(false)} />
      <div className={`bottom-sheet ${questsOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.ex.allQuests')} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.ex.allQuests')}</h2>
          {(state?.quests ?? []).length === 0 && <p style={{ color: 'var(--label-secondary)' }}>{t('m.ex.noQuests')}</p>}
          {(state?.quests ?? []).map(q => (
            <div key={q.id} className="card" style={{ padding: '14px', marginBottom: '10px', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{q.title}</span>
                <span className="num-font" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rum-text)' }}>{t('m.ex.checkpoints', { n: q.total })}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '4px 0 6px' }}>{q.description}</p>
              <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '10px' }}>
                <Icon name="star" size={11} /> {t('m.ex.questReward', { badge: q.badgeName, n: q.rewardPoints })}{q.sponsor ? ` · ${t('m.ex.sponsor', { name: q.sponsor })}` : ''}
              </p>
              {q.completed ? (
                <span className="chip" style={{ cursor: 'default', color: 'var(--success)' }}><Icon name="check" size={13} /> {t('m.ex.completed')}</span>
              ) : (
                <button className="btn btn-primary" onClick={() => startQuest(q)} disabled={busy === q.id} style={{ width: '100%' }}>
                  {busy === q.id ? '…' : q.started ? t('m.ex.resume', { n: q.reached, total: q.total }) : t('m.ex.start')}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* A found secret spot */}
      <div className={`bottom-sheet-overlay ${spot ? 'open' : ''}`} onClick={() => setSpot(null)} />
      <div className={`bottom-sheet ${spot ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={spot?.name}>
        <div className="sheet-grabber" />
        {spot && (
          <div style={{ padding: '0 20px 24px' }}>
            {spot.photos?.[0] && <div style={{ position: 'relative', height: '180px', borderRadius: '14px', overflow: 'hidden', marginBottom: '12px' }}><Img src={spot.photos[0]} alt={spot.name ?? ''} width={720} height={360} sizes="100vw" /></div>}
            <p className="section-eyebrow">{t(`m.ex.cat.${spot.category}` as DictKey)}{spot.status === 'PENDING' ? ` · ${t('m.ex.unverified')}` : ''}</p>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '6px' }}>{spot.name}</h3>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', lineHeight: 1.45, marginBottom: '14px' }}>{spot.description}</p>
            {spot.status === 'PENDING' && spot.found && (
              <button className="btn btn-primary" onClick={() => confirmSpot(spot)} disabled={busy === spot.id} style={{ width: '100%', marginBottom: '8px' }}>{busy === spot.id ? '…' : t('m.ex.confirm')}</button>
            )}
            <button className="btn btn-tertiary" onClick={() => setSpot(null)} style={{ width: '100%' }}>{t('m.profile.done')}</button>
          </div>
        )}
      </div>

      <AddGemSheet open={adding} pos={pos} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); flash(t('m.ex.spotAdded')); load() }} />
    </main>
  )
}
