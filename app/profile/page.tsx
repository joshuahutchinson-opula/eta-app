// app/profile/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'
import { getCurrentUser, logout, type CurrentUser } from '@/lib/auth-client'

function formatLevel(level: string) {
  return level
    .split('_')
    .map(w => w[0] + w.slice(1).toLowerCase())
    .join(' ')
}

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
  const [notifications, setNotifications] = useState(true)
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [showSettingsSheet, setShowSettingsSheet] = useState(false)

  useEffect(() => {
    setUser(getCurrentUser())

    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }

    const savedNotifications = localStorage.getItem('notifications')
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === 'true')
    }

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

  const toggleNotifications = () => {
    const newValue = !notifications
    setNotifications(newValue)
    localStorage.setItem('notifications', String(newValue))
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

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const menuItems: { label: string; icon: string; href?: string; onClick?: () => void }[] = [
    { label: 'My Bookings', icon: 'clock', href: '/experiences' },
    { label: 'Saved Vendors', icon: 'heart', href: '/marketplace' },
    { label: 'Wallet & Rewards', icon: 'sparkle', href: '/wallet' },
    { label: 'Rewards', icon: 'gift', href: '/rewards' },
    { label: 'Settings', icon: 'settings', onClick: () => setShowSettingsSheet(true) }
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
          <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Log in to see your profile</p>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)' }}>
            Sign in to view your bookings, points and wallet.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ marginTop: '8px', textDecoration: 'none' }}>
            Log In
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
          <p style={{ fontSize: '11px', color: 'var(--label-tertiary)', marginBottom: '4px' }}>Tap to add photo</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{user.name}</h2>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginTop: '2px' }}>{user.email}</p>
          {memberSince && (
            <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px' }}>{memberSince}</p>
          )}
          <span className="chip" style={{ cursor: 'default', marginTop: '10px' }}>
            <Icon name="crown" size={14} style={{ color: 'var(--rum-text)' }} />
            {formatLevel(user.level)}
          </span>
        </div>

        <div className="grid-2" style={{ gap: '12px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--rum)' }}>{user.points.toLocaleString()}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Points</p>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>${user.walletBalance.toFixed(2)}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Wallet</p>
          </div>
        </div>

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
          Log Out
        </button>
      </div>

      {/* Settings Sheet */}
      <div className={`bottom-sheet-overlay ${showSettingsSheet ? 'open' : ''}`} onClick={() => setShowSettingsSheet(false)} />
      <div className={`bottom-sheet ${showSettingsSheet ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Settings</h3>

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
              <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Dark Mode</span>
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
              <span style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>Notifications</span>
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

          <button className="btn btn-tertiary" style={{ width: '100%' }} onClick={() => setShowSettingsSheet(false)}>
            Done
          </button>
        </div>
      </div>

      <Dock />
    </main>
  )
}
