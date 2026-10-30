// app/profile/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { getAuthToken, getCurrentUser, logout, setCurrentUser, type CurrentUser } from '@/lib/auth-client'
import { useLang } from '@/lib/i18n-client'
import { getTierForPoints } from '@/lib/rewardTiers'
import { alertsEnabled, disableAlerts, enableAlerts, pushSupported, refreshAlertLocation, syncAlerts } from '@/lib/alerts-client'
import { apiJson, uploadPhoto } from '@/lib/api-client'
import { useCurrency, USD_TO_JMD } from '@/lib/currency'
import { LANGS, LANG_NAMES } from '@/lib/i18n'
import Price from '@/components/Price'

function formatMemberSince(createdAt?: string | null): string | null {
  if (!createdAt) return null
  const d = new Date(createdAt)
  if (isNaN(d.getTime())) return null
  return `Member since ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
}

export default function ProfilePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [alertPrefs, setAlertPrefs] = useState({ liveAlerts: true, dealAlerts: true })
  const [alertsBusy, setAlertsBusy] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: '', bio: '', homeCountry: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { currency, setCurrency } = useCurrency()
  const [showSettingsSheet, setShowSettingsSheet] = useState(false)
  const { lang, setLang, t } = useLang()
  const [referral, setReferral] = useState<{ code: string; pointsPerReferral: number; invited: number; rewarded: number; pointsEarned: number } | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)

  useEffect(() => {
    const current = getCurrentUser()
    setUser(current)
    // Points change server-side (completed trips, referral payouts), so
    // refresh the cached user instead of trusting the copy from login.
    const token = getAuthToken()
    if (token) {
      fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (data?.user) {
            setCurrentUser(data.user)
            setUser(data.user)
          }
        })
        .catch(() => {})
    }
    if (current) {
      fetch(`/api/referrals?userId=${current.id}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data?.code) setReferral(data) })
        .catch(() => {})
    }

    // Light is the default; dark applies only when the user has chosen it.
    const savedTheme = localStorage.getItem('theme')
    const isDark = savedTheme === 'dark'
    setDarkMode(isDark)
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')

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
    if (new URLSearchParams(window.location.search).get('settings') === '1') setShowSettingsSheet(true)

    setMounted(true)
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light')
    localStorage.setItem('theme', newMode ? 'dark' : 'light')

    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', newMode ? '#000000' : '#F2F2F7')
    }
  }

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
      setAlertsError(e instanceof Error ? e.message : 'Sumth nah wuk')
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
        setPhotoError(err instanceof Error ? err.message : 'Sumth nah wuk')
      } finally {
        setPhotoBusy(false)
      }
    }
    input.click()
  }

  const openEdit = () => {
    if (!user) return
    setForm({ name: user.name, bio: user.bio ?? '', homeCountry: user.homeCountry ?? '' })
    setSaveError(null)
    setEditOpen(true)
  }

  const saveProfile = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const { user: updated } = await apiJson<{ user: CurrentUser }>('/api/users/me', { method: 'PUT', body: form })
      setCurrentUser(updated)
      setUser(updated)
      setEditOpen(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Sumth nah wuk')
    } finally {
      setSaving(false)
    }
  }

  const shareInvite = async () => {
    if (!referral) return
    const url = `${window.location.origin}/register?ref=${encodeURIComponent(referral.code)}`
    const text = t('m.invite.shareText', { code: referral.code, points: referral.pointsPerReferral })
    if (navigator.share) {
      navigator.share({ title: 'ETA', text, url }).catch(() => {})
      return
    }
    await navigator.clipboard?.writeText(`${text} ${url}`).catch(() => {})
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 1800)
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const menuItems: { label: string; icon: string; href?: string; onClick?: () => void }[] = [
    { label: t('m.profile.bookings'), icon: 'clock', href: '/bookings' },
    { label: t('m.profile.saved'), icon: 'heart', href: '/saved' },
    { label: t('m.inbox.title'), icon: 'bell', href: '/notifications' },
    { label: t('m.profile.wallet'), icon: 'sparkle', href: '/wallet' },
    { label: t('m.profile.rewards'), icon: 'gift', href: '/rewards' },
    { label: t('m.safety.title'), icon: 'route', href: '/safety' },
    { label: t('m.profile.settings'), icon: 'settings', onClick: () => setShowSettingsSheet(true) }
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

  const memberSince = formatMemberSince(user.createdAt)

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px' }}>
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
            <Icon name={getTierForPoints(user.points).icon as any} size={14} style={{ color: 'var(--rum-text)' }} />
            {getTierForPoints(user.points).label}
          </span>
        </div>

        <div className="grid-2" style={{ gap: '12px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--rum)' }}>{user.points.toLocaleString()}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{t('m.profile.points')}</p>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <Price usd={user.walletBalance} style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }} />
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>{t('m.profile.wallet')}</p>
          </div>
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

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }} onClick={handleLogout}>
          {t('m.profile.logout')}
        </button>
      </div>

      {/* Settings Sheet */}
      <div className={`bottom-sheet-overlay ${showSettingsSheet ? 'open' : ''}`} onClick={() => setShowSettingsSheet(false)} />
      <div className={`bottom-sheet ${showSettingsSheet ? 'open' : ''}`}>
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
            <p className="num-font" style={{ fontSize: '12px', color: 'var(--label-secondary)', marginTop: '6px' }}>{t('m.profile.rate', { rate: USD_TO_JMD })}</p>
          </div>

          <button
            className="card"
            role="switch"
            aria-checked={darkMode}
            style={{
              width: '100%',
              border: 'none',
              fontFamily: 'inherit',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
            onClick={toggleDarkMode}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="moon" size={20} style={{ color: 'var(--label-secondary)' }} />
              <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.profile.darkMode')}</span>
            </div>
            <div style={{
              width: '48px',
              height: '28px',
              borderRadius: '999px',
              background: darkMode ? 'var(--rum)' : 'var(--separator)',
              position: 'relative',
              transition: 'background 0.2s ease'
            }}>
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: darkMode ? '23px' : '3px',
                transition: 'left 0.2s ease'
              }} />
            </div>
          </button>

          <button
            className="card"
            role="switch"
            aria-checked={notifications}
            disabled={alertsBusy}
            style={{
              width: '100%',
              border: 'none',
              fontFamily: 'inherit',
              textAlign: 'left',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
            onClick={toggleNotifications}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icon name="bell" size={20} style={{ color: 'var(--label-secondary)' }} />
              <span>
                <span style={{ display: 'block', fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Live alerts</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>
                  {alertsBusy ? 'Setting up…' : 'Saved spots going live, flash deals nearby'}
                </span>
              </span>
            </div>
            <div style={{
              width: '48px',
              height: '28px',
              borderRadius: '999px',
              background: notifications ? 'var(--rum)' : 'var(--separator)',
              position: 'relative',
              transition: 'background 0.2s ease'
            }}>
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '3px',
                left: notifications ? '23px' : '3px',
                transition: 'left 0.2s ease'
              }} />
            </div>
          </button>

          {alertsError && (
            <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', margin: '-4px 4px 12px' }}>{alertsError}</p>
          )}
          {!pushSupported() && !notifications && (
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', margin: '-4px 4px 12px' }}>
              On iPhone, add ETA to your Home Screen to get alerts.
            </p>
          )}
          {notifications && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button className={`chip ${alertPrefs.liveAlerts ? 'active' : ''}`} onClick={() => toggleAlertPref('liveAlerts')}>
                <Icon name="heart" size={14} /> Saved spot goes live
              </button>
              <button className={`chip ${alertPrefs.dealAlerts ? 'active' : ''}`} onClick={() => toggleAlertPref('dealAlerts')}>
                <Icon name="flame" size={14} /> Flash deals nearby
              </button>
            </div>
          )}

          <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setShowSettingsSheet(false)}>
            {t('m.profile.done')}
          </button>
        </div>
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
