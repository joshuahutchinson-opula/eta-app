// app/profile/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

export default function ProfilePage() {
  const [darkMode, setDarkMode] = useState(false)
  const [profilePic, setProfilePic] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    const savedPic = localStorage.getItem('profilePic')
    if (savedPic) setProfilePic(savedPic)
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

  const user = {
    name: 'Jordan',
    email: 'jordan@eta.app',
    memberSince: 'January 2025',
    points: 1240,
    walletBalance: 250
  }

  const menuItems = [
    { label: 'My Bookings', icon: 'clock', href: '/experiences' },
    { label: 'Saved Vendors', icon: 'heart', href: '/marketplace' },
    { label: 'Wallet & Rewards', icon: 'sparkle', href: '/wallet' },
    { label: 'Settings', icon: 'settings', href: '#' }
  ]

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
            ) : (
              <Icon name="user" size={32} style={{ color: 'var(--label-secondary)' }} />
            )}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--label-tertiary)', marginBottom: '4px' }}>Tap to add photo</p>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>{user.name}</h2>
          <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginTop: '2px' }}>{user.email}</p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '4px' }}>Member since {user.memberSince}</p>
        </div>

        <div className="grid-2" style={{ gap: '12px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--rum)' }}>{user.points.toLocaleString()}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Points</p>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--label-primary)' }}>${user.walletBalance}</p>
            <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--label-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Wallet</p>
          </div>
        </div>

        <div className="card" style={{ 
          padding: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: '16px'
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

        {menuItems.map((item, i) => (
          <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
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
          </Link>
        ))}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '16px' }}>
          Log Out
        </button>
      </div>

      <Dock />
    </main>
  )
}