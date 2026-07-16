'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CheckIcon, LanguagesIcon } from 'lucide-react'
import { localeLabels, localeOrder, useTranslation } from '@/lib/i18n/i18n-context'
import { cn } from '@/lib/utils'

// Language picker, styled to match the theme dropdown in the dashboard header.
// Used both in the header and on the login screen.
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={localeLabels[locale]}
          className={cn(
            'h-8 justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]',
            className,
          )}
        >
          <LanguagesIcon className="h-3.5 w-3.5" />
          {localeLabels[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {localeOrder.map((code) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLocale(code)}
            data-selected={locale === code ? 'true' : 'false'}
            className="flex items-center justify-between gap-3"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
              {localeLabels[code]}
            </span>
            {locale === code && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
