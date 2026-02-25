'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Gamepad2,
  Plus,
  AlertCircle,
  RefreshCw,
  Flag,
} from 'lucide-react'
import { Game } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { isGameSeasonEnded } from '@/lib/game-utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge, SportBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterPills } from '@/components/ui/FilterPills'
import { SortableHeader, type SortDirection } from '@/components/ui/SortableHeader'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, exportJson } from '@/lib/csv-export'

type SportFilter = 'all' | 'FOOTBALL' | 'HOCKEY' | 'F1'
type StatusFilter = 'all' | 'active' | 'inactive' | 'ended'

function getGameStatus(game: Game): 'active' | 'inactive' | 'ended' {
  if (isGameSeasonEnded(game)) return 'ended'
  return game.is_active ? 'active' : 'inactive'
}

const gameCsvColumns = [
  { header: 'Name', accessor: (row: Game) => row.name },
  { header: 'Game Key', accessor: (row: Game) => row.game_key },
  { header: 'Sport', accessor: (row: Game) => row.sport_type },
  { header: 'Current Round', accessor: (row: Game) => row.current_round },
  { header: 'Total Rounds', accessor: (row: Game) => row.total_rounds || '' },
  { header: 'Users', accessor: (row: Game) => row.users_total || 0 },
  { header: 'Sync Interval (min)', accessor: (row: Game) => row.sync_interval_minutes },
  { header: 'Last Synced', accessor: (row: Game) => row.last_synced_at || '' },
  { header: 'Active', accessor: (row: Game) => row.is_active },
]

export default function GamesPage() {
  const { isAdmin } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter & sort state
  const [search, setSearch] = useState('')
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/admin/games')
      const data = await res.json()
      if (data.success) {
        setGames(data.data || [])
        setError(null)
      } else {
        setError(data.error || `Request failed with status ${res.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch games:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch games')
    } finally {
      setLoading(false)
    }
  }

  // Compute sport counts for filter pills
  const sportCounts = useMemo(() => {
    const counts = { all: games.length, FOOTBALL: 0, HOCKEY: 0, F1: 0 }
    games.forEach((g) => {
      if (g.sport_type in counts) {
        counts[g.sport_type as keyof typeof counts]++
      }
    })
    return counts
  }, [games])

  // Compute status counts for filter pills
  const statusCounts = useMemo(() => {
    const counts = { all: games.length, active: 0, inactive: 0, ended: 0 }
    games.forEach((g) => {
      counts[getGameStatus(g)]++
    })
    return counts
  }, [games])

  // Filtered and sorted games
  const filteredGames = useMemo(() => {
    let result = [...games]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.game_key.toLowerCase().includes(q)
      )
    }

    // Sport filter
    if (sportFilter !== 'all') {
      result = result.filter((g) => g.sport_type === sportFilter)
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((g) => getGameStatus(g) === statusFilter)
    }

    // Sort
    if (sortKey && sortDirection) {
      result.sort((a, b) => {
        let aVal: string | number | boolean | null
        let bVal: string | number | boolean | null

        switch (sortKey) {
          case 'name':
            aVal = a.name.toLowerCase()
            bVal = b.name.toLowerCase()
            break
          case 'sport':
            aVal = a.sport_type
            bVal = b.sport_type
            break
          case 'round':
            aVal = a.current_round
            bVal = b.current_round
            break
          case 'users':
            aVal = a.users_total || 0
            bVal = b.users_total || 0
            break
          case 'sync_interval':
            aVal = a.sync_interval_minutes
            bVal = b.sync_interval_minutes
            break
          case 'last_synced':
            aVal = a.last_synced_at || ''
            bVal = b.last_synced_at || ''
            break
          case 'status':
            // Sort order: active first, then inactive, then ended
            const statusOrder = { active: 0, inactive: 1, ended: 2 }
            aVal = statusOrder[getGameStatus(a)]
            bVal = statusOrder[getGameStatus(b)]
            break
          default:
            return 0
        }

        if (aVal === null || aVal === undefined) aVal = ''
        if (bVal === null || bVal === undefined) bVal = ''

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return result
  }, [games, search, sportFilter, statusFilter, sortKey, sortDirection])

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Cycle: asc → desc → none
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const hasActiveFilters = search || sportFilter !== 'all' || statusFilter !== 'all'

  if (loading) {
    return <LoadingScreen message="Loading games..." />
  }

  return (
    <div>
      <PageHeader
        title="Games"
        description="Manage your SWUSH fantasy game integrations"
        actions={
          <div className="flex items-center gap-2">
            {games.length > 0 && (
              <ExportButton
                onExportCsv={() => exportCsv(filteredGames, gameCsvColumns, 'games')}
                onExportJson={() => exportJson(filteredGames, 'games')}
              />
            )}
            {isAdmin && (
              <Link href="/dashboard/games/new">
                <Button icon={Plus} size="sm">Add Game</Button>
              </Link>
            )}
          </div>
        }
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-punch/10 border border-punch/20 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-punch flex-shrink-0" />
          <div>
            <p className="text-punch font-medium">Failed to load games</p>
            <p className="text-punch/70 text-sm">{error}</p>
          </div>
          <button
            onClick={fetchGames}
            className="ml-auto px-3 py-1.5 text-sm bg-punch/20 hover:bg-punch/30 text-punch rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
            Retry
          </button>
        </motion.div>
      )}

      {!error && games.length === 0 && (
        <Card>
          <div className="p-8">
            <EmptyState
              icon={Gamepad2}
              title="No games yet"
              description="Get started by adding your first game"
              action={
                isAdmin ? (
                  <Link href="/dashboard/games/new">
                    <Button icon={Plus}>Add Game</Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        </Card>
      )}

      {games.length > 0 && (
        <>
          {/* Filter Bar */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-4">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name or game key..."
                className="w-72"
              />
              <div className="h-6 w-px bg-ink-600/30" />
              <FilterPills
                options={[
                  { value: 'all' as SportFilter, label: 'All Sports', count: sportCounts.all },
                  { value: 'FOOTBALL' as SportFilter, label: 'Football', count: sportCounts.FOOTBALL },
                  { value: 'HOCKEY' as SportFilter, label: 'Hockey', count: sportCounts.HOCKEY },
                  { value: 'F1' as SportFilter, label: 'F1', count: sportCounts.F1 },
                ]}
                value={sportFilter}
                onChange={setSportFilter}
              />
            </div>
            <div className="flex items-center gap-3">
              <FilterPills
                options={[
                  { value: 'all' as StatusFilter, label: 'All Status', count: statusCounts.all },
                  { value: 'active' as StatusFilter, label: 'Active', count: statusCounts.active },
                  { value: 'inactive' as StatusFilter, label: 'Inactive', count: statusCounts.inactive },
                  { value: 'ended' as StatusFilter, label: 'Season Ended', count: statusCounts.ended },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearch('')
                    setSportFilter('all')
                    setStatusFilter('all')
                  }}
                  className="text-xs text-ink-500 hover:text-ink-300 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Results Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ink-600/30 bg-ink-800/80">
                    <SortableHeader
                      label="Game"
                      sortKey="name"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Sport"
                      sortKey="sport"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Round"
                      sortKey="round"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Users"
                      sortKey="users"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Sync Interval"
                      sortKey="sync_interval"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Last Synced"
                      sortKey="last_synced"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Status"
                      sortKey="status"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <th className="px-6 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/20">
                  {filteredGames.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-ink-500">
                        <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No games match your filters</p>
                        <button
                          onClick={() => {
                            setSearch('')
                            setSportFilter('all')
                            setStatusFilter('all')
                          }}
                          className="text-sm text-electric-400 hover:text-electric-300 mt-1 transition-colors"
                        >
                          Clear all filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredGames.map((game, index) => (
                      <motion.tr
                        key={game.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        className="group hover:bg-ink-700/20 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-ink-50">{game.name}</div>
                          <div className="text-sm text-ink-500 font-mono">{game.game_key}</div>
                        </td>
                        <td className="px-6 py-4">
                          <SportBadge sport={game.sport_type} />
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-200">
                          {game.current_round}/{game.total_rounds || '?'}
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-200">
                          {(game.users_total || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-400">
                          {game.sync_interval_minutes} min
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-400">
                          {formatDate(game.last_synced_at)}
                        </td>
                        <td className="px-6 py-4">
                          {isGameSeasonEnded(game) ? (
                            <Badge color="solar" icon={Flag}>Season Ended</Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <StatusDot active={game.is_active} />
                              <span className={`text-sm ${game.is_active ? 'text-mint' : 'text-ink-500'}`}>
                                {game.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/dashboard/games/${game.id}`}
                            className="text-electric-400 hover:text-electric-300 text-sm font-medium transition-colors"
                          >
                            View &rarr;
                          </Link>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Results count */}
            {hasActiveFilters && filteredGames.length > 0 && (
              <div className="px-6 py-2.5 border-t border-ink-600/20 bg-ink-800/40">
                <p className="text-xs text-ink-500">
                  Showing {filteredGames.length} of {games.length} games
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
