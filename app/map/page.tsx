'use client'

import { LiveMapPage } from '@/components/live-map-page'
import { RequireServerConfig } from '@/components/require-server-config'

export default function MapPage() {
  return (
    <RequireServerConfig>
      <LiveMapPage />
    </RequireServerConfig>
  )
}
