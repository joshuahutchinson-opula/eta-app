// app/profile/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

export default function ProfilePage() {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') {
      setDarkMode(true)
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light')
    localStorage.setItem('theme', newMode ? 'dark' : 'light')
  }

  const user = {
    name: 'Jordan',
    email: 'jordan@eta.app',
    memberSince: 'January 2025',
    points: 1240,
    walletBalance: 250
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--off-white)', paddingBottom: '80px', overflowX: 'hidden' }}>
      <TopBar />

      <div style={{ padding: '16px' }}>
        {/* Profile header */}
        <div className="card" style={{ padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--light-grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Icon name="user" size={32} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--black)' }}>{user.name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--grey)', marginTop: '2px' }}>{user.email}</p>
          <p style={{ fontSize: '11px', color: 'var(--grey)', marginTop: '4px' }}>Member since {user.memberSince}</p>
        </div>

        {/* Stats */}
        <div className="grid-2" style={{ gap: '12px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--rum)' }}>{user.points.toLocaleString()}</p>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Points</p>
          </div>
          <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <p className="num-font" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--black)' }}>${user.walletBalance}</p>
            <p style={{ fontSize: '10px', fontWeight: 600, color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>Wallet</p>
          </div>
        </div>

        {/* Dark mode toggle */}
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
            <Icon name="moon" size={20} style={{ color: 'var(--grey)' }} />
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--black)' }}>Dark Mode</span>
          </div>
          <div style={{
            width: '48px',
            height: '28px',
            borderRadius: '999px',
            background: darkMode ? 'var(--rum)' : 'var(--light-grey)',
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

        {/* Menu items */}
        {[
          { label: 'My Bookings', icon: 'clock', href: '/experiences' },
          { label: 'Saved Vendors', icon: 'heart', href: '/marketplace' },
          { label: 'Rewards', icon: 'sparkle', href: '/rewards' },
          { label: 'Wallet', icon: 'wallet', href: '/wallet' },
          { label: 'Settings', icon: 'settings', href: '#' }
        ].map((item, i) => (
          <Link key={i} href={item.href} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ 
              padding: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icon name={item.icon as any} size={20} style={{ color: 'var(--grey)' }} />
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--black)' }}>{item.label}</span>
              </div>
              <Icon name="chevronRight" size={16} style={{ color: 'var(--grey)' }} />
            </div>
          </Link>
        ))}

        {/* Logout */}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
          Log Out
        </button>
      </div>

      <Dock />
    </main>
  )
}