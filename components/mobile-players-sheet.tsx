'use client'

import { useServer } from '@/lib/server-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { UsersIcon, RefreshCwIcon, UserIcon } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface MobilePlayersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobilePlayersSheet({ open, onOpenChange }: MobilePlayersSheetProps) {
  const { players, apiCall, setPlayers, isLoading } = useServer()

  const fetchPlayers = async () => {
    try {
      const data = await apiCall<{ players: typeof players }>('players')
      if (data?.players) {
        setPlayers(data.players)
      }
    } catch {
      // Error logged in apiCall
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <UsersIcon className="w-5 h-5 text-primary" />
              Online Players ({players.length})
            </SheetTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={fetchPlayers}
              disabled={isLoading['players']}
              className="h-8 w-8"
            >
              {isLoading['players'] ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <RefreshCwIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(70vh-80px)] mt-4">
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <UsersIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No players online</p>
            </div>
          ) : (
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.oddsId || player.oddsId || player.name}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{player.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Level {player.level || 'N/A'}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
