'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Heart,
  Shield,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronUp,
  ChevronDown,
  Minus,
} from 'lucide-react'
import { Element } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterPills } from '@/components/ui/FilterPills'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, exportJson } from '@/lib/csv-export'

type SortField = 'trend' | 'growth' | 'total_growth' | 'value' | 'popularity' | 'full_name'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'injured' | 'suspended' | 'active'

interface GameInfo {
  id: string
  name: string
  game_key: string
}

interface ElementStats {
  total: number
  injured: number
  suspended: number
  active: number
}

interface ElementsResponse {
  elements: Element[]
  game: GameInfo
  teams: string[]
  stats: ElementStats
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

const PAGE_SIZE = 50

export default function ElementsBrowserPage() {
  const params = useParams()

  const [data, setData] = useState<ElementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('trend')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [teamFilter, setTeamFilter] = useState('')
  const [offset, setOffset] = useState(0)

  const fetchElements = useCallback(async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        sort_by: sortBy,
        sort_order: sortOrder,
        status: statusFilter,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (search) queryParams.set('search', search)
      if (teamFilter) queryParams.set('team', teamFilter)

      const res = await fetch(`/api/admin/games/${params.id}/elements?${queryParams}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      }
    } catch (error) {
      console.error('Failed to fetch elements:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id, search, sortBy, sortOrder, statusFilter, teamFilter, offset])

  useEffect(() => {
    if (params.id) {
      fetchElements()
    }
  }, [params.id, fetchElements])

  // Debounced search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'full_name' ? 'asc' : 'desc')
    }
    setOffset(0)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ChevronDown className="w-3 h-3 text-ink-600" />
    return sortOrder === 'desc'
      ? <ChevronDown className="w-3 h-3 text-electric" />
      : <ChevronUp className="w-3 h-3 text-electric" />
  }

  if (!data && loading) {
    return <LoadingScreen />
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-ink-400">
        <p>Failed to load elements.</p>
        <Link href={`/dashboard/games/${params.id}`}>
          <Button variant="ghost" size="sm" className="mt-4">Back to Game</Button>
        </Link>
      </div>
    )
  }

  const { elements, game, teams, stats, pagination } = data

  const elementCsvColumns = [
    { header: 'Name', accessor: (el: Element) => el.full_name },
    { header: 'Short Name', accessor: (el: Element) => el.short_name },
    { header: 'Team', accessor: (el: Element) => el.team_name || '' },
    { header: 'Trend', accessor: (el: Element) => el.trend },
    { header: 'Value', accessor: (el: Element) => el.value },
    { header: 'Growth', accessor: (el: Element) => el.growth },
    { header: 'Total Growth', accessor: (el: Element) => el.total_growth },
    { header: 'Popularity', accessor: (el: Element) => Number(el.popularity) },
    { header: 'Injured', accessor: (el: Element) => el.is_injured },
    { header: 'Suspended', accessor: (el: Element) => el.is_suspended },
  ]

  const statusOptions: { value: StatusFilter; label: string; count?: number }[] = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'active', label: 'Active', count: stats.active },
    { value: 'injured', label: 'Injured', count: stats.injured },
    { value: 'suspended', label: 'Suspended', count: stats.suspended },
  ]

  return (
    <div>
      <PageHeader
        title={`${game.name} — Players`}
        description={`Browse and search all ${stats.total.toLocaleString()} players in this game`}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              onExportCsv={() => exportCsv(elements, elementCsvColumns, `${game.game_key}-players`)}
              onExportJson={() => exportJson(elements, `${game.game_key}-players`)}
            />
            <Link href={`/dashboard/games/${params.id}`}>
              <Button variant="ghost" size="sm" icon={ArrowLeft}>
                Back to Game
              </Button>
            </Link>
          </div>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Players', value: stats.total, icon: Layers, color: 'text-ocean', bg: 'bg-ocean/15' },
          { label: 'Active', value: stats.active, icon: TrendingUp, color: 'text-mint', bg: 'bg-mint/15' },
          { label: 'Injured', value: stats.injured, icon: Heart, color: 'text-punch', bg: 'bg-punch/15' },
          { label: 'Suspended', value: stats.suspended, icon: Shield, color: 'text-solar', bg: 'bg-solar/15' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-ink-400">{stat.label}</p>
                  <p className="text-lg font-heading font-bold text-ink-50">{stat.value.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search players by name or team..."
            className="flex-1"
          />
          <div className="flex items-center gap-3">
            {/* Team filter dropdown */}
            {teams.length > 0 && (
              <select
                value={teamFilter}
                onChange={(e) => { setTeamFilter(e.target.value); setOffset(0) }}
                className="
                  bg-ink-700/50 text-ink-50 text-sm border border-ink-600/50 rounded-xl
                  px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-electric/50
                  appearance-none cursor-pointer min-w-[160px]
                "
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="mt-3">
          <FilterPills
            options={statusOptions}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setOffset(0) }}
          />
        </div>
      </Card>

      {/* Elements Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-800/80 border-b border-ink-600/30">
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('full_name')}
                    className="flex items-center gap-1 text-xs font-medium text-ink-400 uppercase tracking-wider hover:text-ink-200 transition-colors"
                  >
                    Player <SortIcon field="full_name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('trend')}
                    className="flex items-center gap-1 mx-auto text-xs font-medium text-ink-400 uppercase tracking-wider hover:text-ink-200 transition-colors"
                  >
                    Trend <SortIcon field="trend" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('value')}
                    className="flex items-center gap-1 mx-auto text-xs font-medium text-ink-400 uppercase tracking-wider hover:text-ink-200 transition-colors"
                  >
                    Value <SortIcon field="value" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('growth')}
                    className="flex items-center gap-1 mx-auto text-xs font-medium text-ink-400 uppercase tracking-wider hover:text-ink-200 transition-colors"
                  >
                    Growth <SortIcon field="growth" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('popularity')}
                    className="flex items-center gap-1 mx-auto text-xs font-medium text-ink-400 uppercase tracking-wider hover:text-ink-200 transition-colors"
                  >
                    Popularity <SortIcon field="popularity" />
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-ink-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-600/20">
              <AnimatePresence mode="popLayout">
                {elements.map((el, i) => (
                  <motion.tr
                    key={el.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.01, duration: 0.15 }}
                    className="hover:bg-ink-700/20 transition-colors"
                  >
                    {/* Player Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {el.image_url ? (
                          <Image
                            src={el.image_url}
                            alt={el.short_name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full bg-ink-700 object-cover ring-1 ring-ink-600/30"
                            unoptimized
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-ink-700/50 flex items-center justify-center text-xs font-medium text-ink-400 ring-1 ring-ink-600/30">
                            {el.short_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-ink-100">{el.full_name}</p>
                          <p className="text-xs text-ink-500">{el.short_name}</p>
                        </div>
                      </div>
                    </td>

                    {/* Team */}
                    <td className="px-4 py-3 text-ink-300">
                      {el.team_name || '—'}
                    </td>

                    {/* Trend */}
                    <td className="px-4 py-3">
                      <TrendCell value={el.trend} />
                    </td>

                    {/* Value */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-ink-200">{el.value.toLocaleString()}</span>
                    </td>

                    {/* Growth */}
                    <td className="px-4 py-3">
                      <GrowthCell value={el.growth} />
                    </td>

                    {/* Popularity */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-ink-300">{Number(el.popularity).toFixed(1)}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {el.is_injured && (
                          <Badge color="punch" icon={Heart}>Injured</Badge>
                        )}
                        {el.is_suspended && (
                          <Badge color="solar" icon={Shield}>Suspended</Badge>
                        )}
                        {!el.is_injured && !el.is_suspended && (
                          <span className="text-ink-600">—</span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {elements.length === 0 && !loading && (
          <div className="text-center py-16 text-ink-500">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No players found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        )}

        {/* Loading overlay */}
        {loading && elements.length > 0 && (
          <div className="absolute inset-0 bg-ink-900/30 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-ink-600 border-t-ocean" />
          </div>
        )}

        {/* Pagination */}
        {pagination.total > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-ink-600/20 flex items-center justify-between">
            <p className="text-sm text-ink-500">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, pagination.total)} of {pagination.total.toLocaleString()} players
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!pagination.has_more}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

/** Trend value display with color and icon */
function TrendCell({ value }: { value: number }) {
  const isPositive = value > 0
  const isNegative = value < 0
  const isNeutral = value === 0

  return (
    <div className="flex items-center justify-center gap-1">
      {isPositive && <ArrowUp className="w-3.5 h-3.5 text-mint" />}
      {isNegative && <ArrowDown className="w-3.5 h-3.5 text-punch" />}
      {isNeutral && <Minus className="w-3.5 h-3.5 text-ink-500" />}
      <span
        className={`font-mono font-medium ${
          isPositive ? 'text-mint' : isNegative ? 'text-punch' : 'text-ink-500'
        }`}
      >
        {isPositive ? '+' : ''}{value}
      </span>
    </div>
  )
}

/** Growth value display */
function GrowthCell({ value }: { value: number }) {
  const isPositive = value > 0
  const isNegative = value < 0

  return (
    <div className="flex items-center justify-center gap-1">
      {isPositive && <TrendingUp className="w-3.5 h-3.5 text-mint-400" />}
      {isNegative && <TrendingDown className="w-3.5 h-3.5 text-punch-400" />}
      <span
        className={`font-mono text-sm ${
          isPositive ? 'text-mint-300' : isNegative ? 'text-punch-300' : 'text-ink-500'
        }`}
      >
        {isPositive ? '+' : ''}{value}
      </span>
    </div>
  )
}
