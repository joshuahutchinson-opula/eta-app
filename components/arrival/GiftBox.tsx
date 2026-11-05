// components/arrival/GiftBox.tsx — the welcome gift on the arrival screen:
// a gold box with a red ribbon that floats, a shine sweeping across it, a
// soft pulsing glow behind and twinkling sparkles around. All motion lives
// in globals.css (.gift-*) and stops under prefers-reduced-motion.
'use client'

const SPARKLES = [
  { top: '6%', left: '14%', size: 14, delay: '0s' },
  { top: '18%', left: '86%', size: 10, delay: '0.6s' },
  { top: '64%', left: '6%', size: 9, delay: '1.2s' },
  { top: '78%', left: '88%', size: 13, delay: '0.3s' },
  { top: '0%', left: '58%', size: 8, delay: '1.6s' },
  { top: '44%', left: '96%', size: 7, delay: '0.9s' }
]

export default function GiftBox({ size = 180 }: { size?: number }) {
  return (
    <div className="gift-stage" style={{ width: size * 1.5, height: size * 1.35 }} aria-hidden>
      <div className="gift-glow" />
      {SPARKLES.map((s, i) => (
        <svg key={i} className="gift-sparkle" style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay }} viewBox="0 0 24 24">
          <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="#FFE7A3" />
        </svg>
      ))}
      <div className="gift-float" style={{ width: size, height: size }}>
        <svg viewBox="0 0 200 200" width={size} height={size}>
          <defs>
            <linearGradient id="giftGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFE08A" />
              <stop offset="0.5" stopColor="#F4B526" />
              <stop offset="1" stopColor="#B87A0B" />
            </linearGradient>
            <linearGradient id="giftLid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFEBA8" />
              <stop offset="1" stopColor="#D69A17" />
            </linearGradient>
            <linearGradient id="giftRibbon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E0301A" />
              <stop offset="1" stopColor="#8E1608" />
            </linearGradient>
            <clipPath id="giftClip"><rect x="30" y="70" width="140" height="115" rx="10" /><rect x="22" y="52" width="156" height="30" rx="8" /></clipPath>
          </defs>
          {/* Bow */}
          <path d="M100 54 C 70 20, 38 30, 52 50 C 60 60, 84 58, 100 54 Z" fill="url(#giftRibbon)" />
          <path d="M100 54 C 130 20, 162 30, 148 50 C 140 60, 116 58, 100 54 Z" fill="url(#giftRibbon)" />
          {/* Box and lid */}
          <rect x="30" y="70" width="140" height="115" rx="10" fill="url(#giftGold)" />
          <rect x="22" y="52" width="156" height="30" rx="8" fill="url(#giftLid)" />
          {/* Ribbon */}
          <rect x="88" y="52" width="24" height="133" fill="url(#giftRibbon)" />
          <rect x="22" y="60" width="156" height="12" fill="url(#giftRibbon)" opacity="0.9" />
          <circle cx="100" cy="54" r="10" fill="#B51E0C" />
          {/* Shine */}
          <g clipPath="url(#giftClip)">
            <rect className="gift-shine" x="-60" y="40" width="40" height="160" fill="rgba(255,255,255,0.55)" transform="skewX(-20)" />
          </g>
        </svg>
      </div>
    </div>
  )
}
