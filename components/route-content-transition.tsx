'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface RouteContentTransitionProps {
  children: React.ReactNode
}

export function RouteContentTransition({ children }: RouteContentTransitionProps) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className={cn('route-content-transition route-content-transition-animate')}
    >
      {children}
    </div>
  )
}
