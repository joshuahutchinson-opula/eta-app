// components/tabs/ProfileTab.tsx — the traveler's profile (route /profile,
// kept alive by components/TabKeeper): Bookings, Saved, Rewards
// (points, vouchers, discoveries and wallet in one hub), Trips (app/trips),
// Notifications and Settings, with Safety always one tap away in the corner.
// The theme is Light, Dark or Auto (dark at the selected town's real
// sunset, lib/theme.ts).
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { getAuthToken, getCurrentUser, logout, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { useLowData } from '@/lib/low-data'
import { authHeaders as authHeadersFor } from '@/lib/api-client'
import { getTierForPoints } from '@/lib/rewardTiers'
import { alertsEnabled, disableAlerts, enableAlerts, pushSupported, refreshAlertLocation, syncAlerts } from '@/lib/alerts-client'
import { apiJson, authHeaders, uploadPhoto } from '@/lib/api-client'
import { useCurrency } from '@/lib/currency'
import { LANGS, LANG_NAMES } from '@/lib/i18n'
import Price from '@/components/Price'
import VerifyEmailBanner from '@/components/VerifyEmailBanner'
import { absoluteUrl } from '@/lib/site-url'
import { useRegion } from '@/components/RegionProvider'
import { readTheme, setTheme, type ThemeMode } from '@/lib/theme'
import { useTabShow } from '@/components/TabKeeper'

const NOTIFY_TYPES = ['bookings', 'events', 'deals', 'live', 'crew', 'trips'] as const
type NotifyType = (typeof NOTIFY_TYPES)[number]
const NOTIFY_FIELD = { bookings: 'notifyBookings', events: 'notifyEvents', deals: 'notifyDeals', live: 'notifyLive', crew: 'notifyCrew', trips: 'notifyTrips' } as const
const fieldStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', marginBottom: '8px' }

function Switch({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{ width: '48px', height: '28px', borderRadius: '999px', background: on ? 'var(--rum)' : 'var(--separator)', position: 'relative', flexShrink: 0, transition: 'background 0.2s ease' }}>
      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: on ? '23px' : '3px', transition: 'left 0.2s ease' }} />
    </span>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [theme, setThemeMode] = useState<ThemeMode>('light')
  const { town } = useRegion()
  const [notifications, setNotifications] = useState(false)
  const [alertPrefs, setAlertPrefs] = useState({ liveAlerts: true, dealAlerts: true })
  const [alertsBusy, setAlertsBusy] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: '', bio: '', homeCountry: '', instagramHandle: '' })
  const [whatsapp, setWhatsapp] = useState({ number: '', on: false })
  const [whatsappMsg, setWhatsappMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { currency, setCurrency } = useCurrency()
  const [showSettingsSheet, setShowSettingsSheet] = useState(false)
  const { lang, setLang, t } = useLang()
  const errorText = useErrorText()
  const labels = useLabels()
  const { lowData, setLowData } = useLowData()
  const [emergency, setEmergency] = useState({ name: '', phone: '' })
  const [emergencyMsg, setEmergencyMsg] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [rate, setRate] = useState<number | null>(null)
  const [referral, setReferral] = useState<{ code: string; pointsPerReferral: number; invited: number; rewarded: number; pointsEarned: number } | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)

  useEffect(() => {
    const current = getCurrentUser()
    setUser(current)
    // Points change server-side (completed trips, referral payouts), so
    // refresh the cached user instead of trusting the copy from login.
    const token = getAuthToken()
    if (token) {
      apiJson<{ user: CurrentUser }>('/api/users/me')
        .then(data => {
          if (data?.user) {
            setCurrentUser(data.user)
            setUser(data.user)
            setEmergency({ name: data.user.emergencyContactName ?? '', phone: data.user.emergencyContactPhone ?? '' })
            setWhatsapp({ number: data.user.whatsappNumber ?? '', on: Boolean(data.user.notifyWhatsapp) })
          }
        })
        .catch(() => {})
      fetch('/api/exchange-rate').then(r => (r.ok ? r.json() : null)).then(d => d?.rate && setRate(d.rate)).catch(() => {})
    }
    if (current) {
      fetch('/api/referrals', { headers: authHeaders() })
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data?.code) setReferral(data) })
        .catch(() => {})
    }

    // Light is the default; dark or Auto (dark after sunset) when chosen.
    setThemeMode(readTheme())

    // Alerts are real push subscriptions now, so the toggle reflects the
    // browser's actual state rather than a stored flag.
    alertsEnabled().then(on => {
      setNotifications(on)
      if (on) refreshAlertLocation()
    })
    try {
      const prefs = JSON.parse(localStorage.getItem('alertPrefs') || 'null')
      if (prefs && typeof prefs === 'object') setAlertPrefs({ liveAlerts: prefs.liveAlerts !== false, dealAlerts: prefs.dealAlerts !== false })
    } catch {}

    // Deep link from the inbox: /profile?settings=1
    const params = new URLSearchParams(window.location.search)
    if (params.get('settings') === '1') setShowSettingsSheet(true)
    else if (params.get('edit') === '1' && current) {
      setForm({ name: current.name, bio: current.bio ?? '', homeCountry: current.homeCountry ?? '', instagramHandle: current.instagramHandle ? '@' + current.instagramHandle : '' })
      setEditOpen(true)
    }

    setMounted(true)
  }, [])

  const chooseTheme = (mode: ThemeMode) => {
    setThemeMode(mode)
    setTheme(mode, town)
  }

  // Back on the tab: points and settings may have changed elsewhere.
  useTabShow('/profile', () => {
    if (!getAuthToken()) { setUser(getCurrentUser()); return }
    apiJson<{ user: CurrentUser }>('/api/users/me').then(d => { if (d?.user) { setCurrentUser(d.user); setUser(d.user) } }).catch(() => {})
  })

  const toggleNotifications = async () => {
    setAlertsBusy(true)
    setAlertsError(null)
    try {
      if (notifications) {
        await disableAlerts()
        setNotifications(false)
      } else {
        await enableAlerts(alertPrefs)
        setNotifications(true)
      }
    } catch (e) {
      setAlertsError(errorText(e))
    } finally {
      setAlertsBusy(false)
    }
  }

  const toggleAlertPref = (key: 'liveAlerts' | 'dealAlerts') => {
    const next = { ...alertPrefs, [key]: !alertPrefs[key] }
    setAlertPrefs(next)
    localStorage.setItem('alertPrefs', JSON.stringify(next))
    syncAlerts(next)
  }

  // Profile photo goes to Cloudinary and is saved on the account (avatarUrl).
  const handleProfilePicUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setPhotoBusy(true)
      setPhotoError(null)
      try {
        const avatarUrl = await uploadPhoto(file, 'avatars')
        const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { avatarUrl } })
        setCurrentUser(updated)
        setUser(updated)
      } catch (err) {
        setPhotoError(errorText(err))
      } finally {
        setPhotoBusy(false)
      }
    }
    input.click()
  }

  const openEdit = () => {
    if (!user) return
    setForm({ name: user.name, bio: user.bio ?? '', homeCountry: user.homeCountry ?? '', instagramHandle: user.instagramHandle ? '@' + user.instagramHandle : '' })
    setSaveError(null)
    setEditOpen(true)
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { ...form, instagramHandle: form.instagramHandle.trim() || null } })
      setCurrentUser(updated)
      setUser(updated)
      setEditOpen(false)
    } catch (err) {
      setSaveError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const shareInvite = async () => {
    if (!referral) return
    const url = absoluteUrl(`/register?ref=${encodeURIComponent(referral.code)}`)
    const text = t('m.invite.shareText', { code: referral.code, points: referral.pointsPerReferral })
    if (navigator.share) {
      navigator.share({ title: 'ETA', text, url }).catch(() => {})
      return
    }
    await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {})
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 1800)
  }

  // Per-type notification preferences live on the account; the device's own
  // live/deal flags follow the matching ones so pushes respect them too.
  const toggleNotify = async (type: NotifyType) => {
    if (!user) return
    const field = NOTIFY_FIELD[type]
    const next = !(user[field] ?? true)
    setUser({ ...user, [field]: next })
    try {
      const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { [field]: next } })
      setCurrentUser(updated)
      setUser(updated)
      if (type === 'live' || type === 'deals') {
        const prefs = { liveAlerts: updated.notifyLive !== false, dealAlerts: updated.notifyDeals !== false }
        setAlertPrefs(prefs)
        localStorage.setItem('alertPrefs', JSON.stringify(prefs))
        syncAlerts(prefs)
      }
    } catch (e) {
      setUser(user)
      setAlertsError(errorText(e))
    }
  }

  const saveEmergency = async () => {
    setEmergencyMsg(null)
    try {
      const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { emergencyContactName: emergency.name, emergencyContactPhone: emergency.phone } })
      setCurrentUser(updated)
      setUser(updated)
      setEmergencyMsg(t('m.profile.saved2'))
    } catch (e) {
      setEmergencyMsg(errorText(e))
    }
  }

  const saveWhatsapp = async (next: { number: string; on: boolean }) => {
    setWhatsappMsg(null)
    try {
      const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: { whatsappNumber: next.number.trim() || null, notifyWhatsapp: next.on && Boolean(next.number.trim()) } })
      setCurrentUser(updated)
      setUser(updated)
      setWhatsapp({ number: updated.whatsappNumber ?? '', on: Boolean(updated.notifyWhatsapp) })
      setWhatsappMsg(t('m.profile.saved2'))
    } catch (e) {
      setWhatsappMsg(errorText(e))
    }
  }

  const openSettings = () => setShowSettingsSheet(true)

  const downloadData = async () => {
    try {
      const res = await fetch('/api/users/me/export', { headers: authHeadersFor() })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eta-my-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setAlertsError(errorText(e))
    }
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await apiJson('/api/users/me', { method: 'DELETE', body: { confirm: 'DELETE' } })
      await logout()
      router.push('/login')
    } catch (e) {
      setDeleteError(errorText(e))
      setDeleting(false)
    }
  }

  const [loggingOut, setLoggingOut] = useState(false)
  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    router.push('/login')
  }

  const menuItems: { label: string; icon: string; href?: string; onClick?: () => void }[] = [
    { label: t('m.profile.bookings'), icon: 'clock', href: '/bookings' },
    { label: t('m.trips.title'), icon: 'plane', href: '/trips' },
    { label: t('m.profile.notifications'), icon: 'bell', href: '/notifications' },
    { label: t('m.profile.saved'), icon: 'heart', href: '/saved' },
    { label: t('m.profile.rewards'), icon: 'gift', href: '/rewards' },
    { label: t('m.profile.settings'), icon: 'settings', onClick: openSettings }
  ]

  if (!mounted) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <Dock />
      </main>
    )
  }

  if (!user) {
    return (
      <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
        <div className="empty-state" style={{ minHeight: '70vh' }}>
          <Icon name="user" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.loginTitle')}</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>
            {t('m.profile.loginBody')}
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>
            {t('m.profile.login')}
          </Link>
        </div>
        <Dock />
      </main>
    )
  }

  const memberSince = user.createdAt && !isNaN(Date.parse(user.createdAt))
    ? t('m.profile.memberSince', { date: new Date(user.createdAt).toLocaleDateString(lang === 'en' ? 'en-US' : lang, { month: 'long', year: 'numeric' }) })
    : null

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      {/* Safety: always visible, whatever you scroll to */}
      <Link
        href="/safety"
        aria-label={t('m.safety.title')}
        style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: '16px', zIndex: 30, display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', padding: '0 14px', borderRadius: '999px', background: 'var(--error)', color: 'white', fontSize: '14px', fontWeight: 700, textDecoration: 'none', boxShadow: 'var(--shadow-elevated)' }}
      >
        <Icon name="shield" size={16} /> {t('m.profile.safety')}
      </Link>
      <div style={{ padding: '64px 16px 16px' }}>
        <div style={{ marginBottom: '16px' }}><VerifyEmailBanner padded={false} /></div>
        <div className="card" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <button
            onClick={handleProfilePicUpload}
            disabled={photoBusy}
            aria-label={t('m.profile.changePhoto')}
            className="tappable"
            style={{
              border: 'none',
              padding: 0,
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--system-bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: photoBusy ? 0.5 : 1 }} />
            ) : (
              <Icon name={photoBusy ? 'clock' : 'user'} size={32} style={{ color: 'var(--label-secondary)' }} />
            )}
          </button>
          <p style={{ fontSize: '11px', color: 'var(--label-secondary)', marginBottom: '4px' }}>{photoBusy ? t('m.stories.posting') : t('m.profile.tapPhoto')}</p>
          {photoError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '4px' }}>{photoError}</p>}
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{user.name}</h2>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginTop: '2px' }}>{user.email}</p>
          {(user.bio || user.homeCountry) && (
            <p style={{ fontSize: '14px', color: 'var(--label-primary)', marginTop: '6px', lineHeight: 1.4 }}>
              {user.bio}{user.bio && user.homeCountry ? ' · ' : ''}{user.homeCountry ? t('m.profile.from', { place: user.homeCountry }) : ''}
            </p>
          )}
          <button className="btn btn-tertiary" onClick={openEdit} style={{ margin: '4px auto 0', minHeight: '36px', fontSize: '15px' }}>
            <Icon name="settings" size={14} /> {t('m.profile.edit')}
          </button>
          {memberSince && (
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px' }}>{memberSince}</p>
          )}
          <span className="chip" style={{ cursor: 'default', marginTop: '10px' }}>
            <Icon name={getTierForPoints(user.lifetimePoints ?? user.points).icon as any} size={14} style={{ color: 'var(--rum-text)' }} />
            {labels.tier(getTierForPoints(user.lifetimePoints ?? user.points).key)}
          </span>
        </div>

        <div className="grid-2" style={{ gap: '12px', marginBottom: '24px' }}>
          <Link href="/rewards" className="card" style={{ padding: '16px', textAlign: 'center', textDecoration: 'none' }}>
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--rum)' }}>{user.points.toLocaleString()}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{t('m.profile.points')}</p>
          </Link>
          <Link href="/pay" className="card" style={{ padding: '16px', textAlign: 'center', textDecoration: 'none' }}>
            <Price usd={user.walletBalance} style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }} />
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{t('m.profile.wallet')}</p>
          </Link>
        </div>

        {referral && (
          <div className="card" style={{ padding: '16px', marginBottom: '24px', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Icon name="users" size={20} style={{ color: 'var(--rum-text)' }} />
              <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.invite.title')}</p>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--label-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
              {t('m.invite.body', { points: referral.pointsPerReferral })}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', background: 'var(--system-bg-secondary)' }}>
                <p style={{ fontSize: '11px', color: 'var(--label-tertiary)' }}>{t('m.invite.code')}</p>
                <p className="num-font" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)', letterSpacing: '0.04em' }}>{referral.code}</p>
              </div>
              <button className="btn btn-primary" onClick={shareInvite} style={{ padding: '0 14px' }}>
                <Icon name="share" size={16} /> {inviteCopied ? '✓' : t('m.invite.share')}
              </button>
            </div>
            {referral.invited > 0 && (
              <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '10px' }}>
                {t('m.invite.stats', { invited: referral.invited, rewarded: referral.rewarded, earned: referral.pointsEarned })}
              </p>
            )}
          </div>
        )}

        {menuItems.map((item, i) => {
          const row = (
            <div className="card" style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
              minHeight: '44px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon name={item.icon as any} size={20} style={{ color: 'var(--label-secondary)' }} />
                <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{item.label}</span>
              </div>
              <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
            </div>
          )

          if (item.href) {
            return (
              <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
                {row}
              </Link>
            )
          }

          return (
            <button key={i} className="tappable" onClick={item.onClick} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer' }}>
              {row}
            </button>
          )
        })}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }} onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? t('m.profile.logoutBusy') : t('m.profile.logout')}
        </button>
      </div>

      {/* Settings Sheet */}
      <div className={`bottom-sheet-overlay ${showSettingsSheet ? 'open' : ''}`} onClick={() => setShowSettingsSheet(false)} />
      <div className={`bottom-sheet ${showSettingsSheet ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.profile.settings')} style={{ maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.profile.settings')}</h3>

          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="globe" size={20} style={{ color: 'var(--label-secondary)' }} />
              <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.language')}</span>
            </div>
            <div role="group" aria-label={t('m.profile.language')} style={{ display: 'flex', gap: '4px' }}>
              {LANGS.map(code => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`chip ${lang === code ? 'active' : ''}`}
                  style={{ minHeight: '36px', padding: '4px 12px' }}
                >
                  {LANG_NAMES[code]}
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon name="wallet" size={20} style={{ color: 'var(--label-secondary)' }} />
                <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.currency')}</span>
              </div>
              <div role="group" aria-label={t('m.profile.currency')} style={{ display: 'flex', gap: '4px' }}>
                {(['USD', 'JMD'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)} aria-pressed={currency === c} className={`chip ${currency === c ? 'active' : ''}`} style={{ minHeight: '36px', padding: '4px 12px' }}>{c}</button>
                ))}
              </div>
            </div>
            <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '6px' }}>{t('m.profile.rate', { rate: rate ?? '—' })}</p>
          </div>

          <Link href="/trips" className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="calendar" size={20} style={{ color: 'var(--label-secondary)' }} />
              <span>
                <span style={{ display: 'block', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.tripTitle')}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.profile.tripSub')}</span>
              </span>
            </span>
            <Icon name="chevronRight" size={16} style={{ color: 'var(--label-tertiary)' }} />
          </Link>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
              <Icon name="send" size={20} style={{ color: 'var(--label-secondary)' }} /> WhatsApp
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', margin: '2px 0 8px 32px' }}>{t('m.profile.whatsappSub')}</p>
            <input value={whatsapp.number} type="tel" maxLength={24} onChange={e => setWhatsapp({ ...whatsapp, number: e.target.value })} placeholder={t('m.profile.whatsappNumber')} aria-label={t('m.profile.whatsappNumber')} autoComplete="tel" style={fieldStyle} />
            <button role="switch" aria-checked={whatsapp.on} disabled={!whatsapp.number.trim()} onClick={() => saveWhatsapp({ ...whatsapp, on: !whatsapp.on })} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', background: 'none', border: 'none', borderTop: '0.5px solid var(--separator)', fontFamily: 'inherit', cursor: 'pointer', minHeight: '44px', opacity: whatsapp.number.trim() ? 1 : 0.5 }}>
              <span style={{ fontSize: '15px', color: 'var(--label-primary)', textAlign: 'left' }}>{t('m.profile.whatsappOn')}</span>
              <Switch on={whatsapp.on} />
            </button>
            <button className="btn btn-secondary" onClick={() => saveWhatsapp(whatsapp)} style={{ width: '100%' }}>{t('m.profile.save')}</button>
            {whatsappMsg && <p role="status" style={{ fontSize: '13px', color: 'var(--label-primary)', marginTop: '6px' }}>{whatsappMsg}</p>}
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon name="moon" size={20} style={{ color: 'var(--label-secondary)' }} />
                <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.theme')}</span>
              </span>
              <div role="radiogroup" aria-label={t('m.profile.theme')} style={{ display: 'flex', gap: '4px' }}>
                {(['light', 'dark', 'auto'] as const).map(mode => (
                  <button key={mode} role="radio" aria-checked={theme === mode} onClick={() => chooseTheme(mode)} className={`chip ${theme === mode ? 'active' : ''}`} style={{ minHeight: '36px', padding: '4px 12px' }}>
                    {t(`m.profile.theme.${mode}` as 'm.profile.theme.auto')}
                  </button>
                ))}
              </div>
            </div>
            {theme === 'auto' && <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '6px' }}>{t('m.profile.themeAutoSub', { town: town.name })}</p>}
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
              <Icon name="bell" size={20} style={{ color: 'var(--label-secondary)' }} /> {t('m.profile.notifTitle')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', margin: '2px 0 8px 32px' }}>{t('m.profile.notifSub')}</p>
            {NOTIFY_TYPES.map(type => {
              const on = user[NOTIFY_FIELD[type]] !== false
              return (
                <button key={type} role="switch" aria-checked={on} onClick={() => toggleNotify(type)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', background: 'none', border: 'none', borderTop: '0.5px solid var(--separator)', fontFamily: 'inherit', cursor: 'pointer', minHeight: '44px' }}>
                  <span style={{ fontSize: '15px', color: 'var(--label-primary)', textAlign: 'left' }}>{t(`m.profile.notif.${type}` as 'm.profile.notif.crew')}</span>
                  <Switch on={on} />
                </button>
              )
            })}
            <button role="switch" aria-checked={notifications} disabled={alertsBusy} onClick={toggleNotifications} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 0', background: 'none', border: 'none', borderTop: '0.5px solid var(--separator)', fontFamily: 'inherit', cursor: 'pointer', minHeight: '44px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', textAlign: 'left' }}>{alertsBusy ? t('m.profile.pushSetting') : t('m.profile.push')}</span>
              <Switch on={notifications} />
            </button>
            {!pushSupported() && !notifications && <p style={{ fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.profile.pushIphone')}</p>}
            {alertsError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)' }}>{alertsError}</p>}
          </div>

          <button className="card" role="switch" aria-checked={lowData} onClick={() => setLowData(!lowData)} style={{ width: '100%', border: 'none', fontFamily: 'inherit', textAlign: 'left', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="video" size={20} style={{ color: 'var(--label-secondary)' }} />
              <span>
                <span style={{ display: 'block', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.lowData')}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.profile.lowDataSub')}</span>
              </span>
            </span>
            <Switch on={lowData} />
          </button>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>
              <Icon name="shield" size={20} style={{ color: 'var(--label-secondary)' }} /> {t('m.profile.emergencyTitle')}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', margin: '2px 0 8px 32px' }}>{t('m.profile.emergencySub')}</p>
            <input value={emergency.name} maxLength={60} onChange={e => setEmergency({ ...emergency, name: e.target.value })} placeholder={t('m.profile.emergencyName')} aria-label={t('m.profile.emergencyName')} autoComplete="off" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', marginBottom: '8px' }} />
            <input value={emergency.phone} maxLength={24} type="tel" onChange={e => setEmergency({ ...emergency, phone: e.target.value })} placeholder={t('m.profile.emergencyPhone')} aria-label={t('m.profile.emergencyPhone')} autoComplete="off" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', marginBottom: '8px' }} />
            <button className="btn btn-secondary" onClick={saveEmergency} style={{ width: '100%' }}>{t('m.profile.save')}</button>
            {emergencyMsg && <p role="status" style={{ fontSize: '13px', color: 'var(--label-primary)', marginTop: '6px' }}>{emergencyMsg}</p>}
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '8px' }}>
              <Icon name="lock" size={20} style={{ color: 'var(--label-secondary)' }} /> {t('m.profile.yourData')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button className="chip" onClick={downloadData}><Icon name="download" size={14} /> {t('m.profile.download')}</button>
              <button className="chip" onClick={() => { setDeleteText(''); setDeleteError(null); setDeleteOpen(true) }} style={{ color: 'var(--error)' }}><Icon name="trash" size={14} /> {t('m.profile.delete')}</button>
            </div>
          </div>

          <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', cursor: 'default' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '8px' }}>
              <Icon name="shield" size={20} style={{ color: 'var(--label-secondary)' }} /> {t('m.legal.section')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Link href="/privacy" className="chip" style={{ textDecoration: 'none' }}>{t('m.legal.privacy')}</Link>
              <Link href="/terms" className="chip" style={{ textDecoration: 'none' }}>{t('m.legal.terms')}</Link>
              <Link href="/policies/cancellation" className="chip" style={{ textDecoration: 'none' }}>{t('m.legal.cancellation')}</Link>
            </div>
          </div>

          <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setShowSettingsSheet(false)}>
            {t('m.profile.done')}
          </button>
        </div>
      </div>

      {/* Delete account */}
      <div className={`bottom-sheet-overlay ${deleteOpen ? 'open' : ''}`} onClick={() => !deleting && setDeleteOpen(false)} style={{ zIndex: 650 }} />
      <div className={`bottom-sheet ${deleteOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.profile.deleteTitle')} style={{ zIndex: 651 }}>
        <div className="sheet-grabber" />
        {deleteOpen && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--error)', marginBottom: '8px' }}>{t('m.profile.deleteTitle')}</h3>
            <p style={{ fontSize: '14px', color: 'var(--label-primary)', lineHeight: 1.45, marginBottom: '14px' }}>{t('m.profile.deleteBody')}</p>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }} htmlFor="delete-confirm">{t('m.profile.deleteType')}</label>
            <input id="delete-confirm" value={deleteText} onChange={e => setDeleteText(e.target.value)} autoCapitalize="characters" autoComplete="off" style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', marginBottom: '12px' }} />
            {deleteError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-tertiary" onClick={() => setDeleteOpen(false)} disabled={deleting} style={{ flex: 1 }}>{t('m.book.cancel')}</button>
              <button className="btn btn-primary" onClick={deleteAccount} disabled={deleting || deleteText.trim().toUpperCase() !== 'DELETE'} style={{ flex: 2, background: 'var(--error)' }}>{deleting ? '…' : t('m.profile.deleteConfirm')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit profile */}
      <div className={`bottom-sheet-overlay ${editOpen ? 'open' : ''}`} onClick={() => setEditOpen(false)} />
      <div className={`bottom-sheet ${editOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.profile.edit')}>
        <div className="sheet-grabber" />
        {editOpen && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.profile.edit')}</h3>
            {([['name', t('m.profile.name'), 60], ['homeCountry', t('m.profile.homeCountry'), 60]] as const).map(([key, label, max]) => (
              <label key={key} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '12px' }}>
                {label}
                <input value={form[key]} maxLength={max} onChange={e => setForm({ ...form, [key]: e.target.value })} style={{ width: '100%', marginTop: '6px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit' }} />
              </label>
            ))}
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '12px' }}>
              {t('m.profile.instagram')}
              <input value={form.instagramHandle} maxLength={40} onChange={e => setForm({ ...form, instagramHandle: e.target.value })} placeholder="@yourname" autoCapitalize="none" autoCorrect="off" style={{ width: '100%', marginTop: '6px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit' }} />
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 400, marginTop: '4px' }}>{t('m.profile.instagramSub')}</span>
            </label>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '12px' }}>
              {t('m.profile.bio')}
              <textarea value={form.bio} maxLength={280} rows={3} onChange={e => setForm({ ...form, bio: e.target.value })} style={{ width: '100%', marginTop: '6px', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', color: 'var(--label-primary)', fontSize: '16px', fontFamily: 'inherit', resize: 'vertical' }} />
            </label>
            {saveError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{saveError}</p>}
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving || !form.name.trim()} style={{ width: '100%' }}>{saving ? '…' : t('m.profile.save')}</button>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}
