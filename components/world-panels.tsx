'use client'

import { useMemo, useState } from 'react'
import { Building2Icon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon, UsersIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WorldDataStatus } from '@/components/world-data-status'
import { useServer } from '@/lib/server-context'
import type { WorldGuild, WorldPlayer } from '@/lib/types'
import { useWorld } from '@/lib/use-world'
import { formatRelativeTime, formatWorldDateTime } from '@/lib/world-time'

function canonicalUid(value: string) {
  return value.trim().toUpperCase()
}

function useOnlineUids() {
  const { players: onlinePlayers } = useServer()
  return useMemo(
    () => new Set(onlinePlayers.map((player) => canonicalUid(player.playerId)).filter(Boolean)),
    [onlinePlayers],
  )
}

// "Last seen" cell: online players show a live green state instead of a stale
// relative time (the guild timestamp only advances on save events, so an online
// player would read "6m ago"). One column, one truth.
function LastSeenCell({ online, lastSeen }: { online: boolean; lastSeen: string | null }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-green-500">
        <span className="status-dot h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
        Online
      </span>
    )
  }
  return <span title={formatWorldDateTime(lastSeen)}>{formatRelativeTime(lastSeen)}</span>
}

// Shared clickable sort header (roster + guild tables).
function SortHeaderButton({ label, active, dir, align = 'left', onClick }: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  align?: 'left' | 'right'
  onClick: () => void
}) {
  const Icon = active ? (dir === 'asc' ? ChevronUpIcon : ChevronDownIcon) : ChevronsUpDownIcon
  return (
    <th className={`px-4 py-3 font-medium ${align === 'right' ? 'text-right' : ''}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex select-none items-center gap-1 uppercase tracking-[0.18em] transition-colors hover:text-foreground ${active ? 'text-foreground' : ''} ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </button>
    </th>
  )
}

type RosterSortKey = 'nickname' | 'level' | 'pal_count' | 'last_seen'
const ROSTER_DEFAULT_DIR: Record<RosterSortKey, 'asc' | 'desc'> = {
  nickname: 'asc',
  level: 'desc',
  pal_count: 'desc',
  last_seen: 'desc',
}

function WorldRosterPanel({ players }: { players: WorldPlayer[] }) {
  const onlineUids = useOnlineUids()
  const [sort, setSort] = useState<{ key: RosterSortKey; dir: 'asc' | 'desc' }>({ key: 'level', dir: 'desc' })

  const toggleSort = (key: RosterSortKey) =>
    setSort((cur) => (cur.key === key
      ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: ROSTER_DEFAULT_DIR[key] }))

  const sortedPlayers = useMemo(() => {
    // last_seen sort value: online = most recent (now); missing timestamp = oldest.
    const lastSeenValue = (p: WorldPlayer) => {
      if (onlineUids.has(canonicalUid(p.uid))) return Number.POSITIVE_INFINITY
      if (!p.last_seen) return Number.NEGATIVE_INFINITY
      const t = Date.parse(p.last_seen)
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY
    }
    const byName = (a: WorldPlayer, b: WorldPlayer) =>
      a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' })
    const cmp = (a: WorldPlayer, b: WorldPlayer) => {
      switch (sort.key) {
        case 'nickname': return byName(a, b)
        case 'level': return a.level - b.level || byName(a, b)
        case 'pal_count': return a.pal_count - b.pal_count || byName(a, b)
        case 'last_seen': return lastSeenValue(a) - lastSeenValue(b) || byName(a, b)
      }
    }
    const sorted = [...players].sort(cmp)
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [players, sort, onlineUids])

  const SortHeader = ({ label, sortKey, align = 'left' }: { label: string; sortKey: RosterSortKey; align?: 'left' | 'right' }) => (
    <SortHeaderButton label={label} active={sort.key === sortKey} dir={sort.dir} align={align} onClick={() => toggleSort(sortKey)} />
  )

  return (
    <div className="max-h-[36rem] overflow-auto rounded-lg border border-border/50">
      <table className="w-full min-w-[660px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-card/95 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
          <tr>
            <SortHeader label="Nickname" sortKey="nickname" />
            <SortHeader label="Level" sortKey="level" align="right" />
            <SortHeader label="Pals" sortKey="pal_count" align="right" />
            <SortHeader label="Last seen" sortKey="last_seen" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sortedPlayers.map((player) => {
            const online = onlineUids.has(canonicalUid(player.uid))
            return (
              <tr key={player.uid} className="transition-colors hover:bg-muted/25">
                <td className="max-w-72 truncate px-4 py-3 font-medium text-foreground">{player.nickname || 'Unnamed player'}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{player.level}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{player.pal_count}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  <LastSeenCell online={online} lastSeen={player.last_seen} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type GuildSortKey = 'name' | 'base_level' | 'base_count' | 'members'
const GUILD_DEFAULT_DIR: Record<GuildSortKey, 'asc' | 'desc'> = {
  name: 'asc',
  base_level: 'desc',
  base_count: 'desc',
  members: 'desc',
}

function WorldGuildPanel({ guilds }: { guilds: WorldGuild[] }) {
  const onlineUids = useOnlineUids()
  const [sort, setSort] = useState<{ key: GuildSortKey; dir: 'asc' | 'desc' }>({ key: 'base_level', dir: 'desc' })

  const toggleSort = (key: GuildSortKey) =>
    setSort((cur) => (cur.key === key
      ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: GUILD_DEFAULT_DIR[key] }))

  const sortedGuilds = useMemo(() => {
    const byName = (a: WorldGuild, b: WorldGuild) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    const cmp = (a: WorldGuild, b: WorldGuild) => {
      switch (sort.key) {
        case 'name': return byName(a, b)
        case 'base_level': return a.base_level - b.base_level || byName(a, b)
        case 'base_count': return a.base_count - b.base_count || byName(a, b)
        case 'members': return a.members.length - b.members.length || byName(a, b)
      }
    }
    const sorted = [...guilds].sort(cmp)
    return sort.dir === 'desc' ? sorted.reverse() : sorted
  }, [guilds, sort])

  const SortHeader = ({ label, sortKey, align = 'left' }: { label: string; sortKey: GuildSortKey; align?: 'left' | 'right' }) => (
    <SortHeaderButton label={label} active={sort.key === sortKey} dir={sort.dir} align={align} onClick={() => toggleSort(sortKey)} />
  )

  return (
    <div className="max-h-[36rem] overflow-auto rounded-lg border border-border/50">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 bg-card/95 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
          <tr>
            <SortHeader label="Guild" sortKey="name" />
            <SortHeader label="Base level" sortKey="base_level" align="right" />
            <SortHeader label="Bases" sortKey="base_count" align="right" />
            <SortHeader label="Members" sortKey="members" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sortedGuilds.map((guild) => (
            <tr key={guild.id} className="align-top transition-colors hover:bg-muted/25">
              <td className="max-w-64 px-4 py-3 font-medium text-foreground">
                <div className="truncate">{guild.name || 'Unnamed Guild'}</div>
                <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground" title={guild.id}>{guild.id}</div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{guild.base_level}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{guild.base_count}</td>
              <td className="px-4 py-3">
                {guild.members.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No members</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {guild.members.map((member) => {
                      const online = onlineUids.has(canonicalUid(member.uid))
                      return (
                        <span
                          key={member.uid}
                          className="rounded-md border border-border/50 bg-muted/20 px-2 py-1 text-xs text-foreground"
                          title={online ? `${member.nickname || 'Unnamed player'} · online now` : `${member.nickname || 'Unnamed player'} · last seen ${formatWorldDateTime(member.last_seen)}`}
                        >
                          {member.nickname || 'Unnamed player'}
                          {online ? (
                            <span className="ml-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-green-500">
                              <span className="status-dot h-1 w-1 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
                              Online
                            </span>
                          ) : (
                            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{formatRelativeTime(member.last_seen)}</span>
                          )}
                        </span>
                      )
                    })}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function WorldPanels() {
  const { world, available, permissionDenied } = useWorld()

  if (permissionDenied) return null

  return (
    <Card className="gap-4 border-border/60 bg-card/55 py-5 backdrop-blur-sm">
      <CardHeader className="gap-3 px-5 sm:px-6">
        <div>
          <CardTitle className="font-mono text-base uppercase tracking-[0.16em]">World intelligence</CardTitle>
          <CardDescription className="mt-1">Save-derived roster, guild, and base records.</CardDescription>
        </div>
        <WorldDataStatus />
      </CardHeader>
      <CardContent className="px-5 sm:px-6">
        {!available || !world ? (
          <div className="rounded-lg border border-dashed border-border/60 px-4 py-12 text-center font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            No world data yet
          </div>
        ) : (
          <Tabs defaultValue="roster" className="gap-4">
            <TabsList className="h-10 rounded-md border border-border/60 bg-muted/20">
              <TabsTrigger value="roster" className="gap-2 px-4 font-mono text-[11px] uppercase tracking-[0.16em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <UsersIcon className="h-3.5 w-3.5" /> Roster {world.players.length}
              </TabsTrigger>
              <TabsTrigger value="guilds" className="gap-2 px-4 font-mono text-[11px] uppercase tracking-[0.16em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Building2Icon className="h-3.5 w-3.5" /> Guilds {world.guilds.length}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="roster"><WorldRosterPanel players={world.players} /></TabsContent>
            <TabsContent value="guilds"><WorldGuildPanel guilds={world.guilds} /></TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
