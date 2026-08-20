'use client'

import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

export default function WalletPage() {
  const points = 1240
  const balance = 250

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '120px' }}>
      <TopBar />

      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: 'var(--sand-dim)' }}>Your Wallet</p>
        <div style={{
          fontSize: '52px',
          fontWeight: 800,
          background: 'var(--gradient-gold)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ${balance}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>
          {points.toLocaleString()} pts
        </p>

        {/* Coins */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', margin: '16px 0' }}>
          {Array(Math.min(Math.floor(points / 100), 10)).fill(0).map((_, i) => (
            <div key={i} style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'var(--gradient-gold)',
              boxShadow: '0 2px 8px rgba(255,184,0,0.4)'
            }} />
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', minHeight: '160px', marginBottom: '20px' }}>
          {[
            { cardClass: 'card-1', bg: 'linear-gradient(135deg, #1A1A2E, #16213E)', transform: 'translateY(0)', zIndex: 3 },
            { cardClass: 'card-2', bg: 'linear-gradient(135deg, #2E1A1A, #3E1A2E)', transform: 'translateY(12px) rotate(2deg) scale(0.95)', zIndex: 2 },
            { cardClass: 'card-3', bg: 'linear-gradient(135deg, #1A2E1A, #1E3E1A)', transform: 'translateY(24px) rotate(-1deg) scale(0.9)', zIndex: 1 },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '280px',
                height: '160px',
                borderRadius: '16px',
                background: card.bg,
                transform: card.transform,
                zIndex: card.zIndex,
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <p style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '2px' }}>
                •••• {['4242', '8842', '3310'][i]}
              </p>
            </div>
          ))}
        </div>

        {/* Reward Tickets */}
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Icon name="gift" size={18} />
          Your Tickets
        </h2>

        <div className="wallet-ticket bond" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--glass-bg)', backdropFilter: 'blur(15px)', border: '1px solid rgba(255,184,0,0.3)', borderRadius: '12px', marginBottom: '8px' }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h4 style={{ fontSize: '14px' }}>350 pts = Free rum punch</h4>
            <p style={{ fontSize: '12px', color: 'var(--sand-dim)' }}>Push Cart</p>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }}>
            Redeem
          </button>
        </div>

        <div className="wallet-ticket bond" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--glass-bg)', backdropFilter: 'blur(15px)', border: '1px solid rgba(255,184,0,0.3)', borderRadius: '12px' }}>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <h4 style={{ fontSize: '14px' }}>800 pts = Free breakfast</h4>
            <p style={{ fontSize: '12px', color: 'var(--sand-dim)' }}>Blue Mahoe</p>
          </div>
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }}>
            Redeem
          </button>
        </div>
      </div>

      <Dock />
    </main>
  )
}