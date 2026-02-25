import { jsonResponse, errorResponse, requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase/server'
import { Game } from '@/types'
import { log } from '@/lib/logger'

export const dynamic = 'force-dynamic'

type SyncPriority = 'critical' | 'routine' | 'overdue' | 'idle'

interface GameSyncSchedule {
  game_id: string
  game_name: string
  game_key: string
  sport_type: string
  is_active: boolean
  /** When it was last synced */
  last_synced_at: string | null
  /** Minutes since the last sync */
  minutes_since_sync: number | null
  /** Configured sync interval in minutes */
  sync_interval_minutes: number
  /** Expected next sync time (ISO) */
  next_sync_at: string
  /** Minutes until next sync (negative = overdue) */
  minutes_until_sync: number
  /** Sync priority category */
  priority: SyncPriority
  /** Human-readable reason for priority */
  priority_reason: string
  /** Current round state info */
  round_info: {
    current_round: number
    total_rounds: number
    round_state: string | null
    current_round_start: string | null
    current_round_end: string | null
    next_trade_deadline: string | null
  }
  /** Is the game currently in a critical sync period? */
  in_critical_period: boolean
  /** Active critical period details (if any) */
  critical_period?: {
    type: 'round_starting' | 'trade_deadline' | 'round_ended'
    label: string
    event_time: string
    minutes_until_event: number
  }
}

/**
 * Check if a game is in a critical sync period
 */
function getCriticalPeriod(game: Game): GameSyncSchedule['critical_period'] | null {
  const now = new Date()

  // Check if round is starting within 2 hours
  if (game.current_round_start) {
    const roundStart = new Date(game.current_round_start)
    const minutesUntil = (roundStart.getTime() - now.getTime()) / (1000 * 60)

    if (minutesUntil > 0 && minutesUntil <= 120) {
      return {
        type: 'round_starting',
        label: `Round ${game.current_round} starting in ${Math.round(minutesUntil)} min`,
        event_time: game.current_round_start,
        minutes_until_event: Math.round(minutesUntil),
      }
    }
  }

  // Check if trade deadline is within 2 hours
  if (game.next_trade_deadline) {
    const deadline = new Date(game.next_trade_deadline)
    const minutesUntil = (deadline.getTime() - now.getTime()) / (1000 * 60)

    if (minutesUntil > 0 && minutesUntil <= 120) {
      return {
        type: 'trade_deadline',
        label: `Trade deadline in ${Math.round(minutesUntil)} min`,
        event_time: game.next_trade_deadline,
        minutes_until_event: Math.round(minutesUntil),
      }
    }
  }

  // Check if round ended within last hour
  if (game.current_round_end && (game.round_state === 'Ended' || game.round_state === 'EndedLastest')) {
    const roundEnd = new Date(game.current_round_end)
    const minutesSince = (now.getTime() - roundEnd.getTime()) / (1000 * 60)

    if (minutesSince >= 0 && minutesSince <= 60) {
      return {
        type: 'round_ended',
        label: `Round ended ${Math.round(minutesSince)} min ago`,
        event_time: game.current_round_end,
        minutes_until_event: -Math.round(minutesSince),
      }
    }
  }

  return null
}

/**
 * GET /api/admin/sync-schedule
 * Returns the sync schedule for all active games with timing, priority, and critical period info
 */
export async function GET() {
  const authError = await requireAdminAuth()
  if (authError) return authError

  try {
    const admin = supabaseAdmin()
    const now = new Date()

    const { data: games, error } = await admin
      .from('games')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      log.api.error({ err: error }, 'Failed to fetch games for sync schedule')
      return errorResponse('Failed to fetch games', 500)
    }

    const schedule: GameSyncSchedule[] = (games || []).map((game: Game) => {
      const lastSynced = game.last_synced_at ? new Date(game.last_synced_at) : null
      const minutesSinceSync = lastSynced
        ? (now.getTime() - lastSynced.getTime()) / (1000 * 60)
        : null

      // Calculate next sync time
      const nextSyncTime = lastSynced
        ? new Date(lastSynced.getTime() + game.sync_interval_minutes * 60 * 1000)
        : now // Never synced → due now

      const minutesUntilSync = (nextSyncTime.getTime() - now.getTime()) / (1000 * 60)

      // Determine critical period
      const criticalPeriod = game.is_active ? getCriticalPeriod(game) : null
      const inCriticalPeriod = criticalPeriod !== null

      // Determine priority
      let priority: SyncPriority
      let priorityReason: string

      if (!game.is_active) {
        priority = 'idle'
        priorityReason = 'Game is inactive'
      } else if (inCriticalPeriod) {
        priority = 'critical'
        priorityReason = criticalPeriod!.label
      } else if (minutesUntilSync <= 0) {
        priority = 'overdue'
        priorityReason = `Overdue by ${Math.abs(Math.round(minutesUntilSync))} min`
      } else {
        priority = 'routine'
        priorityReason = `Next sync in ${Math.round(minutesUntilSync)} min`
      }

      return {
        game_id: game.id,
        game_name: game.name,
        game_key: game.game_key,
        sport_type: game.sport_type,
        is_active: game.is_active,
        last_synced_at: game.last_synced_at,
        minutes_since_sync: minutesSinceSync !== null ? Math.round(minutesSinceSync) : null,
        sync_interval_minutes: game.sync_interval_minutes,
        next_sync_at: nextSyncTime.toISOString(),
        minutes_until_sync: Math.round(minutesUntilSync),
        priority,
        priority_reason: priorityReason,
        round_info: {
          current_round: game.current_round,
          total_rounds: game.total_rounds,
          round_state: game.round_state,
          current_round_start: game.current_round_start,
          current_round_end: game.current_round_end,
          next_trade_deadline: game.next_trade_deadline,
        },
        in_critical_period: inCriticalPeriod,
        ...(criticalPeriod ? { critical_period: criticalPeriod } : {}),
      }
    })

    // Sort: critical first, then overdue, then routine by soonest, then idle
    const priorityOrder: Record<SyncPriority, number> = { critical: 0, overdue: 1, routine: 2, idle: 3 }
    schedule.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      return a.minutes_until_sync - b.minutes_until_sync
    })

    return jsonResponse({
      success: true,
      data: {
        schedule,
        generated_at: now.toISOString(),
      },
    }, 200, { cache: false })
  } catch (error) {
    log.api.error({ err: error }, 'Sync schedule generation failed')
    return errorResponse('Failed to generate sync schedule', 500)
  }
}
