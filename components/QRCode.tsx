// components/QRCode.tsx — a scannable QR (booking tickets, reward and deal
// vouchers), drawn as SVG on a white tile so it scans in dark mode too.
'use client'

import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

export default function QRCode({ value, size = 200, label }: { value: string; size?: number; label?: string }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    const dark: Array<[number, number]> = []
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push([r, c])
    return { n, dark }
  }, [value])

  return (
    <div style={{ width: size, height: size, padding: 12, background: '#FFFFFF', borderRadius: 14, boxShadow: 'var(--shadow-card)', margin: '0 auto' }}>
      <svg viewBox={`0 0 ${cells.n} ${cells.n}`} width="100%" height="100%" role="img" aria-label={label ?? `QR code for ${value}`} shapeRendering="crispEdges">
        {cells.dark.map(([r, c]) => <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#0F0E0C" />)}
      </svg>
    </div>
  )
}
