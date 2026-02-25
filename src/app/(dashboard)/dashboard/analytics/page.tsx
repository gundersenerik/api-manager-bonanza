'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  Activity,
  Zap,
  Users,
  AlertCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, SportBadge } from '@/components/ui/Badge'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  AnalyticsResponse,
  GameComparisonMetric,
} from '@/types'

type TimeRange = '7d' | '30d' | 'all'

// Design token colors for charts
const CHART_COLORS = {
  electric: '#6366f1',
  mint: '#34d399',
  punch: '#f43f5e',
  solar: '#f59e0b',
  ocean: '#38bdf8',
  ink300: '#94a3b8',
  ink600: '#475569',
  ink700: '#334155',
  ink800: '#1e293b',
}

const GAME_PALETTE = [
  CHART_COLORS.electric,
  CHART_COLORS.mint,
  CHART_COLORS.solar,
  CHART_COLORS.ocean,
  CHART_COLORS.punch,
  '#a78bfa', // violet
  '#fb923c', // orange
  '#2dd4bf', // teal
]

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// Custom tooltip component for consistent dark theme
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-ink-800 border border-ink-600/50 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-ink-400 mb-1.5 font-medium">
        {typeof label === 'string' && label.match(/^\d{4}-\d{2}-\d{2}$/) ? formatDateShort(label) : label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-ink-300">{entry.name}:</span>
          <span className="text-ink-50 font-medium font-mono">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  const fetchAnalytics = async (range: TimeRange) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error || 'Failed to load analytics')
      }
    } catch (err) {
      console.error('Analytics fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics(timeRange)
  }, [timeRange])

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!data) return null
    const totalSyncs = data.sync_health.reduce((s, d) => s + d.total, 0)
    const totalFailures = data.sync_health.reduce((s, d) => s + d.failed, 0)
    const avgSuccessRate = totalSyncs > 0 ? Math.round(((totalSyncs - totalFailures) / totalSyncs) * 100) : 100
    const totalTriggers = data.trigger_timeline.reduce((s, d) => s + d.triggered + d.failed + d.skipped, 0)
    const totalUsers = data.game_comparison.reduce((s, g) => s + g.total_users, 0)
    return { totalSyncs, totalFailures, avgSuccessRate, totalTriggers, totalUsers }
  }, [data])

  const hasData = data && (
    data.sync_health.length > 0 ||
    data.trigger_timeline.length > 0 ||
    data.user_trends.length > 0
  )

  if (loading && !data) {
    return <LoadingScreen message="Loading analytics..." />
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Trends and insights across all games"
        actions={
          <div className="flex items-center gap-2">
            {/* Time range pills */}
            <div className="flex items-center bg-ink-800/60 rounded-xl p-1 border border-ink-600/30">
              {(['7d', '30d', 'all'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    timeRange === range
                      ? 'bg-electric/20 text-electric-300 ring-1 ring-electric/30'
                      : 'text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {range === 'all' ? 'All time' : range}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              icon={RefreshCw}
              size="sm"
              onClick={() => fetchAnalytics(timeRange)}
              disabled={loading}
            >
              Refresh
            </Button>
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
            <p className="text-punch font-medium">Failed to load analytics</p>
            <p className="text-punch/70 text-sm">{error}</p>
          </div>
          <button
            onClick={() => fetchAnalytics(timeRange)}
            className="ml-auto px-3 py-1.5 text-sm bg-punch/20 hover:bg-punch/30 text-punch rounded-lg transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {!error && !hasData && !loading && (
        <Card>
          <div className="p-8">
            <EmptyState
              icon={BarChart3}
              title="No analytics data yet"
              description="Analytics will appear here once games start syncing and triggers fire"
            />
          </div>
        </Card>
      )}

      {hasData && data && summaryStats && (
        <>
          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <SummaryCard
              icon={RefreshCw}
              label="Total Syncs"
              value={summaryStats.totalSyncs}
              color="ocean"
              delay={0}
            />
            <SummaryCard
              icon={TrendingUp}
              label="Success Rate"
              value={`${summaryStats.avgSuccessRate}%`}
              color={summaryStats.avgSuccessRate >= 95 ? 'mint' : summaryStats.avgSuccessRate >= 80 ? 'solar' : 'punch'}
              delay={0.05}
            />
            <SummaryCard
              icon={AlertCircle}
              label="Failures"
              value={summaryStats.totalFailures}
              color={summaryStats.totalFailures > 0 ? 'punch' : 'mint'}
              delay={0.1}
            />
            <SummaryCard
              icon={Zap}
              label="Triggers Fired"
              value={summaryStats.totalTriggers}
              color="electric"
              delay={0.15}
            />
            <SummaryCard
              icon={Users}
              label="Total Users"
              value={summaryStats.totalUsers}
              color="mint"
              delay={0.2}
            />
          </div>

          {/* Chart Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Sync Health Chart */}
            {data.sync_health.length > 0 && (
              <ChartCard title="Sync Health" subtitle="Success vs failure rate" icon={Activity} delay={0}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.sync_health} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.ink700} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                    <Bar
                      dataKey="success"
                      name="Success"
                      fill={CHART_COLORS.mint}
                      radius={[3, 3, 0, 0]}
                      stackId="sync"
                    />
                    <Bar
                      dataKey="failed"
                      name="Failed"
                      fill={CHART_COLORS.punch}
                      radius={[3, 3, 0, 0]}
                      stackId="sync"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Sync Duration Chart */}
            {data.sync_duration.length > 0 && (
              <ChartCard title="Sync Duration" subtitle="Average sync time trend" icon={RefreshCw} delay={0.1}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.sync_duration}>
                    <defs>
                      <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.ocean} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.ocean} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.ink700} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                    />
                    <YAxis
                      tickFormatter={(v) => formatDuration(v)}
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="bg-ink-800 border border-ink-600/50 rounded-xl px-4 py-3 shadow-xl">
                            <p className="text-xs text-ink-400 mb-1.5 font-medium">{formatDateShort(label as string)}</p>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                                <span className="text-ink-300">Avg:</span>
                                <span className="text-ink-50 font-medium font-mono">{formatDuration(d.avg_duration_ms)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-ink-500" />
                                <span className="text-ink-300">Range:</span>
                                <span className="text-ink-50 font-mono text-xs">
                                  {formatDuration(d.min_duration_ms)} – {formatDuration(d.max_duration_ms)}
                                </span>
                              </div>
                              <div className="text-xs text-ink-500">{d.count} syncs</div>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg_duration_ms"
                      name="Avg Duration"
                      stroke={CHART_COLORS.ocean}
                      fill="url(#durationGrad)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: CHART_COLORS.ocean, stroke: CHART_COLORS.ink800, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Trigger Timeline Chart */}
            {data.trigger_timeline.length > 0 && (
              <ChartCard title="Trigger Timeline" subtitle="Campaign triggers over time" icon={Zap} delay={0.2}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.trigger_timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.ink700} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                    />
                    <YAxis
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="triggered"
                      name="Triggered"
                      stroke={CHART_COLORS.electric}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS.electric }}
                      activeDot={{ r: 5, stroke: CHART_COLORS.ink800, strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      name="Failed"
                      stroke={CHART_COLORS.punch}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CHART_COLORS.punch }}
                      activeDot={{ r: 5, stroke: CHART_COLORS.ink800, strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="skipped"
                      name="Skipped"
                      stroke={CHART_COLORS.ink300}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* User Trends Chart */}
            {data.user_trends.length > 0 && (
              <ChartCard title="Users per Game" subtitle="User count trends" icon={Users} delay={0.3}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart>
                    <defs>
                      {data.user_trends.map((series, i) => (
                        <linearGradient key={series.game_id} id={`userGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GAME_PALETTE[i % GAME_PALETTE.length]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={GAME_PALETTE[i % GAME_PALETTE.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.ink700} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                      type="category"
                      allowDuplicatedCategory={false}
                    />
                    <YAxis
                      stroke={CHART_COLORS.ink600}
                      tick={{ fontSize: 11, fill: CHART_COLORS.ink300 }}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {data.user_trends.map((series, i) => (
                      <Area
                        key={series.game_id}
                        data={series.data}
                        dataKey="value"
                        name={series.game_name}
                        type="monotone"
                        stroke={GAME_PALETTE[i % GAME_PALETTE.length]}
                        fill={`url(#userGrad-${i})`}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: CHART_COLORS.ink800, strokeWidth: 2 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* Game Comparison Table */}
          {data.game_comparison.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="overflow-hidden">
                <div className="px-6 py-4 border-b border-ink-600/20 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-electric" />
                  <h3 className="text-lg font-heading font-semibold text-ink-50">Game Comparison</h3>
                  <Badge color="ink">{timeRange === 'all' ? 'All time' : timeRange}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-ink-600/30 bg-ink-800/80">
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Game</th>
                        <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Sport</th>
                        <th className="px-6 py-3.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Users</th>
                        <th className="px-6 py-3.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Syncs</th>
                        <th className="px-6 py-3.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Failures</th>
                        <th className="px-6 py-3.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Avg Duration</th>
                        <th className="px-6 py-3.5 text-right text-xs font-medium text-ink-400 uppercase tracking-wider">Triggers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-600/20">
                      {data.game_comparison
                        .sort((a, b) => b.total_users - a.total_users)
                        .map((game, index) => (
                          <GameComparisonRow key={game.game_id} game={game} index={index} />
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
  delay: number
}) {
  const colorClasses: Record<string, string> = {
    electric: 'text-electric bg-electric/10 ring-electric/20',
    mint: 'text-mint bg-mint/10 ring-mint/20',
    punch: 'text-punch bg-punch/10 ring-punch/20',
    solar: 'text-solar bg-solar/10 ring-solar/20',
    ocean: 'text-ocean bg-ocean/10 ring-ocean/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card hover={false} className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ring-1 ${colorClasses[color] || colorClasses.electric}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-2xl font-heading font-bold text-ink-50">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-ink-400">{label}</p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  delay,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card hover={false}>
        <div className="px-6 pt-5 pb-2 flex items-center gap-2">
          <Icon className="w-4.5 h-4.5 text-ink-400" />
          <div>
            <h3 className="text-sm font-semibold text-ink-100">{title}</h3>
            <p className="text-xs text-ink-500">{subtitle}</p>
          </div>
        </div>
        <div className="px-2 pb-4">
          {children}
        </div>
      </Card>
    </motion.div>
  )
}

function GameComparisonRow({ game, index }: { game: GameComparisonMetric; index: number }) {
  const failureRate = game.syncs_count > 0
    ? ((game.sync_failures / game.syncs_count) * 100).toFixed(1)
    : '0'

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="hover:bg-ink-700/20 transition-colors"
    >
      <td className="px-6 py-4">
        <div className="font-medium text-ink-50">{game.game_name}</div>
        <div className="text-xs text-ink-500 font-mono">{game.game_key}</div>
      </td>
      <td className="px-6 py-4">
        <SportBadge sport={game.sport_type} />
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm font-medium text-ink-200">{game.total_users.toLocaleString()}</span>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm text-ink-200">{game.syncs_count.toLocaleString()}</span>
      </td>
      <td className="px-6 py-4 text-right">
        {game.sync_failures > 0 ? (
          <span className="text-sm text-punch font-medium">
            {game.sync_failures} <span className="text-xs text-ink-500">({failureRate}%)</span>
          </span>
        ) : (
          <span className="text-sm text-mint">0</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <span className="text-sm text-ink-300 font-mono">
          {game.avg_sync_duration_ms > 0 ? formatDuration(game.avg_sync_duration_ms) : '–'}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="text-sm text-ink-200">
          {game.triggers_fired}
          {game.trigger_failures > 0 && (
            <span className="text-punch ml-1 text-xs">({game.trigger_failures} failed)</span>
          )}
        </div>
      </td>
    </motion.tr>
  )
}
