'use client'

import { Dashboard } from '@/components/dashboard'
import { RequireServerConfig } from '@/components/require-server-config'

export default function Home() {
  return (
    <RequireServerConfig>
      <Dashboard />
    </RequireServerConfig>
  )
}
