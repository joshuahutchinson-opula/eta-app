'use client'

import { useState } from 'react'
import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

export default function ProfilePage() {
  const [settings, setSettings] = useState({
    bigText: false,
    patoisMode: true,
    batterySafe: false
  })

  const points = 1240
  const streak = 3
  const discoveries = 4
  const vibe = 'Adventure'

  const toggleSetting = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '120px' }}>
      <TopBar />

      <div style={{ padding: '24px' }}>
        {/* Profile Header */}
        <div className="glass" style={{ padding: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--gradient-rum)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 700
          }}>
            J
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Jordan</h2>
            <p style={{ fontSize: '12px', color: 'var(--sand-dim)' }}>
              {vibe} • {points.toLocaleString()} pts
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="glass" style={{ padding: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--gold)' }}>{points.toLocaleString()}</div>
            <div style={{ fontSize: '10px', color: 'var(--sand-dim)' }}>Points</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{discoveries}</div>
            <div style={{ fontSize: '10px', color: 'var(--sand-dim)' }}>Discoveries</div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--rum-bright)' }}>{streak}-day</div>
            <div style={{ fontSize: '10px', color: 'var(--sand-dim)' }}>Streak</div>
          </div>
        </div>

        {/* Settings */}
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="settings" size={18} />
          Settings
        </h2>

        {[
          { label: 'Big Text', key: 'bigText' },
          { label: 'Patois Mode', key: 'patoisMode' },
          { label: 'Battery-Safe', key: 'batterySafe' },
        ].map(item => (
          <div key={item.key} className="glass" style={{ padding: '14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.label}</span>
            <div
              style={{
                width: '44px',
                height: '26px',
                borderRadius: '999px',
                background: settings[item.key as keyof typeof settings] ? 'var(--rum)' : 'var(--glass-border)',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={() => toggleSetting(item.key)}
            >
              <div style={{
                position: 'absolute',
                top: '3px',
                [settings[item.key as keyof typeof settings] ? 'right' : 'left']: '3px',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'var(--sand)',
                transition: 'all 0.2s'
              }} />
            </div>
          </div>
        ))}

        {/* Links */}
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', marginTop: '20px' }}>More</h2>

        <Link href="/wallet" className="glass" style={{ padding: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textDecoration: 'none', color: 'var(--sand)' }}>
          <Icon name="wallet" size={18} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Wallet</span>
        </Link>

        <Link href="/login" className="glass" style={{ padding: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textDecoration: 'none', color: 'var(--sand)' }}>
          <Icon name="journal" size={18} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Discovery Journal</span>
        </Link>

        <Link href="/login" className="glass" style={{ padding: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textDecoration: 'none', color: 'var(--sand)' }}>
          <Icon name="gift" size={18} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Challenges</span>
        </Link>

        <Link href="/login" className="glass" style={{ padding: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textDecoration: 'none', color: 'var(--sand)' }}>
          <Icon name="user" size={18} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Login / Register</span>
        </Link>
      </div>

      <Dock />
    </main>
  )
}