'use client'

export default function SceneBackground() {
  const stars = Array.from({ length: 35 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 30}%`,
    delay: `${Math.random() * 3}s`
  }))

  return (
    <div className="scene-bg">
      <div className="scene-sky" />
      <div className="scene-stars">
        {stars.map(star => (
          <div
            key={star.id}
            className="star"
            style={{ left: star.left, top: star.top, animationDelay: star.delay }}
          />
        ))}
      </div>
      <div className="scene-moon" />
      <div className="scene-palm left-palm">
        <svg width="200" height="300" viewBox="0 0 200 300">
          <path d="M180 290 C180 200 175 100 150 30" stroke="#0A1628" strokeWidth="12" fill="none" />
          <path d="M150 30 C140 10 120 -10 90 -20 C110 -5 130 10 145 30 Z" fill="#0A1628" />
          <path d="M150 30 C160 15 175 5 195 0 C175 10 160 20 150 35 Z" fill="#0A1628" />
          <path d="M150 30 C145 20 135 10 120 5 C135 15 145 22 150 35 Z" fill="#0A1628" />
          <path d="M150 30 C155 15 165 5 180 0 C160 10 152 22 150 35 Z" fill="#0A1628" />
          <path d="M150 30 C140 20 130 12 115 8 C128 16 140 24 150 38 Z" fill="#0A1628" />
          <path d="M150 30 C150 15 150 0 148 -15 C152 5 153 15 153 30 Z" fill="#0A1628" />
          <path d="M150 30 C160 10 170 -5 185 -15 C168 0 158 15 153 30 Z" fill="#0A1628" />
        </svg>
      </div>
      <div className="scene-palm right-palm">
        <svg width="200" height="300" viewBox="0 0 200 300">
          <path d="M20 290 C20 200 25 100 50 30" stroke="#0A1628" strokeWidth="12" fill="none" />
          <path d="M50 30 C60 10 80 -10 110 -20 C90 -5 70 10 55 30 Z" fill="#0A1628" />
          <path d="M50 30 C40 15 25 5 5 0 C25 10 40 20 50 35 Z" fill="#0A1628" />
          <path d="M50 30 C55 20 65 10 80 5 C65 15 55 22 50 35 Z" fill="#0A1628" />
          <path d="M50 30 C45 15 35 5 20 0 C40 10 48 22 50 35 Z" fill="#0A1628" />
          <path d="M50 30 C60 20 70 12 85 8 C72 16 60 24 50 38 Z" fill="#0A1628" />
          <path d="M50 30 C50 15 50 0 52 -15 C48 5 47 15 47 30 Z" fill="#0A1628" />
          <path d="M50 30 C40 10 30 -5 15 -15 C32 0 42 15 47 30 Z" fill="#0A1628" />
        </svg>
      </div>
      <div className="scene-ocean">
        <div className="wave-layer wave-back">
          <svg viewBox="0 0 1440 300" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <path d="M0 100 C 120 60, 240 140, 360 100 C 480 60, 600 140, 720 100 C 840 60, 960 140, 1080 100 C 1200 60, 1320 140, 1440 100 L 1440 300 L 0 300 Z" fill="#0D1F35" />
          </svg>
        </div>
        <div className="wave-layer wave-mid">
          <svg viewBox="0 0 1440 300" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <path d="M0 130 C 120 90, 240 170, 360 130 C 480 90, 600 170, 720 130 C 840 90, 960 170, 1080 130 C 1200 90, 1320 170, 1440 130 L 1440 300 L 0 300 Z" fill="#1A2A3A" />
          </svg>
        </div>
        <div className="wave-layer wave-front">
          <svg viewBox="0 0 1440 300" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <path d="M0 160 C 120 120, 240 200, 360 160 C 480 120, 600 200, 720 160 C 840 120, 960 200, 1080 160 C 1200 120, 1320 200, 1440 160 L 1440 300 L 0 300 Z" fill="#0A1628" />
          </svg>
        </div>
      </div>
      <div className="scene-vignette" />
    </div>
  )
}