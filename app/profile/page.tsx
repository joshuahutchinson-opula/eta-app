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
  const [darkMode, setDarkMode] = useState(true)
  const [notifications, setNotifications] = useState(false)
  const [alertPrefs, setAlertPrefs] = useState({ liveAlerts: true, dealAlerts: true })
  const [alertsBusy, setAlertsBusy] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [profilePic, setProfilePic] = useState<string | null>(null)
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

    // Dark is the default; only an explicit 'light' choice turns it off.
    const savedTheme = localStorage.getItem('theme')
    const isDark = savedTheme !== 'light'
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

    const savedPic = localStorage.getItem('profilePic')
    if (savedPic) setProfilePic(savedPic)

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

  const handleProfilePicUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const result = event.target?.result as string
          setProfilePic(result)
          localStorage.setItem('profilePic', result)
        }
        reader.readAsDataURL(file)
      }
    }
    input.click()
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
    { label: t('m.profile.bookings'), icon: 'clock', href: '/experiences' },
    { label: t('m.profile.saved'), icon: 'heart', href: '/marketplace' },
    { label: t('m.profile.wallet'), icon: 'sparkle', href: '/wallet' },
    { label: t('m.profile.rewards'), icon: 'gift', href: '/rewards' },
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
          <div
            onClick={handleProfilePicUpload}
            className="tappable"
            style={{
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
            {profilePic ? (
              <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Icon name="user" size={32} style={{ color: 'var(--label-secondary)' }} />
            )}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--label-tertiary)', marginBottom: '4px' }}>{t('m.profile.tapPhoto')}</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{user.name}</h2>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginTop: '2px' }}>{user.email}</p>
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
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>${user.walletBalance.toFixed(2)}</p>
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
            <div key={i} className="tappable" onClick={item.onClick} style={{ textDecoration: 'none' }}>
              {row}
            </div>
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
              {(['en', 'es'] as const).map(code => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`chip ${lang === code ? 'active' : ''}`}
                  style={{ minHeight: '36px', padding: '4px 12px' }}
                >
                  {code === 'en' ? 'English' : 'Español'}
                </button>
              ))}
            </div>
          </div>

          <div
            className="card"
            style={{
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
          </div>

          <div
            className="card"
            style={{
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
          </div>

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

      <Dock />
    </main>
  )
}
