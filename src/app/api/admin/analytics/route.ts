import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { log } from '@/lib/logger'
import {
  AnalyticsResponse,
  AnalyticsGameSeries,
  SyncHealthPoint,
  SyncDurationPoint,
  TriggerTimelinePoint,
  GameComparisonMetric,
} from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/analytics
 * Aggregated analytics data for charts and dashboards.
 *
 * Query params:
 * - range: '7d' | '30d' | 'all' (default '30d')
 */
export async function GET(request: Request) {
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    const url = new URL(request.url)
    const range = (url.searchParams.get('range') || '30d') as '7d' | '30d' | 'all'

    const admin = supabaseAdmin()

    // Calculate date boundary
    const now = new Date()
    let dateFrom: string | null = null
    if (range === '7d') {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (range === '30d') {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    // Fetch all data in parallel
    const [
      games,
      syncLogs,
      triggerLogs,
      userStats,
    ] = await Promise.all([
      fetchGames(admin),
      fetchSyncLogs(admin, dateFrom),
      fetchTriggerLogs(admin, dateFrom),
      fetchUserStats(admin),
    ])

    // 1. User trends (per game, daily user counts from user_game_stats)
    const userTrends = buildUserTrends(userStats, games, dateFrom)

    // 2. Sync health (daily success/failure rates)
    const syncHealth = buildSyncHealth(syncLogs, dateFrom)

    // 3. Sync duration trends (daily avg duration)
    const syncDuration = buildSyncDuration(syncLogs, dateFrom)

    // 4. Trigger timeline (daily trigger counts)
    const triggerTimeline = buildTriggerTimeline(triggerLogs, dateFrom)

    // 5. Game comparison metrics
    const gameComparison = buildGameComparison(games, syncLogs, triggerLogs)

    const response: AnalyticsResponse = {
      time_range: range,
      user_trends: userTrends,
      sync_health: syncHealth,
      sync_duration: syncDuration,
      trigger_timeline: triggerTimeline,
      game_comparison: gameComparison,
    }

    return jsonResponse({ success: true, data: response }, 200, { cache: false })
  } catch (error) {
    log.api.error({ err: error }, 'Analytics endpoint failed')
    return errorResponse('Failed to load analytics data', 500)
  }
}

// ============================================
// Data Fetching
// ============================================

interface GameRow {
  id: string
  name: string
  game_key: string
  sport_type: string
  users_total: number | null
  is_active: boolean
}

interface SyncLogRow {
  id: string
  game_id: string
  status: string
  started_at: string
  completed_at: string | null
}

interface TriggerLogRow {
  id: string
  game_id: string
  trigger_type: string
  status: string
  triggered_at: string
}

interface UserStatRow {
  game_id: string
  synced_at: string
}

async function fetchGames(admin: ReturnType<typeof supabaseAdmin>): Promise<GameRow[]> {
  const { data, error } = await admin
    .from('games')
    .select('id, name, game_key, sport_type, users_total, is_active')
    .order('name')

  if (error) {
    log.api.warn({ err: error }, 'Failed to fetch games for analytics')
    return []
  }
  return data || []
}

async function fetchSyncLogs(admin: ReturnType<typeof supabaseAdmin>, dateFrom: string | null): Promise<SyncLogRow[]> {
  let query = admin
    .from('sync_logs')
    .select('id, game_id, status, started_at, completed_at')
    .order('started_at', { ascending: true })

  if (dateFrom) {
    query = query.gte('started_at', dateFrom)
  }

  const { data, error } = await query
  if (error) {
    log.api.warn({ err: error }, 'Failed to fetch sync logs for analytics')
    return []
  }
  return data || []
}

async function fetchTriggerLogs(admin: ReturnType<typeof supabaseAdmin>, dateFrom: string | null): Promise<TriggerLogRow[]> {
  let query = admin
    .from('trigger_logs')
    .select('id, game_id, trigger_type, status, triggered_at')
    .order('triggered_at', { ascending: true })

  if (dateFrom) {
    query = query.gte('triggered_at', dateFrom)
  }

  const { data, error } = await query
  if (error) {
    log.api.warn({ err: error }, 'Failed to fetch trigger logs for analytics')
    return []
  }
  return data || []
}

async function fetchUserStats(admin: ReturnType<typeof supabaseAdmin>): Promise<UserStatRow[]> {
  // Get unique user counts per game per day
  // We use synced_at as an approximation of when the user data was captured
  const { data, error } = await admin
    .from('user_game_stats')
    .select('game_id, synced_at')
    .order('synced_at', { ascending: true })
    .limit(10000) // Reasonable limit

  if (error) {
    log.api.warn({ err: error }, 'Failed to fetch user stats for analytics')
    return []
  }
  return data || []
}

// ============================================
// Analytics Builders
// ============================================

function toDateString(isoDate: string): string {
  return isoDate.substring(0, 10)
}

function buildUserTrends(
  userStats: UserStatRow[],
  games: GameRow[],
  dateFrom: string | null
): AnalyticsGameSeries[] {
  // Group user counts by game and date
  const gameUsersByDate = new Map<string, Map<string, Set<string>>>()

  for (const stat of userStats) {
    if (dateFrom && stat.synced_at < dateFrom) continue

    const date = toDateString(stat.synced_at)
    if (!gameUsersByDate.has(stat.game_id)) {
      gameUsersByDate.set(stat.game_id, new Map())
    }
    const dateMap = gameUsersByDate.get(stat.game_id)!
    if (!dateMap.has(date)) {
      dateMap.set(date, new Set())
    }
    // We use the stat entry itself as a unique user marker
    dateMap.get(date)!.add(stat.game_id + date)
  }

  // If no user stats data, fall back to current game totals
  if (gameUsersByDate.size === 0) {
    return games
      .filter((g) => (g.users_total || 0) > 0)
      .map((g) => ({
        game_id: g.id,
        game_name: g.name,
        game_key: g.game_key,
        sport_type: g.sport_type,
        data: [{ date: toDateString(new Date().toISOString()), value: g.users_total || 0 }],
      }))
  }

  return games
    .filter((g) => gameUsersByDate.has(g.id))
    .map((g) => {
      const dateMap = gameUsersByDate.get(g.id)!
      const data = Array.from(dateMap.entries())
        .map(([date, users]) => ({
          date,
          value: users.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      return {
        game_id: g.id,
        game_name: g.name,
        game_key: g.game_key,
        sport_type: g.sport_type,
        data,
      }
    })
}

function buildSyncHealth(syncLogs: SyncLogRow[], dateFrom: string | null): SyncHealthPoint[] {
  const dailyMap = new Map<string, { success: number; failed: number }>()

  for (const log of syncLogs) {
    if (dateFrom && log.started_at < dateFrom) continue
    const date = toDateString(log.started_at)
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { success: 0, failed: 0 })
    }
    const day = dailyMap.get(date)!
    if (log.status === 'completed') {
      day.success++
    } else if (log.status === 'failed') {
      day.failed++
    }
  }

  return Array.from(dailyMap.entries())
    .map(([date, counts]) => {
      const total = counts.success + counts.failed
      return {
        date,
        success: counts.success,
        failed: counts.failed,
        total,
        success_rate: total > 0 ? Math.round((counts.success / total) * 100) : 100,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildSyncDuration(syncLogs: SyncLogRow[], dateFrom: string | null): SyncDurationPoint[] {
  const dailyDurations = new Map<string, number[]>()

  for (const log of syncLogs) {
    if (dateFrom && log.started_at < dateFrom) continue
    if (!log.completed_at) continue

    const date = toDateString(log.started_at)
    const durationMs = new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()
    if (durationMs < 0) continue

    if (!dailyDurations.has(date)) {
      dailyDurations.set(date, [])
    }
    dailyDurations.get(date)!.push(durationMs)
  }

  return Array.from(dailyDurations.entries())
    .map(([date, durations]) => ({
      date,
      avg_duration_ms: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      min_duration_ms: Math.min(...durations),
      max_duration_ms: Math.max(...durations),
      count: durations.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildTriggerTimeline(triggerLogs: TriggerLogRow[], dateFrom: string | null): TriggerTimelinePoint[] {
  const dailyMap = new Map<string, { triggered: number; failed: number; skipped: number }>()

  for (const log of triggerLogs) {
    if (dateFrom && log.triggered_at < dateFrom) continue
    const date = toDateString(log.triggered_at)
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { triggered: 0, failed: 0, skipped: 0 })
    }
    const day = dailyMap.get(date)!
    if (log.status === 'triggered') {
      day.triggered++
    } else if (log.status === 'failed') {
      day.failed++
    } else {
      day.skipped++
    }
  }

  return Array.from(dailyMap.entries())
    .map(([date, counts]) => ({
      date,
      ...counts,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildGameComparison(
  games: GameRow[],
  syncLogs: SyncLogRow[],
  triggerLogs: TriggerLogRow[],
): GameComparisonMetric[] {
  // Aggregate sync data per game
  const syncByGame = new Map<string, { count: number; failures: number; durations: number[] }>()
  for (const log of syncLogs) {
    if (!syncByGame.has(log.game_id)) {
      syncByGame.set(log.game_id, { count: 0, failures: 0, durations: [] })
    }
    const agg = syncByGame.get(log.game_id)!
    agg.count++
    if (log.status === 'failed') agg.failures++
    if (log.completed_at) {
      const dur = new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()
      if (dur >= 0) agg.durations.push(dur)
    }
  }

  // Aggregate trigger data per game
  const triggerByGame = new Map<string, { fired: number; failures: number }>()
  for (const log of triggerLogs) {
    if (!triggerByGame.has(log.game_id)) {
      triggerByGame.set(log.game_id, { fired: 0, failures: 0 })
    }
    const agg = triggerByGame.get(log.game_id)!
    if (log.status === 'triggered') agg.fired++
    if (log.status === 'failed') agg.failures++
  }

  return games.map((g) => {
    const sync = syncByGame.get(g.id) || { count: 0, failures: 0, durations: [] }
    const trigger = triggerByGame.get(g.id) || { fired: 0, failures: 0 }
    const avgDur = sync.durations.length > 0
      ? Math.round(sync.durations.reduce((a, b) => a + b, 0) / sync.durations.length)
      : 0

    return {
      game_id: g.id,
      game_name: g.name,
      game_key: g.game_key,
      sport_type: g.sport_type,
      total_users: g.users_total || 0,
      syncs_count: sync.count,
      sync_failures: sync.failures,
      avg_sync_duration_ms: avgDur,
      triggers_fired: trigger.fired,
      trigger_failures: trigger.failures,
    }
  })
}
