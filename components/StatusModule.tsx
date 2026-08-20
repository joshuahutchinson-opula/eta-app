'use client'

import { useState } from 'react'

export default function StatusModule() {
  const [walletHidden, setWalletHidden] = useState(true)
  const points = 1240
  const balance = 250
  const transportEta = '12 min'

  return (
    <div className="user-status">
      <div style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gold)' }}>
          {points.toLocaleString()}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--sand-dim)', marginTop: '2px' }}>
          Points
        </div>
      </div>

      <div style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }} onClick={() => setWalletHidden(!walletHidden)}>
        <div style={{
          fontSize: '18px',
          fontWeight: 800,
          letterSpacing: walletHidden ? '2px' : '0',
          opacity: walletHidden ? 0.5 : 1
        }}>
          {walletHidden ? '••••' : `$${balance}`}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--sand-dim)', marginTop: '2px' }}>
          Wallet
        </div>
      </div>

      <div style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--sea)' }}>
          {transportEta}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--sand-dim)', marginTop: '2px' }}>
          ETA
        </div>
      </div>
    </div>
  )
}