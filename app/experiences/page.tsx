'use client'

import { useState } from 'react'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

const orbs = [
  { id: 'chill', label: 'Chill', color: '#00E5CC', icon: 'wellness' },
  { id: 'hungry', label: 'Hungry', color: '#FF4B2B', icon: 'food' },
  { id: 'adventure', label: 'Adventure', color: '#FFB800', icon: 'activity' },
  { id: 'turnup', label: 'Turn Up', color: '#9333EA', icon: 'drink' },
]

export default function ExperiencesPage() {
  const [selectedOrb, setSelectedOrb] = useState<string | null>(null)
  const [phase, setPhase] = useState(1)

  const selectOrb = (orbId: string) => {
    setSelectedOrb(orbId)
    setPhase(2)
    setTimeout(() => setPhase(3), 800)
    setTimeout(() => setPhase(4), 1600)
    setTimeout(() => setPhase(5), 2400)
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '120px' }}>
      <TopBar />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '20px' }}>
        {phase === 1 && (
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
              Tonight, Negril is...
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--sand-dim)', marginBottom: '40px' }}>
              Wi a find sumth nice fi yuh
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {orbs.map(orb => (
                <button
                  key={orb.id}
                  onClick={() => selectOrb(orb.id)}
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${orb.color}33, ${orb.color}11)`,
                    border: `2px solid ${orb.color}66`,
                    color: 'var(--sand)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    transition: 'all 0.3s',
                    boxShadow: `0 0 30px ${orb.color}22`
                  }}
                >
                  <Icon name={orb.icon} size={28} />
                  {orb.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(phase === 2 || phase === 3) && selectedOrb && (
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
            <div
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${orbs.find(o => o.id === selectedOrb)?.color}44, ${orbs.find(o => o.id === selectedOrb)?.color}11)`,
                border: `2px solid ${orbs.find(o => o.id === selectedOrb)?.color}88`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                boxShadow: `0 0 60px ${orbs.find(o => o.id === selectedOrb)?.color}44`
              }}
            >
              <Icon name={orbs.find(o => o.id === selectedOrb)?.icon || 'sparkle'} size={60} />
            </div>

            {phase === 3 && (
              <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '30px' }}>
                Say less.
              </p>
            )}
          </div>
        )}

        {phase === 4 && (
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease' }}>
            <div style={{ position: 'relative', width: '280px', height: '280px', margin: '0 auto' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--gradient-rum)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                  boxShadow: 'var(--shadow-rum)',
                  zIndex: 2
                }}
              >
                Full Moon Float
              </div>

              {[
                { label: '5 min', angle: 0, color: 'var(--sea)' },
                { label: '$185', angle: 90, color: 'var(--gold)' },
                { label: 'Water Life', angle: 180, color: 'var(--purple)' },
                { label: '3 stops', angle: 270, color: 'var(--rum)' },
              ].map((node, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `rotate(${node.angle}deg) translateX(110px) rotate(-${node.angle}deg) translate(-50%, -50%)`,
                    padding: '10px 16px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(15px)',
                    border: `1px solid ${node.color}66`,
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: node.color,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {node.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 5 && (
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease', width: '100%', maxWidth: '340px' }}>
            <p style={{ fontSize: '16px', color: 'var(--sand-dim)', marginBottom: '20px' }}>
              Ready when you are.
            </p>

            <button className="btn-primary" style={{ marginBottom: '12px' }}>
              Book dis
            </button>

            <button className="btn-secondary" onClick={() => { setPhase(4); setTimeout(() => setPhase(5), 1500); }}>
              <Icon name="shuffle" size={16} />
              Shock mi
            </button>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
              {['Closer', 'Cheaper', 'Different'].map(pill => (
                <button
                  key={pill}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '999px',
                    fontSize: '11px',
                    color: 'var(--sand-dim)',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {pill}
                </button>
              ))}
            </div>

            <p style={{ fontSize: '11px', color: 'var(--sand-dim)', marginTop: '30px', cursor: 'pointer' }}>
              Build It Yourself
            </p>
          </div>
        )}
      </div>

      <Dock />
    </main>
  )
}