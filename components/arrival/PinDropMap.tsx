// components/arrival/PinDropMap.tsx — "Not listed? Drop a pin": tap the map
// to place your stay (components/map/EtaMap).
'use client'

import EtaMap from '@/components/map/EtaMap'
import { useLang } from '@/lib/i18n-client'

export default function PinDropMap({ center, pin, onPick }: { center: [number, number]; pin: { lat: number; lng: number } | null; onPick: (p: { lat: number; lng: number }) => void }) {
  const { t } = useLang()
  return (
    <EtaMap
      center={{ lat: center[0], lng: center[1] }}
      zoom={13}
      fitTo={[{ lat: center[0], lng: center[1] }]}
      markers={pin ? [{ id: 'pin', lat: pin.lat, lng: pin.lng, size: 22, label: t('m.arrival.pinName'), labelAlways: true }] : []}
      onMapClick={onPick}
      label={t('m.arrival.pinHelp')}
    />
  )
}
