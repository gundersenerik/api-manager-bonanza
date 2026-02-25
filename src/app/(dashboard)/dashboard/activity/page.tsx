'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Gamepad2,
  Info,
  RefreshCw,
  Settings,
  User,
  XCircle,
  Zap,
} from 'lucide-react'
import { ActivityFeedItem, Game } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { Button } from '@/components/ui/Button'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, exportJson } from '@/lib/csv-export'

type TypeFilter = 'all' | 'sync' | 'trigger' | 'admin_action'
type SeverityFilter = 'all' | 'info' | 'success' | 'warning' | 'error'

// Icons for each activity type
const typeIconMap: Record<string, typeof Activity> = {
  sync: RefreshCw,
  trigger: Zap,
  admin_action: Settings,
}

// Severity styling
const severityConfig = {
  info: {
    icon: Info,
    color: 'text-ink-400',
    bg: 'bg-ink-600/20',
    ring: 'ring-ink-600/30',
    dot: 'bg-ink-400',
    badge: 'ink' as const,
  },
  success: {
    icon: CheckCircle2,
    color: 'text-mint',
    bg: 'bg-mint/10',
    ring: 'ring-mint/20',
    dot: 'bg-mint',
    badge: 'mint' as const,
  },
  warning: {
    icon: AlertCircle,
    color: 'text-solar',
    bg: 'bg-solar/10',
    ring: 'ring-solar/20',
    dot: 'bg-solar',
    badge: 'solar' as const,
  },
  error: {
    icon: XCircle,
    color: 'text-punch',
    bg: 'bg-punch/10',
    ring: 'ring-punch/20',
    dot: 'bg-punch',
    badge: 'punch' as const,
  },
}

// Group items by date
function groupByDate(items: ActivityFeedItem[]): { label: string; date: string; items: ActivityFeedItem[] }[] {
  const groups = new Map<string, ActivityFeedItem[]>()

  for (const item of items) {
    const date = new Date(item.timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let key: string
    if (date.toDateString() === today.toDateString()) {
      key = 'today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'yesterday'
    } else {
      key = date.toISOString().split('T')[0] ?? date.toDateString()
    }

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => {
    let label: string
    if (key === 'today') {
      label = 'Today'
    } else if (key === 'yesterday') {
      label = 'Yesterday'
    } else if (groupItems.length > 0) {
      label = new Date(groupItems[0]!.timestamp).toLocaleDateString('sv-SE', { weekday: 'long', month: 'short', day: 'numeric' })
    } else {
      label = key
    }
    return { label, date: key, items: groupItems }
  })
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString('sv-SE')
}

const activityCsvColumns = [
  { header: 'Timestamp', accessor: (row: ActivityFeedItem) => row.timestamp },
  { header: 'Type', accessor: (row: ActivityFeedItem) => row.type },
  { header: 'Action', accessor: (row: ActivityFeedItem) => row.action },
  { header: 'Description', accessor: (row: ActivityFeedItem) => row.description },
  { header: 'Severity', accessor: (row: ActivityFeedItem) => row.severity },
  { header: 'Game', accessor: (row: ActivityFeedItem) => row.game_name || '' },
  { header: 'Actor', accessor: (row: ActivityFeedItem) => row.actor || '' },
]

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Games for filter dropdown
  const [games, setGames] = useState<{ id: string; name: string }[]>([])

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/games')
      const data = await res.json()
      if (data.success) {
        setGames((data.data || []).map((g: Game) => ({ id: g.id, name: g.name })))
      }
    } catch {
      // Non-critical
    }
  }, [])

  const fetchActivity = useCallback(async (offset = 0, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: String(offset),
        type: typeFilter,
        severity: severityFilter,
      })
      if (gameFilter !== 'all') {
        params.set('game_id', gameFilter)
      }

      const res = await fetch(`/api/admin/activity?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        const newItems: ActivityFeedItem[] = data.data.items
        if (append) {
          setItems(prev => [...prev, ...newItems])
        } else {
          setItems(newItems)
        }
        setTotal(data.data.total)
        setHasMore(data.data.has_more)
        setError(null)
      } else {
        setError(data.error || 'Failed to load activity')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [typeFilter, severityFilter, gameFilter])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  useEffect(() => {
    fetchActivity(0, false)
  }, [fetchActivity])

  const handleLoadMore = () => {
    fetchActivity(items.length, true)
  }

  // Compute type counts for badges
  const typeCounts = useMemo(() => {
    const counts = { all: items.length, sync: 0, trigger: 0, admin_action: 0 }
    items.forEach(item => {
      if (item.type in counts) {
        counts[item.type as keyof typeof counts]++
      }
    })
    return counts
  }, [items])

  // Severity counts
  const severityCounts = useMemo(() => {
    const counts = { all: items.length, info: 0, success: 0, warning: 0, error: 0 }
    items.forEach(item => {
      counts[item.severity]++
    })
    return counts
  }, [items])

  // Group by date
  const grouped = useMemo(() => groupByDate(items), [items])

  const hasActiveFilters = typeFilter !== 'all' || severityFilter !== 'all' || gameFilter !== 'all'

  if (loading) {
    return <LoadingScreen message="Loading activity..." />
  }

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Everything that happened across your games"
        actions={
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <ExportButton
                onExportCsv={() => exportCsv(items, activityCsvColumns, 'activity-log')}
                onExportJson={() => exportJson(items, 'activity-log')}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={Filter}
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'text-electric-300' : ''}
            >
              Filters
              {hasActiveFilters && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-electric inline-block" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchActivity(0, false)}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-punch/10 border border-punch/20 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-punch flex-shrink-0" />
          <div>
            <p className="text-punch font-medium">Failed to load activity</p>
            <p className="text-punch/70 text-sm">{error}</p>
          </div>
          <button
            onClick={() => fetchActivity(0, false)}
            className="ml-auto px-3 py-1.5 text-sm bg-punch/20 hover:bg-punch/30 text-punch rounded-lg transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-6"
          >
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-6">
                {/* Type filter */}
                <div>
                  <label className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2 block">Type</label>
                  <div className="flex items-center gap-1.5">
                    {([
                      { value: 'all', label: 'All' },
                      { value: 'sync', label: 'Syncs' },
                      { value: 'trigger', label: 'Triggers' },
                      { value: 'admin_action', label: 'Admin' },
                    ] as { value: TypeFilter; label: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTypeFilter(opt.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          typeFilter === opt.value
                            ? 'bg-electric/15 text-electric-300 ring-1 ring-electric/20'
                            : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/30'
                        }`}
                      >
                        {opt.label}
                        {opt.value !== 'all' && typeCounts[opt.value as keyof typeof typeCounts] > 0 && (
                          <span className="ml-1 text-ink-500">{typeCounts[opt.value as keyof typeof typeCounts]}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Severity filter */}
                <div>
                  <label className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2 block">Severity</label>
                  <div className="flex items-center gap-1.5">
                    {([
                      { value: 'all', label: 'All' },
                      { value: 'success', label: 'Success' },
                      { value: 'info', label: 'Info' },
                      { value: 'warning', label: 'Warning' },
                      { value: 'error', label: 'Error' },
                    ] as { value: SeverityFilter; label: string }[]).map(opt => {
                      const config = opt.value !== 'all' ? severityConfig[opt.value] : null
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSeverityFilter(opt.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                            severityFilter === opt.value
                              ? 'bg-electric/15 text-electric-300 ring-1 ring-electric/20'
                              : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/30'
                          }`}
                        >
                          {config && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />}
                          {opt.label}
                          {opt.value !== 'all' && severityCounts[opt.value] > 0 && (
                            <span className="text-ink-500">{severityCounts[opt.value]}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Game filter */}
                {games.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-ink-500 uppercase tracking-wider mb-2 block">Game</label>
                    <div className="relative">
                      <select
                        value={gameFilter}
                        onChange={(e) => setGameFilter(e.target.value)}
                        className="
                          appearance-none bg-ink-700/50 text-sm text-ink-200
                          border border-ink-600/50 rounded-lg px-3 py-1.5 pr-8
                          focus:outline-none focus:ring-2 focus:ring-electric/50 focus:border-electric/50
                          transition-all cursor-pointer
                        "
                      >
                        <option value="all">All Games</option>
                        {games.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setTypeFilter('all')
                        setSeverityFilter('all')
                        setGameFilter('all')
                      }}
                      className="text-xs text-ink-500 hover:text-ink-300 transition-colors pb-1"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary stats */}
      {!error && items.length > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Activity className="w-4 h-4" />
            <span>{total} events</span>
          </div>
          {severityCounts.error > 0 && (
            <Badge color="punch" icon={XCircle}>{severityCounts.error} errors</Badge>
          )}
          {severityCounts.success > 0 && (
            <Badge color="mint" icon={CheckCircle2}>{severityCounts.success} succeeded</Badge>
          )}
        </div>
      )}

      {/* Empty state */}
      {!error && items.length === 0 && !loading && (
        <Card>
          <div className="p-8">
            <EmptyState
              icon={Activity}
              title="No activity yet"
              description={hasActiveFilters
                ? 'No events match your current filters. Try adjusting or clearing them.'
                : 'Activity will appear here as syncs run, triggers fire, and changes are made.'}
              action={hasActiveFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTypeFilter('all')
                    setSeverityFilter('all')
                    setGameFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined}
            />
          </div>
        </Card>
      )}

      {/* Activity Timeline */}
      {!error && items.length > 0 && (
        <div className="space-y-8">
          {grouped.map((group, groupIdx) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-semibold text-ink-300">{group.label}</h3>
                <div className="flex-1 h-px bg-ink-600/30" />
                <span className="text-xs text-ink-500">{group.items.length} events</span>
              </div>

              {/* Items */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-ink-600/30" />

                <div className="space-y-1">
                  {group.items.map((item, itemIdx) => {
                    const severity = severityConfig[item.severity]
                    const TypeIcon = typeIconMap[item.type] || Activity
                    const globalIdx = groupIdx * 100 + itemIdx

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(globalIdx * 0.02, 0.5), duration: 0.3 }}
                        className="group relative flex gap-4 py-2.5 pl-1"
                      >
                        {/* Timeline dot */}
                        <div className={`
                          relative z-10 flex items-center justify-center
                          w-[38px] h-[38px] rounded-xl flex-shrink-0
                          ${severity.bg} ring-1 ${severity.ring}
                          transition-all group-hover:scale-105
                        `}>
                          <TypeIcon className={`w-4 h-4 ${severity.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-ink-100 leading-relaxed">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {item.game_name && (
                                  <Link
                                    href={item.game_id ? `/dashboard/games/${item.game_id}` : '#'}
                                    className="inline-flex items-center gap-1 text-xs text-ink-400 hover:text-electric-300 transition-colors"
                                  >
                                    <Gamepad2 className="w-3 h-3" />
                                    {item.game_name}
                                  </Link>
                                )}
                                {item.actor && (
                                  <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                                    <User className="w-3 h-3" />
                                    {item.actor}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(item.timestamp)}
                                </span>
                              </div>
                            </div>

                            {/* Right side: relative time + severity badge */}
                            <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                              <span className="text-xs text-ink-500 hidden sm:block">
                                {formatRelativeTime(item.timestamp)}
                              </span>
                              <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                            </div>
                          </div>

                          {/* Metadata chips */}
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {item.metadata.users_synced !== undefined && (
                                <span className="text-xs px-2 py-0.5 bg-ink-700/30 rounded text-ink-400">
                                  {String(item.metadata.users_synced)} users
                                </span>
                              )}
                              {item.metadata.elements_synced !== undefined && (
                                <span className="text-xs px-2 py-0.5 bg-ink-700/30 rounded text-ink-400">
                                  {String(item.metadata.elements_synced)} elements
                                </span>
                              )}
                              {item.metadata.round_index !== undefined && (
                                <span className="text-xs px-2 py-0.5 bg-ink-700/30 rounded text-ink-400">
                                  Round {String(item.metadata.round_index)}
                                </span>
                              )}
                              {typeof item.metadata.trigger_type === 'string' && (
                                <span className="text-xs px-2 py-0.5 bg-ink-700/30 rounded text-ink-400">
                                  {String(item.metadata.trigger_type).replace(/_/g, ' ')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                icon={loadingMore ? RefreshCw : ArrowRight}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : `Load more (${items.length} of ${total})`}
              </Button>
            </div>
          )}

          {/* End marker */}
          {!hasMore && items.length > 0 && (
            <div className="flex items-center gap-3 py-4">
              <div className="flex-1 h-px bg-ink-600/20" />
              <span className="text-xs text-ink-600">
                {total === items.length ? `All ${total} events` : `${items.length} of ${total} events`}
              </span>
              <div className="flex-1 h-px bg-ink-600/20" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
